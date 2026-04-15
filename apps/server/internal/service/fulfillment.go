package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"passdock/server/internal/model"
)

type resolvedDeliveryPayload struct {
	Channel        string
	Target         string
	MaskedContent  string
	MessageText    string
	BotKey         string
	FallbackReason string
	Queued         bool
}

func (s *Service) ListAdminCodeIssueRecords(ctx context.Context) (map[string]any, error) {
	var records []model.CodeIssueRecord
	if err := s.db.WithContext(ctx).
		Order("created_at DESC, id DESC").
		Find(&records).Error; err != nil {
		return nil, err
	}

	items := make([]map[string]any, 0, len(records))
	for _, record := range records {
		var order model.Order
		_ = s.db.WithContext(ctx).Where("id = ?", record.OrderID).First(&order).Error

		items = append(items, map[string]any{
			"id":                    record.ID,
			"record_id":             record.ID,
			"order_no":              record.OrderNo,
			"code_type":             record.CodeType,
			"issue_status":          record.IssueStatus,
			"provider_key":          record.ProviderKey,
			"action_key":            record.ActionKey,
			"issued_count":          record.IssuedCount,
			"issued_code_masked":    record.IssuedCodeMasked,
			"error_message":         record.ErrorMessage,
			"fulfillment_record_id": record.FulfillmentRecordID,
			"issued_at":             record.IssuedAt,
			"created_at":            record.CreatedAt,
			"updated_at":            record.UpdatedAt,
			"product_name":          s.orderProductName(order),
			"customer_name":         buildCustomerName(order),
		})
	}

	return map[string]any{"items": items}, nil
}

func (s *Service) GetAdminCodeIssueRecordDetail(ctx context.Context, routeID string) (map[string]any, error) {
	record, err := s.resolveCodeIssueRecordByRoute(ctx, routeID)
	if err != nil {
		return nil, err
	}

	var order model.Order
	_ = s.db.WithContext(ctx).Where("id = ?", record.OrderID).First(&order).Error

	return map[string]any{
		"id":                    record.ID,
		"record_id":             record.ID,
		"order_id":              record.OrderID,
		"order_no":              record.OrderNo,
		"product_name":          s.orderProductName(order),
		"customer_name":         buildCustomerName(order),
		"code_type":             record.CodeType,
		"issue_status":          record.IssueStatus,
		"provider_key":          record.ProviderKey,
		"action_key":            record.ActionKey,
		"issued_count":          record.IssuedCount,
		"issued_code_masked":    record.IssuedCodeMasked,
		"error_message":         record.ErrorMessage,
		"fulfillment_record_id": record.FulfillmentRecordID,
		"issued_at":             record.IssuedAt,
		"created_at":            record.CreatedAt,
		"updated_at":            record.UpdatedAt,
	}, nil
}

func (s *Service) RetryAdminCodeIssueRecord(ctx context.Context, routeID string, meta AuditMeta) error {
	record, err := s.resolveCodeIssueRecordByRoute(ctx, routeID)
	if err != nil {
		return err
	}

	if record.OrderNo == "" {
		return ErrInvalidState
	}

	return s.RetryAdminOrderFulfillment(ctx, record.OrderNo, meta)
}

func (s *Service) ListAdminFulfillmentRecords(ctx context.Context) (map[string]any, error) {
	var records []model.FulfillmentRecord
	if err := s.db.WithContext(ctx).
		Order("created_at DESC, id DESC").
		Find(&records).Error; err != nil {
		return nil, err
	}

	items := make([]map[string]any, 0, len(records))
	for _, record := range records {
		var order model.Order
		_ = s.db.WithContext(ctx).Where("id = ?", record.OrderID).First(&order).Error

		var latestDelivery model.DeliveryRecord
		_ = s.db.WithContext(ctx).
			Where("order_id = ?", record.OrderID).
			Order("id DESC").
			First(&latestDelivery).Error

		botKey := ""
		if binding, err := s.resolveTelegramBindingForDeliveryTx(
			ctx,
			s.db,
			&latestDelivery,
			&order,
			"",
		); err == nil && binding != nil {
			botKey = binding.BotKey
		}

		items = append(items, map[string]any{
			"id":               record.ID,
			"record_id":        record.ID,
			"order_no":         order.OrderNo,
			"strategy_name":    record.StrategyKey,
			"strategy_key":     record.StrategyKey,
			"fulfillment_type": record.FulfillmentType,
			"provider_name":    record.ProviderKey,
			"provider_key":     record.ProviderKey,
			"action_key":       record.ActionKey,
			"status":           record.Status,
			"delivery_channel": latestDelivery.DeliveryChannel,
			"channel_type":     latestDelivery.DeliveryChannel,
			"bot_key":          botKey,
			"target":           latestDelivery.DeliveryTarget,
			"started_at":       record.StartedAt,
			"finished_at":      record.FinishedAt,
		})
	}

	return map[string]any{"items": items}, nil
}

func (s *Service) GetAdminFulfillmentRecordDetail(ctx context.Context, routeID string) (map[string]any, error) {
	record, err := s.resolveFulfillmentRecordByRoute(ctx, routeID)
	if err != nil {
		return nil, err
	}

	var order model.Order
	_ = s.db.WithContext(ctx).Where("id = ?", record.OrderID).First(&order).Error

	result := ""
	if record.ResultDataEncrypted != "" {
		result, _ = s.decryptString(record.ResultDataEncrypted)
	}

	return map[string]any{
		"id":               record.ID,
		"record_id":        record.ID,
		"order_no":         order.OrderNo,
		"strategy_name":    record.StrategyKey,
		"strategy_key":     record.StrategyKey,
		"fulfillment_type": record.FulfillmentType,
		"provider_name":    record.ProviderKey,
		"provider_key":     record.ProviderKey,
		"action_key":       record.ActionKey,
		"status":           record.Status,
		"request_payload":  parseJSON[map[string]any](record.RequestPayloadJSON),
		"response_payload": parseJSON[map[string]any](record.ResponsePayloadJSON),
		"result_masked":    record.ResultDataMasked,
		"result_plain":     result,
		"external_ref":     record.ExternalRef,
		"error_message":    record.ErrorMessage,
		"started_at":       record.StartedAt,
		"finished_at":      record.FinishedAt,
		"created_at":       record.CreatedAt,
		"updated_at":       record.UpdatedAt,
	}, nil
}

func (s *Service) ListAdminDeliveryRecords(ctx context.Context) (map[string]any, error) {
	var records []model.DeliveryRecord
	if err := s.db.WithContext(ctx).
		Order("created_at DESC, id DESC").
		Find(&records).Error; err != nil {
		return nil, err
	}

	items := make([]map[string]any, 0, len(records))
	for _, record := range records {
		var order model.Order
		_ = s.db.WithContext(ctx).Where("id = ?", record.OrderID).First(&order).Error

		botKey := ""
		if binding, err := s.resolveTelegramBindingForDeliveryTx(
			ctx,
			s.db,
			&record,
			&order,
			"",
		); err == nil && binding != nil {
			botKey = binding.BotKey
		}

		items = append(items, map[string]any{
			"id":               record.ID,
			"record_id":        record.ID,
			"order_no":         order.OrderNo,
			"delivery_channel": record.DeliveryChannel,
			"channel_type":     record.DeliveryChannel,
			"bot_key":          botKey,
			"target":           record.DeliveryTarget,
			"status":           record.DeliveryStatus,
			"started_at":       record.CreatedAt,
			"finished_at":      record.DeliveredAt,
		})
	}

	return map[string]any{"items": items}, nil
}

func (s *Service) GetAdminDeliveryRecordDetail(ctx context.Context, routeID string) (map[string]any, error) {
	record, err := s.resolveDeliveryRecordByRoute(ctx, routeID)
	if err != nil {
		return nil, err
	}

	var order model.Order
	_ = s.db.WithContext(ctx).Where("id = ?", record.OrderID).First(&order).Error

	botKey := ""
	if binding, err := s.resolveTelegramBindingForDeliveryTx(ctx, s.db, record, &order, ""); err == nil && binding != nil {
		botKey = binding.BotKey
	}

	return map[string]any{
		"id":                       record.ID,
		"record_id":                record.ID,
		"order_no":                 order.OrderNo,
		"delivery_channel":         record.DeliveryChannel,
		"channel_type":             record.DeliveryChannel,
		"bot_key":                  botKey,
		"target":                   record.DeliveryTarget,
		"status":                   record.DeliveryStatus,
		"message_id":               record.MessageID,
		"delivered_content_masked": record.DeliveredContentMasked,
		"error_message":            record.ErrorMessage,
		"started_at":               record.CreatedAt,
		"finished_at":              record.DeliveredAt,
		"created_at":               record.CreatedAt,
		"updated_at":               record.UpdatedAt,
	}, nil
}

func (s *Service) runFulfillmentForOrderTx(
	ctx context.Context,
	tx *gorm.DB,
	order *model.Order,
	meta AuditMeta,
	retry bool,
) (bool, error) {
	inventoryReserved := false

	if order.PaymentStatus != "paid" {
		return inventoryReserved, ErrInvalidState
	}
	if order.Status == "cancelled" || order.Status == "expired" || order.Status == "refunded" {
		return inventoryReserved, ErrInvalidState
	}

	strategyKey, _, err := s.orderStrategyKeys(order)
	if err != nil {
		return inventoryReserved, err
	}

	strategy, err := s.resolveFulfillmentStrategyByRoute(ctx, strategyKey)
	if err != nil {
		return inventoryReserved, err
	}

	var latest model.FulfillmentRecord
	err = tx.WithContext(ctx).
		Where("order_id = ?", order.ID).
		Order("id DESC").
		First(&latest).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		return inventoryReserved, err
	}
	if latest.ID != 0 && (latest.Status == "success" || latest.Status == "running") {
		return inventoryReserved, ErrInvalidState
	}

	now := time.Now()
	fromStatus := order.Status
	order.Status = "issuing"
	order.UpdatedAt = now
	if err := tx.Save(order).Error; err != nil {
		return inventoryReserved, err
	}

	record := model.FulfillmentRecord{
		OrderID:         order.ID,
		StrategyKey:     strategy.StrategyKey,
		FulfillmentType: strategy.FulfillmentType,
		ProviderKey:     strategy.ProviderKey,
		ActionKey:       strategy.ActionKey,
		Status:          "running",
		StartedAt:       &now,
		RequestPayloadJSON: jsonValue(map[string]any{
			"order_no":         order.OrderNo,
			"payment_method":   order.PaymentMethod,
			"source_channel":   order.SourceChannel,
			"buyer_ref":        order.BuyerRef,
			"strategy_key":     strategy.StrategyKey,
			"fulfillment_type": strategy.FulfillmentType,
		}),
		ExternalRef: fmt.Sprintf("%s-%d", order.OrderNo, now.UnixNano()),
	}
	if err := tx.Create(&record).Error; err != nil {
		return inventoryReserved, err
	}

	if err := s.reserveOrderInventoryTx(ctx, tx, order, orderQuantity(*order)); err != nil {
		return inventoryReserved, err
	}
	inventoryReserved = true

	issueRecord, maskedValue, payload, err := s.buildFulfillmentResult(ctx, tx, order, strategy, &record, retry)
	if err != nil {
		return inventoryReserved, err
	}

	doneAt := time.Now()
	record.Status = "success"
	record.ResultDataMasked = maskedValue
	record.ResponsePayloadJSON = jsonValue(payload)
	record.FinishedAt = &doneAt
	if err := tx.Save(&record).Error; err != nil {
		return inventoryReserved, err
	}

	if issueRecord != nil {
		if err := tx.Save(issueRecord).Error; err != nil {
			return inventoryReserved, err
		}
	}

	order.Status = "delivery_pending"
	order.DeliveryStatus = "pending"
	order.UpdatedAt = doneAt
	if err := tx.Save(order).Error; err != nil {
		return inventoryReserved, err
	}

	if err := s.cancelPendingAsyncJobsTx(
		ctx,
		tx,
		&order.ID,
		order.OrderNo,
		"fulfilled_successfully",
		asyncJobTypeFulfillmentRetry,
	); err != nil {
		return inventoryReserved, err
	}

	operatorType, operatorID := auditEventOperator(meta)

	if err := tx.Create(&model.OrderEvent{
		OrderID:      order.ID,
		EventType:    "fulfillment_succeeded",
		FromStatus:   fromStatus,
		ToStatus:     order.Status,
		OperatorType: operatorType,
		OperatorID:   operatorID,
		PayloadJSON: jsonValue(map[string]any{
			"strategy_key":      strategy.StrategyKey,
			"fulfillment_type":  strategy.FulfillmentType,
			"result_masked":     maskedValue,
			"retry":             retry,
			"fulfillment_id":    record.ID,
			"code_issue_record": codeIssueRecordID(issueRecord),
		}),
		CreatedAt: doneAt,
	}).Error; err != nil {
		return inventoryReserved, err
	}

	if shouldWriteAdminLog(meta) {
		s.logAdminAction(ctx, tx, meta, "orders", "fulfill_order", order.OrderNo, "order", map[string]any{
			"retry":        retry,
			"strategy_key": strategy.StrategyKey,
		})
	}
	return inventoryReserved, nil
}

func (s *Service) persistFulfillmentFailureTx(
	ctx context.Context,
	tx *gorm.DB,
	order *model.Order,
	meta AuditMeta,
	retry bool,
	inventoryReserved bool,
	cause error,
) error {
	var record model.FulfillmentRecord
	err := tx.WithContext(ctx).
		Where("order_id = ?", order.ID).
		Order("id DESC").
		First(&record).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil
		}
		return err
	}
	if record.Status != "running" {
		return nil
	}

	if inventoryReserved {
		if err := s.restoreOrderInventoryTx(ctx, tx, order, orderQuantity(*order)); err != nil {
			return err
		}
	}

	now := time.Now()
	message := defaultString(strings.TrimSpace(cause.Error()), "fulfillment failed")
	record.Status = "failed"
	record.ErrorMessage = message
	record.ResponsePayloadJSON = jsonValue(map[string]any{
		"error": message,
		"retry": retry,
	})
	record.FinishedAt = &now
	if err := tx.Save(&record).Error; err != nil {
		return err
	}

	if record.FulfillmentType != "manual_delivery" {
		var issue model.CodeIssueRecord
		err := tx.WithContext(ctx).Where("order_no = ?", order.OrderNo).First(&issue).Error
		if err != nil && err != gorm.ErrRecordNotFound {
			return err
		}

		issue.OrderID = order.ID
		issue.OrderNo = order.OrderNo
		issue.FulfillmentRecordID = &record.ID
		issue.CodeType = codeTypeForFulfillment(record.FulfillmentType)
		issue.IssueStatus = "failed"
		issue.ProviderKey = record.ProviderKey
		issue.ActionKey = record.ActionKey
		issue.IssuedCodeEncrypted = ""
		issue.IssuedCodeMasked = ""
		issue.IssuedCount = 0
		issue.IssuedAt = nil
		issue.ErrorMessage = message

		if issue.ID == 0 {
			if err := tx.Create(&issue).Error; err != nil {
				return err
			}
		} else {
			if err := tx.Save(&issue).Error; err != nil {
				return err
			}
		}
	}

	fromStatus := order.Status
	order.Status = "failed"
	order.UpdatedAt = now
	if err := tx.Save(order).Error; err != nil {
		return err
	}

	if _, err := s.createOrUpdateOrderFailureTicketTx(
		ctx,
		tx,
		order,
		fmt.Sprintf("Fulfillment failure · %s", order.OrderNo),
		fmt.Sprintf(
			"Order %s fulfillment failed.\nStrategy: %s\nType: %s\nProvider: %s\nAction: %s\nError: %s",
			order.OrderNo,
			record.StrategyKey,
			record.FulfillmentType,
			record.ProviderKey,
			record.ActionKey,
			message,
		),
	); err != nil {
		return err
	}

	if err := s.scheduleFulfillmentRetryIfNeededTx(ctx, tx, order, &record, message); err != nil {
		return err
	}

	operatorType, operatorID := auditEventOperator(meta)

	if err := tx.Create(&model.OrderEvent{
		OrderID:      order.ID,
		EventType:    "fulfillment_failed",
		FromStatus:   fromStatus,
		ToStatus:     order.Status,
		OperatorType: operatorType,
		OperatorID:   operatorID,
		PayloadJSON: jsonValue(map[string]any{
			"retry":          retry,
			"fulfillment_id": record.ID,
			"strategy_key":   record.StrategyKey,
			"error_message":  message,
		}),
		CreatedAt: now,
	}).Error; err != nil {
		return err
	}

	action := "fulfillment_failed"
	if retry {
		action = "retry_fulfillment_failed"
	}
	if shouldWriteAdminLog(meta) {
		s.logAdminAction(ctx, tx, meta, "orders", action, order.OrderNo, "order", map[string]any{
			"retry":          retry,
			"fulfillment_id": record.ID,
			"strategy_key":   record.StrategyKey,
			"error_message":  message,
		})
	}

	return nil
}

func (s *Service) runDeliveryForOrderTx(
	ctx context.Context,
	tx *gorm.DB,
	order *model.Order,
	meta AuditMeta,
	retry bool,
	resendOnly bool,
) error {
	if order.Status == "cancelled" || order.Status == "expired" || order.Status == "refunded" {
		return ErrInvalidState
	}
	if !resendOnly && order.Status != "delivery_pending" && order.Status != "issued" && order.Status != "completed" {
		return ErrInvalidState
	}

	_, deliveryStrategyKey, err := s.orderStrategyKeys(order)
	if err != nil {
		return err
	}

	deliveryStrategy, err := s.resolveDeliveryStrategyByRoute(ctx, deliveryStrategyKey)
	if err != nil {
		return err
	}

	var latest model.DeliveryRecord
	err = tx.WithContext(ctx).
		Where("order_id = ?", order.ID).
		Order("id DESC").
		First(&latest).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		return err
	}
	if latest.ID != 0 && latest.DeliveryStatus == "sent" && !retry && !resendOnly {
		return ErrInvalidState
	}
	if latest.ID != 0 && latest.DeliveryStatus == "pending" && deliveryChannelRequiresManualCompletion(latest.DeliveryChannel) && !retry && !resendOnly {
		return ErrInvalidState
	}

	now := time.Now()
	record := model.DeliveryRecord{
		OrderID:         order.ID,
		DeliveryChannel: defaultString(deliveryStrategy.ChannelType, "web"),
		DeliveryTarget:  deliveryTargetForStrategy(*order, deliveryStrategy.ChannelType),
		DeliveryStatus:  "pending",
	}
	if err := tx.Create(&record).Error; err != nil {
		return err
	}

	deliveryPayload, err := s.buildDeliveryPayload(ctx, tx, order, deliveryStrategy)
	if err != nil {
		return err
	}

	record.DeliveryChannel = deliveryPayload.Channel
	record.DeliveryTarget = deliveryPayload.Target
	record.DeliveredContentMasked = deliveryPayload.MaskedContent
	if !deliveryPayload.Queued {
		record.DeliveryStatus = "sending"
	}
	if err := tx.Save(&record).Error; err != nil {
		return err
	}

	fromStatus := order.Status
	if deliveryPayload.Queued {
		order.Status = "delivery_pending"
		order.DeliveryStatus = "pending"
		order.DeliveredAt = nil
		order.CompletedAt = nil
		order.UpdatedAt = now
		if err := tx.Save(order).Error; err != nil {
			return err
		}

		if err := s.cancelPendingAsyncJobsTx(
			ctx,
			tx,
			&order.ID,
			order.OrderNo,
			"delivery_requeued",
			asyncJobTypeDeliveryRetry,
		); err != nil {
			return err
		}

		eventType := "delivery_queued"
		action := "queue_delivery"
		if resendOnly {
			eventType = "delivery_requeued"
			action = "requeue_delivery"
		} else if retry {
			eventType = "delivery_retry_queued"
			action = "retry_delivery_queue"
		}

		operatorType, operatorID := auditEventOperator(meta)

		if err := tx.Create(&model.OrderEvent{
			OrderID:      order.ID,
			EventType:    eventType,
			FromStatus:   fromStatus,
			ToStatus:     order.Status,
			OperatorType: operatorType,
			OperatorID:   operatorID,
			PayloadJSON: jsonValue(map[string]any{
				"requested_channel": deliveryStrategy.ChannelType,
				"delivery_channel":  deliveryPayload.Channel,
				"target":            deliveryPayload.Target,
				"queued":            true,
				"retry":             retry,
				"resend_only":       resendOnly,
				"record_id":         record.ID,
				"bot_key":           deliveryPayload.BotKey,
				"fallback_reason":   deliveryPayload.FallbackReason,
			}),
			CreatedAt: now,
		}).Error; err != nil {
			return err
		}

		if shouldWriteAdminLog(meta) {
			s.logAdminAction(ctx, tx, meta, "orders", action, order.OrderNo, "order", map[string]any{
				"queued":            true,
				"retry":             retry,
				"resend_only":       resendOnly,
				"requested_channel": deliveryStrategy.ChannelType,
				"channel":           deliveryPayload.Channel,
				"target":            deliveryPayload.Target,
				"record_id":         record.ID,
				"bot_key":           deliveryPayload.BotKey,
				"fallback_reason":   deliveryPayload.FallbackReason,
			})
		}
		return nil
	}

	messageID := fmt.Sprintf("msg_%s_%d", order.OrderNo, now.UnixNano())
	if deliveryPayload.Channel == "telegram" {
		sendResult, err := s.sendTelegramMessage(ctx, deliveryPayload.BotKey, deliveryPayload.Target, deliveryPayload.MessageText)
		if err != nil {
			return err
		}
		messageID = sendResult.MessageID
	}

	record.DeliveryStatus = "sent"
	record.MessageID = messageID
	record.DeliveredAt = &now
	record.ErrorMessage = ""
	if err := tx.Save(&record).Error; err != nil {
		return err
	}

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
		"delivery_succeeded",
		asyncJobTypeDeliveryRetry,
	); err != nil {
		return err
	}

	eventType := "delivery_sent"
	action := "deliver_order"
	if resendOnly {
		eventType = "delivery_resent"
		action = "resend_delivery"
	} else if retry {
		action = "retry_delivery"
	}

	operatorType, operatorID := auditEventOperator(meta)

	if err := tx.Create(&model.OrderEvent{
		OrderID:      order.ID,
		EventType:    eventType,
		FromStatus:   fromStatus,
		ToStatus:     order.Status,
		OperatorType: operatorType,
		OperatorID:   operatorID,
		PayloadJSON: jsonValue(map[string]any{
			"requested_channel": deliveryStrategy.ChannelType,
			"delivery_channel":  deliveryPayload.Channel,
			"target":            deliveryPayload.Target,
			"retry":             retry,
			"resend_only":       resendOnly,
			"record_id":         record.ID,
			"bot_key":           deliveryPayload.BotKey,
			"fallback_reason":   deliveryPayload.FallbackReason,
		}),
		CreatedAt: now,
	}).Error; err != nil {
		return err
	}

	if shouldWriteAdminLog(meta) {
		s.logAdminAction(ctx, tx, meta, "orders", action, order.OrderNo, "order", map[string]any{
			"retry":             retry,
			"resend_only":       resendOnly,
			"requested_channel": deliveryStrategy.ChannelType,
			"channel":           deliveryPayload.Channel,
			"bot_key":           deliveryPayload.BotKey,
			"fallback_reason":   deliveryPayload.FallbackReason,
		})
	}
	return nil
}

func (s *Service) persistDeliveryFailureTx(
	ctx context.Context,
	tx *gorm.DB,
	order *model.Order,
	meta AuditMeta,
	retry bool,
	resendOnly bool,
	cause error,
) error {
	var record model.DeliveryRecord
	err := tx.WithContext(ctx).
		Where("order_id = ?", order.ID).
		Order("id DESC").
		First(&record).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil
		}
		return err
	}
	if record.DeliveryStatus != "sending" {
		return nil
	}

	now := time.Now()
	message := defaultString(strings.TrimSpace(cause.Error()), "delivery failed")
	record.DeliveryStatus = "failed"
	record.ErrorMessage = message
	if err := tx.Save(&record).Error; err != nil {
		return err
	}

	if !resendOnly {
		order.DeliveryStatus = "failed"
		order.UpdatedAt = now
		if err := tx.Save(order).Error; err != nil {
			return err
		}
	}

	if _, err := s.createOrUpdateOrderFailureTicketTx(
		ctx,
		tx,
		order,
		fmt.Sprintf("Delivery failure · %s", order.OrderNo),
		fmt.Sprintf(
			"Order %s delivery failed.\nChannel: %s\nTarget: %s\nRetry: %t\nResend only: %t\nError: %s",
			order.OrderNo,
			record.DeliveryChannel,
			record.DeliveryTarget,
			retry,
			resendOnly,
			message,
		),
	); err != nil {
		return err
	}

	if !resendOnly {
		if err := s.scheduleDeliveryRetryIfNeededTx(ctx, tx, order, &record, message); err != nil {
			return err
		}
	}

	eventType := "delivery_failed"
	action := "delivery_failed"
	if resendOnly {
		eventType = "delivery_resend_failed"
		action = "resend_delivery_failed"
	} else if retry {
		eventType = "delivery_retry_failed"
		action = "retry_delivery_failed"
	}

	operatorType, operatorID := auditEventOperator(meta)

	if err := tx.Create(&model.OrderEvent{
		OrderID:      order.ID,
		EventType:    eventType,
		FromStatus:   order.Status,
		ToStatus:     order.Status,
		OperatorType: operatorType,
		OperatorID:   operatorID,
		PayloadJSON: jsonValue(map[string]any{
			"retry":             retry,
			"resend_only":       resendOnly,
			"requested_channel": record.DeliveryChannel,
			"record_id":         record.ID,
			"error_message":     message,
		}),
		CreatedAt: now,
	}).Error; err != nil {
		return err
	}

	if shouldWriteAdminLog(meta) {
		s.logAdminAction(ctx, tx, meta, "orders", action, order.OrderNo, "order", map[string]any{
			"retry":             retry,
			"resend_only":       resendOnly,
			"requested_channel": record.DeliveryChannel,
			"record_id":         record.ID,
			"error_message":     message,
		})
	}

	return nil
}

func (s *Service) buildFulfillmentResult(
	ctx context.Context,
	tx *gorm.DB,
	order *model.Order,
	strategy *model.FulfillmentStrategy,
	record *model.FulfillmentRecord,
	retry bool,
) (*model.CodeIssueRecord, string, map[string]any, error) {
	count := 1
	if len(order.OrderItems) > 0 && order.OrderItems[0].Quantity > 0 {
		count = order.OrderItems[0].Quantity
	}

	var issue model.CodeIssueRecord
	err := tx.WithContext(ctx).Where("order_no = ?", order.OrderNo).First(&issue).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		return nil, "", nil, err
	}
	if issue.ID != 0 && issue.IssueStatus == "success" {
		if !retry {
			return nil, "", nil, ErrInvalidState
		}

		codes, err := s.loadIssueCodes(issue)
		if err != nil {
			return nil, "", nil, err
		}

		record.ResultDataEncrypted = issue.IssuedCodeEncrypted
		record.RequestPayloadJSON = jsonValue(map[string]any{
			"order_no": order.OrderNo,
			"reused":   true,
		})

		return &issue, issue.IssuedCodeMasked, map[string]any{
			"issued_count": issue.IssuedCount,
			"codes_masked": maskCodes(codes),
			"reused":       true,
		}, nil
	}

	templateData := s.buildFulfillmentTemplateData(order, strategy, count)
	if strategyRequest := parseJSON[map[string]any](strategy.RequestTemplateJSON); len(strategyRequest) > 0 {
		if renderedRequest, ok := renderTemplateValue(strategyRequest, templateData).(map[string]any); ok {
			for key, value := range renderedRequest {
				templateData[key] = value
			}
		}
	}
	if retry && strategy.FulfillmentType != "manual_delivery" {
		if recovered := s.queryFulfillmentIssuedCodes(ctx, order, strategy, templateData); recovered != nil {
			record.RequestPayloadJSON = jsonValue(buildFulfillmentRecoveryRequestPayload(recovered.Request, "", "before_retry_issue"))
			return s.buildIssuedCodeFulfillmentResult(order, strategy, record, &issue, recovered, map[string]any{
				"recovered":      true,
				"recovery_mode":  "query_issue_result",
				"recovery_stage": "before_retry_issue",
			})
		}
	}

	execution, err := s.ExecuteIntegrationAction(ctx, strategy.ProviderKey, strategy.ActionKey, ExecuteActionInput{
		TemplateData: templateData,
	})
	if err != nil {
		if strategy.FulfillmentType != "manual_delivery" {
			if recovered := s.queryFulfillmentIssuedCodes(ctx, order, strategy, templateData); recovered != nil {
				record.RequestPayloadJSON = jsonValue(buildFulfillmentRecoveryRequestPayload(recovered.Request, err.Error(), "after_issue_error"))
				return s.buildIssuedCodeFulfillmentResult(order, strategy, record, &issue, recovered, map[string]any{
					"recovered":       true,
					"recovery_mode":   "query_issue_result",
					"recovery_stage":  "after_issue_error",
					"recovery_error":  strings.TrimSpace(err.Error()),
					"recovery_action": "query_issue_result",
				})
			}
		}
		return nil, "", nil, err
	}

	record.RequestPayloadJSON = jsonValue(execution.Request)

	switch strategy.FulfillmentType {
	case "manual_delivery":
		fullText := defaultString(execution.Message, fmt.Sprintf("Manual fulfillment queued for order %s", order.OrderNo))
		encrypted, err := s.encryptString(fullText)
		if err != nil {
			return nil, "", nil, err
		}

		record.ResultDataEncrypted = encrypted
		return nil, defaultString(execution.Message, "Manual operator queue"), execution.ToMap(), nil
	default:
		return s.buildIssuedCodeFulfillmentResult(order, strategy, record, &issue, execution, nil)
	}
}

func (s *Service) queryFulfillmentIssuedCodes(
	ctx context.Context,
	order *model.Order,
	strategy *model.FulfillmentStrategy,
	templateData map[string]any,
) *ExecuteActionResult {
	if order == nil || strategy == nil || strings.TrimSpace(strategy.ProviderKey) == "" {
		return nil
	}

	result, err := s.ExecuteIntegrationAction(ctx, strategy.ProviderKey, "query_issue_result", ExecuteActionInput{
		TemplateData: copyMap(templateData),
	})
	if err != nil || result == nil || len(result.Codes) == 0 {
		return nil
	}

	return result
}

func buildFulfillmentRecoveryRequestPayload(
	request map[string]any,
	recoveryError string,
	stage string,
) map[string]any {
	payload := map[string]any{
		"recovery_action": "query_issue_result",
		"recovery_stage":  strings.TrimSpace(stage),
	}
	if len(request) > 0 {
		payload["query_request"] = request
	}
	if strings.TrimSpace(recoveryError) != "" {
		payload["recovery_error"] = strings.TrimSpace(recoveryError)
	}

	return payload
}

func (s *Service) buildIssuedCodeFulfillmentResult(
	order *model.Order,
	strategy *model.FulfillmentStrategy,
	record *model.FulfillmentRecord,
	issue *model.CodeIssueRecord,
	execution *ExecuteActionResult,
	extraPayload map[string]any,
) (*model.CodeIssueRecord, string, map[string]any, error) {
	if order == nil || strategy == nil || record == nil || issue == nil || execution == nil || len(execution.Codes) == 0 {
		return nil, "", nil, ErrInvalidState
	}

	encoded, err := json.Marshal(execution.Codes)
	if err != nil {
		return nil, "", nil, err
	}
	encrypted, err := s.encryptString(string(encoded))
	if err != nil {
		return nil, "", nil, err
	}

	maskedCodes := maskCodes(execution.Codes)
	issue.OrderID = order.ID
	issue.OrderNo = order.OrderNo
	issue.FulfillmentRecordID = &record.ID
	issue.CodeType = codeTypeForFulfillment(strategy.FulfillmentType)
	issue.IssueStatus = "success"
	issue.ProviderKey = strategy.ProviderKey
	issue.ActionKey = strategy.ActionKey
	issue.IssuedCodeEncrypted = encrypted
	issue.IssuedCodeMasked = strings.Join(maskedCodes, ", ")
	issue.IssuedCount = len(execution.Codes)
	issuedAt := time.Now()
	issue.IssuedAt = &issuedAt
	issue.ErrorMessage = ""

	record.ResultDataEncrypted = encrypted

	payload := execution.ToMap()
	payload["issued_count"] = len(execution.Codes)
	payload["codes_masked"] = maskedCodes
	for key, value := range extraPayload {
		payload[key] = value
	}

	return issue, strings.Join(maskedCodes, ", "), payload, nil
}

func (s *Service) buildFulfillmentTemplateData(
	order *model.Order,
	strategy *model.FulfillmentStrategy,
	count int,
) map[string]any {
	productSnapshot := parseJSON[map[string]any](order.ProductSnapshot)
	metadata, _ := productSnapshot["metadata"].(map[string]any)
	productName := s.orderProductName(*order)
	if productName == "" {
		productName = stringifyTemplateValue(productSnapshot["name"])
	}

	return map[string]any{
		"order_no":         order.OrderNo,
		"product_id":       productSnapshot["product_id"],
		"product_name":     productName,
		"buyer_ref":        order.BuyerRef,
		"payment_method":   order.PaymentMethod,
		"source_channel":   order.SourceChannel,
		"currency":         order.Currency,
		"count":            count,
		"code_name":        strings.ToUpper(strings.ReplaceAll(defaultString(stringifyTemplateValue(productSnapshot["sku"]), order.OrderNo), "-", "_")),
		"quota":            int(order.PayAmount * 100000),
		"expired_time":     0,
		"duration_unit":    billingCycleUnit(stringifyTemplateValue(metadata["billing_cycle"])),
		"duration_value":   billingCycleValue(stringifyTemplateValue(metadata["billing_cycle"])),
		"custom_seconds":   0,
		"available_group":  "",
		"strategy_key":     strategy.StrategyKey,
		"fulfillment_type": strategy.FulfillmentType,
	}
}

func (s *Service) loadIssueCodes(issue model.CodeIssueRecord) ([]string, error) {
	plain, err := s.decryptString(issue.IssuedCodeEncrypted)
	if err != nil {
		return nil, err
	}

	var codes []string
	if err := json.Unmarshal([]byte(plain), &codes); err != nil {
		return nil, err
	}

	return codes, nil
}

func maskCodes(codes []string) []string {
	result := make([]string, 0, len(codes))
	for _, code := range codes {
		result = append(result, maskValue(code, 6))
	}
	return result
}

func billingCycleUnit(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "yearly":
		return "year"
	case "quarterly", "monthly":
		return "month"
	default:
		return ""
	}
}

func billingCycleValue(value string) int {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "yearly":
		return 1
	case "quarterly":
		return 3
	case "monthly":
		return 1
	default:
		return 0
	}
}

func (s *Service) buildDeliveryPayload(
	ctx context.Context,
	tx *gorm.DB,
	order *model.Order,
	deliveryStrategy *model.DeliveryStrategy,
) (resolvedDeliveryPayload, error) {
	var issue model.CodeIssueRecord
	err := tx.WithContext(ctx).Where("order_id = ?", order.ID).Order("id DESC").First(&issue).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		return resolvedDeliveryPayload{}, err
	}

	codes := []string{}
	plainContent := ""
	maskedContent := ""
	if issue.ID != 0 {
		plain, err := s.decryptString(issue.IssuedCodeEncrypted)
		if err != nil {
			return resolvedDeliveryPayload{}, err
		}

		if err := json.Unmarshal([]byte(plain), &codes); err != nil {
			return resolvedDeliveryPayload{}, err
		}
		plainContent = strings.Join(codes, ", ")

		maskedCodes := make([]string, 0, len(codes))
		for _, code := range codes {
			maskedCodes = append(maskedCodes, maskValue(code, 6))
		}
		maskedContent = strings.Join(maskedCodes, ", ")
	} else {
		var fulfillment model.FulfillmentRecord
		err = tx.WithContext(ctx).Where("order_id = ?", order.ID).Order("id DESC").First(&fulfillment).Error
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				return resolvedDeliveryPayload{}, ErrInvalidState
			}
			return resolvedDeliveryPayload{}, err
		}

		if fulfillment.ResultDataMasked == "" {
			return resolvedDeliveryPayload{}, ErrInvalidState
		}

		if plain, err := s.decryptString(fulfillment.ResultDataEncrypted); err == nil && strings.TrimSpace(plain) != "" {
			plainContent = plain
		}
		if plainContent == "" {
			plainContent = fulfillment.ResultDataMasked
		}
		maskedContent = fulfillment.ResultDataMasked
	}

	delivery, err := s.resolveDeliveryChannelTarget(ctx, tx, order, deliveryStrategy.ChannelType)
	if err != nil {
		return resolvedDeliveryPayload{}, err
	}

	delivery.MaskedContent = maskedContent
	delivery.MessageText = s.renderDeliveryMessage(order, deliveryStrategy, codes, plainContent, maskedContent)
	delivery.Queued = deliveryChannelRequiresManualCompletion(delivery.Channel)
	return delivery, nil
}

func (s *Service) renderDeliveryMessage(
	order *model.Order,
	deliveryStrategy *model.DeliveryStrategy,
	codes []string,
	plainContent string,
	maskedContent string,
) string {
	templateData := s.buildDeliveryMessageTemplateData(order, deliveryStrategy, codes, plainContent, maskedContent)
	renderedTemplate := renderTemplateObject(parseJSON[map[string]any](deliveryStrategy.MessageTemplateJSON), templateData)
	return s.buildRenderedDeliveryMessage(order, plainContent, renderedTemplate)
}

func (s *Service) resolveDeliveryChannelTarget(
	ctx context.Context,
	tx *gorm.DB,
	order *model.Order,
	channelType string,
) (resolvedDeliveryPayload, error) {
	result := resolvedDeliveryPayload{
		Channel: channelType,
		Target:  deliveryTargetForStrategy(*order, channelType),
	}

	if channelType != "telegram" {
		return result, nil
	}

	binding, err := s.resolveTelegramBindingForOrderTx(ctx, tx, order, "")
	if err != nil {
		return resolvedDeliveryPayload{}, err
	}
	if binding == nil {
		result.Channel = "web"
		result.Target = deliveryTargetForStrategy(*order, "web")
		result.FallbackReason = "telegram_not_bound"
		return result, nil
	}

	result.Channel = "telegram"
	result.Target = binding.ChatID
	result.BotKey = binding.BotKey
	return result, nil
}

func (s *Service) orderStrategyKeys(order *model.Order) (string, string, error) {
	if len(order.OrderItems) > 0 {
		item := order.OrderItems[0]
		if item.FulfillmentStrategyKey != "" && item.DeliveryStrategyKey != "" {
			return item.FulfillmentStrategyKey, item.DeliveryStrategyKey, nil
		}
	}

	snapshot := parseJSON[map[string]any](order.ProductSnapshot)
	fulfillmentStrategyKey, _ := snapshot["fulfillment_strategy_key"].(string)
	deliveryStrategyKey, _ := snapshot["delivery_strategy_key"].(string)
	if fulfillmentStrategyKey == "" || deliveryStrategyKey == "" {
		return "", "", ErrInvalidInput
	}

	return fulfillmentStrategyKey, deliveryStrategyKey, nil
}

func deliveryTargetForStrategy(order model.Order, channelType string) string {
	switch channelType {
	case "telegram":
		if strings.HasPrefix(order.BuyerRef, "tg:") {
			return strings.TrimPrefix(order.BuyerRef, "tg:")
		}
		if order.BuyerRef != "" {
			return order.BuyerRef
		}
		return "telegram:not_bound"
	case "email":
		return "email:customer_contact"
	case "manual":
		return "ops queue"
	default:
		return "order detail"
	}
}

func deliveryChannelRequiresManualCompletion(channel string) bool {
	switch strings.TrimSpace(channel) {
	case "manual", "email":
		return true
	default:
		return false
	}
}

func codeTypeForFulfillment(fulfillmentType string) string {
	switch fulfillmentType {
	case "issue_subscription":
		return "subscription_code"
	case "issue_license":
		return "license_key"
	case "credit_account":
		return "credit_receipt"
	default:
		return "recharge_code"
	}
}

func codeIssueRecordID(record *model.CodeIssueRecord) any {
	if record == nil {
		return nil
	}
	return record.ID
}

func orderQuantity(order model.Order) int {
	if len(order.OrderItems) > 0 && order.OrderItems[0].Quantity > 0 {
		return order.OrderItems[0].Quantity
	}

	return 1
}

func (s *Service) reserveOrderInventoryTx(
	ctx context.Context,
	tx *gorm.DB,
	order *model.Order,
	quantity int,
) error {
	if tx == nil || order == nil || order.ProductID == nil || quantity <= 0 {
		return nil
	}

	var product model.Product
	if err := tx.WithContext(ctx).First(&product, *order.ProductID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrNotFound
		}
		return err
	}

	meta := parseJSON[productMetadata](product.MetadataJSON)
	if meta.Inventory < quantity {
		return ErrInsufficientInventory
	}

	meta.Inventory -= quantity
	product.MetadataJSON = jsonValue(meta)
	return tx.Save(&product).Error
}

func (s *Service) restoreOrderInventoryTx(
	ctx context.Context,
	tx *gorm.DB,
	order *model.Order,
	quantity int,
) error {
	if tx == nil || order == nil || order.ProductID == nil || quantity <= 0 {
		return nil
	}

	var product model.Product
	if err := tx.WithContext(ctx).First(&product, *order.ProductID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}

	meta := parseJSON[productMetadata](product.MetadataJSON)
	meta.Inventory += quantity
	product.MetadataJSON = jsonValue(meta)
	return tx.Save(&product).Error
}
