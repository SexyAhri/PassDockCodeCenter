package service

import (
	"context"
	"fmt"
	"math"
	"time"

	"gorm.io/gorm"

	"passdock/server/internal/model"
)

type AdminPaymentFilters struct {
	OrderNo       string
	PaymentStatus string
	PaymentMethod string
	SourceChannel string
	Page          int
	PageSize      int
}

type AdminPaymentProofFilters struct {
	OrderNo       string
	ReviewStatus  string
	PaymentMethod string
	SourceChannel string
	Page          int
	PageSize      int
}

type PaymentCallbackLogInput struct {
	OrderID     *uint
	OrderNo     string
	CallbackKey string
	ChannelKey  string
	Status      string
	Message     string
	SourceType  string
	RawPayload  map[string]any
	ProcessedAt *time.Time
}

type WatcherRecordInput struct {
	OrderID     *uint
	OrderNo     string
	WatcherKey  string
	ChannelKey  string
	ChainTxHash string
	Amount      float64
	Currency    string
	Status      string
	RawPayload  map[string]any
	ConfirmedAt *time.Time
}

type OnchainConfirmationInput struct {
	OrderNo         string
	PaymentMethod   string
	Amount          string
	Currency        string
	ChainTxHash     string
	PayerAccount    string
	ThirdPartyTxnNo string
	Note            string
}

func (s *Service) ListAdminPaymentRecords(ctx context.Context, filters AdminPaymentFilters) (map[string]any, error) {
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

	query := s.db.WithContext(ctx).Model(&model.PaymentRecord{}).Joins("JOIN orders ON orders.id = payment_records.order_id")
	if filters.OrderNo != "" {
		query = query.Where("orders.order_no LIKE ?", "%"+filters.OrderNo+"%")
	}
	if filters.PaymentStatus != "" {
		query = query.Where("payment_records.status = ?", filters.PaymentStatus)
	}
	if filters.PaymentMethod != "" {
		query = query.Where("payment_records.payment_method = ?", filters.PaymentMethod)
	}
	if filters.SourceChannel != "" {
		query = query.Where("orders.source_channel = ?", filters.SourceChannel)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	var records []model.PaymentRecord
	if err := query.Order("payment_records.created_at DESC, payment_records.id DESC").Limit(pageSize).Offset((page - 1) * pageSize).Find(&records).Error; err != nil {
		return nil, err
	}

	reviewTimeoutMinutes := s.paymentReviewTimeoutMinutes(ctx)
	items := make([]map[string]any, 0, len(records))
	for _, record := range records {
		var order model.Order
		_ = s.db.WithContext(ctx).Where("id = ?", record.OrderID).First(&order).Error

		channelKey := s.channelKeyForPaymentMethod(ctx, record.PaymentMethod)
		reviewDueAt, reviewOverdue := paymentReviewDeadlineWithTimeout(&order, reviewTimeoutMinutes)
		items = append(items, map[string]any{
			"id":                     record.ID,
			"payment_id":             record.ID,
			"order_no":               order.OrderNo,
			"payment_method":         record.PaymentMethod,
			"channel_key":            channelKey,
			"amount":                 formatAmount(record.Amount),
			"currency":               record.Currency,
			"status":                 record.Status,
			"payer_account":          record.PayerAccount,
			"confirmed_at":           record.ConfirmedAt,
			"payment_review_due_at":  reviewDueAt,
			"payment_review_overdue": reviewOverdue,
			"created_at":             record.CreatedAt,
		})
	}

	return map[string]any{
		"items":     items,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	}, nil
}

func (s *Service) GetAdminPaymentRecordDetail(ctx context.Context, routeID string) (map[string]any, error) {
	record, err := s.resolvePaymentRecordByRoute(ctx, routeID)
	if err != nil {
		return nil, err
	}

	order, err := s.getPaymentOpsOrder(ctx, &record.OrderID, record.MerchantOrderNo)
	if err != nil && err != ErrNotFound {
		return nil, err
	}

	channelKey := s.channelKeyForPaymentMethod(ctx, record.PaymentMethod)
	reviewDueAt, reviewOverdue := s.paymentReviewDeadline(ctx, order)
	refunds, err := s.listAdminRefundMapsForOrder(ctx, record.OrderID)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"id":                             record.ID,
		"payment_id":                     record.ID,
		"order_id":                       record.OrderID,
		"order_no":                       paymentOpsOrderNo(order, record.MerchantOrderNo),
		"product_name":                   paymentOpsProductName(s, order),
		"customer_name":                  paymentOpsCustomerName(order),
		"payment_method":                 record.PaymentMethod,
		"channel_key":                    channelKey,
		"merchant_order_no":              record.MerchantOrderNo,
		"third_party_txn_no":             record.ThirdPartyTxnNo,
		"chain_tx_hash":                  record.ChainTxHash,
		"payer_account":                  record.PayerAccount,
		"amount":                         formatAmount(record.Amount),
		"currency":                       record.Currency,
		"status":                         record.Status,
		"payment_status":                 paymentOpsOrderPaymentStatus(order),
		"order_status":                   paymentOpsOrderStatus(order),
		"source_channel":                 paymentOpsSourceChannel(order),
		"buyer_ref":                      paymentOpsBuyerRef(order),
		"raw_payload":                    redactSensitivePayload(parseJSON[map[string]any](record.RawPayloadJSON)),
		"refund_records":                 refunds,
		"confirmed_at":                   record.ConfirmedAt,
		"payment_review_due_at":          reviewDueAt,
		"payment_review_overdue":         reviewOverdue,
		"payment_review_timeout_minutes": s.paymentReviewTimeoutMinutes(ctx),
		"failed_at":                      record.FailedAt,
		"created_at":                     record.CreatedAt,
		"updated_at":                     record.UpdatedAt,
	}, nil
}

func (s *Service) ListAdminPaymentProofs(ctx context.Context, filters AdminPaymentProofFilters) (map[string]any, error) {
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

	query := s.db.WithContext(ctx).Model(&model.PaymentProof{}).Joins("JOIN orders ON orders.id = payment_proofs.order_id")
	if filters.OrderNo != "" {
		query = query.Where("orders.order_no LIKE ?", "%"+filters.OrderNo+"%")
	}
	if filters.ReviewStatus != "" {
		query = query.Where("payment_proofs.review_status = ?", filters.ReviewStatus)
	}
	if filters.PaymentMethod != "" {
		query = query.Where("orders.payment_method = ?", filters.PaymentMethod)
	}
	if filters.SourceChannel != "" {
		query = query.Where("orders.source_channel = ?", filters.SourceChannel)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	var proofs []model.PaymentProof
	if err := query.Order("payment_proofs.created_at DESC, payment_proofs.id DESC").Limit(pageSize).Offset((page - 1) * pageSize).Find(&proofs).Error; err != nil {
		return nil, err
	}

	items := make([]map[string]any, 0, len(proofs))
	reviewTimeoutMinutes := s.paymentReviewTimeoutMinutes(ctx)
	for _, proof := range proofs {
		order, orderErr := s.getPaymentOpsOrder(ctx, &proof.OrderID, "")
		if orderErr != nil && orderErr != ErrNotFound {
			return nil, orderErr
		}

		reviewDueAt, reviewOverdue := paymentReviewDeadlineWithTimeout(order, reviewTimeoutMinutes)
		items = append(items, map[string]any{
			"id":                     proof.ID,
			"proof_id":               proof.ID,
			"order_id":               proof.OrderID,
			"order_no":               paymentOpsOrderNo(order, ""),
			"proof_type":             proof.ProofType,
			"object_key":             proof.ObjectKey,
			"object_url":             s.buildAdminPaymentProofURL(&proof),
			"review_status":          proof.ReviewStatus,
			"reviewed_by":            proof.ReviewedBy,
			"reviewed_at":            proof.ReviewedAt,
			"note":                   proof.Note,
			"product_name":           paymentOpsProductName(s, order),
			"customer_name":          paymentOpsCustomerName(order),
			"payment_method":         paymentOpsPaymentMethod(order),
			"amount":                 paymentOpsAmount(order),
			"currency":               paymentOpsCurrency(order),
			"payment_status":         paymentOpsOrderPaymentStatus(order),
			"order_status":           paymentOpsOrderStatus(order),
			"source_channel":         paymentOpsSourceChannel(order),
			"buyer_ref":              paymentOpsBuyerRef(order),
			"payment_review_due_at":  reviewDueAt,
			"payment_review_overdue": reviewOverdue,
			"created_at":             proof.CreatedAt,
			"updated_at":             proof.UpdatedAt,
		})
	}

	return map[string]any{
		"items":     items,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	}, nil
}

func (s *Service) GetAdminPaymentProofDetail(ctx context.Context, routeID string) (map[string]any, error) {
	proof, err := s.resolvePaymentProofByRoute(ctx, routeID)
	if err != nil {
		return nil, err
	}

	order, err := s.getPaymentOpsOrder(ctx, &proof.OrderID, "")
	if err != nil && err != ErrNotFound {
		return nil, err
	}

	reviewDueAt, reviewOverdue := s.paymentReviewDeadline(ctx, order)
	return map[string]any{
		"id":                             proof.ID,
		"proof_id":                       proof.ID,
		"order_id":                       proof.OrderID,
		"order_no":                       paymentOpsOrderNo(order, ""),
		"product_name":                   paymentOpsProductName(s, order),
		"customer_name":                  paymentOpsCustomerName(order),
		"proof_type":                     proof.ProofType,
		"object_key":                     proof.ObjectKey,
		"object_url":                     s.buildAdminPaymentProofURL(proof),
		"review_status":                  proof.ReviewStatus,
		"reviewed_by":                    proof.ReviewedBy,
		"reviewed_at":                    proof.ReviewedAt,
		"note":                           proof.Note,
		"payment_method":                 paymentOpsPaymentMethod(order),
		"amount":                         paymentOpsAmount(order),
		"currency":                       paymentOpsCurrency(order),
		"payment_status":                 paymentOpsOrderPaymentStatus(order),
		"order_status":                   paymentOpsOrderStatus(order),
		"source_channel":                 paymentOpsSourceChannel(order),
		"buyer_ref":                      paymentOpsBuyerRef(order),
		"payment_review_due_at":          reviewDueAt,
		"payment_review_overdue":         reviewOverdue,
		"payment_review_timeout_minutes": s.paymentReviewTimeoutMinutes(ctx),
		"created_at":                     proof.CreatedAt,
		"updated_at":                     proof.UpdatedAt,
	}, nil
}

func (s *Service) ListAdminCallbackLogs(ctx context.Context) (map[string]any, error) {
	var records []model.PaymentCallbackLog
	if err := s.db.WithContext(ctx).Order("created_at DESC, id DESC").Find(&records).Error; err != nil {
		return nil, err
	}

	items := make([]map[string]any, 0, len(records))
	for _, record := range records {
		orderNo := record.OrderNo
		if orderNo == "" && record.OrderID != nil {
			var order model.Order
			if err := s.db.WithContext(ctx).Where("id = ?", *record.OrderID).First(&order).Error; err == nil {
				orderNo = order.OrderNo
			}
		}

		items = append(items, map[string]any{
			"id":           record.ID,
			"log_id":       record.ID,
			"channel_key":  record.ChannelKey,
			"order_no":     orderNo,
			"status":       record.Status,
			"message":      record.Message,
			"source_type":  record.SourceType,
			"processed_at": record.ProcessedAt,
			"created_at":   record.CreatedAt,
		})
	}

	return map[string]any{"items": items}, nil
}

func (s *Service) GetAdminCallbackLogDetail(ctx context.Context, routeID string) (map[string]any, error) {
	record, err := s.resolvePaymentCallbackLogByRoute(ctx, routeID)
	if err != nil {
		return nil, err
	}

	order, err := s.getPaymentOpsOrder(ctx, record.OrderID, record.OrderNo)
	if err != nil && err != ErrNotFound {
		return nil, err
	}

	return map[string]any{
		"id":             record.ID,
		"log_id":         record.ID,
		"order_id":       paymentOpsOrderID(order, record.OrderID),
		"order_no":       paymentOpsOrderNo(order, record.OrderNo),
		"product_name":   paymentOpsProductName(s, order),
		"customer_name":  paymentOpsCustomerName(order),
		"channel_key":    record.ChannelKey,
		"status":         record.Status,
		"message":        record.Message,
		"source_type":    record.SourceType,
		"payment_method": paymentOpsPaymentMethod(order),
		"payment_status": paymentOpsOrderPaymentStatus(order),
		"order_status":   paymentOpsOrderStatus(order),
		"source_channel": paymentOpsSourceChannel(order),
		"buyer_ref":      paymentOpsBuyerRef(order),
		"raw_payload":    redactSensitivePayload(parseJSON[map[string]any](record.RawPayloadJSON)),
		"processed_at":   record.ProcessedAt,
		"created_at":     record.CreatedAt,
		"updated_at":     record.UpdatedAt,
	}, nil
}

func (s *Service) ListAdminWatcherRecords(ctx context.Context) (map[string]any, error) {
	var records []model.PaymentWatcherRecord
	if err := s.db.WithContext(ctx).Order("created_at DESC, id DESC").Find(&records).Error; err != nil {
		return nil, err
	}

	items := make([]map[string]any, 0, len(records))
	for _, record := range records {
		items = append(items, map[string]any{
			"id":           record.ID,
			"record_id":    record.ID,
			"order_no":     record.OrderNo,
			"channel_key":  record.ChannelKey,
			"hash":         record.ChainTxHash,
			"amount":       fmt.Sprintf("%s %s", formatAmount(record.Amount), record.Currency),
			"currency":     record.Currency,
			"status":       record.Status,
			"confirmed_at": record.ConfirmedAt,
			"created_at":   record.CreatedAt,
		})
	}

	return map[string]any{"items": items}, nil
}

func (s *Service) GetAdminWatcherRecordDetail(ctx context.Context, routeID string) (map[string]any, error) {
	record, err := s.resolvePaymentWatcherRecordByRoute(ctx, routeID)
	if err != nil {
		return nil, err
	}

	order, err := s.getPaymentOpsOrder(ctx, record.OrderID, record.OrderNo)
	if err != nil && err != ErrNotFound {
		return nil, err
	}

	return map[string]any{
		"id":             record.ID,
		"record_id":      record.ID,
		"order_id":       paymentOpsOrderID(order, record.OrderID),
		"order_no":       paymentOpsOrderNo(order, record.OrderNo),
		"product_name":   paymentOpsProductName(s, order),
		"customer_name":  paymentOpsCustomerName(order),
		"channel_key":    record.ChannelKey,
		"chain_tx_hash":  record.ChainTxHash,
		"amount":         formatAmount(record.Amount),
		"currency":       record.Currency,
		"status":         record.Status,
		"payment_method": paymentOpsPaymentMethod(order),
		"payment_status": paymentOpsOrderPaymentStatus(order),
		"order_status":   paymentOpsOrderStatus(order),
		"source_channel": paymentOpsSourceChannel(order),
		"buyer_ref":      paymentOpsBuyerRef(order),
		"raw_payload":    redactSensitivePayload(parseJSON[map[string]any](record.RawPayloadJSON)),
		"confirmed_at":   record.ConfirmedAt,
		"created_at":     record.CreatedAt,
		"updated_at":     record.UpdatedAt,
	}, nil
}

func (s *Service) createOrUpdatePaymentRecordTx(ctx context.Context, tx *gorm.DB, order *model.Order, status string, updater func(*model.PaymentRecord)) error {
	var record model.PaymentRecord
	err := tx.WithContext(ctx).Where("order_id = ?", order.ID).Order("id DESC").First(&record).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		return err
	}

	if record.ID == 0 {
		record = model.PaymentRecord{
			OrderID:         order.ID,
			PaymentMethod:   order.PaymentMethod,
			MerchantOrderNo: order.OrderNo,
			PayerAccount:    order.BuyerRef,
			Amount:          order.PayAmount,
			Currency:        order.Currency,
			Status:          status,
		}
		if updater != nil {
			updater(&record)
		}
		return tx.Create(&record).Error
	}

	record.PaymentMethod = order.PaymentMethod
	record.MerchantOrderNo = order.OrderNo
	record.Amount = order.PayAmount
	record.Currency = order.Currency
	record.Status = status
	if updater != nil {
		updater(&record)
	}

	return tx.Save(&record).Error
}

func (s *Service) recordPaymentCallbackLogTx(ctx context.Context, tx *gorm.DB, input PaymentCallbackLogInput) error {
	record := model.PaymentCallbackLog{
		OrderID:        input.OrderID,
		OrderNo:        input.OrderNo,
		CallbackKey:    stringPointerOrNil(input.CallbackKey),
		ChannelKey:     input.ChannelKey,
		Status:         defaultString(input.Status, "success"),
		Message:        input.Message,
		SourceType:     defaultString(input.SourceType, "system"),
		RawPayloadJSON: jsonValue(input.RawPayload),
		ProcessedAt:    input.ProcessedAt,
	}

	return tx.WithContext(ctx).Create(&record).Error
}

func (s *Service) createWatcherRecordTx(ctx context.Context, tx *gorm.DB, input WatcherRecordInput) error {
	record := model.PaymentWatcherRecord{
		OrderID:        input.OrderID,
		OrderNo:        input.OrderNo,
		WatcherKey:     stringPointerOrNil(input.WatcherKey),
		ChannelKey:     input.ChannelKey,
		ChainTxHash:    input.ChainTxHash,
		Amount:         input.Amount,
		Currency:       defaultString(input.Currency, "USDT"),
		Status:         defaultString(input.Status, "pending"),
		RawPayloadJSON: jsonValue(input.RawPayload),
		ConfirmedAt:    input.ConfirmedAt,
	}

	return tx.WithContext(ctx).Create(&record).Error
}

func (s *Service) HandleOnchainConfirmation(ctx context.Context, input OnchainConfirmationInput, meta AuditMeta) (map[string]any, error) {
	amount, err := parseFloat(input.Amount)
	if err != nil {
		return nil, ErrInvalidInput
	}

	channelKey := s.channelKeyForPaymentMethod(ctx, input.PaymentMethod)
	watcherKey := buildPaymentWatcherKey(channelKey, input)
	now := time.Now()

	existingWatcher, err := s.resolvePaymentWatcherRecordByWatcherKey(ctx, watcherKey)
	if err != nil && err != ErrNotFound {
		return nil, err
	}
	if existingWatcher != nil {
		if existingWatcher.OrderNo != "" && input.OrderNo != "" && existingWatcher.OrderNo != input.OrderNo {
			return map[string]any{
				"order_no":      existingWatcher.OrderNo,
				"chain_tx_hash": input.ChainTxHash,
				"status":        "manual_review",
				"duplicate":     true,
				"message":       "Chain transaction is already attached to another order.",
			}, nil
		}

		return map[string]any{
			"order_no":      defaultString(existingWatcher.OrderNo, input.OrderNo),
			"chain_tx_hash": input.ChainTxHash,
			"status":        existingWatcher.Status,
			"duplicate":     true,
			"message":       "On-chain confirmation already processed.",
		}, nil
	}

	order, err := s.resolveOrderByNo(ctx, input.OrderNo)
	if err != nil {
		transactionErr := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			return s.createWatcherRecordTx(ctx, tx, WatcherRecordInput{
				OrderNo:     input.OrderNo,
				WatcherKey:  watcherKey,
				ChannelKey:  channelKey,
				ChainTxHash: input.ChainTxHash,
				Amount:      amount,
				Currency:    input.Currency,
				Status:      "manual_review",
				RawPayload: map[string]any{
					"reason": "order_not_found",
				},
				ConfirmedAt: &now,
			})
		})
		if transactionErr != nil && !isUniqueConstraintError(transactionErr) {
			return nil, transactionErr
		}
		if transactionErr != nil && isUniqueConstraintError(transactionErr) {
			if duplicateWatcher, resolveErr := s.resolvePaymentWatcherRecordByWatcherKey(ctx, watcherKey); resolveErr == nil && duplicateWatcher != nil {
				return map[string]any{
					"order_no":      defaultString(duplicateWatcher.OrderNo, input.OrderNo),
					"chain_tx_hash": input.ChainTxHash,
					"status":        duplicateWatcher.Status,
					"duplicate":     true,
					"message":       "On-chain confirmation already processed.",
				}, nil
			}
		}
		return map[string]any{
			"order_no":  input.OrderNo,
			"status":    "manual_review",
			"duplicate": false,
			"message":   "Order not found, escalated for manual review.",
		}, nil
	}

	status := "matched"
	message := "On-chain confirmation succeeded and order moved forward."
	if math.Abs(order.PayAmount-amount) > 0.009 {
		status = "manual_review"
		message = "Amount mismatch detected and escalated for manual review."
	}

	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := s.createWatcherRecordTx(ctx, tx, WatcherRecordInput{
			OrderID:     &order.ID,
			OrderNo:     order.OrderNo,
			WatcherKey:  watcherKey,
			ChannelKey:  channelKey,
			ChainTxHash: input.ChainTxHash,
			Amount:      amount,
			Currency:    input.Currency,
			Status:      status,
			RawPayload: map[string]any{
				"payer_account": input.PayerAccount,
			},
			ConfirmedAt: &now,
		}); err != nil {
			return err
		}

		if status != "matched" {
			return s.recordPaymentCallbackLogTx(ctx, tx, PaymentCallbackLogInput{
				OrderID:    &order.ID,
				OrderNo:    order.OrderNo,
				ChannelKey: channelKey,
				Status:     "error",
				Message:    message,
				SourceType: "onchain_watcher",
				RawPayload: map[string]any{
					"chain_tx_hash": input.ChainTxHash,
					"amount":        input.Amount,
					"currency":      input.Currency,
				},
				ProcessedAt: &now,
			})
		}

		return nil
	}); err != nil {
		if isUniqueConstraintError(err) {
			if duplicateWatcher, resolveErr := s.resolvePaymentWatcherRecordByWatcherKey(ctx, watcherKey); resolveErr == nil && duplicateWatcher != nil {
				return map[string]any{
					"order_no":      defaultString(duplicateWatcher.OrderNo, order.OrderNo),
					"chain_tx_hash": input.ChainTxHash,
					"status":        duplicateWatcher.Status,
					"duplicate":     true,
					"message":       "On-chain confirmation already processed.",
				}, nil
			}
		}
		return nil, err
	}

	if status == "matched" {
		if err := s.ConfirmAdminOrderPayment(ctx, order.OrderNo, ConfirmPaymentInput{
			PaymentMethod:   defaultString(input.PaymentMethod, order.PaymentMethod),
			Amount:          input.Amount,
			Currency:        defaultString(input.Currency, order.Currency),
			Note:            defaultString(input.Note, "onchain confirmation"),
			ThirdPartyTxnNo: input.ThirdPartyTxnNo,
			ChainTxHash:     input.ChainTxHash,
			PayerAccount:    input.PayerAccount,
			RawPayload: map[string]any{
				"chain_tx_hash": input.ChainTxHash,
				"amount":        input.Amount,
				"currency":      input.Currency,
			},
			SourceType:     "onchain_confirm",
			SuccessMessage: "On-chain confirmation succeeded and order moved forward.",
			CallbackKey:    sha256HexStrings("onchain_confirm", watcherKey),
		}, meta); err != nil {
			return nil, err
		}

		automation, err := s.ApplyPaymentPostConfirmAutomation(ctx, order.OrderNo, false, false, meta)
		if err != nil {
			return nil, err
		}

		return map[string]any{
			"order_no":            input.OrderNo,
			"chain_tx_hash":       input.ChainTxHash,
			"status":              status,
			"duplicate":           false,
			"message":             message,
			"auto_fulfill":        automation.EffectiveAutoFulfill,
			"auto_deliver":        automation.EffectiveAutoDeliver,
			"config_auto_fulfill": automation.ConfigAutoFulfill,
			"config_auto_deliver": automation.ConfigAutoDeliver,
		}, nil
	}

	return map[string]any{
		"order_no":      input.OrderNo,
		"chain_tx_hash": input.ChainTxHash,
		"status":        status,
		"duplicate":     false,
		"message":       message,
	}, nil
}

func (s *Service) channelKeyForPaymentMethod(ctx context.Context, paymentMethod string) string {
	var channel model.PaymentChannel
	if err := s.db.WithContext(ctx).Where("channel_type = ?", paymentMethod).Order("sort_order ASC, id ASC").First(&channel).Error; err != nil {
		return paymentMethod
	}

	return channel.ChannelKey
}

func (s *Service) getPaymentOpsOrder(ctx context.Context, orderID *uint, orderNo string) (*model.Order, error) {
	if orderID != nil && *orderID > 0 {
		var order model.Order
		if err := s.db.WithContext(ctx).
			Preload("OrderItems").
			Where("id = ?", *orderID).
			First(&order).Error; err == nil {
			return &order, nil
		} else if err != gorm.ErrRecordNotFound {
			return nil, err
		}
	}

	if orderNo != "" {
		return s.resolveOrderByNo(ctx, orderNo)
	}

	return nil, ErrNotFound
}

func paymentOpsOrderNo(order *model.Order, fallback string) string {
	if order != nil && order.OrderNo != "" {
		return order.OrderNo
	}
	return fallback
}

func paymentOpsOrderID(order *model.Order, fallback *uint) any {
	if order != nil {
		return order.ID
	}
	if fallback != nil {
		return *fallback
	}
	return nil
}

func paymentOpsProductName(s *Service, order *model.Order) string {
	if order == nil {
		return ""
	}
	return s.orderProductName(*order)
}

func paymentOpsCustomerName(order *model.Order) string {
	if order == nil {
		return ""
	}
	return buildCustomerName(*order)
}

func paymentOpsPaymentMethod(order *model.Order) string {
	if order == nil {
		return ""
	}
	return order.PaymentMethod
}

func paymentOpsAmount(order *model.Order) string {
	if order == nil {
		return ""
	}
	return formatAmount(order.PayAmount)
}

func paymentOpsCurrency(order *model.Order) string {
	if order == nil {
		return ""
	}
	return order.Currency
}

func paymentOpsOrderPaymentStatus(order *model.Order) string {
	if order == nil {
		return ""
	}
	return order.PaymentStatus
}

func paymentOpsOrderStatus(order *model.Order) string {
	if order == nil {
		return ""
	}
	return order.Status
}

func paymentOpsSourceChannel(order *model.Order) string {
	if order == nil {
		return ""
	}
	return order.SourceChannel
}

func paymentOpsBuyerRef(order *model.Order) string {
	if order == nil {
		return ""
	}
	return order.BuyerRef
}
