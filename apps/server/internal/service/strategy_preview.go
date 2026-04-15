package service

import (
	"context"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"passdock/server/internal/model"
)

type adminStrategyPreviewContext struct {
	Order         *model.Order
	Source        string
	Codes         []string
	MaskedCodes   []string
	PlainContent  string
	MaskedContent string
}

func (s *Service) buildAdminFulfillmentStrategyPreview(
	ctx context.Context,
	strategy *model.FulfillmentStrategy,
) (map[string]any, error) {
	if strategy == nil {
		return nil, ErrNotFound
	}

	provider, action, err := s.resolveProviderAction(ctx, strategy.ProviderKey, strategy.ActionKey)
	if err != nil {
		return nil, err
	}

	previewContext, err := s.resolveAdminStrategyPreviewContext(ctx, strategy.StrategyKey, "", strategy.FulfillmentType)
	if err != nil {
		return nil, err
	}

	templateData := s.buildFulfillmentTemplateData(
		previewContext.Order,
		strategy,
		orderQuantity(*previewContext.Order),
	)
	templateData["codes"] = previewContext.Codes
	templateData["masked_codes"] = previewContext.MaskedCodes
	templateData["content"] = previewContext.PlainContent
	templateData["masked_content"] = previewContext.MaskedContent

	renderedRequestTemplate := map[string]any{}
	if requestTemplate := parseJSON[map[string]any](strategy.RequestTemplateJSON); len(requestTemplate) > 0 {
		if rendered, ok := renderTemplateValue(requestTemplate, templateData).(map[string]any); ok {
			renderedRequestTemplate = rendered
			for key, value := range rendered {
				templateData[key] = value
			}
		}
	}

	requestSpec, err := s.renderActionRequest(provider, action, templateData)
	if err != nil {
		return nil, err
	}

	renderedDeliveryTemplate := renderTemplateObject(parseJSON[map[string]any](strategy.DeliveryTemplateJSON), templateData)
	renderedResultSchema := renderTemplateObject(parseJSON[map[string]any](strategy.ResultSchemaJSON), templateData)

	return map[string]any{
		"strategy_key":      strategy.StrategyKey,
		"fulfillment_type":  strategy.FulfillmentType,
		"provider_key":      provider.ProviderKey,
		"action_key":        action.ActionKey,
		"preview_source":    previewContext.Source,
		"sample_order_no":   previewContext.Order.OrderNo,
		"request_method":    requestSpec.Method,
		"request_url":       requestSpec.URL,
		"preview":           "Strategy request and delivery templates rendered successfully.",
		"request_template":  renderedRequestTemplate,
		"delivery_template": renderedDeliveryTemplate,
		"result_schema":     renderedResultSchema,
		"action_request":    requestSpec.previewMap(),
		"template_data":     templateData,
	}, nil
}

func (s *Service) buildAdminDeliveryStrategyTest(
	ctx context.Context,
	strategy *model.DeliveryStrategy,
) (map[string]any, error) {
	if strategy == nil {
		return nil, ErrNotFound
	}

	previewContext, err := s.resolveAdminStrategyPreviewContext(ctx, "", strategy.StrategyKey, "")
	if err != nil {
		return nil, err
	}

	templateData := s.buildDeliveryMessageTemplateData(
		previewContext.Order,
		strategy,
		previewContext.Codes,
		previewContext.PlainContent,
		previewContext.MaskedContent,
	)
	renderedMessageTemplate := renderTemplateObject(parseJSON[map[string]any](strategy.MessageTemplateJSON), templateData)
	message := s.buildRenderedDeliveryMessage(
		previewContext.Order,
		previewContext.PlainContent,
		renderedMessageTemplate,
	)

	deliveryChannel := strategy.ChannelType
	deliveryTarget := deliveryTargetForStrategy(*previewContext.Order, deliveryChannel)
	fallbackReason := ""
	if previewContext.Order.ID != 0 {
		payload, payloadErr := s.resolveDeliveryChannelTarget(ctx, s.db.WithContext(ctx), previewContext.Order, deliveryChannel)
		if payloadErr == nil {
			deliveryChannel = payload.Channel
			deliveryTarget = payload.Target
			fallbackReason = payload.FallbackReason
		}
	}

	return map[string]any{
		"strategy_key":     strategy.StrategyKey,
		"channel_type":     strategy.ChannelType,
		"mask_policy":      strategy.MaskPolicy,
		"preview_source":   previewContext.Source,
		"sample_order_no":  previewContext.Order.OrderNo,
		"delivery_channel": deliveryChannel,
		"delivery_target":  deliveryTarget,
		"fallback_reason":  fallbackReason,
		"resend_allowed":   strategy.ResendAllowed,
		"message":          message,
		"message_template": renderedMessageTemplate,
		"template_data":    templateData,
		"masked_content":   previewContext.MaskedContent,
		"plain_content":    previewContext.PlainContent,
	}, nil
}

func (s *Service) resolveAdminStrategyPreviewContext(
	ctx context.Context,
	fulfillmentStrategyKey string,
	deliveryStrategyKey string,
	fulfillmentType string,
) (adminStrategyPreviewContext, error) {
	order, source, err := s.loadAdminStrategyPreviewOrder(ctx, fulfillmentStrategyKey, deliveryStrategyKey)
	if err != nil {
		return adminStrategyPreviewContext{}, err
	}

	codes, plainContent, maskedContent, err := s.loadAdminStrategyPreviewContent(ctx, order, fulfillmentType)
	if err != nil {
		return adminStrategyPreviewContext{}, err
	}

	return adminStrategyPreviewContext{
		Order:         order,
		Source:        source,
		Codes:         codes,
		MaskedCodes:   maskCodes(codes),
		PlainContent:  plainContent,
		MaskedContent: maskedContent,
	}, nil
}

func (s *Service) loadAdminStrategyPreviewOrder(
	ctx context.Context,
	fulfillmentStrategyKey string,
	deliveryStrategyKey string,
) (*model.Order, string, error) {
	if order, err := s.loadRecentOrderForStrategy(ctx, fulfillmentStrategyKey, deliveryStrategyKey); err != nil {
		return nil, "", err
	} else if order != nil {
		return order, "recent_order", nil
	}

	if product, err := s.loadPreviewProductForStrategy(ctx, fulfillmentStrategyKey, deliveryStrategyKey); err != nil {
		return nil, "", err
	} else if product != nil {
		order := s.buildPreviewOrderFromProduct(*product)
		return order, "product_binding", nil
	}

	return buildDefaultPreviewOrder(fulfillmentStrategyKey, deliveryStrategyKey), "synthetic_sample", nil
}

func (s *Service) loadRecentOrderForStrategy(
	ctx context.Context,
	fulfillmentStrategyKey string,
	deliveryStrategyKey string,
) (*model.Order, error) {
	itemQuery := s.db.WithContext(ctx).Model(&model.OrderItem{})
	if strings.TrimSpace(fulfillmentStrategyKey) != "" {
		itemQuery = itemQuery.Where("fulfillment_strategy_key = ?", strings.TrimSpace(fulfillmentStrategyKey))
	}
	if strings.TrimSpace(deliveryStrategyKey) != "" {
		itemQuery = itemQuery.Where("delivery_strategy_key = ?", strings.TrimSpace(deliveryStrategyKey))
	}

	var item model.OrderItem
	if err := itemQuery.Order("id DESC").First(&item).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}

	var order model.Order
	if err := s.db.WithContext(ctx).
		Preload("OrderItems").
		First(&order, item.OrderID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}

	return &order, nil
}

func (s *Service) loadPreviewProductForStrategy(
	ctx context.Context,
	fulfillmentStrategyKey string,
	deliveryStrategyKey string,
) (*model.Product, error) {
	query := s.db.WithContext(ctx).Model(&model.Product{})
	if strings.TrimSpace(fulfillmentStrategyKey) != "" {
		query = query.Where("fulfillment_strategy_key = ?", strings.TrimSpace(fulfillmentStrategyKey))
	}
	if strings.TrimSpace(deliveryStrategyKey) != "" {
		query = query.Where("delivery_strategy_key = ?", strings.TrimSpace(deliveryStrategyKey))
	}

	var product model.Product
	if err := query.Order("enabled DESC, sort_order ASC, id ASC").First(&product).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}

	return &product, nil
}

func (s *Service) buildPreviewOrderFromProduct(product model.Product) *model.Order {
	metadata := parseJSON[productMetadata](product.MetadataJSON)
	paymentMethod := "wechat_qr"
	if len(metadata.PaymentMethods) > 0 && strings.TrimSpace(metadata.PaymentMethods[0]) != "" {
		paymentMethod = strings.TrimSpace(metadata.PaymentMethods[0])
	}

	snapshot := s.productSnapshot(product)
	order := &model.Order{
		OrderNo:         fmt.Sprintf("PD-PREVIEW-%04d", product.ID),
		ProductID:       &product.ID,
		ProductSnapshot: jsonValue(snapshot),
		PaymentMethod:   paymentMethod,
		Currency:        defaultString(product.Currency, "RMB"),
		PriceAmount:     product.DisplayPrice,
		PayAmount:       product.DisplayPrice,
		Status:          "paid",
		PaymentStatus:   "paid",
		DeliveryStatus:  "pending",
		SourceChannel:   "admin_preview",
		BuyerRef:        "tg:preview_user",
		OrderItems: []model.OrderItem{
			{
				ProductID:              &product.ID,
				ProductSnapshot:        jsonValue(snapshot),
				Quantity:               1,
				UnitAmount:             product.DisplayPrice,
				LineAmount:             product.DisplayPrice,
				FulfillmentStrategyKey: product.FulfillmentStrategyKey,
				DeliveryStrategyKey:    product.DeliveryStrategyKey,
			},
		},
	}

	return order
}

func buildDefaultPreviewOrder(
	fulfillmentStrategyKey string,
	deliveryStrategyKey string,
) *model.Order {
	snapshot := map[string]any{
		"product_id":               0,
		"sku":                      "preview-sku",
		"name":                     "PassDock Preview Product",
		"name_en":                  "PassDock Preview Product",
		"name_zh":                  "PassDock Preview Product",
		"display_price":            "19.90",
		"currency":                 "RMB",
		"fulfillment_strategy_key": fulfillmentStrategyKey,
		"delivery_strategy_key":    deliveryStrategyKey,
		"metadata": map[string]any{
			"billing_cycle": "monthly",
		},
	}

	return &model.Order{
		OrderNo:         "PD-PREVIEW-0000",
		ProductSnapshot: jsonValue(snapshot),
		PaymentMethod:   "wechat_qr",
		Currency:        "RMB",
		PriceAmount:     19.90,
		PayAmount:       19.90,
		Status:          "paid",
		PaymentStatus:   "paid",
		DeliveryStatus:  "pending",
		SourceChannel:   "admin_preview",
		BuyerRef:        "tg:preview_user",
		OrderItems: []model.OrderItem{
			{
				ProductSnapshot:        jsonValue(snapshot),
				Quantity:               1,
				UnitAmount:             19.90,
				LineAmount:             19.90,
				FulfillmentStrategyKey: fulfillmentStrategyKey,
				DeliveryStrategyKey:    deliveryStrategyKey,
			},
		},
	}
}

func (s *Service) loadAdminStrategyPreviewContent(
	ctx context.Context,
	order *model.Order,
	fulfillmentType string,
) ([]string, string, string, error) {
	defaultCodes := previewCodesForFulfillmentType(fulfillmentType)

	if order != nil && order.ID != 0 {
		var issue model.CodeIssueRecord
		if err := s.db.WithContext(ctx).
			Where("order_id = ?", order.ID).
			Order("id DESC").
			First(&issue).Error; err == nil {
			codes, err := s.loadIssueCodes(issue)
			if err != nil {
				return nil, "", "", err
			}
			if len(codes) > 0 {
				return codes, strings.Join(codes, ", "), strings.Join(maskCodes(codes), ", "), nil
			}
		} else if err != gorm.ErrRecordNotFound {
			return nil, "", "", err
		}

		var fulfillment model.FulfillmentRecord
		if err := s.db.WithContext(ctx).
			Where("order_id = ?", order.ID).
			Order("id DESC").
			First(&fulfillment).Error; err == nil {
			plainContent := strings.TrimSpace(fulfillment.ResultDataMasked)
			if decrypted, decryptErr := s.decryptString(fulfillment.ResultDataEncrypted); decryptErr == nil && strings.TrimSpace(decrypted) != "" {
				plainContent = strings.TrimSpace(decrypted)
			}
			maskedContent := strings.TrimSpace(defaultString(fulfillment.ResultDataMasked, plainContent))
			if plainContent != "" {
				return defaultCodes, plainContent, maskedContent, nil
			}
		} else if err != gorm.ErrRecordNotFound {
			return nil, "", "", err
		}
	}

	if len(defaultCodes) == 0 {
		return nil, "Manual operator queue", "Manual operator queue", nil
	}

	plainContent := strings.Join(defaultCodes, ", ")
	return defaultCodes, plainContent, strings.Join(maskCodes(defaultCodes), ", "), nil
}

func previewCodesForFulfillmentType(fulfillmentType string) []string {
	switch strings.TrimSpace(fulfillmentType) {
	case "issue_subscription":
		return []string{"SUBSCRIPTION-DEMO-001"}
	case "issue_license":
		return []string{"LICENSE-DEMO-001"}
	case "manual_delivery":
		return nil
	default:
		return []string{"PASSDOCK-DEMO-001"}
	}
}

func (s *Service) buildDeliveryMessageTemplateData(
	order *model.Order,
	deliveryStrategy *model.DeliveryStrategy,
	codes []string,
	plainContent string,
	maskedContent string,
) map[string]any {
	productName := strings.TrimSpace(s.orderProductName(*order))
	maskedCodes := maskCodes(codes)

	return map[string]any{
		"order_no":         order.OrderNo,
		"product_name":     productName,
		"buyer_ref":        order.BuyerRef,
		"payment_method":   order.PaymentMethod,
		"source_channel":   order.SourceChannel,
		"currency":         order.Currency,
		"delivery_channel": deliveryStrategy.ChannelType,
		"strategy_key":     deliveryStrategy.StrategyKey,
		"quantity":         orderQuantity(*order),
		"codes":            codes,
		"masked_codes":     maskedCodes,
		"content":          plainContent,
		"masked_content":   maskedContent,
	}
}

func renderTemplateObject(template map[string]any, templateData map[string]any) map[string]any {
	if len(template) == 0 {
		return map[string]any{}
	}

	rendered, ok := renderTemplateValue(template, templateData).(map[string]any)
	if !ok {
		return map[string]any{}
	}

	return rendered
}

func (s *Service) buildRenderedDeliveryMessage(
	order *model.Order,
	plainContent string,
	renderedTemplate map[string]any,
) string {
	lines := make([]string, 0, 2)
	title := strings.TrimSpace(stringifyTemplateValue(renderedTemplate["title"]))
	content := strings.TrimSpace(stringifyTemplateValue(renderedTemplate["content"]))
	if title != "" {
		lines = append(lines, title)
	}
	if content != "" {
		lines = append(lines, content)
	}
	if len(lines) > 0 {
		return strings.Join(lines, "\n")
	}

	productName := strings.TrimSpace(s.orderProductName(*order))
	if strings.TrimSpace(plainContent) != "" {
		lines = append(lines, fmt.Sprintf("PassDock order %s", order.OrderNo))
		if productName != "" {
			lines = append(lines, productName)
		}
		lines = append(lines, plainContent)
		return strings.Join(lines, "\n")
	}

	return fmt.Sprintf("PassDock order %s is ready. Please open the order center to review the delivery result.", order.OrderNo)
}
