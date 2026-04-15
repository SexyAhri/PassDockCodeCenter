package service

import (
	"context"
	"strings"
	"time"

	"gorm.io/gorm"

	"passdock/server/internal/model"
)

type preparedOriginalRefund struct {
	RefundRecordID    uint
	RefundNo          string
	OrderID           uint
	OrderNo           string
	PaymentRecordID   *uint
	PaymentMethod     string
	ChannelKey        string
	ProviderKey       string
	ActionKey         string
	Amount            float64
	Currency          string
	Note              string
	AttemptNo         int
	RefundStatusPath  string
	RefundReceiptPath string
	RequestPayload    map[string]any
}

func (s *Service) MarkAdminOrderRefund(
	ctx context.Context,
	orderNo string,
	note string,
	meta AuditMeta,
) (map[string]any, error) {
	now := time.Now()
	trimmedNote := strings.TrimSpace(note)

	var result map[string]any
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		order, err := s.resolveOrderByNoTx(ctx, tx, orderNo)
		if err != nil {
			return err
		}
		if order.PaymentStatus != "paid" || order.Status == "refunded" {
			return ErrInvalidState
		}

		channelKey := s.channelKeyForPaymentMethodTx(ctx, tx, order.PaymentMethod)
		paymentRecord, err := s.resolveLatestPaymentRecordForOrderTx(ctx, tx, order.ID)
		if err != nil && err != ErrNotFound {
			return err
		}

		attemptNo, err := s.nextRefundAttemptNoTx(ctx, tx, order.ID, "mark")
		if err != nil {
			return err
		}

		refundRecord := model.RefundRecord{
			OrderID:            order.ID,
			PaymentRecordID:    uintPointerOrNil(paymentRecord),
			RefundNo:           refundNo(),
			RefundType:         "mark",
			PaymentMethod:      order.PaymentMethod,
			ChannelKey:         channelKey,
			Amount:             order.PayAmount,
			Currency:           order.Currency,
			Status:             "succeeded",
			RequestPayloadJSON: jsonValue(map[string]any{"note": trimmedNote}),
			ResponsePayloadJSON: jsonValue(map[string]any{
				"status":  "succeeded",
				"message": "Order marked as refunded by operator.",
			}),
			FailureMessage: "",
			AttemptNo:      attemptNo,
			RequestedAt:    &now,
			ProcessedAt:    &now,
			RefundedAt:     &now,
		}
		if err := tx.WithContext(ctx).Create(&refundRecord).Error; err != nil {
			return err
		}

		if err := s.applyRefundSuccessTx(ctx, tx, order, paymentRecord, &refundRecord, trimmedNote, "admin_mark_refund", meta, now); err != nil {
			return err
		}

		result = s.buildRefundResultPayload(&refundRecord, "Order marked as refunded.", true)
		return nil
	})
	if err != nil {
		return nil, err
	}

	return result, nil
}

func (s *Service) RequestAdminOrderOriginalRefund(
	ctx context.Context,
	orderNo string,
	note string,
	meta AuditMeta,
) (map[string]any, error) {
	prepared, err := s.prepareOriginalRefund(ctx, orderNo, note)
	if err != nil {
		return nil, err
	}

	execution, execErr := s.ExecuteIntegrationAction(
		ctx,
		prepared.ProviderKey,
		prepared.ActionKey,
		ExecuteActionInput{
			TemplateData: prepared.RequestPayload,
		},
	)

	return s.finalizeOriginalRefund(ctx, prepared, execution, execErr, meta)
}

func (s *Service) RefundAdminOrder(ctx context.Context, orderNo, note string, meta AuditMeta) error {
	_, err := s.MarkAdminOrderRefund(ctx, orderNo, note, meta)
	return err
}

func (s *Service) prepareOriginalRefund(
	ctx context.Context,
	orderNo string,
	note string,
) (*preparedOriginalRefund, error) {
	trimmedNote := strings.TrimSpace(note)

	var prepared *preparedOriginalRefund
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		order, err := s.resolveOrderByNoTx(ctx, tx, orderNo)
		if err != nil {
			return err
		}
		if order.PaymentStatus != "paid" || order.Status == "refunded" {
			return ErrInvalidState
		}

		latestRefund, err := s.resolveLatestRefundRecordForOrderTx(ctx, tx, order.ID)
		if err != nil && err != ErrNotFound {
			return err
		}
		if latestRefund != nil && latestRefund.RefundType == "original" && latestRefund.Status == "processing" {
			return ErrInvalidState
		}

		paymentRecord, err := s.resolveLatestPaymentRecordForOrderTx(ctx, tx, order.ID)
		if err != nil {
			return err
		}

		channel, config, err := s.resolvePaymentChannelConfigByTypeTx(ctx, tx, order.PaymentMethod)
		if err != nil {
			return err
		}
		if strings.TrimSpace(config.RefundProviderKey) == "" || strings.TrimSpace(config.RefundActionKey) == "" {
			return ErrInvalidState
		}

		attemptNo, err := s.nextRefundAttemptNoTx(ctx, tx, order.ID, "original")
		if err != nil {
			return err
		}

		refundNumber := refundNo()
		now := time.Now()
		requestPayload := s.buildOriginalRefundTemplateData(order, paymentRecord, channel, config, refundNumber, trimmedNote)

		refundRecord := model.RefundRecord{
			OrderID:            order.ID,
			PaymentRecordID:    uintPointerOrNil(paymentRecord),
			RefundNo:           refundNumber,
			RefundType:         "original",
			PaymentMethod:      order.PaymentMethod,
			ChannelKey:         channel.ChannelKey,
			ProviderKey:        config.RefundProviderKey,
			ActionKey:          config.RefundActionKey,
			Amount:             order.PayAmount,
			Currency:           order.Currency,
			Status:             "processing",
			RequestPayloadJSON: jsonValue(requestPayload),
			AttemptNo:          attemptNo,
			RequestedAt:        &now,
		}
		if err := tx.WithContext(ctx).Create(&refundRecord).Error; err != nil {
			return err
		}

		prepared = &preparedOriginalRefund{
			RefundRecordID:    refundRecord.ID,
			RefundNo:          refundRecord.RefundNo,
			OrderID:           order.ID,
			OrderNo:           order.OrderNo,
			PaymentRecordID:   uintPointerOrNil(paymentRecord),
			PaymentMethod:     order.PaymentMethod,
			ChannelKey:        channel.ChannelKey,
			ProviderKey:       config.RefundProviderKey,
			ActionKey:         config.RefundActionKey,
			Amount:            order.PayAmount,
			Currency:          order.Currency,
			Note:              trimmedNote,
			AttemptNo:         attemptNo,
			RefundStatusPath:  config.RefundStatusPath,
			RefundReceiptPath: config.RefundReceiptPath,
			RequestPayload:    requestPayload,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return prepared, nil
}

func (s *Service) finalizeOriginalRefund(
	ctx context.Context,
	prepared *preparedOriginalRefund,
	execution *ExecuteActionResult,
	execErr error,
	meta AuditMeta,
) (map[string]any, error) {
	if prepared == nil {
		return nil, ErrInvalidInput
	}

	rawStatus := extractRefundStatus(execution, prepared.RefundStatusPath)
	receiptNo := extractRefundReceipt(execution, prepared.RefundReceiptPath)
	normalizedStatus := normalizeRefundRecordStatus(rawStatus, execution, execErr)
	message := resolveRefundExecutionMessage(normalizedStatus, execution, execErr)
	responsePayload := refundResponsePayload(normalizedStatus, receiptNo, message, execution)
	now := time.Now()

	var result map[string]any
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		refundRecord, err := s.resolveRefundRecordByIDTx(ctx, tx, prepared.RefundRecordID)
		if err != nil {
			return err
		}

		refundRecord.Status = normalizedStatus
		refundRecord.ReceiptNo = receiptNo
		refundRecord.ResponsePayloadJSON = jsonValue(responsePayload)
		refundRecord.FailureMessage = ""
		refundRecord.ProcessedAt = &now
		if normalizedStatus == "succeeded" {
			refundRecord.RefundedAt = &now
		}
		if normalizedStatus == "failed" {
			refundRecord.FailureMessage = message
		}
		if err := tx.WithContext(ctx).Save(refundRecord).Error; err != nil {
			return err
		}

		order, err := s.resolveOrderByNoTx(ctx, tx, prepared.OrderNo)
		if err != nil {
			return err
		}
		paymentRecord, err := s.resolvePaymentRecordForRefundTx(ctx, tx, prepared.PaymentRecordID, order.ID)
		if err != nil && err != ErrNotFound {
			return err
		}

		if normalizedStatus == "succeeded" {
			if err := s.applyRefundSuccessTx(ctx, tx, order, paymentRecord, refundRecord, prepared.Note, "payment_original_refund", meta, now); err != nil {
				return err
			}
		} else {
			eventType := "refund_original_requested"
			if normalizedStatus == "failed" {
				eventType = "refund_original_failed"
			}

			operatorType, operatorID := auditEventOperator(meta)
			if err := tx.WithContext(ctx).Create(&model.OrderEvent{
				OrderID:      order.ID,
				EventType:    eventType,
				FromStatus:   order.Status,
				ToStatus:     order.Status,
				OperatorType: operatorType,
				OperatorID:   operatorID,
				PayloadJSON: jsonValue(map[string]any{
					"refund_no":    refundRecord.RefundNo,
					"refund_type":  refundRecord.RefundType,
					"status":       normalizedStatus,
					"receipt_no":   refundRecord.ReceiptNo,
					"provider_key": refundRecord.ProviderKey,
					"action_key":   refundRecord.ActionKey,
					"amount":       formatAmount(refundRecord.Amount),
					"currency":     refundRecord.Currency,
					"message":      message,
					"note":         prepared.Note,
					"attempt_no":   refundRecord.AttemptNo,
				}),
				CreatedAt: now,
			}).Error; err != nil {
				return err
			}

			if paymentRecord != nil {
				payload := parseJSON[map[string]any](paymentRecord.RawPayloadJSON)
				payload["refund"] = map[string]any{
					"refund_no":    refundRecord.RefundNo,
					"refund_type":  refundRecord.RefundType,
					"status":       normalizedStatus,
					"receipt_no":   refundRecord.ReceiptNo,
					"provider_key": refundRecord.ProviderKey,
					"action_key":   refundRecord.ActionKey,
					"amount":       formatAmount(refundRecord.Amount),
					"currency":     refundRecord.Currency,
					"message":      message,
					"attempt_no":   refundRecord.AttemptNo,
					"processed_at": now,
					"requested_at": refundRecord.RequestedAt,
				}
				paymentRecord.RawPayloadJSON = jsonValue(payload)
				if err := tx.WithContext(ctx).Save(paymentRecord).Error; err != nil {
					return err
				}
			}

			if err := s.recordPaymentCallbackLogTx(ctx, tx, PaymentCallbackLogInput{
				OrderID:    &order.ID,
				OrderNo:    order.OrderNo,
				ChannelKey: prepared.ChannelKey,
				Status: map[string]string{
					"processing": "warning",
					"failed":     "error",
				}[normalizedStatus],
				Message:    message,
				SourceType: "payment_original_refund",
				RawPayload: map[string]any{
					"refund_no":  refundRecord.RefundNo,
					"receipt_no": refundRecord.ReceiptNo,
					"status":     normalizedStatus,
					"attempt_no": refundRecord.AttemptNo,
					"note":       prepared.Note,
				},
				ProcessedAt: &now,
			}); err != nil {
				return err
			}
		}

		if shouldWriteAdminLog(meta) {
			s.logAdminAction(ctx, tx, meta, "orders", "request_original_refund", prepared.OrderNo, "order", map[string]any{
				"refund_no":      refundRecord.RefundNo,
				"payment_method": prepared.PaymentMethod,
				"channel_key":    prepared.ChannelKey,
				"provider_key":   prepared.ProviderKey,
				"action_key":     prepared.ActionKey,
				"status":         normalizedStatus,
				"receipt_no":     receiptNo,
				"attempt_no":     refundRecord.AttemptNo,
				"note":           prepared.Note,
			})
		}

		result = s.buildRefundResultPayload(refundRecord, message, normalizedStatus == "succeeded")
		return nil
	})
	if err != nil {
		return nil, err
	}

	return result, nil
}

func (s *Service) applyRefundSuccessTx(
	ctx context.Context,
	tx *gorm.DB,
	order *model.Order,
	paymentRecord *model.PaymentRecord,
	refundRecord *model.RefundRecord,
	note string,
	sourceType string,
	meta AuditMeta,
	now time.Time,
) error {
	if order == nil || refundRecord == nil {
		return ErrInvalidInput
	}

	fromStatus := order.Status
	order.Status = "refunded"
	order.PaymentStatus = "refunded"
	order.DeliveryStatus = "cancelled"
	order.UpdatedAt = now
	if err := tx.WithContext(ctx).Save(order).Error; err != nil {
		return err
	}

	if err := s.cancelPendingAsyncJobsTx(
		ctx,
		tx,
		&order.ID,
		order.OrderNo,
		"order_refunded",
		asyncJobTypeFulfillmentRetry,
		asyncJobTypeDeliveryRetry,
	); err != nil {
		return err
	}

	if paymentRecord != nil {
		payload := parseJSON[map[string]any](paymentRecord.RawPayloadJSON)
		payload["refund"] = map[string]any{
			"refund_no":    refundRecord.RefundNo,
			"refund_type":  refundRecord.RefundType,
			"status":       refundRecord.Status,
			"receipt_no":   refundRecord.ReceiptNo,
			"provider_key": refundRecord.ProviderKey,
			"action_key":   refundRecord.ActionKey,
			"amount":       formatAmount(refundRecord.Amount),
			"currency":     refundRecord.Currency,
			"attempt_no":   refundRecord.AttemptNo,
			"refunded_at":  now,
			"note":         strings.TrimSpace(note),
		}
		paymentRecord.Status = "refunded"
		paymentRecord.RawPayloadJSON = jsonValue(payload)
		if err := tx.WithContext(ctx).Save(paymentRecord).Error; err != nil {
			return err
		}
	}

	operatorType, operatorID := auditEventOperator(meta)
	if err := tx.WithContext(ctx).Create(&model.OrderEvent{
		OrderID:      order.ID,
		EventType:    "order_refunded",
		FromStatus:   fromStatus,
		ToStatus:     order.Status,
		OperatorType: operatorType,
		OperatorID:   operatorID,
		PayloadJSON: jsonValue(map[string]any{
			"refund_no":    refundRecord.RefundNo,
			"refund_type":  refundRecord.RefundType,
			"status":       refundRecord.Status,
			"receipt_no":   refundRecord.ReceiptNo,
			"provider_key": refundRecord.ProviderKey,
			"action_key":   refundRecord.ActionKey,
			"amount":       formatAmount(refundRecord.Amount),
			"currency":     refundRecord.Currency,
			"attempt_no":   refundRecord.AttemptNo,
			"note":         strings.TrimSpace(note),
		}),
		CreatedAt: now,
	}).Error; err != nil {
		return err
	}

	if err := s.recordPaymentCallbackLogTx(ctx, tx, PaymentCallbackLogInput{
		OrderID:    &order.ID,
		OrderNo:    order.OrderNo,
		ChannelKey: refundRecord.ChannelKey,
		Status:     "warning",
		Message:    "Order refunded and payment marked as refunded.",
		SourceType: defaultString(sourceType, "admin_refund"),
		RawPayload: map[string]any{
			"refund_no":  refundRecord.RefundNo,
			"receipt_no": refundRecord.ReceiptNo,
			"status":     refundRecord.Status,
			"note":       strings.TrimSpace(note),
			"attempt_no": refundRecord.AttemptNo,
		},
		ProcessedAt: &now,
	}); err != nil {
		return err
	}

	if shouldWriteAdminLog(meta) && refundRecord.RefundType == "mark" {
		s.logAdminAction(ctx, tx, meta, "orders", "mark_refund_order", order.OrderNo, "order", map[string]any{
			"refund_no": refundRecord.RefundNo,
			"status":    refundRecord.Status,
			"note":      strings.TrimSpace(note),
		})
	}

	return nil
}

func (s *Service) buildOriginalRefundTemplateData(
	order *model.Order,
	paymentRecord *model.PaymentRecord,
	channel *model.PaymentChannel,
	config paymentChannelConfig,
	refundNumber string,
	note string,
) map[string]any {
	templateData := map[string]any{
		"order_id":           order.ID,
		"order_no":           order.OrderNo,
		"merchant_order_no":  defaultString(paymentStringValue(paymentRecord, func(item *model.PaymentRecord) string { return item.MerchantOrderNo }), order.OrderNo),
		"payment_method":     order.PaymentMethod,
		"channel_key":        defaultString(channel.ChannelKey, order.PaymentMethod),
		"channel_type":       channel.ChannelType,
		"provider_name":      channel.ProviderName,
		"reference":          config.Reference,
		"refund_no":          refundNumber,
		"refund_amount":      formatAmount(order.PayAmount),
		"refund_currency":    order.Currency,
		"amount":             formatAmount(order.PayAmount),
		"currency":           order.Currency,
		"buyer_ref":          order.BuyerRef,
		"note":               note,
		"reason":             note,
		"third_party_txn_no": paymentStringValue(paymentRecord, func(item *model.PaymentRecord) string { return item.ThirdPartyTxnNo }),
		"chain_tx_hash":      paymentStringValue(paymentRecord, func(item *model.PaymentRecord) string { return item.ChainTxHash }),
		"payer_account":      paymentStringValue(paymentRecord, func(item *model.PaymentRecord) string { return item.PayerAccount }),
	}

	meta := parseJSON[map[string]any](order.MetadataJSON)
	if customerName, ok := meta["customer_name"].(string); ok && strings.TrimSpace(customerName) != "" {
		templateData["customer_name"] = customerName
	}

	return templateData
}

func (s *Service) resolveLatestPaymentRecordForOrderTx(
	ctx context.Context,
	tx *gorm.DB,
	orderID uint,
) (*model.PaymentRecord, error) {
	var record model.PaymentRecord
	if err := tx.WithContext(ctx).
		Where("order_id = ?", orderID).
		Order("id DESC").
		First(&record).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &record, nil
}

func (s *Service) resolvePaymentRecordForRefundTx(
	ctx context.Context,
	tx *gorm.DB,
	paymentRecordID *uint,
	orderID uint,
) (*model.PaymentRecord, error) {
	if paymentRecordID != nil && *paymentRecordID > 0 {
		var record model.PaymentRecord
		if err := tx.WithContext(ctx).First(&record, *paymentRecordID).Error; err == nil {
			return &record, nil
		} else if err != gorm.ErrRecordNotFound {
			return nil, err
		}
	}

	return s.resolveLatestPaymentRecordForOrderTx(ctx, tx, orderID)
}

func (s *Service) resolveLatestRefundRecordForOrderTx(
	ctx context.Context,
	tx *gorm.DB,
	orderID uint,
) (*model.RefundRecord, error) {
	var record model.RefundRecord
	if err := tx.WithContext(ctx).
		Where("order_id = ?", orderID).
		Order("id DESC").
		First(&record).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &record, nil
}

func (s *Service) resolveRefundRecordByIDTx(
	ctx context.Context,
	tx *gorm.DB,
	refundRecordID uint,
) (*model.RefundRecord, error) {
	var record model.RefundRecord
	if err := tx.WithContext(ctx).First(&record, refundRecordID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &record, nil
}

func (s *Service) nextRefundAttemptNoTx(
	ctx context.Context,
	tx *gorm.DB,
	orderID uint,
	refundType string,
) (int, error) {
	var count int64
	if err := tx.WithContext(ctx).
		Model(&model.RefundRecord{}).
		Where("order_id = ? AND refund_type = ?", orderID, strings.TrimSpace(refundType)).
		Count(&count).Error; err != nil {
		return 0, err
	}

	return int(count) + 1, nil
}

func (s *Service) resolvePaymentChannelConfigByTypeTx(
	ctx context.Context,
	tx *gorm.DB,
	paymentMethod string,
) (*model.PaymentChannel, paymentChannelConfig, error) {
	var channel model.PaymentChannel
	if err := tx.WithContext(ctx).
		Where("channel_type = ?", paymentMethod).
		Order("sort_order ASC, id ASC").
		First(&channel).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, paymentChannelConfig{}, ErrNotFound
		}
		return nil, paymentChannelConfig{}, err
	}

	return &channel, normalizePaymentChannelConfig(parseJSON[paymentChannelConfig](channel.ConfigJSON), channel.ChannelName), nil
}

func (s *Service) channelKeyForPaymentMethodTx(
	ctx context.Context,
	tx *gorm.DB,
	paymentMethod string,
) string {
	var channel model.PaymentChannel
	if err := tx.WithContext(ctx).
		Where("channel_type = ?", paymentMethod).
		Order("sort_order ASC, id ASC").
		First(&channel).Error; err != nil {
		return paymentMethod
	}

	return channel.ChannelKey
}

func refundNo() string {
	suffix, err := generateCode(6)
	if err != nil {
		return "RF" + time.Now().Format("20060102150405")
	}

	return "RF" + time.Now().Format("20060102150405") + suffix
}

func normalizeRefundRecordStatus(rawStatus string, execution *ExecuteActionResult, execErr error) string {
	normalized := strings.ToLower(strings.TrimSpace(rawStatus))

	switch normalized {
	case "success", "succeeded", "succeed", "refunded", "completed", "complete", "done", "finished", "ok", "approved", "refund_success":
		return "succeeded"
	case "processing", "pending", "submitted", "accepted", "queued", "in_progress", "retrying", "waiting":
		return "processing"
	case "failed", "fail", "error", "rejected", "closed", "cancelled", "canceled", "timeout", "refund_failed":
		return "failed"
	}

	if execErr != nil {
		return "failed"
	}
	if execution != nil && execution.Success {
		return "succeeded"
	}

	return "failed"
}

func resolveRefundExecutionMessage(
	status string,
	execution *ExecuteActionResult,
	execErr error,
) string {
	if execErr != nil && strings.TrimSpace(execErr.Error()) != "" {
		return strings.TrimSpace(execErr.Error())
	}
	if execution != nil && strings.TrimSpace(execution.Message) != "" {
		return strings.TrimSpace(execution.Message)
	}

	switch status {
	case "processing":
		return "Refund request accepted and is processing."
	case "succeeded":
		return "Refund request completed successfully."
	default:
		return "Refund request failed."
	}
}

func extractRefundStatus(execution *ExecuteActionResult, configuredPath string) string {
	if execution == nil {
		return ""
	}

	if strings.TrimSpace(configuredPath) != "" {
		if value, ok := lookupPath(execution.Response, configuredPath); ok {
			return stringifyTemplateValue(value)
		}
	}

	for _, path := range []string{
		"refund_status",
		"status",
		"data.refund_status",
		"data.status",
		"result.refund_status",
		"result.status",
	} {
		if value, ok := lookupPath(execution.Response, path); ok {
			text := stringifyTemplateValue(value)
			if strings.TrimSpace(text) != "" {
				return text
			}
		}
	}

	return ""
}

func extractRefundReceipt(execution *ExecuteActionResult, configuredPath string) string {
	if execution == nil {
		return ""
	}

	if strings.TrimSpace(configuredPath) != "" {
		if value, ok := lookupPath(execution.Response, configuredPath); ok {
			return strings.TrimSpace(stringifyTemplateValue(value))
		}
	}

	for _, path := range []string{
		"receipt_no",
		"refund_no",
		"refund_id",
		"out_refund_no",
		"transaction_id",
		"data.receipt_no",
		"data.refund_no",
		"data.refund_id",
		"data.out_refund_no",
		"data.transaction_id",
		"result.receipt_no",
		"result.refund_no",
		"result.refund_id",
	} {
		if value, ok := lookupPath(execution.Response, path); ok {
			text := strings.TrimSpace(stringifyTemplateValue(value))
			if text != "" {
				return text
			}
		}
	}

	return ""
}

func refundResponsePayload(
	status string,
	receiptNo string,
	message string,
	execution *ExecuteActionResult,
) map[string]any {
	payload := map[string]any{
		"status":     status,
		"receipt_no": receiptNo,
		"message":    message,
	}

	if execution != nil {
		payload["provider_key"] = execution.ProviderKey
		payload["action_key"] = execution.ActionKey
		payload["success"] = execution.Success
		payload["request"] = execution.Request
		payload["response"] = execution.Response
	}

	return payload
}

func (s *Service) buildRefundResultPayload(
	record *model.RefundRecord,
	message string,
	refunded bool,
) map[string]any {
	if record == nil {
		return map[string]any{
			"status":   "failed",
			"message":  defaultString(strings.TrimSpace(message), "Refund request failed."),
			"refunded": refunded,
		}
	}

	return map[string]any{
		"refund_id":    record.ID,
		"refund_no":    record.RefundNo,
		"refund_type":  record.RefundType,
		"status":       record.Status,
		"receipt_no":   record.ReceiptNo,
		"provider_key": record.ProviderKey,
		"action_key":   record.ActionKey,
		"amount":       formatAmount(record.Amount),
		"currency":     record.Currency,
		"attempt_no":   record.AttemptNo,
		"message":      defaultString(strings.TrimSpace(message), "Refund request handled."),
		"refunded":     refunded,
	}
}

func uintPointerOrNil(record *model.PaymentRecord) *uint {
	if record == nil || record.ID == 0 {
		return nil
	}

	value := record.ID
	return &value
}

func paymentStringValue(record *model.PaymentRecord, getter func(*model.PaymentRecord) string) string {
	if record == nil || getter == nil {
		return ""
	}

	return strings.TrimSpace(getter(record))
}

func latestRefundField(records []model.RefundRecord, getter func(model.RefundRecord) string) string {
	if len(records) == 0 || getter == nil {
		return ""
	}

	return strings.TrimSpace(getter(records[0]))
}

func (s *Service) listAdminRefundMapsForOrder(ctx context.Context, orderID uint) ([]map[string]any, error) {
	if orderID == 0 {
		return nil, nil
	}

	var refundRecords []model.RefundRecord
	if err := s.db.WithContext(ctx).
		Where("order_id = ?", orderID).
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

	return refunds, nil
}
