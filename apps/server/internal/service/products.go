package service

import (
	"context"
	"errors"
	"strings"

	"gorm.io/gorm"

	"passdock/server/internal/model"
)

type ProductUpsertInput struct {
	ProductType            string
	SKU                    string
	Name                   string
	Description            string
	DisplayPrice           string
	Currency               string
	Enabled                bool
	SortOrder              int
	FulfillmentStrategyKey string
	DeliveryStrategyKey    string
	Metadata               map[string]any
	PaymentMethods         []string
}

type ProductPriceUpsertInput struct {
	PriceID        string
	TemplateName   string
	PaymentMethod  string
	Amount         string
	OriginalAmount string
	Currency       string
	BillingCycle   string
	Enabled        bool
	SortOrder      int
}

func (s *Service) ListAdminProducts(ctx context.Context) ([]map[string]any, error) {
	var items []model.Product
	if err := s.db.WithContext(ctx).Order("sort_order ASC, id ASC").Find(&items).Error; err != nil {
		return nil, err
	}

	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		meta := parseJSON[productMetadata](item.MetadataJSON)
		result = append(result, map[string]any{
			"id":                       item.ID,
			"product_id":               item.ID,
			"product_type":             item.ProductType,
			"sku":                      item.SKU,
			"name":                     item.Name,
			"name_zh":                  meta.NameZH,
			"name_en":                  meta.NameEN,
			"display_price":            formatAmount(item.DisplayPrice),
			"currency":                 item.Currency,
			"enabled":                  item.Enabled,
			"sort_order":               item.SortOrder,
			"fulfillment_strategy_key": item.FulfillmentStrategyKey,
			"delivery_strategy_key":    item.DeliveryStrategyKey,
			"metadata": map[string]any{
				"name_zh":           meta.NameZH,
				"name_en":           meta.NameEN,
				"badge_zh":          meta.BadgeZH,
				"badge_en":          meta.BadgeEN,
				"cycle_label_zh":    meta.CycleLabelZH,
				"cycle_label_en":    meta.CycleLabelEN,
				"delivery_label_zh": meta.DeliveryLabelZH,
				"delivery_label_en": meta.DeliveryLabelEN,
				"stock_label_zh":    meta.StockLabelZH,
				"stock_label_en":    meta.StockLabelEN,
				"status_label_zh":   meta.StatusLabelZH,
				"status_label_en":   meta.StatusLabelEN,
				"original_price":    meta.OriginalPrice,
				"billing_cycle":     meta.BillingCycle,
				"inventory":         meta.Inventory,
				"payment_methods":   meta.PaymentMethods,
				"tags_zh":           meta.TagsZH,
				"tags_en":           meta.TagsEN,
				"checkout_notes_zh": meta.CheckoutNotesZH,
				"checkout_notes_en": meta.CheckoutNotesEN,
				"art_variant":       meta.ArtVariant,
			},
		})
	}
	return result, nil
}

func (s *Service) UpsertAdminProduct(ctx context.Context, routeID string, input ProductUpsertInput) error {
	price, err := parseFloat(input.DisplayPrice)
	if err != nil {
		return ErrInvalidInput
	}

	meta := productMetadata{
		NameZH:          stringValue(input.Metadata["name_zh"]),
		NameEN:          stringValue(input.Metadata["name_en"]),
		BadgeZH:         stringValue(input.Metadata["badge_zh"]),
		BadgeEN:         stringValue(input.Metadata["badge_en"]),
		CycleLabelZH:    stringValue(input.Metadata["cycle_label_zh"]),
		CycleLabelEN:    stringValue(input.Metadata["cycle_label_en"]),
		DeliveryLabelZH: stringValue(input.Metadata["delivery_label_zh"]),
		DeliveryLabelEN: stringValue(input.Metadata["delivery_label_en"]),
		StockLabelZH:    stringValue(input.Metadata["stock_label_zh"]),
		StockLabelEN:    stringValue(input.Metadata["stock_label_en"]),
		StatusLabelZH:   stringValue(input.Metadata["status_label_zh"]),
		StatusLabelEN:   stringValue(input.Metadata["status_label_en"]),
		OriginalPrice:   stringValue(input.Metadata["original_price"]),
		BillingCycle:    stringValue(input.Metadata["billing_cycle"]),
		Inventory:       intValue(input.Metadata["inventory"]),
		PaymentMethods:  normalizeStringList(input.PaymentMethods, input.Metadata["payment_methods"]),
		TagsZH:          normalizeStringList(nil, input.Metadata["tags_zh"]),
		TagsEN:          normalizeStringList(nil, input.Metadata["tags_en"]),
		CheckoutNotesZH: normalizeStringList(nil, input.Metadata["checkout_notes_zh"]),
		CheckoutNotesEN: normalizeStringList(nil, input.Metadata["checkout_notes_en"]),
		ArtVariant:      stringValue(input.Metadata["art_variant"]),
	}

	record := model.Product{
		ProductType:            input.ProductType,
		SKU:                    input.SKU,
		Name:                   input.Name,
		Description:            input.Description,
		DisplayPrice:           price,
		Currency:               defaultString(input.Currency, "RMB"),
		Enabled:                input.Enabled,
		SortOrder:              input.SortOrder,
		FulfillmentStrategyKey: input.FulfillmentStrategyKey,
		DeliveryStrategyKey:    input.DeliveryStrategyKey,
		MetadataJSON:           jsonValue(meta),
	}

	if routeID == "" {
		return s.db.WithContext(ctx).Create(&record).Error
	}

	existing, err := s.resolveProductByRoute(ctx, routeID)
	if err != nil {
		return err
	}

	return s.db.WithContext(ctx).Model(existing).Updates(map[string]any{
		"product_type":             record.ProductType,
		"sku":                      record.SKU,
		"name":                     record.Name,
		"description":              record.Description,
		"display_price":            record.DisplayPrice,
		"currency":                 record.Currency,
		"enabled":                  record.Enabled,
		"sort_order":               record.SortOrder,
		"fulfillment_strategy_key": record.FulfillmentStrategyKey,
		"delivery_strategy_key":    record.DeliveryStrategyKey,
		"metadata":                 record.MetadataJSON,
	}).Error
}

func (s *Service) DeleteAdminProduct(ctx context.Context, routeID string) error {
	record, err := s.resolveProductByRoute(ctx, routeID)
	if err != nil {
		return err
	}
	return s.db.WithContext(ctx).Delete(record).Error
}

func (s *Service) ListAdminProductPrices(ctx context.Context, productRouteID string) ([]map[string]any, error) {
	product, err := s.resolveProductByRoute(ctx, productRouteID)
	if err != nil {
		return nil, err
	}

	var items []model.ProductPrice
	if err := s.db.WithContext(ctx).Where("product_id = ?", product.ID).Order("sort_order ASC, id ASC").Find(&items).Error; err != nil {
		return nil, err
	}

	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		result = append(result, map[string]any{
			"id":              item.ID,
			"price_id":        item.ID,
			"product_id":      item.ProductID,
			"product_sku":     product.SKU,
			"template_name":   item.TemplateName,
			"name":            item.TemplateName,
			"payment_method":  item.PaymentMethod,
			"amount":          formatAmount(item.Amount),
			"display_price":   formatAmount(item.Amount),
			"original_amount": formatAmount(item.OriginalAmount),
			"original_price":  formatAmount(item.OriginalAmount),
			"currency":        item.Currency,
			"billing_cycle":   item.BillingCycle,
			"enabled":         item.Enabled,
			"sort_order":      item.SortOrder,
		})
	}

	return result, nil
}

func (s *Service) UpsertAdminProductPrice(ctx context.Context, productRouteID string, input ProductPriceUpsertInput) error {
	product, err := s.resolveProductByRoute(ctx, productRouteID)
	if err != nil {
		return err
	}

	amount, err := parseFloat(input.Amount)
	if err != nil {
		return ErrInvalidInput
	}
	originalAmount, err := parseFloat(input.OriginalAmount)
	if err != nil {
		return ErrInvalidInput
	}

	meta := parseJSON[productMetadata](product.MetadataJSON)
	templateName := strings.TrimSpace(input.TemplateName)
	paymentMethod := defaultString(input.PaymentMethod, firstPaymentMethod(meta.PaymentMethods))
	currency := defaultString(input.Currency, product.Currency)
	if templateName == "" {
		return ErrInvalidInput
	}
	if len(meta.PaymentMethods) > 0 && !stringListContains(meta.PaymentMethods, paymentMethod) {
		return ErrInvalidInput
	}

	record := model.ProductPrice{
		ProductID:      product.ID,
		TemplateName:   templateName,
		PaymentMethod:  paymentMethod,
		Currency:       currency,
		Amount:         amount,
		Enabled:        input.Enabled,
		OriginalAmount: originalAmount,
		BillingCycle:   input.BillingCycle,
		SortOrder:      input.SortOrder,
	}

	identityQuery := s.db.WithContext(ctx).Where(
		"product_id = ? AND template_name = ? AND payment_method = ? AND currency = ?",
		product.ID,
		templateName,
		paymentMethod,
		currency,
	)

	if strings.TrimSpace(input.PriceID) == "" {
		var existing model.ProductPrice
		if err := identityQuery.First(&existing).Error; err == nil {
			return s.db.WithContext(ctx).Model(&existing).Updates(map[string]any{
				"product_id":      record.ProductID,
				"template_name":   record.TemplateName,
				"payment_method":  record.PaymentMethod,
				"currency":        record.Currency,
				"amount":          record.Amount,
				"enabled":         record.Enabled,
				"original_amount": record.OriginalAmount,
				"billing_cycle":   record.BillingCycle,
				"sort_order":      record.SortOrder,
			}).Error
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		return s.db.WithContext(ctx).Create(&record).Error
	}

	existing, err := s.resolveProductPriceByRoute(ctx, product.ID, input.PriceID)
	if err != nil {
		return err
	}

	var duplicate model.ProductPrice
	if err := identityQuery.Where("id <> ?", existing.ID).First(&duplicate).Error; err == nil {
		return ErrInvalidInput
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	return s.db.WithContext(ctx).Model(existing).Updates(map[string]any{
		"product_id":      record.ProductID,
		"template_name":   record.TemplateName,
		"payment_method":  record.PaymentMethod,
		"currency":        record.Currency,
		"amount":          record.Amount,
		"enabled":         record.Enabled,
		"original_amount": record.OriginalAmount,
		"billing_cycle":   record.BillingCycle,
		"sort_order":      record.SortOrder,
	}).Error
}

func (s *Service) DeleteAdminProductPrice(ctx context.Context, productRouteID, priceRouteID string) error {
	product, err := s.resolveProductByRoute(ctx, productRouteID)
	if err != nil {
		return err
	}
	record, err := s.resolveProductPriceByRoute(ctx, product.ID, priceRouteID)
	if err != nil {
		return err
	}
	return s.db.WithContext(ctx).Delete(record).Error
}

func firstPaymentMethod(values []string) string {
	if len(values) == 0 {
		return "okx_usdt"
	}
	return values[0]
}
