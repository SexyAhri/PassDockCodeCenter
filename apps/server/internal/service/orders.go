package service

import (
	"context"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"

	"passdock/server/internal/model"
)

type AdminOrderFilters struct {
	OrderNo        string
	Status         string
	PaymentStatus  string
	DeliveryStatus string
	PaymentMethod  string
	SourceChannel  string
	Page           int
	PageSize       int
}

type ConfirmPaymentInput struct {
	PaymentMethod   string
	Amount          string
	Currency        string
	Note            string
	ThirdPartyTxnNo string
	ChainTxHash     string
	PayerAccount    string
	RawPayload      map[string]any
	SourceType      string
	SuccessMessage  string
	CallbackKey     string
}

func (s *Service) ListAdminOrders(ctx context.Context, filters AdminOrderFilters) (map[string]any, error) {
	page := filters.Page
	if page <= 0 {
		page = 1
	}

	pageSize := filters.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	query := s.db.WithContext(ctx).Model(&model.Order{})
	if filters.OrderNo != "" {
		query = query.Where("order_no LIKE ?", "%"+filters.OrderNo+"%")
	}
	if filters.Status != "" {
		query = query.Where("status = ?", filters.Status)
	}
	if filters.PaymentStatus != "" {
		query = query.Where("payment_status = ?", filters.PaymentStatus)
	}
	if filters.DeliveryStatus != "" {
		query = query.Where("delivery_status = ?", filters.DeliveryStatus)
	}
	if filters.PaymentMethod != "" {
		query = query.Where("payment_method = ?", filters.PaymentMethod)
	}
	if filters.SourceChannel != "" {
		query = query.Where("source_channel = ?", filters.SourceChannel)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	var orders []model.Order
	if err := query.
		Preload("OrderItems").
		Order("created_at DESC, id DESC").
		Limit(pageSize).
		Offset((page - 1) * pageSize).
		Find(&orders).Error; err != nil {
		return nil, err
	}

	reviewTimeoutMinutes := s.paymentReviewTimeoutMinutes(ctx)
	items := make([]map[string]any, 0, len(orders))
	for _, order := range orders {
		productName := s.orderProductName(order)
		reviewDueAt, reviewOverdue := paymentReviewDeadlineWithTimeout(&order, reviewTimeoutMinutes)
		deliverySummary, err := s.resolveOrderDeliverySummary(ctx, &order)
		if err != nil {
			return nil, err
		}
		items = append(items, map[string]any{
			"id":                             order.ID,
			"order_id":                       order.ID,
			"order_no":                       order.OrderNo,
			"product_name":                   productName,
			"product_title":                  productName,
			"customer_name":                  buildCustomerName(order),
			"buyer_name":                     buildCustomerName(order),
			"amount":                         formatAmount(order.PayAmount),
			"display_amount":                 formatAmount(order.PayAmount),
			"total_amount":                   formatAmount(order.PayAmount),
			"currency":                       order.Currency,
			"payment_method":                 order.PaymentMethod,
			"payment_status":                 order.PaymentStatus,
			"order_status":                   order.Status,
			"status":                         order.Status,
			"delivery_status":                order.DeliveryStatus,
			"delivery_channel":               deliverySummary.Channel,
			"delivery_record_id":             deliverySummary.RecordID,
			"source_channel":                 order.SourceChannel,
			"bot_key":                        orderBotKey(order),
			"buyer_ref":                      order.BuyerRef,
			"created_at":                     order.CreatedAt,
			"paid_at":                        order.PaidAt,
			"payment_review_due_at":          reviewDueAt,
			"payment_review_overdue":         reviewOverdue,
			"payment_review_timeout_minutes": reviewTimeoutMinutes,
		})
	}

	return map[string]any{
		"items":     items,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	}, nil
}

func (s *Service) GetAdminOrderDetail(ctx context.Context, orderNo string) (map[string]any, error) {
	order, err := s.resolveOrderByNo(ctx, orderNo)
	if err != nil {
		return nil, err
	}

	var events []model.OrderEvent
	if err := s.db.WithContext(ctx).
		Where("order_id = ?", order.ID).
		Order("created_at DESC, id DESC").
		Find(&events).Error; err != nil {
		return nil, err
	}

	proofs := make([]map[string]any, 0, len(order.PaymentProofs))
	for _, proof := range order.PaymentProofs {
		proofs = append(proofs, map[string]any{
			"id":            proof.ID,
			"proof_id":      proof.ID,
			"proof_type":    proof.ProofType,
			"object_key":    proof.ObjectKey,
			"object_url":    s.buildAdminPaymentProofURL(&proof),
			"review_status": proof.ReviewStatus,
			"reviewed_by":   proof.ReviewedBy,
			"reviewed_at":   proof.ReviewedAt,
			"note":          proof.Note,
			"created_at":    proof.CreatedAt,
		})
	}

	payments := make([]map[string]any, 0, len(order.PaymentRecords))
	for _, payment := range order.PaymentRecords {
		payments = append(payments, map[string]any{
			"id":                 payment.ID,
			"payment_method":     payment.PaymentMethod,
			"merchant_order_no":  payment.MerchantOrderNo,
			"third_party_txn_no": payment.ThirdPartyTxnNo,
			"chain_tx_hash":      payment.ChainTxHash,
			"payer_account":      payment.PayerAccount,
			"amount":             formatAmount(payment.Amount),
			"currency":           payment.Currency,
			"status":             payment.Status,
			"confirmed_at":       payment.ConfirmedAt,
			"failed_at":          payment.FailedAt,
		})
	}

	var refundRecords []model.RefundRecord
	if err := s.db.WithContext(ctx).
		Where("order_id = ?", order.ID).
		Order("id DESC").
		Find(&refundRecords).Error; err != nil {
		return nil, err
	}

	refunds := make([]map[string]any, 0, len(refundRecords))
	for _, refund := range refundRecords {
		refunds = append(refunds, map[string]any{
			"id":               refund.ID,
			"refund_id":        refund.ID,
			"refund_no":        refund.RefundNo,
			"refund_type":      refund.RefundType,
			"payment_method":   refund.PaymentMethod,
			"channel_key":      refund.ChannelKey,
			"provider_key":     refund.ProviderKey,
			"action_key":       refund.ActionKey,
			"amount":           formatAmount(refund.Amount),
			"currency":         refund.Currency,
			"status":           refund.Status,
			"receipt_no":       refund.ReceiptNo,
			"failure_message":  refund.FailureMessage,
			"attempt_no":       refund.AttemptNo,
			"request_payload":  redactSensitivePayload(parseJSON[map[string]any](refund.RequestPayloadJSON)),
			"response_payload": redactSensitivePayload(parseJSON[map[string]any](refund.ResponsePayloadJSON)),
			"requested_at":     refund.RequestedAt,
			"processed_at":     refund.ProcessedAt,
			"refunded_at":      refund.RefundedAt,
			"created_at":       refund.CreatedAt,
			"updated_at":       refund.UpdatedAt,
		})
	}

	orderEvents := make([]map[string]any, 0, len(events))
	for _, event := range events {
		orderEvents = append(orderEvents, map[string]any{
			"id":            event.ID,
			"event_type":    event.EventType,
			"from_status":   event.FromStatus,
			"to_status":     event.ToStatus,
			"operator_type": event.OperatorType,
			"operator_id":   event.OperatorID,
			"payload":       parseJSON[map[string]any](event.PayloadJSON),
			"created_at":    event.CreatedAt,
		})
	}

	reviewDueAt, reviewOverdue := s.paymentReviewDeadline(ctx, order)
	deliverySummary, err := s.resolveOrderDeliverySummary(ctx, order)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"id":                             order.ID,
		"order_id":                       order.ID,
		"order_no":                       order.OrderNo,
		"product_name":                   s.orderProductName(*order),
		"product_title":                  s.orderProductName(*order),
		"customer_name":                  buildCustomerName(*order),
		"buyer_name":                     buildCustomerName(*order),
		"amount":                         formatAmount(order.PayAmount),
		"display_amount":                 formatAmount(order.PayAmount),
		"total_amount":                   formatAmount(order.PayAmount),
		"currency":                       order.Currency,
		"payment_method":                 order.PaymentMethod,
		"payment_status":                 order.PaymentStatus,
		"order_status":                   order.Status,
		"status":                         order.Status,
		"delivery_status":                order.DeliveryStatus,
		"delivery_channel":               deliverySummary.Channel,
		"delivery_record_id":             deliverySummary.RecordID,
		"source_channel":                 order.SourceChannel,
		"bot_key":                        orderBotKey(*order),
		"buyer_ref":                      order.BuyerRef,
		"product_snapshot":               parseJSON[map[string]any](order.ProductSnapshot),
		"metadata":                       parseJSON[map[string]any](order.MetadataJSON),
		"payment_proofs":                 proofs,
		"payment_records":                payments,
		"refund_records":                 refunds,
		"latest_refund_status":           latestRefundField(refundRecords, func(item model.RefundRecord) string { return item.Status }),
		"latest_refund_receipt_no":       latestRefundField(refundRecords, func(item model.RefundRecord) string { return item.ReceiptNo }),
		"latest_refund_no":               latestRefundField(refundRecords, func(item model.RefundRecord) string { return item.RefundNo }),
		"events":                         orderEvents,
		"created_at":                     order.CreatedAt,
		"updated_at":                     order.UpdatedAt,
		"expire_at":                      order.ExpireAt,
		"order_expire_minutes":           s.orderExpireMinutes(ctx),
		"paid_at":                        order.PaidAt,
		"payment_review_due_at":          reviewDueAt,
		"payment_review_overdue":         reviewOverdue,
		"payment_review_timeout_minutes": s.paymentReviewTimeoutMinutes(ctx),
		"delivered_at":                   order.DeliveredAt,
		"cancelled_at":                   order.CancelledAt,
		"completed_at":                   order.CompletedAt,
	}, nil
}

type orderDeliverySummary struct {
	RecordID string
	Channel  string
}

func (s *Service) resolveOrderDeliverySummary(ctx context.Context, order *model.Order) (orderDeliverySummary, error) {
	summary := orderDeliverySummary{}
	if order == nil || order.ID == 0 {
		return summary, nil
	}

	var latest model.DeliveryRecord
	err := s.db.WithContext(ctx).
		Where("order_id = ?", order.ID).
		Order("id DESC").
		First(&latest).Error
	if err == nil {
		summary.RecordID = strconv.FormatUint(uint64(latest.ID), 10)
		summary.Channel = strings.TrimSpace(latest.DeliveryChannel)
		return summary, nil
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		return summary, err
	}

	_, deliveryStrategyKey, err := s.orderStrategyKeys(order)
	if err != nil {
		if err == ErrInvalidInput {
			return summary, nil
		}
		return summary, err
	}

	deliveryStrategy, err := s.resolveDeliveryStrategyByRoute(ctx, deliveryStrategyKey)
	if err != nil {
		if err == ErrNotFound {
			return summary, nil
		}
		return summary, err
	}

	summary.Channel = strings.TrimSpace(deliveryStrategy.ChannelType)
	return summary, nil
}

func (s *Service) ConfirmAdminOrderPayment(ctx context.Context, orderNo string, input ConfirmPaymentInput, meta AuditMeta) error {
	amount, err := parseFloat(input.Amount)
	if err != nil {
		return ErrInvalidInput
	}

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		order, err := s.resolveOrderByNoTx(ctx, tx, orderNo)
		if err != nil {
			return err
		}
		existingCallbackLog, err := s.resolvePaymentCallbackLogByCallbackKeyTx(ctx, tx, input.CallbackKey)
		if err != nil && err != ErrNotFound {
			return err
		}
		if existingCallbackLog != nil {
			if existingCallbackLog.OrderNo != "" && existingCallbackLog.OrderNo != order.OrderNo {
				return ErrInvalidState
			}
			return nil
		}

		existingExternalPayment, err := s.resolvePaymentRecordByExternalRefsTx(ctx, tx, input.ThirdPartyTxnNo, input.ChainTxHash)
		if err != nil && err != ErrNotFound {
			return err
		}
		if existingExternalPayment != nil && existingExternalPayment.OrderID != order.ID {
			return ErrInvalidState
		}
		if order.Status == "cancelled" || order.Status == "expired" || order.Status == "refunded" {
			return ErrInvalidState
		}
		if order.PaymentStatus == "paid" && order.Status != "paid_pending_review" {
			if existingExternalPayment != nil {
				return nil
			}
			if order.Status == "payment_confirmed" || order.Status == "failed" {
				// Allow operators to re-run post-payment automation when the payment
				// is already confirmed but fulfillment previously failed.
				return nil
			}
			return ErrInvalidState
		}

		now := time.Now()
		fromStatus := order.Status
		order.Status = "payment_confirmed"
		order.PaymentStatus = "paid"
		order.PaymentMethod = defaultString(input.PaymentMethod, order.PaymentMethod)
		if amount > 0 {
			order.PayAmount = amount
		}
		if input.Currency != "" {
			order.Currency = input.Currency
		}
		order.PaidAt = &now
		order.UpdatedAt = now
		if err := tx.Save(order).Error; err != nil {
			return err
		}

		if err := s.createOrUpdatePaymentRecordTx(ctx, tx, order, "paid", func(payment *model.PaymentRecord) {
			payment.ConfirmedAt = &now
			payment.MerchantOrderNo = order.OrderNo
			payment.ThirdPartyTxnNo = input.ThirdPartyTxnNo
			payment.ChainTxHash = input.ChainTxHash
			if input.PayerAccount != "" {
				payment.PayerAccount = input.PayerAccount
			}
			payment.RawPayloadJSON = jsonValue(map[string]any{
				"note":             input.Note,
				"confirmed_manual": true,
				"raw_payload":      input.RawPayload,
			})
		}); err != nil {
			return err
		}

		if err := tx.Model(&model.PaymentProof{}).
			Where("order_id = ?", order.ID).
			Updates(map[string]any{
				"review_status": "approved",
				"reviewed_by":   meta.AdminUserID,
				"reviewed_at":   now,
			}).Error; err != nil {
			return err
		}

		if err := tx.Create(&model.OrderEvent{
			OrderID:      order.ID,
			EventType:    "payment_confirmed",
			FromStatus:   fromStatus,
			ToStatus:     order.Status,
			OperatorType: "admin",
			OperatorID:   meta.AdminUserID,
			PayloadJSON: jsonValue(map[string]any{
				"payment_method": order.PaymentMethod,
				"amount":         formatAmount(order.PayAmount),
				"currency":       order.Currency,
				"note":           input.Note,
			}),
			CreatedAt: now,
		}).Error; err != nil {
			return err
		}

		if err := s.recordPaymentCallbackLogTx(ctx, tx, PaymentCallbackLogInput{
			OrderID:     &order.ID,
			OrderNo:     order.OrderNo,
			CallbackKey: input.CallbackKey,
			ChannelKey:  s.channelKeyForPaymentMethod(ctx, order.PaymentMethod),
			Status:      "success",
			Message:     defaultString(input.SuccessMessage, "Payment confirmed and order moved to the next stage."),
			SourceType:  defaultString(input.SourceType, "admin_confirm_payment"),
			RawPayload:  input.RawPayload,
			ProcessedAt: &now,
		}); err != nil {
			return err
		}

		s.logAdminAction(ctx, tx, meta, "orders", "confirm_payment", order.OrderNo, "order", input)
		return nil
	})
}

func (s *Service) RejectAdminOrderPayment(ctx context.Context, orderNo, note string, meta AuditMeta) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		order, err := s.resolveOrderByNoTx(ctx, tx, orderNo)
		if err != nil {
			return err
		}
		if order.PaymentStatus != "pending_review" {
			return ErrInvalidState
		}

		now := time.Now()
		fromStatus := order.Status
		order.Status = "awaiting_payment"
		order.PaymentStatus = "unpaid"
		order.PaidAt = nil
		order.UpdatedAt = now
		if err := tx.Save(order).Error; err != nil {
			return err
		}

		if err := tx.Model(&model.PaymentProof{}).
			Where("order_id = ?", order.ID).
			Updates(map[string]any{
				"review_status": "rejected",
				"reviewed_by":   meta.AdminUserID,
				"reviewed_at":   now,
			}).Error; err != nil {
			return err
		}

		if err := s.createOrUpdatePaymentRecordTx(ctx, tx, order, "failed", func(payment *model.PaymentRecord) {
			payment.FailedAt = &now
			payment.RawPayloadJSON = jsonValue(map[string]any{"note": note})
		}); err != nil {
			return err
		}

		if err := tx.Create(&model.OrderEvent{
			OrderID:      order.ID,
			EventType:    "payment_rejected",
			FromStatus:   fromStatus,
			ToStatus:     order.Status,
			OperatorType: "admin",
			OperatorID:   meta.AdminUserID,
			PayloadJSON:  jsonValue(map[string]any{"note": note}),
			CreatedAt:    now,
		}).Error; err != nil {
			return err
		}

		if err := s.recordPaymentCallbackLogTx(ctx, tx, PaymentCallbackLogInput{
			OrderID:     &order.ID,
			OrderNo:     order.OrderNo,
			ChannelKey:  s.channelKeyForPaymentMethod(ctx, order.PaymentMethod),
			Status:      "error",
			Message:     "Payment proof was rejected and manual recheck is required.",
			SourceType:  "admin_reject_payment",
			RawPayload:  map[string]any{"note": note},
			ProcessedAt: &now,
		}); err != nil {
			return err
		}

		s.logAdminAction(ctx, tx, meta, "orders", "reject_payment", order.OrderNo, "order", map[string]any{"note": note})
		return nil
	})
}

func (s *Service) FulfillAdminOrder(ctx context.Context, orderNo string, meta AuditMeta) error {
	var opErr error
	var inventoryReserved bool
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		order, err := s.resolveOrderByNoTx(ctx, tx, orderNo)
		if err != nil {
			return err
		}
		inventoryReserved, opErr = s.runFulfillmentForOrderTx(ctx, tx, order, meta, false)
		if opErr == nil {
			return nil
		}

		return s.persistFulfillmentFailureTx(ctx, tx, order, meta, false, inventoryReserved, opErr)
	})
	if err != nil {
		return err
	}

	return opErr
}

func (s *Service) RetryAdminOrderFulfillment(ctx context.Context, orderNo string, meta AuditMeta) error {
	var opErr error
	var inventoryReserved bool
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		order, err := s.resolveOrderByNoTx(ctx, tx, orderNo)
		if err != nil {
			return err
		}
		inventoryReserved, opErr = s.runFulfillmentForOrderTx(ctx, tx, order, meta, true)
		if opErr == nil {
			return nil
		}

		return s.persistFulfillmentFailureTx(ctx, tx, order, meta, true, inventoryReserved, opErr)
	})
	if err != nil {
		return err
	}

	return opErr
}

func (s *Service) DeliverAdminOrder(ctx context.Context, orderNo string, meta AuditMeta) error {
	var opErr error
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		order, err := s.resolveOrderByNoTx(ctx, tx, orderNo)
		if err != nil {
			return err
		}
		opErr = s.runDeliveryForOrderTx(ctx, tx, order, meta, false, false)
		if opErr == nil {
			return nil
		}

		return s.persistDeliveryFailureTx(ctx, tx, order, meta, false, false, opErr)
	})
	if err != nil {
		return err
	}

	return opErr
}

func (s *Service) CompleteAdminOrderDelivery(ctx context.Context, orderNo, note string, meta AuditMeta) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		order, err := s.resolveOrderByNoTx(ctx, tx, orderNo)
		if err != nil {
			return err
		}
		if order.Status == "cancelled" || order.Status == "expired" || order.Status == "refunded" {
			return ErrInvalidState
		}
		if order.PaymentStatus != "paid" {
			return ErrInvalidState
		}

		var record model.DeliveryRecord
		if err := tx.WithContext(ctx).
			Where("order_id = ?", order.ID).
			Order("id DESC").
			First(&record).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return ErrInvalidState
			}
			return err
		}
		if !deliveryChannelRequiresManualCompletion(record.DeliveryChannel) {
			return ErrInvalidState
		}
		if record.DeliveryStatus != "pending" && record.DeliveryStatus != "sending" {
			return ErrInvalidState
		}

		now := time.Now()
		record.DeliveryStatus = "sent"
		record.DeliveredAt = &now
		record.ErrorMessage = ""
		if err := tx.Save(&record).Error; err != nil {
			return err
		}

		fromStatus := order.Status
		order.Status = "completed"
		order.DeliveryStatus = "sent"
		order.DeliveredAt = &now
		order.CompletedAt = &now
		order.UpdatedAt = now
		if err := tx.Save(order).Error; err != nil {
			return err
		}

		if err := s.cancelPendingAsyncJobsTx(
			ctx,
			tx,
			&order.ID,
			order.OrderNo,
			"manual_delivery_completed",
			asyncJobTypeDeliveryRetry,
		); err != nil {
			return err
		}

		operatorType, operatorID := auditEventOperator(meta)

		if err := tx.Create(&model.OrderEvent{
			OrderID:      order.ID,
			EventType:    "delivery_completed_manual",
			FromStatus:   fromStatus,
			ToStatus:     order.Status,
			OperatorType: operatorType,
			OperatorID:   operatorID,
			PayloadJSON: jsonValue(map[string]any{
				"record_id":        record.ID,
				"delivery_channel": record.DeliveryChannel,
				"target":           record.DeliveryTarget,
				"completed_manual": true,
				"completion_note":  strings.TrimSpace(note),
			}),
			CreatedAt: now,
		}).Error; err != nil {
			return err
		}

		if shouldWriteAdminLog(meta) {
			s.logAdminAction(ctx, tx, meta, "orders", "complete_delivery", order.OrderNo, "order", map[string]any{
				"record_id":        record.ID,
				"delivery_channel": record.DeliveryChannel,
				"target":           record.DeliveryTarget,
				"note":             strings.TrimSpace(note),
			})
		}
		return nil
	})
}

func (s *Service) RetryAdminOrderDelivery(ctx context.Context, orderNo string, meta AuditMeta) error {
	var opErr error
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		order, err := s.resolveOrderByNoTx(ctx, tx, orderNo)
		if err != nil {
			return err
		}
		opErr = s.runDeliveryForOrderTx(ctx, tx, order, meta, true, false)
		if opErr == nil {
			return nil
		}

		return s.persistDeliveryFailureTx(ctx, tx, order, meta, true, false, opErr)
	})
	if err != nil {
		return err
	}

	return opErr
}

func (s *Service) ResendAdminOrderDelivery(ctx context.Context, orderNo string, meta AuditMeta) error {
	var opErr error
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		order, err := s.resolveOrderByNoTx(ctx, tx, orderNo)
		if err != nil {
			return err
		}
		opErr = s.runDeliveryForOrderTx(ctx, tx, order, meta, true, true)
		if opErr == nil {
			return nil
		}

		return s.persistDeliveryFailureTx(ctx, tx, order, meta, true, true, opErr)
	})
	if err != nil {
		return err
	}

	return opErr
}

func (s *Service) CancelAdminOrder(ctx context.Context, orderNo, note string, meta AuditMeta) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		order, err := s.resolveOrderByNoTx(ctx, tx, orderNo)
		if err != nil {
			return err
		}
		if order.PaymentStatus == "paid" {
			return ErrInvalidState
		}
		if order.Status == "completed" || order.Status == "delivered" || order.Status == "refunded" {
			return ErrInvalidState
		}

		now := time.Now()
		fromStatus := order.Status
		order.Status = "cancelled"
		order.DeliveryStatus = "cancelled"
		order.CancelledAt = &now
		order.UpdatedAt = now
		if err := tx.Save(order).Error; err != nil {
			return err
		}

		if err := s.cancelPendingAsyncJobsTx(
			ctx,
			tx,
			&order.ID,
			order.OrderNo,
			"order_cancelled",
			asyncJobTypeFulfillmentRetry,
			asyncJobTypeDeliveryRetry,
		); err != nil {
			return err
		}

		operatorType, operatorID := auditEventOperator(meta)

		if err := tx.Create(&model.OrderEvent{
			OrderID:      order.ID,
			EventType:    "order_cancelled",
			FromStatus:   fromStatus,
			ToStatus:     order.Status,
			OperatorType: operatorType,
			OperatorID:   operatorID,
			PayloadJSON:  jsonValue(map[string]any{"note": note}),
			CreatedAt:    now,
		}).Error; err != nil {
			return err
		}

		if shouldWriteAdminLog(meta) {
			s.logAdminAction(ctx, tx, meta, "orders", "cancel_order", order.OrderNo, "order", map[string]any{"note": note})
		}
		return nil
	})
}

func (s *Service) ExpireOrder(ctx context.Context, orderNo string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		order, err := s.resolveOrderByNoTx(ctx, tx, orderNo)
		if err != nil {
			return err
		}
		if order.Status != "awaiting_payment" {
			return ErrInvalidState
		}

		now := time.Now()
		order.Status = "expired"
		order.UpdatedAt = now
		if err := tx.Save(order).Error; err != nil {
			return err
		}

		return tx.Create(&model.OrderEvent{
			OrderID:      order.ID,
			EventType:    "order_expired",
			FromStatus:   "awaiting_payment",
			ToStatus:     "expired",
			OperatorType: "system",
			CreatedAt:    now,
		}).Error
	})
}

func (s *Service) orderProductName(order model.Order) string {
	snapshot := parseJSON[map[string]any](order.ProductSnapshot)
	if value, ok := snapshot["name_en"].(string); ok && value != "" {
		return value
	}
	if value, ok := snapshot["name"].(string); ok && value != "" {
		return value
	}
	if len(order.OrderItems) > 0 {
		itemSnapshot := parseJSON[map[string]any](order.OrderItems[0].ProductSnapshot)
		if value, ok := itemSnapshot["name_en"].(string); ok && value != "" {
			return value
		}
		if value, ok := itemSnapshot["name"].(string); ok && value != "" {
			return value
		}
	}
	return ""
}
