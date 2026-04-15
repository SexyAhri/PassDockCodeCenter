package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"gorm.io/gorm"

	"passdock/server/internal/model"
)

const orderLifecycleSweepBatchSize = 100

type OrderLifecycleSweepResult struct {
	ExpiredOrders        int `json:"expired_orders"`
	FailedPaymentReviews int `json:"failed_payment_reviews"`
}

func (s *Service) StartBackgroundWorkers(ctx context.Context) {
	s.workerOnce.Do(func() {
		go s.runOrderLifecycleSweeper(ctx)
		go s.runAsyncJobWorker(ctx)
		go s.runOKXWatcher(ctx)
	})
}

func (s *Service) runOrderLifecycleSweeper(ctx context.Context) {
	if ctx == nil {
		ctx = context.Background()
	}

	s.executeOrderLifecycleSweep(ctx)

	for {
		interval := time.Duration(maxInt(s.orderSweepIntervalSeconds(ctx), 30)) * time.Second
		timer := time.NewTimer(interval)

		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
			s.executeOrderLifecycleSweep(ctx)
		}
	}
}

func (s *Service) executeOrderLifecycleSweep(ctx context.Context) {
	result, err := s.RunOrderLifecycleSweep(ctx)
	if err != nil {
		log.Printf("passdock: order lifecycle sweep failed: %v", err)
		return
	}

	if result.ExpiredOrders == 0 && result.FailedPaymentReviews == 0 {
		return
	}

	log.Printf(
		"passdock: order lifecycle sweep advanced expired=%d review_failed=%d",
		result.ExpiredOrders,
		result.FailedPaymentReviews,
	)
}

func (s *Service) RunOrderLifecycleSweep(ctx context.Context) (OrderLifecycleSweepResult, error) {
	now := time.Now()
	result := OrderLifecycleSweepResult{}

	expiredCount, err := s.sweepExpiredOrders(ctx, now)
	if err != nil {
		return result, err
	}
	result.ExpiredOrders = expiredCount

	reviewFailedCount, err := s.sweepOverduePaymentReviews(ctx, now)
	if err != nil {
		return result, err
	}
	result.FailedPaymentReviews = reviewFailedCount

	return result, nil
}

func (s *Service) sweepExpiredOrders(ctx context.Context, now time.Time) (int, error) {
	total := 0

	for {
		var orderNos []string
		if err := s.db.WithContext(ctx).
			Model(&model.Order{}).
			Where("status = ? AND expire_at IS NOT NULL AND expire_at <= ?", "awaiting_payment", now).
			Order("expire_at ASC, id ASC").
			Limit(orderLifecycleSweepBatchSize).
			Pluck("order_no", &orderNos).Error; err != nil {
			return total, err
		}
		if len(orderNos) == 0 {
			return total, nil
		}

		for _, orderNo := range orderNos {
			if err := s.ExpireOrder(ctx, orderNo); err != nil {
				if err == ErrInvalidState || err == ErrNotFound {
					continue
				}
				return total, err
			}
			total++
		}

		if len(orderNos) < orderLifecycleSweepBatchSize {
			return total, nil
		}
	}
}

func (s *Service) sweepOverduePaymentReviews(ctx context.Context, now time.Time) (int, error) {
	total := 0

	for {
		var orders []model.Order
		if err := s.db.WithContext(ctx).
			Model(&model.Order{}).
			Where("payment_status = ? OR status = ?", "pending_review", "paid_pending_review").
			Order("paid_at ASC, id ASC").
			Limit(orderLifecycleSweepBatchSize).
			Find(&orders).Error; err != nil {
			return total, err
		}
		if len(orders) == 0 {
			return total, nil
		}

		advancedInBatch := 0
		for _, order := range orders {
			if _, overdue := paymentReviewDeadlineWithTimeoutAt(&order, s.paymentReviewTimeoutMinutes(ctx), now); !overdue {
				continue
			}
			if err := s.FailOrderPaymentReviewTimeout(ctx, order.OrderNo, now); err != nil {
				if err == ErrInvalidState || err == ErrNotFound {
					continue
				}
				return total, err
			}
			total++
			advancedInBatch++
		}

		if len(orders) < orderLifecycleSweepBatchSize || advancedInBatch == 0 {
			return total, nil
		}
	}
}

func (s *Service) FailOrderPaymentReviewTimeout(ctx context.Context, orderNo string, now time.Time) error {
	timeoutMinutes := s.paymentReviewTimeoutMinutes(ctx)

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		order, err := s.resolveOrderByNoTx(ctx, tx, orderNo)
		if err != nil {
			return err
		}

		reviewDueAt, overdue := paymentReviewDeadlineWithTimeoutAt(order, timeoutMinutes, now)
		if !overdue {
			return ErrInvalidState
		}

		fromStatus := order.Status
		order.Status = "failed"
		order.PaymentStatus = "failed"
		order.UpdatedAt = now
		if err := tx.Save(order).Error; err != nil {
			return err
		}

		if err := tx.Model(&model.PaymentProof{}).
			Where("order_id = ? AND review_status = ?", order.ID, "pending").
			Updates(map[string]any{
				"review_status": "rejected",
				"reviewed_at":   now,
				"note":          "Payment review timeout auto-closed by system.",
			}).Error; err != nil {
			return err
		}

		if err := tx.Model(&model.PaymentRecord{}).
			Where("order_id = ?", order.ID).
			Updates(map[string]any{
				"status":    "failed",
				"failed_at": now,
				"raw_payload": jsonValue(map[string]any{
					"reason":                "payment_review_timeout",
					"timeout_minutes":       timeoutMinutes,
					"payment_review_due_at": reviewDueAt,
				}),
			}).Error; err != nil {
			return err
		}

		message := fmt.Sprintf(
			"Payment review timed out after %d minutes and the order was marked failed.",
			timeoutMinutes,
		)
		if err := tx.Create(&model.OrderEvent{
			OrderID:      order.ID,
			EventType:    "payment_review_timeout",
			FromStatus:   fromStatus,
			ToStatus:     order.Status,
			OperatorType: "system",
			PayloadJSON: jsonValue(map[string]any{
				"timeout_minutes":       timeoutMinutes,
				"payment_review_due_at": reviewDueAt,
				"paid_at":               order.PaidAt,
			}),
			CreatedAt: now,
		}).Error; err != nil {
			return err
		}

		if err := s.recordPaymentCallbackLogTx(ctx, tx, PaymentCallbackLogInput{
			OrderID:    &order.ID,
			OrderNo:    order.OrderNo,
			ChannelKey: s.channelKeyForPaymentMethod(ctx, order.PaymentMethod),
			Status:     "error",
			Message:    message,
			SourceType: "payment_review_timeout",
			RawPayload: map[string]any{
				"timeout_minutes":       timeoutMinutes,
				"payment_review_due_at": reviewDueAt,
			},
			ProcessedAt: &now,
		}); err != nil {
			return err
		}

		if _, err := s.createOrUpdateOrderFailureTicketTx(
			ctx,
			tx,
			order,
			fmt.Sprintf("Payment review timeout · %s", order.OrderNo),
			fmt.Sprintf(
				"Order %s payment review timed out.\nPaid at: %s\nReview due at: %s\nTimeout minutes: %d",
				order.OrderNo,
				formatLifecycleSweepTime(order.PaidAt),
				formatLifecycleSweepTime(reviewDueAt),
				timeoutMinutes,
			),
		); err != nil {
			return err
		}

		return nil
	})
}

func formatLifecycleSweepTime(value *time.Time) string {
	if value == nil {
		return "-"
	}

	return value.UTC().Format(time.RFC3339)
}
