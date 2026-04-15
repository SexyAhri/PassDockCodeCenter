package service

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

	"gorm.io/gorm"

	"passdock/server/internal/model"
)

type CreateOrderInput struct {
	UserID        *uint
	ProductID     uint
	PriceID       string
	PaymentMethod string
	SourceChannel string
	BotKey        string
	BuyerRef      string
	Quantity      int
	Currency      string
}

type UploadPaymentProofInput struct {
	ProofType string
	ObjectKey string
	ObjectURL string
	Note      string
}

type StorefrontOrderAccessInput struct {
	UserID           *uint
	OrderAccessToken string
}

func (s *Service) ListPublicProducts(ctx context.Context) ([]map[string]any, error) {
	var products []model.Product
	if err := s.db.WithContext(ctx).
		Preload("ProductPrices", "enabled = ?", true).
		Where("enabled = ?", true).
		Order("sort_order ASC, id ASC").
		Find(&products).Error; err != nil {
		return nil, err
	}

	result := make([]map[string]any, 0, len(products))
	for _, item := range products {
		meta := parseJSON[productMetadata](item.MetadataJSON)
		priceTemplates := make([]map[string]any, 0, len(item.ProductPrices))
		for _, price := range item.ProductPrices {
			priceTemplates = append(priceTemplates, map[string]any{
				"id":             price.ID,
				"price_id":       price.ID,
				"template_name":  price.TemplateName,
				"payment_method": price.PaymentMethod,
				"display_price":  formatAmount(price.Amount),
				"original_price": formatAmount(price.OriginalAmount),
				"currency":       price.Currency,
				"billing_cycle":  price.BillingCycle,
				"enabled":        price.Enabled,
				"sort_order":     price.SortOrder,
			})
		}
		result = append(result, map[string]any{
			"id":                item.ID,
			"sku":               item.SKU,
			"name":              item.Name,
			"name_zh":           meta.NameZH,
			"name_en":           meta.NameEN,
			"description":       item.Description,
			"display_price":     formatAmount(item.DisplayPrice),
			"original_price":    meta.OriginalPrice,
			"currency":          item.Currency,
			"product_type":      item.ProductType,
			"billing_cycle":     meta.BillingCycle,
			"payment_methods":   meta.PaymentMethods,
			"enabled":           item.Enabled,
			"inventory":         meta.Inventory,
			"sort_order":        item.SortOrder,
			"badge_zh":          meta.BadgeZH,
			"badge_en":          meta.BadgeEN,
			"cycle_label_zh":    defaultString(meta.CycleLabelZH, productBillingCycleLabel(meta.BillingCycle, "zh-CN")),
			"cycle_label_en":    defaultString(meta.CycleLabelEN, productBillingCycleLabel(meta.BillingCycle, "en-US")),
			"delivery_label_zh": defaultString(meta.DeliveryLabelZH, defaultPublicDeliveryLabel(item.DeliveryStrategyKey, "zh-CN")),
			"delivery_label_en": defaultString(meta.DeliveryLabelEN, defaultPublicDeliveryLabel(item.DeliveryStrategyKey, "en-US")),
			"stock_label_zh":    defaultString(meta.StockLabelZH, defaultPublicStockLabel(item, meta, "zh-CN")),
			"stock_label_en":    defaultString(meta.StockLabelEN, defaultPublicStockLabel(item, meta, "en-US")),
			"status_label_zh":   defaultString(meta.StatusLabelZH, defaultPublicStatusLabel(item.Enabled, "zh-CN")),
			"status_label_en":   defaultString(meta.StatusLabelEN, defaultPublicStatusLabel(item.Enabled, "en-US")),
			"tags_zh":           normalizeStringList(nil, meta.TagsZH),
			"tags_en":           normalizeStringList(nil, meta.TagsEN),
			"checkout_notes_zh": normalizeStringList(nil, meta.CheckoutNotesZH),
			"checkout_notes_en": normalizeStringList(nil, meta.CheckoutNotesEN),
			"art_variant":       normalizePublicProductArtVariant(meta.ArtVariant),
			"price_templates":   priceTemplates,
		})
	}

	return result, nil
}

func productBillingCycleLabel(value string, locale string) string {
	switch strings.TrimSpace(strings.ToLower(value)) {
	case "monthly":
		if locale == "zh-CN" {
			return "月付"
		}
		return "Monthly"
	case "quarterly":
		if locale == "zh-CN" {
			return "季付"
		}
		return "Quarterly"
	case "yearly", "annual":
		if locale == "zh-CN" {
			return "年付"
		}
		return "Yearly"
	case "one_time", "one-time":
		if locale == "zh-CN" {
			return "一次性"
		}
		return "One-time"
	default:
		return ""
	}
}

func defaultPublicDeliveryLabel(strategyKey string, locale string) string {
	lowered := strings.ToLower(strings.TrimSpace(strategyKey))
	switch {
	case strings.Contains(lowered, "telegram"):
		if locale == "zh-CN" {
			return "站内 + Telegram"
		}
		return "Web + Telegram"
	case strings.Contains(lowered, "email"):
		if locale == "zh-CN" {
			return "邮件交付"
		}
		return "Email delivery"
	case strings.Contains(lowered, "manual"):
		if locale == "zh-CN" {
			return "人工交付"
		}
		return "Manual delivery"
	default:
		if locale == "zh-CN" {
			return "站内交付"
		}
		return "Web delivery"
	}
}

func defaultPublicStockLabel(product model.Product, meta productMetadata, locale string) string {
	if meta.Inventory <= 0 {
		if locale == "zh-CN" {
			return "需补货"
		}
		return "Restock required"
	}

	loweredType := strings.ToLower(strings.TrimSpace(product.ProductType))
	if loweredType == "manual" {
		if locale == "zh-CN" {
			return "人工处理"
		}
		return "Manual handling"
	}

	if locale == "zh-CN" {
		return "即时发放"
	}
	return "Instant issue"
}

func defaultPublicStatusLabel(enabled bool, locale string) string {
	if !enabled {
		if locale == "zh-CN" {
			return "停用"
		}
		return "Disabled"
	}

	if locale == "zh-CN" {
		return "上架"
	}
	return "Live"
}

func defaultPublicPaymentModeLabel(channelType string, settlementMode string, providerName string, locale string) string {
	loweredType := strings.ToLower(strings.TrimSpace(channelType))
	loweredProvider := strings.ToLower(strings.TrimSpace(providerName))
	if strings.TrimSpace(settlementMode) == "auto" {
		if strings.Contains(loweredProvider, "chain") || strings.Contains(loweredType, "usdt") {
			if locale == "zh-CN" {
				return "链上 watcher"
			}
			return "On-chain watcher"
		}
		if locale == "zh-CN" {
			return "自动确认"
		}
		return "Auto confirmation"
	}

	if locale == "zh-CN" {
		return "人工确认"
	}
	return "Manual review"
}

func normalizePublicProductArtVariant(value string) string {
	switch strings.TrimSpace(strings.ToLower(value)) {
	case "trial", "starter", "growth", "team", "enterprise":
		return strings.TrimSpace(strings.ToLower(value))
	case "pro":
		return "growth"
	default:
		return "starter"
	}
}

func (s *Service) ListPublicPaymentChannels(ctx context.Context) ([]map[string]any, error) {
	var channels []model.PaymentChannel
	if err := s.db.WithContext(ctx).
		Where("enabled = ?", true).
		Order("sort_order ASC, id ASC").
		Find(&channels).Error; err != nil {
		return nil, err
	}

	result := make([]map[string]any, 0, len(channels))
	for _, item := range channels {
		config := s.storefrontPaymentChannelConfig(&item)
		modeLabelZH := defaultString(config.ModeLabelZH, defaultPublicPaymentModeLabel(item.ChannelType, item.SettlementMode, item.ProviderName, "zh-CN"))
		modeLabelEN := defaultString(config.ModeLabelEN, defaultPublicPaymentModeLabel(item.ChannelType, item.SettlementMode, item.ProviderName, "en-US"))
		result = append(result, map[string]any{
			"id":              item.ID,
			"channel_key":     item.ChannelKey,
			"channel_name":    item.ChannelName,
			"channel_type":    item.ChannelType,
			"provider_name":   item.ProviderName,
			"currency":        item.Currency,
			"settlement_mode": item.SettlementMode,
			"enabled":         item.Enabled,
			"config": map[string]any{
				"qr_content":      config.QRContent,
				"display_name":    config.DisplayName,
				"display_name_zh": config.DisplayNameZH,
				"display_name_en": config.DisplayNameEN,
				"mode_label_zh":   modeLabelZH,
				"mode_label_en":   modeLabelEN,
				"reference":       config.Reference,
				"auto_fulfill":    config.AutoFulfill,
				"auto_deliver":    config.AutoDeliver,
			},
			"qr_value":        config.QRContent,
			"display_name_zh": config.DisplayNameZH,
			"display_name_en": config.DisplayNameEN,
			"mode_label_zh":   modeLabelZH,
			"mode_label_en":   modeLabelEN,
			"reference":       config.Reference,
			"auto_fulfill":    config.AutoFulfill,
			"auto_deliver":    config.AutoDeliver,
		})
	}

	return result, nil
}

func (s *Service) CreateOrder(ctx context.Context, input CreateOrderInput) (map[string]any, error) {
	if input.ProductID == 0 || strings.TrimSpace(input.PaymentMethod) == "" {
		return nil, ErrInvalidInput
	}
	if input.Quantity <= 0 {
		input.Quantity = 1
	}
	if input.SourceChannel == "" {
		input.SourceChannel = "web"
	}

	var product model.Product
	if err := s.db.WithContext(ctx).Where("id = ? AND enabled = ?", input.ProductID, true).First(&product).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrNotFound
		}
		return nil, err
	}
	meta := parseJSON[productMetadata](product.MetadataJSON)
	if meta.Inventory > 0 && input.Quantity > meta.Inventory {
		return nil, ErrInsufficientInventory
	}
	if len(meta.PaymentMethods) > 0 && !stringListContains(meta.PaymentMethods, input.PaymentMethod) {
		return nil, ErrInvalidInput
	}

	if err := s.db.WithContext(ctx).
		Where("channel_type = ? AND enabled = ?", input.PaymentMethod, true).
		First(&model.PaymentChannel{}).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrInvalidInput
		}
		return nil, err
	}

	metadata := map[string]any{
		"customer_name": humanizeBuyerRef(input.BuyerRef),
	}
	if strings.TrimSpace(input.BotKey) != "" {
		metadata["bot_key"] = strings.TrimSpace(input.BotKey)
	}

	unitAmount := product.DisplayPrice
	selectedPriceID := strings.TrimSpace(input.PriceID)
	selectedTemplateName := ""
	selectedBillingCycle := ""
	if selectedPriceID != "" {
		price, err := s.resolveProductPriceByRoute(ctx, product.ID, selectedPriceID)
		if err != nil {
			return nil, err
		}
		if !price.Enabled {
			return nil, ErrInvalidState
		}
		if strings.TrimSpace(price.PaymentMethod) != strings.TrimSpace(input.PaymentMethod) {
			return nil, ErrInvalidInput
		}
		if input.Currency == "" {
			input.Currency = defaultString(price.Currency, product.Currency)
		}
		if strings.TrimSpace(price.Currency) != "" && strings.TrimSpace(input.Currency) != strings.TrimSpace(price.Currency) {
			return nil, ErrInvalidInput
		}
		unitAmount = price.Amount
		selectedPriceID = fmt.Sprintf("%d", price.ID)
		selectedTemplateName = price.TemplateName
		selectedBillingCycle = price.BillingCycle
	} else {
		var price model.ProductPrice
		if strings.TrimSpace(input.Currency) != "" {
			err := s.db.WithContext(ctx).
				Where("product_id = ? AND payment_method = ? AND currency = ? AND enabled = ?", product.ID, input.PaymentMethod, input.Currency, true).
				Order("sort_order ASC, id ASC").
				First(&price).Error
			if err != nil && err != gorm.ErrRecordNotFound {
				return nil, err
			}
		}
		if price.ID == 0 {
			err := s.db.WithContext(ctx).
				Where("product_id = ? AND payment_method = ? AND enabled = ?", product.ID, input.PaymentMethod, true).
				Order("sort_order ASC, id ASC").
				First(&price).Error
			if err != nil && err != gorm.ErrRecordNotFound {
				return nil, err
			}
		}
		if price.ID != 0 {
			unitAmount = price.Amount
			selectedPriceID = fmt.Sprintf("%d", price.ID)
			selectedTemplateName = price.TemplateName
			selectedBillingCycle = price.BillingCycle
			input.Currency = firstNonEmpty(price.Currency, input.Currency, product.Currency)
		}
	}
	if input.Currency == "" {
		input.Currency = product.Currency
	}
	if selectedPriceID != "" {
		metadata["selected_price_id"] = selectedPriceID
	}
	if selectedTemplateName != "" {
		metadata["selected_template_name"] = selectedTemplateName
	}
	if selectedBillingCycle != "" {
		metadata["selected_billing_cycle"] = selectedBillingCycle
	}
	totalAmount := unitAmount * float64(input.Quantity)

	expireMinutes := s.orderExpireMinutes(ctx)
	expireAt := time.Now().Add(time.Duration(expireMinutes) * time.Minute)
	orderNumber := orderNo()
	order := model.Order{
		OrderNo:         orderNumber,
		UserID:          input.UserID,
		ProductID:       &product.ID,
		ProductSnapshot: jsonValue(s.productSnapshot(product)),
		PaymentMethod:   input.PaymentMethod,
		Currency:        input.Currency,
		PriceAmount:     totalAmount,
		PayAmount:       totalAmount,
		Status:          "awaiting_payment",
		PaymentStatus:   "unpaid",
		DeliveryStatus:  "pending",
		SourceChannel:   input.SourceChannel,
		BuyerRef:        input.BuyerRef,
		ExternalRef:     orderNumber,
		MetadataJSON:    jsonValue(metadata),
		ExpireAt:        &expireAt,
	}

	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&order).Error; err != nil {
			return err
		}

		orderItem := model.OrderItem{
			OrderID:                order.ID,
			ProductID:              &product.ID,
			ProductSnapshot:        jsonValue(s.productSnapshot(product)),
			Quantity:               input.Quantity,
			UnitAmount:             unitAmount,
			LineAmount:             totalAmount,
			FulfillmentStrategyKey: product.FulfillmentStrategyKey,
			DeliveryStrategyKey:    product.DeliveryStrategyKey,
		}
		if err := tx.Create(&orderItem).Error; err != nil {
			return err
		}

		if err := s.createOrUpdatePaymentRecordTx(ctx, tx, &order, "unpaid", nil); err != nil {
			return err
		}

		return tx.Create(&model.OrderEvent{
			OrderID:      order.ID,
			EventType:    "order_created",
			ToStatus:     order.Status,
			OperatorType: "buyer",
			PayloadJSON:  jsonValue(map[string]any{"source_channel": input.SourceChannel}),
			CreatedAt:    time.Now(),
		}).Error
	}); err != nil {
		return nil, err
	}

	return s.GetStorefrontOrder(ctx, order.OrderNo)
}

func (s *Service) GetStorefrontOrder(ctx context.Context, value string) (map[string]any, error) {
	order, err := s.resolveOrderByNo(ctx, value)
	if err != nil {
		return nil, err
	}

	var item model.OrderItem
	_ = s.db.WithContext(ctx).Where("order_id = ?", order.ID).Order("id ASC").First(&item).Error

	var channel model.PaymentChannel
	_ = s.db.WithContext(ctx).Where("channel_type = ?", order.PaymentMethod).First(&channel).Error
	config := s.storefrontPaymentChannelConfig(&channel)

	proofs := make([]map[string]any, 0, len(order.PaymentProofs))
	for _, proof := range order.PaymentProofs {
		proofs = append(proofs, map[string]any{
			"id":            proof.ID,
			"proof_id":      proof.ID,
			"proof_type":    proof.ProofType,
			"object_key":    proof.ObjectKey,
			"object_url":    s.buildStorefrontPaymentProofURL(order, &proof),
			"review_status": proof.ReviewStatus,
			"reviewed_at":   proof.ReviewedAt,
			"note":          proof.Note,
			"created_at":    proof.CreatedAt,
		})
	}

	reviewTimeoutMinutes := s.paymentReviewTimeoutMinutes(ctx)
	reviewDueAt, reviewOverdue := paymentReviewDeadlineWithTimeout(order, reviewTimeoutMinutes)
	var deliveryResult any
	if embeddedDeliveryResult := s.buildStorefrontEmbeddedDeliveryResult(ctx, order); embeddedDeliveryResult != nil {
		deliveryResult = embeddedDeliveryResult
	}

	return map[string]any{
		"order_no":           order.OrderNo,
		"order_status":       order.Status,
		"payment_status":     order.PaymentStatus,
		"delivery_status":    order.DeliveryStatus,
		"payment_method":     order.PaymentMethod,
		"source_channel":     order.SourceChannel,
		"bot_key":            orderBotKey(*order),
		"buyer_ref":          order.BuyerRef,
		"quantity":           item.Quantity,
		"currency":           order.Currency,
		"display_amount":     formatAmount(order.PayAmount),
		"price_id":           stringValue(parseJSON[map[string]any](order.MetadataJSON)["selected_price_id"]),
		"template_name":      stringValue(parseJSON[map[string]any](order.MetadataJSON)["selected_template_name"]),
		"billing_cycle":      stringValue(parseJSON[map[string]any](order.MetadataJSON)["selected_billing_cycle"]),
		"order_access_token": s.storefrontOrderAccessToken(order),
		"payment_instruction": map[string]any{
			"channel_key":    channel.ChannelKey,
			"type":           "qr",
			"display_amount": formatAmount(order.PayAmount),
			"currency":       defaultString(channel.Currency, order.Currency),
			"qr_content":     config.QRContent,
			"expire_at":      order.ExpireAt,
			"reference":      config.Reference,
		},
		"payment_proofs":                 proofs,
		"delivery_result":                deliveryResult,
		"order_expire_minutes":           s.orderExpireMinutes(ctx),
		"payment_review_timeout_minutes": reviewTimeoutMinutes,
		"payment_review_due_at":          reviewDueAt,
		"payment_review_overdue":         reviewOverdue,
	}, nil
}

func (s *Service) GetPublicStorefrontOrder(
	ctx context.Context,
	value string,
	access StorefrontOrderAccessInput,
) (map[string]any, error) {
	if _, err := s.resolveAuthorizedStorefrontOrder(ctx, value, access); err != nil {
		return nil, err
	}

	return s.GetStorefrontOrder(ctx, value)
}

func (s *Service) MarkStorefrontOrderPaid(ctx context.Context, value string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		order, err := s.resolveOrderByNo(ctx, value)
		if err != nil {
			return err
		}
		if order.PaymentStatus == "paid" || order.Status == "completed" || order.Status == "delivered" {
			return ErrInvalidState
		}

		now := time.Now()
		fromStatus := order.Status
		order.Status = "paid_pending_review"
		order.PaymentStatus = "pending_review"
		order.PaidAt = &now
		order.UpdatedAt = now
		if err := tx.Save(order).Error; err != nil {
			return err
		}

		if err := s.createOrUpdatePaymentRecordTx(ctx, tx, order, "pending_review", func(record *model.PaymentRecord) {
			record.PayerAccount = defaultString(order.BuyerRef, record.PayerAccount)
			record.ConfirmedAt = &now
		}); err != nil {
			return err
		}

		if err := s.recordPaymentCallbackLogTx(ctx, tx, PaymentCallbackLogInput{
			OrderID:     &order.ID,
			OrderNo:     order.OrderNo,
			ChannelKey:  s.channelKeyForPaymentMethod(ctx, order.PaymentMethod),
			Status:      "warning",
			Message:     "Buyer marked paid and is waiting for operator proof review.",
			SourceType:  "buyer_mark_paid",
			ProcessedAt: &now,
		}); err != nil {
			return err
		}

		return tx.Create(&model.OrderEvent{
			OrderID:      order.ID,
			EventType:    "buyer_mark_paid",
			FromStatus:   fromStatus,
			ToStatus:     order.Status,
			OperatorType: "buyer",
			PayloadJSON:  jsonValue(map[string]any{"payment_status": order.PaymentStatus}),
			CreatedAt:    now,
		}).Error
	})
}

func (s *Service) MarkPublicStorefrontOrderPaid(
	ctx context.Context,
	value string,
	access StorefrontOrderAccessInput,
) error {
	if _, err := s.resolveAuthorizedStorefrontOrder(ctx, value, access); err != nil {
		return err
	}

	return s.MarkStorefrontOrderPaid(ctx, value)
}

func (s *Service) CancelStorefrontOrder(ctx context.Context, value string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		order, err := s.resolveOrderByNo(ctx, value)
		if err != nil {
			return err
		}
		if order.PaymentStatus == "paid" || order.Status == "completed" || order.Status == "delivered" {
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

		if err := s.createOrUpdatePaymentRecordTx(ctx, tx, order, "failed", nil); err != nil {
			return err
		}

		return tx.Create(&model.OrderEvent{
			OrderID:      order.ID,
			EventType:    "order_cancelled",
			FromStatus:   fromStatus,
			ToStatus:     order.Status,
			OperatorType: "buyer",
			CreatedAt:    now,
		}).Error
	})
}

func (s *Service) CancelPublicStorefrontOrder(
	ctx context.Context,
	value string,
	access StorefrontOrderAccessInput,
) error {
	if _, err := s.resolveAuthorizedStorefrontOrder(ctx, value, access); err != nil {
		return err
	}

	return s.CancelStorefrontOrder(ctx, value)
}

func (s *Service) UploadPaymentProof(ctx context.Context, orderNo string, input UploadPaymentProofInput) error {
	objectKey := strings.TrimSpace(input.ObjectKey)
	storedObjectURL := strings.TrimSpace(input.ObjectURL)
	if objectKey == "" {
		objectKey = s.extractUploadedObjectKey(storedObjectURL)
	}
	if objectKey == "" && storedObjectURL == "" {
		return ErrInvalidInput
	}
	if objectKey != "" {
		storedObjectURL = s.buildObjectURL(objectKey)
	}

	order, err := s.resolveOrderByNo(ctx, orderNo)
	if err != nil {
		return err
	}
	if order.Status == "cancelled" || order.Status == "expired" || order.Status == "refunded" {
		return ErrInvalidState
	}

	record := model.PaymentProof{
		OrderID:      order.ID,
		ProofType:    defaultString(input.ProofType, "screenshot"),
		ObjectKey:    objectKey,
		ObjectURL:    storedObjectURL,
		ReviewStatus: "pending",
		Note:         input.Note,
	}

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&record).Error; err != nil {
			return err
		}

		return tx.Create(&model.OrderEvent{
			OrderID:      order.ID,
			EventType:    "payment_proof_uploaded",
			FromStatus:   order.Status,
			ToStatus:     order.Status,
			OperatorType: "buyer",
			PayloadJSON: jsonValue(map[string]any{
				"proof_type": record.ProofType,
				"object_key": record.ObjectKey,
				"note":       record.Note,
			}),
			CreatedAt: time.Now(),
		}).Error
	})
}

func (s *Service) UploadPublicPaymentProof(
	ctx context.Context,
	orderNo string,
	access StorefrontOrderAccessInput,
	input UploadPaymentProofInput,
) error {
	if _, err := s.resolveAuthorizedStorefrontOrder(ctx, orderNo, access); err != nil {
		return err
	}

	return s.UploadPaymentProof(ctx, orderNo, input)
}

func (s *Service) GetStorefrontOrderDelivery(ctx context.Context, orderNo string) (map[string]any, error) {
	order, err := s.resolveOrderByNo(ctx, orderNo)
	if err != nil {
		return nil, err
	}
	if order.PaymentStatus != "paid" {
		return nil, nil
	}

	var delivery model.DeliveryRecord
	_ = s.db.WithContext(ctx).Where("order_id = ?", order.ID).Order("id DESC").First(&delivery).Error

	var issue model.CodeIssueRecord
	_ = s.db.WithContext(ctx).Where("order_id = ?", order.ID).Order("id DESC").First(&issue).Error

	codes := []string{}
	if decrypted, err := s.decryptString(issue.IssuedCodeEncrypted); err == nil && decrypted != "" {
		_ = json.Unmarshal([]byte(decrypted), &codes)
	}

	maskedCodes := make([]string, 0, len(codes))
	for _, code := range codes {
		maskedCodes = append(maskedCodes, maskValue(code, 6))
	}

	return map[string]any{
		"order_no":                 order.OrderNo,
		"order_status":             order.Status,
		"delivery_status":          order.DeliveryStatus,
		"delivery_channel":         delivery.DeliveryChannel,
		"delivery_target":          delivery.DeliveryTarget,
		"delivered_content_masked": delivery.DeliveredContentMasked,
		"codes":                    codes,
		"masked_codes":             maskedCodes,
		"issued_count":             len(codes),
		"delivered_at":             delivery.DeliveredAt,
	}, nil
}

func (s *Service) buildStorefrontEmbeddedDeliveryResult(
	ctx context.Context,
	order *model.Order,
) map[string]any {
	if order == nil || order.ID == 0 || order.PaymentStatus != "paid" {
		return nil
	}

	result, err := s.GetStorefrontOrderDelivery(ctx, order.OrderNo)
	if err != nil || len(result) == 0 {
		return nil
	}

	return result
}

func (s *Service) GetPublicStorefrontOrderDelivery(
	ctx context.Context,
	orderNo string,
	access StorefrontOrderAccessInput,
) (map[string]any, error) {
	if _, err := s.resolveAuthorizedStorefrontOrder(ctx, orderNo, access); err != nil {
		return nil, err
	}

	return s.GetStorefrontOrderDelivery(ctx, orderNo)
}

func (s *Service) resolveAuthorizedStorefrontOrder(
	ctx context.Context,
	orderNo string,
	access StorefrontOrderAccessInput,
) (*model.Order, error) {
	order, err := s.resolveOrderByNo(ctx, orderNo)
	if err != nil {
		return nil, err
	}
	if err := s.authorizeStorefrontOrderAccess(order, access); err != nil {
		return nil, err
	}

	return order, nil
}

func (s *Service) authorizeStorefrontOrderAccess(
	order *model.Order,
	access StorefrontOrderAccessInput,
) error {
	if order == nil {
		return ErrNotFound
	}

	if access.UserID != nil && order.UserID != nil && *order.UserID == *access.UserID {
		return nil
	}

	expectedToken := s.storefrontOrderAccessToken(order)
	providedToken := strings.TrimSpace(access.OrderAccessToken)
	if providedToken != "" &&
		expectedToken != "" &&
		subtle.ConstantTimeCompare([]byte(providedToken), []byte(expectedToken)) == 1 {
		return nil
	}

	return ErrNotFound
}

func (s *Service) storefrontOrderAccessToken(order *model.Order) string {
	if order == nil || strings.TrimSpace(order.OrderNo) == "" {
		return ""
	}

	return sha256HexStrings(
		"storefront_order_access",
		strings.TrimSpace(order.OrderNo),
		fmt.Sprintf("%d", order.ID),
		order.CreatedAt.UTC().Format(time.RFC3339Nano),
		strings.TrimSpace(order.BuyerRef),
		fmt.Sprintf("%x", s.cryptoKey),
	)
}

func (s *Service) extractUploadedObjectKey(rawURL string) string {
	trimmedURL := strings.TrimSpace(rawURL)
	if trimmedURL == "" {
		return ""
	}

	parsed, err := url.Parse(trimmedURL)
	if err != nil {
		return ""
	}

	publicPath := strings.TrimRight(strings.TrimSpace(s.cfg.StoragePublicPath), "/")
	if publicPath == "" {
		publicPath = "/uploads"
	}

	normalizedPath := strings.TrimSpace(parsed.Path)
	if !strings.HasPrefix(normalizedPath, publicPath+"/") {
		return ""
	}

	objectKey := strings.TrimPrefix(normalizedPath, publicPath+"/")
	normalizedKey, err := normalizeUploadedObjectKey(objectKey)
	if err != nil {
		return ""
	}

	return normalizedKey
}

func stringListContains(values []string, target string) bool {
	for _, value := range values {
		if strings.TrimSpace(value) == strings.TrimSpace(target) {
			return true
		}
	}

	return false
}
