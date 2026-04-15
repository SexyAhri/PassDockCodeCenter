package service

import (
	"context"

	"gorm.io/gorm"

	"passdock/server/internal/model"
)

func (s *Service) SeedDefaults() error {
	ctx := context.Background()

	if err := s.seedReferenceData(ctx); err != nil {
		return err
	}

	return s.seedSampleBusinessData(ctx)
}

func (s *Service) SeedRuntimeDefaults() error {
	ctx := context.Background()
	seedSample := s.cfg.ShouldSeedSampleBusinessData()
	if !s.cfg.ShouldBootstrapReferenceData() && !seedSample {
		return nil
	}

	if err := s.seedReferenceData(ctx); err != nil {
		return err
	}
	if !seedSample {
		return nil
	}

	return s.seedSampleBusinessData(ctx)
}

func (s *Service) seedReferenceData(ctx context.Context) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		adminEmail := "admin@passdock.local"
		adminPasswordHash, err := HashPassword("Passdock123!")
		if err != nil {
			return err
		}
		operatorEmail := "operator@passdock.local"
		operatorPasswordHash, err := HashPassword("Passdock123!")
		if err != nil {
			return err
		}

		users := []model.User{
			{DisplayName: "Ava", Role: "admin", Status: "active", Locale: "en-US", Email: &adminEmail, PasswordHash: &adminPasswordHash},
			{DisplayName: "Mika", Role: "operator", Status: "active", Locale: "en-US", Email: &operatorEmail, PasswordHash: &operatorPasswordHash},
			{DisplayName: "Lina", Role: "operator", Status: "active", Locale: "en-US"},
			{DisplayName: "Noah", Role: "operator", Status: "active", Locale: "en-US"},
		}
		for _, item := range users {
			if err := tx.Where("display_name = ?", item.DisplayName).Assign(item).FirstOrCreate(&model.User{}).Error; err != nil {
				return err
			}
		}

		channels := []model.PaymentChannel{
			{
				ChannelKey:     "wechat_qr_main",
				ChannelName:    "WeChat QR",
				ChannelType:    "wechat_qr",
				ProviderName:   "manual_qr",
				SettlementMode: "manual",
				Currency:       "RMB",
				Enabled:        true,
				SortOrder:      10,
				ConfigJSON: jsonValue(paymentChannelConfig{
					QRContent:     "wechat://pay/passdock/main",
					DisplayName:   "WeChat QR",
					DisplayNameZH: "微信收款码",
					DisplayNameEN: "WeChat QR",
					ModeLabelZH:   "人工确认",
					ModeLabelEN:   "Manual review",
					Reference:     "WC-MAIN",
					AutoFulfill:   true,
					AutoDeliver:   true,
				}),
			},
			{
				ChannelKey:     "alipay_qr_main",
				ChannelName:    "Alipay QR",
				ChannelType:    "alipay_qr",
				ProviderName:   "manual_qr",
				SettlementMode: "manual",
				Currency:       "RMB",
				Enabled:        true,
				SortOrder:      20,
				ConfigJSON: jsonValue(paymentChannelConfig{
					QRContent:     "alipay://pay/passdock/main",
					DisplayName:   "Alipay QR",
					DisplayNameZH: "支付宝收款码",
					DisplayNameEN: "Alipay QR",
					ModeLabelZH:   "人工确认",
					ModeLabelEN:   "Manual review",
					Reference:     "ALI-MAIN",
					AutoFulfill:   true,
					AutoDeliver:   true,
				}),
			},
			{
				ChannelKey:     "okx_usdt_watch",
				ChannelName:    "OKX USDT",
				ChannelType:    "okx_usdt",
				ProviderName:   "chain_watcher",
				SettlementMode: "auto",
				Currency:       "USDT",
				Enabled:        true,
				SortOrder:      30,
				ConfigJSON: jsonValue(paymentChannelConfig{
					QRContent:               "okx://wallet/passdock/usdt",
					DisplayName:             "OKX USDT",
					DisplayNameZH:           "OKX USDT",
					DisplayNameEN:           "OKX USDT",
					ModeLabelZH:             "链上 watcher",
					ModeLabelEN:             "On-chain watcher",
					Reference:               "OKX-USDT",
					AutoFulfill:             true,
					AutoDeliver:             true,
					CallbackAuthType:        "hmac_sha256",
					CallbackSecret:          "passdock-okx-callback-secret",
					CallbackKey:             "okx-prod",
					CallbackHeaderName:      "X-PassDock-Key",
					CallbackSignHeader:      "X-PassDock-Sign",
					CallbackTimestampHeader: "X-PassDock-Timestamp",
					CallbackNonceHeader:     "X-PassDock-Nonce",
					CallbackTTLSeconds:      300,
					CallbackSignSource:      "method_path_timestamp_nonce_body_sha256",
				}),
			},
		}
		for _, item := range channels {
			if err := tx.Where("channel_key = ?", item.ChannelKey).Assign(item).FirstOrCreate(&model.PaymentChannel{}).Error; err != nil {
				return err
			}
		}

		providers := s.bootstrapIntegrationProviders()
		for _, item := range providers {
			if err := tx.Where("provider_key = ?", item.ProviderKey).Assign(item).FirstOrCreate(&model.IntegrationProvider{}).Error; err != nil {
				return err
			}
		}

		var newAPIProd model.IntegrationProvider
		if err := tx.Where("provider_key = ?", "new_api_prod").First(&newAPIProd).Error; err != nil {
			return err
		}
		var manualQueue model.IntegrationProvider
		if err := tx.Where("provider_key = ?", "manual_review_queue").First(&manualQueue).Error; err != nil {
			return err
		}

		actions := []model.IntegrationAction{
			{
				ProviderID:         newAPIProd.ID,
				ActionKey:          "issue_recharge_code",
				HTTPMethod:         "POST",
				PathTemplate:       "/api/internal/redemption/issue",
				HeaderTemplateJSON: jsonValue(map[string]any{"Content-Type": "application/json"}),
				QueryTemplateJSON:  jsonValue(map[string]any{}),
				BodyTemplateJSON: jsonValue(map[string]any{
					"order_no":     "{{order_no}}",
					"product_id":   "{{product_id}}",
					"product_name": "{{product_name}}",
					"code_name":    "{{code_name}}",
					"quota":        "{{quota}}",
					"count":        "{{count}}",
					"expired_time": "{{expired_time}}",
					"buyer_ref":    "{{buyer_ref}}",
				}),
				SuccessPath:  "success",
				CodeListPath: "data.codes",
				Enabled:      true,
			},
			{
				ProviderID:         newAPIProd.ID,
				ActionKey:          "issue_subscription_code",
				HTTPMethod:         "POST",
				PathTemplate:       "/api/internal/subscription_code/issue",
				HeaderTemplateJSON: jsonValue(map[string]any{"Content-Type": "application/json"}),
				QueryTemplateJSON:  jsonValue(map[string]any{}),
				BodyTemplateJSON: jsonValue(map[string]any{
					"order_no":        "{{order_no}}",
					"product_id":      "{{product_id}}",
					"product_name":    "{{product_name}}",
					"code_name":       "{{code_name}}",
					"count":           "{{count}}",
					"duration_unit":   "{{duration_unit}}",
					"duration_value":  "{{duration_value}}",
					"custom_seconds":  "{{custom_seconds}}",
					"available_group": "{{available_group}}",
					"expired_time":    "{{expired_time}}",
					"buyer_ref":       "{{buyer_ref}}",
				}),
				SuccessPath:  "success",
				CodeListPath: "data.codes",
				Enabled:      true,
			},
			{
				ProviderID:         newAPIProd.ID,
				ActionKey:          "query_issue_result",
				HTTPMethod:         "GET",
				PathTemplate:       "/api/internal/code_issue/{order_no}",
				HeaderTemplateJSON: jsonValue(map[string]any{}),
				QueryTemplateJSON:  jsonValue(map[string]any{"order_no": "{{order_no}}"}),
				BodyTemplateJSON:   jsonValue(map[string]any{}),
				SuccessPath:        "success",
				CodeListPath:       "data.codes",
				Enabled:            true,
			},
			{
				ProviderID:         manualQueue.ID,
				ActionKey:          "manual_review_delivery",
				HTTPMethod:         "POST",
				PathTemplate:       "/internal/v1/manual/review",
				HeaderTemplateJSON: jsonValue(map[string]any{}),
				QueryTemplateJSON:  jsonValue(map[string]any{}),
				BodyTemplateJSON: jsonValue(map[string]any{
					"order_no":         "{{order_no}}",
					"buyer_ref":        "{{buyer_ref}}",
					"strategy_key":     "{{strategy_key}}",
					"fulfillment_type": "{{fulfillment_type}}",
				}),
				SuccessPath:  "queued",
				CodeListPath: "",
				Enabled:      true,
			},
		}
		for _, item := range actions {
			if err := tx.Where("provider_id = ? AND action_key = ?", item.ProviderID, item.ActionKey).Assign(item).FirstOrCreate(&model.IntegrationAction{}).Error; err != nil {
				return err
			}
		}

		fulfillmentStrategies := []model.FulfillmentStrategy{
			{
				StrategyKey:          "recharge_code_standard",
				StrategyName:         "Recharge code standard",
				FulfillmentType:      "issue_code",
				ProviderKey:          "new_api_prod",
				ActionKey:            "issue_recharge_code",
				RequestTemplateJSON:  jsonValue(map[string]any{"order_no": "{{order_no}}"}),
				ResultSchemaJSON:     jsonValue(map[string]any{"codes": []string{}}),
				DeliveryTemplateJSON: jsonValue(map[string]any{"title": "Recharge code"}),
				RetryPolicyJSON:      jsonValue(map[string]any{"max_retries": 2}),
				Enabled:              true,
			},
			{
				StrategyKey:          "subscription_code_standard",
				StrategyName:         "Subscription code standard",
				FulfillmentType:      "issue_subscription",
				ProviderKey:          "new_api_prod",
				ActionKey:            "issue_subscription_code",
				RequestTemplateJSON:  jsonValue(map[string]any{"order_no": "{{order_no}}"}),
				ResultSchemaJSON:     jsonValue(map[string]any{"codes": []string{}}),
				DeliveryTemplateJSON: jsonValue(map[string]any{"title": "Subscription code"}),
				RetryPolicyJSON:      jsonValue(map[string]any{"max_retries": 2}),
				Enabled:              true,
			},
			{
				StrategyKey:          "manual_review_delivery",
				StrategyName:         "Manual review delivery",
				FulfillmentType:      "manual_delivery",
				ProviderKey:          "manual_review_queue",
				ActionKey:            "manual_review_delivery",
				RequestTemplateJSON:  jsonValue(map[string]any{"order_no": "{{order_no}}"}),
				ResultSchemaJSON:     jsonValue(map[string]any{"queued": true}),
				DeliveryTemplateJSON: jsonValue(map[string]any{"title": "Manual review"}),
				RetryPolicyJSON:      jsonValue(map[string]any{"max_retries": 0}),
				Enabled:              true,
			},
		}
		for _, item := range fulfillmentStrategies {
			if err := tx.Where("strategy_key = ?", item.StrategyKey).Assign(item).FirstOrCreate(&model.FulfillmentStrategy{}).Error; err != nil {
				return err
			}
		}

		deliveryStrategies := []model.DeliveryStrategy{
			{
				StrategyKey:         "telegram_and_web_default",
				StrategyName:        "Telegram and web default",
				ChannelType:         "telegram",
				MessageTemplateJSON: jsonValue(map[string]any{"title": "Telegram delivery"}),
				MaskPolicy:          "show_last_6",
				ResendAllowed:       true,
				Enabled:             true,
			},
			{
				StrategyKey:         "web_masked_fallback",
				StrategyName:        "Web masked fallback",
				ChannelType:         "web",
				MessageTemplateJSON: jsonValue(map[string]any{"title": "Web delivery"}),
				MaskPolicy:          "masked_full",
				ResendAllowed:       false,
				Enabled:             true,
			},
			{
				StrategyKey:         "manual_email_enterprise",
				StrategyName:        "Manual enterprise email",
				ChannelType:         "manual",
				MessageTemplateJSON: jsonValue(map[string]any{"title": "Manual enterprise delivery"}),
				MaskPolicy:          "manual_only",
				ResendAllowed:       true,
				Enabled:             true,
			},
		}
		for _, item := range deliveryStrategies {
			if err := tx.Where("strategy_key = ?", item.StrategyKey).Assign(item).FirstOrCreate(&model.DeliveryStrategy{}).Error; err != nil {
				return err
			}
		}

		runtimeSettings := []model.RuntimeSetting{
			{
				Module:      "orders",
				Name:        "ORDER_EXPIRE_MINUTES",
				Value:       "30",
				Scope:       "env",
				Description: "Minutes before an awaiting-payment order expires.",
			},
			{
				Module:      "payments",
				Name:        "PAYMENT_REVIEW_TIMEOUT_MINUTES",
				Value:       "60",
				Scope:       "env",
				Description: "Minutes before a pending-review payment is considered overdue.",
			},
			{
				Module:      "orders",
				Name:        "ORDER_SWEEP_INTERVAL_SECONDS",
				Value:       "30",
				Scope:       "env",
				Description: "Seconds between automated order expiration and payment-review timeout sweeps.",
			},
		}
		for _, item := range runtimeSettings {
			if err := tx.Where("name = ?", item.Name).Assign(item).FirstOrCreate(&model.RuntimeSetting{}).Error; err != nil {
				return err
			}
		}

		products := []model.Product{
			{
				ProductType:            "recharge",
				SKU:                    "credit-trial",
				Name:                   "Trial Credit Pack",
				Description:            "Starter recharge pack",
				DisplayPrice:           0.15,
				Currency:               "USDT",
				Enabled:                true,
				SortOrder:              10,
				FulfillmentStrategyKey: "recharge_code_standard",
				DeliveryStrategyKey:    "web_masked_fallback",
				MetadataJSON: jsonValue(productMetadata{
					NameZH:          "试用充值包",
					NameEN:          "Trial Credit Pack",
					BadgeZH:         "首购",
					BadgeEN:         "Starter",
					CycleLabelZH:    "一次性",
					CycleLabelEN:    "One-time",
					DeliveryLabelZH: "站内 + Telegram",
					DeliveryLabelEN: "Web + Telegram",
					StockLabelZH:    "即时发放",
					StockLabelEN:    "Instant issue",
					StatusLabelZH:   "上架",
					StatusLabelEN:   "Live",
					OriginalPrice:   "0.28",
					BillingCycle:    "one_time",
					Inventory:       120,
					PaymentMethods:  []string{"okx_usdt", "wechat_qr", "alipay_qr"},
					TagsZH:          []string{"充值", "试用", "现货"},
					TagsEN:          []string{"Credit", "Trial", "In stock"},
					CheckoutNotesZH: []string{"适合跑通首条真实支付链路。", "订单确认后立即发放兑换码。", "运营视图需对卡密脱敏展示。"},
					CheckoutNotesEN: []string{
						"Good first SKU for validating a live payment loop.",
						"Issue the redemption code immediately after payment confirmation.",
						"Delivered codes should remain masked in operator views.",
					},
					ArtVariant: "trial",
				}),
			},
			{
				ProductType:            "subscription",
				SKU:                    "starter-monthly",
				Name:                   "Starter Monthly",
				Description:            "Starter subscription plan",
				DisplayPrice:           2.10,
				Currency:               "USDT",
				Enabled:                true,
				SortOrder:              20,
				FulfillmentStrategyKey: "subscription_code_standard",
				DeliveryStrategyKey:    "web_masked_fallback",
				MetadataJSON: jsonValue(productMetadata{
					NameZH:          "入门月卡",
					NameEN:          "Starter Monthly",
					BadgeZH:         "标准",
					BadgeEN:         "Core",
					CycleLabelZH:    "月付",
					CycleLabelEN:    "Monthly",
					DeliveryLabelZH: "站内 + Telegram",
					DeliveryLabelEN: "Web + Telegram",
					StockLabelZH:    "自动交付",
					StockLabelEN:    "Auto delivery",
					StatusLabelZH:   "稳定",
					StatusLabelEN:   "Stable",
					OriginalPrice:   "2.70",
					BillingCycle:    "monthly",
					Inventory:       200,
					PaymentMethods:  []string{"okx_usdt", "wechat_qr", "alipay_qr"},
					TagsZH:          []string{"订阅", "月付", "自动"},
					TagsEN:          []string{"Subscription", "Monthly", "Automatic"},
					CheckoutNotesZH: []string{"适合个人与小团队试运行。", "支付成功后同步写入站内订单。", "默认启用 Telegram 交付通知。"},
					CheckoutNotesEN: []string{
						"Fits personal and small-team onboarding.",
						"Sync the web order after payment confirmation.",
						"Telegram delivery notice is enabled by default.",
					},
					ArtVariant: "starter",
				}),
			},
			{
				ProductType:            "subscription",
				SKU:                    "pro-monthly",
				Name:                   "Pro Monthly",
				Description:            "Professional subscription plan",
				DisplayPrice:           5.49,
				Currency:               "USDT",
				Enabled:                true,
				SortOrder:              30,
				FulfillmentStrategyKey: "subscription_code_standard",
				DeliveryStrategyKey:    "telegram_and_web_default",
				MetadataJSON: jsonValue(productMetadata{
					NameZH:          "专业月卡",
					NameEN:          "Pro Monthly",
					BadgeZH:         "热销",
					BadgeEN:         "Popular",
					CycleLabelZH:    "月付",
					CycleLabelEN:    "Monthly",
					DeliveryLabelZH: "站内 + Telegram",
					DeliveryLabelEN: "Web + Telegram",
					StockLabelZH:    "自动交付",
					StockLabelEN:    "Auto delivery",
					StatusLabelZH:   "稳定",
					StatusLabelEN:   "Stable",
					OriginalPrice:   "6.90",
					BillingCycle:    "monthly",
					Inventory:       160,
					PaymentMethods:  []string{"okx_usdt", "wechat_qr", "alipay_qr"},
					TagsZH:          []string{"订阅", "热销", "自动"},
					TagsEN:          []string{"Subscription", "Popular", "Automatic"},
					CheckoutNotesZH: []string{"适合高频使用场景。", "推荐链上 watcher 进行付款确认。", "库存不足时触发后台预警。"},
					CheckoutNotesEN: []string{
						"Built for higher-frequency usage.",
						"Watcher-based payment confirmation is recommended.",
						"Low stock should trigger an admin alert.",
					},
					ArtVariant: "growth",
				}),
			},
			{
				ProductType:            "subscription",
				SKU:                    "team-quarterly",
				Name:                   "Team Quarterly",
				Description:            "Quarterly team package",
				DisplayPrice:           12.39,
				Currency:               "USDT",
				Enabled:                true,
				SortOrder:              40,
				FulfillmentStrategyKey: "subscription_code_standard",
				DeliveryStrategyKey:    "telegram_and_web_default",
				MetadataJSON: jsonValue(productMetadata{
					NameZH:          "团队季卡",
					NameEN:          "Team Quarterly",
					BadgeZH:         "协作",
					BadgeEN:         "Team",
					CycleLabelZH:    "季付",
					CycleLabelEN:    "Quarterly",
					DeliveryLabelZH: "站内 + Telegram",
					DeliveryLabelEN: "Web + Telegram",
					StockLabelZH:    "人工确认",
					StockLabelEN:    "Manual review",
					StatusLabelZH:   "预售",
					StatusLabelEN:   "Pre-sale",
					OriginalPrice:   "13.99",
					BillingCycle:    "quarterly",
					Inventory:       90,
					PaymentMethods:  []string{"okx_usdt", "wechat_qr", "alipay_qr"},
					TagsZH:          []string{"团队", "季付", "人工"},
					TagsEN:          []string{"Team", "Quarterly", "Manual"},
					CheckoutNotesZH: []string{"适合小团队集中采购。", "付款后进入人工审核履约队列。", "支持 Telegram 与站内双通道交付。"},
					CheckoutNotesEN: []string{
						"Designed for small-team centralized purchases.",
						"Orders enter the manual review queue after payment.",
						"Telegram and web delivery are both supported.",
					},
					ArtVariant: "team",
				}),
			},
			{
				ProductType:            "manual",
				SKU:                    "enterprise-yearly",
				Name:                   "Enterprise Yearly",
				Description:            "Enterprise annual package",
				DisplayPrice:           23.59,
				Currency:               "USDT",
				Enabled:                true,
				SortOrder:              50,
				FulfillmentStrategyKey: "manual_review_delivery",
				DeliveryStrategyKey:    "manual_email_enterprise",
				MetadataJSON: jsonValue(productMetadata{
					NameZH:          "企业年付",
					NameEN:          "Enterprise Yearly",
					BadgeZH:         "企业",
					BadgeEN:         "Enterprise",
					CycleLabelZH:    "年付",
					CycleLabelEN:    "Yearly",
					DeliveryLabelZH: "人工交付",
					DeliveryLabelEN: "Manual delivery",
					StockLabelZH:    "专属服务",
					StockLabelEN:    "Concierge service",
					StatusLabelZH:   "定制",
					StatusLabelEN:   "Custom",
					OriginalPrice:   "27.90",
					BillingCycle:    "yearly",
					Inventory:       32,
					PaymentMethods:  []string{"okx_usdt", "wechat_qr", "alipay_qr"},
					TagsZH:          []string{"企业", "年付", "定制"},
					TagsEN:          []string{"Enterprise", "Yearly", "Custom"},
					CheckoutNotesZH: []string{"适合企业长期采购与定制交付。", "订单会进入人工服务流程。", "默认使用邮件与专属通道交付。"},
					CheckoutNotesEN: []string{
						"Ideal for enterprise purchasing and custom delivery.",
						"Orders enter a managed service workflow.",
						"Email and dedicated channels are used by default.",
					},
					ArtVariant: "enterprise",
				}),
			},
		}
		for _, item := range products {
			if err := tx.Where("sku = ?", item.SKU).Assign(item).FirstOrCreate(&model.Product{}).Error; err != nil {
				return err
			}
		}

		var productRows []model.Product
		if err := tx.Find(&productRows).Error; err != nil {
			return err
		}

		priceTemplates := []struct {
			productSKU string
			record     model.ProductPrice
		}{
			{productSKU: "credit-trial", record: model.ProductPrice{TemplateName: "trial-usdt", PaymentMethod: "okx_usdt", Currency: "USDT", Amount: 0.15, OriginalAmount: 0.28, BillingCycle: "one_time", Enabled: true, SortOrder: 10}},
			{productSKU: "credit-trial", record: model.ProductPrice{TemplateName: "trial-rmb-wechat", PaymentMethod: "wechat_qr", Currency: "RMB", Amount: 0.99, OriginalAmount: 1.99, BillingCycle: "one_time", Enabled: true, SortOrder: 20}},
			{productSKU: "credit-trial", record: model.ProductPrice{TemplateName: "trial-rmb-alipay", PaymentMethod: "alipay_qr", Currency: "RMB", Amount: 0.99, OriginalAmount: 1.99, BillingCycle: "one_time", Enabled: true, SortOrder: 30}},
			{productSKU: "starter-monthly", record: model.ProductPrice{TemplateName: "starter-usdt", PaymentMethod: "okx_usdt", Currency: "USDT", Amount: 2.10, OriginalAmount: 2.70, BillingCycle: "monthly", Enabled: true, SortOrder: 10}},
			{productSKU: "starter-monthly", record: model.ProductPrice{TemplateName: "starter-rmb-wechat", PaymentMethod: "wechat_qr", Currency: "RMB", Amount: 15.00, OriginalAmount: 19.00, BillingCycle: "monthly", Enabled: true, SortOrder: 20}},
			{productSKU: "starter-monthly", record: model.ProductPrice{TemplateName: "starter-rmb-alipay", PaymentMethod: "alipay_qr", Currency: "RMB", Amount: 15.00, OriginalAmount: 19.00, BillingCycle: "monthly", Enabled: true, SortOrder: 30}},
			{productSKU: "pro-monthly", record: model.ProductPrice{TemplateName: "pro-usdt", PaymentMethod: "okx_usdt", Currency: "USDT", Amount: 5.49, OriginalAmount: 6.90, BillingCycle: "monthly", Enabled: true, SortOrder: 10}},
			{productSKU: "pro-monthly", record: model.ProductPrice{TemplateName: "pro-rmb-wechat", PaymentMethod: "wechat_qr", Currency: "RMB", Amount: 39.00, OriginalAmount: 49.00, BillingCycle: "monthly", Enabled: true, SortOrder: 20}},
			{productSKU: "pro-monthly", record: model.ProductPrice{TemplateName: "pro-rmb-alipay", PaymentMethod: "alipay_qr", Currency: "RMB", Amount: 39.00, OriginalAmount: 49.00, BillingCycle: "monthly", Enabled: true, SortOrder: 30}},
			{productSKU: "team-quarterly", record: model.ProductPrice{TemplateName: "team-usdt", PaymentMethod: "okx_usdt", Currency: "USDT", Amount: 12.39, OriginalAmount: 13.99, BillingCycle: "quarterly", Enabled: true, SortOrder: 10}},
			{productSKU: "team-quarterly", record: model.ProductPrice{TemplateName: "team-rmb-wechat", PaymentMethod: "wechat_qr", Currency: "RMB", Amount: 88.00, OriginalAmount: 99.00, BillingCycle: "quarterly", Enabled: true, SortOrder: 20}},
			{productSKU: "team-quarterly", record: model.ProductPrice{TemplateName: "team-rmb-alipay", PaymentMethod: "alipay_qr", Currency: "RMB", Amount: 88.00, OriginalAmount: 99.00, BillingCycle: "quarterly", Enabled: true, SortOrder: 30}},
			{productSKU: "enterprise-yearly", record: model.ProductPrice{TemplateName: "enterprise-usdt", PaymentMethod: "okx_usdt", Currency: "USDT", Amount: 23.59, OriginalAmount: 27.90, BillingCycle: "yearly", Enabled: true, SortOrder: 10}},
			{productSKU: "enterprise-yearly", record: model.ProductPrice{TemplateName: "enterprise-rmb-wechat", PaymentMethod: "wechat_qr", Currency: "RMB", Amount: 168.00, OriginalAmount: 199.00, BillingCycle: "yearly", Enabled: true, SortOrder: 20}},
			{productSKU: "enterprise-yearly", record: model.ProductPrice{TemplateName: "enterprise-rmb-alipay", PaymentMethod: "alipay_qr", Currency: "RMB", Amount: 168.00, OriginalAmount: 199.00, BillingCycle: "yearly", Enabled: true, SortOrder: 30}},
		}
		for _, item := range priceTemplates {
			productID := findSeedProductID(productRows, item.productSKU)
			if productID == 0 {
				continue
			}
			item.record.ProductID = productID
			if err := tx.Where(
				"product_id = ? AND template_name = ? AND payment_method = ? AND currency = ?",
				productID,
				item.record.TemplateName,
				item.record.PaymentMethod,
				item.record.Currency,
			).Assign(item.record).FirstOrCreate(&model.ProductPrice{}).Error; err != nil {
				return err
			}
		}

		return nil
	})
}

func (s *Service) seedSampleBusinessData(ctx context.Context) error {
	var orderCount int64
	if err := s.db.WithContext(ctx).Model(&model.Order{}).Count(&orderCount).Error; err != nil {
		return err
	}
	if orderCount > 0 {
		return nil
	}

	productIDs, err := s.seedProductLookup(ctx)
	if err != nil {
		return err
	}

	meta := AuditMeta{RequestIP: "seed"}

	order1, err := s.CreateOrder(ctx, CreateOrderInput{
		ProductID:     productIDs["pro-monthly"],
		PaymentMethod: "okx_usdt",
		SourceChannel: "web",
		BuyerRef:      "tg:aster_ops",
		Quantity:      1,
		Currency:      "USDT",
	})
	if err != nil {
		return err
	}
	order1No := stringValue(order1["order_no"])
	if err := s.MarkStorefrontOrderPaid(ctx, order1No); err != nil {
		return err
	}
	if _, err := s.HandleOnchainConfirmation(ctx, OnchainConfirmationInput{
		OrderNo:       order1No,
		PaymentMethod: "okx_usdt",
		Amount:        "5.49",
		Currency:      "USDT",
		ChainTxHash:   "0x2a3f91c4",
		PayerAccount:  "0x98...19d2",
	}, meta); err != nil {
		return err
	}

	order2, err := s.CreateOrder(ctx, CreateOrderInput{
		ProductID:     productIDs["team-quarterly"],
		PaymentMethod: "alipay_qr",
		SourceChannel: "telegram",
		BuyerRef:      "tg:northwind_ops",
		Quantity:      1,
		Currency:      "RMB",
	})
	if err != nil {
		return err
	}
	order2No := stringValue(order2["order_no"])
	if err := s.MarkStorefrontOrderPaid(ctx, order2No); err != nil {
		return err
	}
	if err := s.ConfirmAdminOrderPayment(ctx, order2No, ConfirmPaymentInput{PaymentMethod: "alipay_qr", Amount: "88.00", Currency: "RMB"}, meta); err != nil {
		return err
	}
	if err := s.FulfillAdminOrder(ctx, order2No, meta); err != nil {
		return err
	}

	order3, err := s.CreateOrder(ctx, CreateOrderInput{
		ProductID:     productIDs["enterprise-yearly"],
		PaymentMethod: "wechat_qr",
		SourceChannel: "web",
		BuyerRef:      "web:orbital-commerce",
		Quantity:      1,
		Currency:      "RMB",
	})
	if err != nil {
		return err
	}
	order3No := stringValue(order3["order_no"])
	if err := s.UploadPaymentProof(ctx, order3No, UploadPaymentProofInput{
		ProofType: "screenshot",
		ObjectURL: "https://assets.example.com/proofs/orbital-commerce.png",
		Note:      "Buyer uploaded proof for manual review",
	}); err != nil {
		return err
	}
	if err := s.MarkStorefrontOrderPaid(ctx, order3No); err != nil {
		return err
	}

	order4, err := s.CreateOrder(ctx, CreateOrderInput{
		ProductID:     productIDs["credit-trial"],
		PaymentMethod: "okx_usdt",
		SourceChannel: "web",
		BuyerRef:      "web:nova-lab",
		Quantity:      1,
		Currency:      "USDT",
	})
	if err != nil {
		return err
	}
	order4No := stringValue(order4["order_no"])
	if _, err := s.HandleOnchainConfirmation(ctx, OnchainConfirmationInput{
		OrderNo:       order4No,
		PaymentMethod: "okx_usdt",
		Amount:        "0.97",
		Currency:      "USDT",
		ChainTxHash:   "TQ7288fd",
		PayerAccount:  "TRC20 memo pending",
	}, meta); err != nil {
		return err
	}

	order5, err := s.CreateOrder(ctx, CreateOrderInput{
		ProductID:     productIDs["starter-monthly"],
		PaymentMethod: "wechat_qr",
		SourceChannel: "admin",
		BuyerRef:      "crm:signal-forge",
		Quantity:      1,
		Currency:      "RMB",
	})
	if err != nil {
		return err
	}
	order5No := stringValue(order5["order_no"])
	if err := s.MarkStorefrontOrderPaid(ctx, order5No); err != nil {
		return err
	}
	if err := s.ConfirmAdminOrderPayment(ctx, order5No, ConfirmPaymentInput{PaymentMethod: "wechat_qr", Amount: "15.00", Currency: "RMB"}, meta); err != nil {
		return err
	}
	if err := s.RefundAdminOrder(ctx, order5No, "Seeded refund scenario.", meta); err != nil {
		return err
	}

	if _, err := s.CreateSupportTicket(ctx, CreateSupportTicketInput{
		OrderNo:      order2No,
		CustomerName: "Northwind Ops",
		Subject:      "Payment completed but subscription code not delivered",
		Content:      "Please check the fulfillment queue and resend the code.",
		Priority:     "urgent",
	}); err != nil {
		return err
	}
	if err := s.AssignAdminTicket(ctx, latestTicketNo(ctx, s.db), "Ava", meta); err != nil {
		return err
	}

	if _, err := s.CreateSupportTicket(ctx, CreateSupportTicketInput{
		OrderNo:      order1No,
		CustomerName: "Aster Group",
		Subject:      "Need Telegram delivery resend",
		Content:      "Buyer wants the delivery message resent to Telegram.",
		Priority:     "high",
	}); err != nil {
		return err
	}
	if err := s.AssignAdminTicket(ctx, latestTicketNo(ctx, s.db), "Mika", meta); err != nil {
		return err
	}

	if _, err := s.CreateSupportTicket(ctx, CreateSupportTicketInput{
		OrderNo:      order3No,
		CustomerName: "Orbital Commerce",
		Subject:      "Enterprise order requests manual delivery",
		Content:      "Enterprise buyer needs manual follow-up before delivery.",
		Priority:     "normal",
	}); err != nil {
		return err
	}
	lastTicket := latestTicketNo(ctx, s.db)
	if err := s.AssignAdminTicket(ctx, lastTicket, "Noah", meta); err != nil {
		return err
	}
	if err := s.ResolveAdminTicket(ctx, lastTicket, "Manual delivery procedure queued.", meta); err != nil {
		return err
	}

	return nil
}

func (s *Service) seedProductLookup(ctx context.Context) (map[string]uint, error) {
	var products []model.Product
	if err := s.db.WithContext(ctx).Find(&products).Error; err != nil {
		return nil, err
	}

	result := make(map[string]uint, len(products))
	for _, item := range products {
		result[item.SKU] = item.ID
	}

	return result, nil
}

func findSeedProductID(items []model.Product, sku string) uint {
	for _, item := range items {
		if item.SKU == sku {
			return item.ID
		}
	}
	return 0
}

func latestTicketNo(ctx context.Context, db *gorm.DB) string {
	var ticket model.SupportTicket
	if err := db.WithContext(ctx).Order("id DESC").First(&ticket).Error; err != nil {
		return ""
	}
	return ticket.TicketNo
}
