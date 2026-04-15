package service

import (
	"context"
	"fmt"
	"time"

	"passdock/server/internal/model"
)

type PaymentChannelUpsertInput struct {
	ChannelKey              string
	ChannelName             string
	ChannelType             string
	ProviderName            string
	Currency                string
	SettlementMode          string
	Enabled                 bool
	QRValue                 string
	DisplayNameZH           string
	DisplayNameEN           string
	ModeLabelZH             string
	ModeLabelEN             string
	Reference               string
	AutoFulfill             bool
	AutoDeliver             bool
	CallbackAuthType        string
	CallbackSecret          string
	CallbackKey             string
	CallbackHeaderName      string
	CallbackSignHeader      string
	CallbackTimestampHeader string
	CallbackNonceHeader     string
	CallbackSignatureParam  string
	CallbackTimestampParam  string
	CallbackNonceParam      string
	CallbackTTLSeconds      int
	CallbackSignSource      string
	CallbackPayloadMapping  map[string]string
	CallbackSuccessField    string
	CallbackSuccessValues   []string
	RefundProviderKey       string
	RefundActionKey         string
	RefundStatusPath        string
	RefundReceiptPath       string
}

type ProviderUpsertInput struct {
	ProviderKey  string
	ProviderName string
	BaseURL      string
	AuthType     string
	RetryTimes   int
	TimeoutMS    int
	Enabled      bool
	Health       string
	AuthConfig   map[string]any
}

type ActionUpsertInput struct {
	ProviderKey    string
	ActionKey      string
	HTTPMethod     string
	PathTemplate   string
	SuccessPath    string
	MessagePath    string
	CodeListPath   string
	Enabled        bool
	HeaderTemplate map[string]any
	QueryTemplate  map[string]any
	BodyTemplate   map[string]any
}

type FulfillmentStrategyUpsertInput struct {
	StrategyKey      string
	StrategyName     string
	FulfillmentType  string
	ProviderKey      string
	ActionKey        string
	Enabled          bool
	RequestTemplate  map[string]any
	ResultSchema     map[string]any
	DeliveryTemplate map[string]any
	RetryPolicy      map[string]any
}

type DeliveryStrategyUpsertInput struct {
	StrategyKey     string
	StrategyName    string
	ChannelType     string
	MaskPolicy      string
	ResendAllowed   bool
	Enabled         bool
	MessageTemplate map[string]any
}

func (s *Service) ListAdminPaymentChannels(ctx context.Context) ([]map[string]any, error) {
	var items []model.PaymentChannel
	if err := s.db.WithContext(ctx).Order("sort_order ASC, id ASC").Find(&items).Error; err != nil {
		return nil, err
	}

	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		config := normalizePaymentChannelConfig(parseJSON[paymentChannelConfig](item.ConfigJSON), item.ChannelName)
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
				"qr_content":                config.QRContent,
				"display_name":              config.DisplayName,
				"display_name_zh":           config.DisplayNameZH,
				"display_name_en":           config.DisplayNameEN,
				"mode_label_zh":             modeLabelZH,
				"mode_label_en":             modeLabelEN,
				"reference":                 config.Reference,
				"auto_fulfill":              config.AutoFulfill,
				"auto_deliver":              config.AutoDeliver,
				"callback_auth_type":        config.CallbackAuthType,
				"callback_secret_masked":    maskValue(config.CallbackSecret, 4),
				"callback_key":              config.CallbackKey,
				"callback_header_name":      config.CallbackHeaderName,
				"callback_sign_header":      config.CallbackSignHeader,
				"callback_timestamp_header": config.CallbackTimestampHeader,
				"callback_nonce_header":     config.CallbackNonceHeader,
				"callback_signature_param":  config.CallbackSignatureParam,
				"callback_timestamp_param":  config.CallbackTimestampParam,
				"callback_nonce_param":      config.CallbackNonceParam,
				"callback_ttl_seconds":      config.CallbackTTLSeconds,
				"callback_sign_source":      config.CallbackSignSource,
				"callback_payload_mapping":  config.CallbackPayloadMapping,
				"callback_success_field":    config.CallbackSuccessField,
				"callback_success_values":   config.CallbackSuccessValues,
				"refund_provider_key":       config.RefundProviderKey,
				"refund_action_key":         config.RefundActionKey,
				"refund_status_path":        config.RefundStatusPath,
				"refund_receipt_path":       config.RefundReceiptPath,
			},
			"qr_value":                  config.QRContent,
			"display_name_zh":           config.DisplayNameZH,
			"display_name_en":           config.DisplayNameEN,
			"mode_label_zh":             modeLabelZH,
			"mode_label_en":             modeLabelEN,
			"reference":                 config.Reference,
			"auto_fulfill":              config.AutoFulfill,
			"auto_deliver":              config.AutoDeliver,
			"callback_auth_type":        config.CallbackAuthType,
			"callback_secret_masked":    maskValue(config.CallbackSecret, 4),
			"callback_key":              config.CallbackKey,
			"callback_header_name":      config.CallbackHeaderName,
			"callback_sign_header":      config.CallbackSignHeader,
			"callback_timestamp_header": config.CallbackTimestampHeader,
			"callback_nonce_header":     config.CallbackNonceHeader,
			"callback_signature_param":  config.CallbackSignatureParam,
			"callback_timestamp_param":  config.CallbackTimestampParam,
			"callback_nonce_param":      config.CallbackNonceParam,
			"callback_ttl_seconds":      config.CallbackTTLSeconds,
			"callback_sign_source":      config.CallbackSignSource,
			"callback_payload_mapping":  config.CallbackPayloadMapping,
			"callback_success_field":    config.CallbackSuccessField,
			"callback_success_values":   config.CallbackSuccessValues,
			"refund_provider_key":       config.RefundProviderKey,
			"refund_action_key":         config.RefundActionKey,
			"refund_status_path":        config.RefundStatusPath,
			"refund_receipt_path":       config.RefundReceiptPath,
		})
	}
	return result, nil
}

func (s *Service) UpsertAdminPaymentChannel(ctx context.Context, routeID string, input PaymentChannelUpsertInput) error {
	var existingConfig *paymentChannelConfig
	if routeID != "" {
		existing, err := s.resolvePaymentChannelByRoute(ctx, routeID)
		if err != nil {
			return err
		}

		config := normalizePaymentChannelConfig(parseJSON[paymentChannelConfig](existing.ConfigJSON), existing.ChannelName)
		existingConfig = &config
	}

	config, err := buildPaymentChannelConfig(input, existingConfig)
	if err != nil {
		return err
	}

	record := model.PaymentChannel{
		ChannelKey:     input.ChannelKey,
		ChannelName:    input.ChannelName,
		ChannelType:    input.ChannelType,
		ProviderName:   input.ProviderName,
		SettlementMode: defaultString(input.SettlementMode, "manual"),
		Currency:       defaultString(input.Currency, "RMB"),
		Enabled:        input.Enabled,
		ConfigJSON:     jsonValue(config),
	}

	if routeID == "" {
		return s.db.WithContext(ctx).Create(&record).Error
	}
	existing, err := s.resolvePaymentChannelByRoute(ctx, routeID)
	if err != nil {
		return err
	}
	return s.db.WithContext(ctx).Model(existing).Updates(map[string]any{
		"channel_key":      record.ChannelKey,
		"channel_name":     record.ChannelName,
		"channel_type":     record.ChannelType,
		"provider_name":    record.ProviderName,
		"settlement_mode":  record.SettlementMode,
		"currency":         record.Currency,
		"enabled":          record.Enabled,
		"config_encrypted": record.ConfigJSON,
	}).Error
}

func (s *Service) DeleteAdminPaymentChannel(ctx context.Context, routeID string) error {
	record, err := s.resolvePaymentChannelByRoute(ctx, routeID)
	if err != nil {
		return err
	}
	return s.db.WithContext(ctx).Delete(record).Error
}

func (s *Service) ListAdminProviders(ctx context.Context) ([]map[string]any, error) {
	var items []model.IntegrationProvider
	if err := s.db.WithContext(ctx).Order("id ASC").Find(&items).Error; err != nil {
		return nil, err
	}

	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		result = append(result, map[string]any{
			"id":              item.ID,
			"provider_key":    item.ProviderKey,
			"provider_name":   item.ProviderName,
			"base_url":        item.BaseURL,
			"auth_type":       item.AuthType,
			"auth_config":     parseJSON[map[string]any](item.AuthConfigJSON),
			"retry_times":     item.RetryTimes,
			"timeout_ms":      item.TimeoutMS,
			"health":          item.HealthStatus,
			"enabled":         item.Enabled,
			"last_checked_at": item.LastCheckedAt,
		})
	}
	return result, nil
}

func (s *Service) UpsertAdminProvider(ctx context.Context, routeID string, input ProviderUpsertInput) error {
	if input.Enabled && s.isStrictProviderRuntime() && isMockProviderBaseURL(input.BaseURL) {
		return fmt.Errorf("provider %s cannot use a mock bootstrap target in %s", input.ProviderKey, s.cfg.AppEnv)
	}

	record := model.IntegrationProvider{
		ProviderKey:    input.ProviderKey,
		ProviderName:   input.ProviderName,
		BaseURL:        input.BaseURL,
		AuthType:       defaultString(input.AuthType, "none"),
		AuthConfigJSON: jsonValue(input.AuthConfig),
		RetryTimes:     input.RetryTimes,
		TimeoutMS:      input.TimeoutMS,
		HealthStatus:   s.deriveProviderHealthStatus(defaultString(input.Health, "unknown"), input.BaseURL),
		Enabled:        input.Enabled,
	}
	if err := s.validateProviderRuntimeTarget(&record); err != nil {
		return err
	}

	if routeID == "" {
		return s.db.WithContext(ctx).Create(&record).Error
	}
	existing, err := s.resolveProviderByRoute(ctx, routeID)
	if err != nil {
		return err
	}
	return s.db.WithContext(ctx).Model(existing).Updates(map[string]any{
		"provider_key":          record.ProviderKey,
		"provider_name":         record.ProviderName,
		"base_url":              record.BaseURL,
		"auth_type":             record.AuthType,
		"auth_config_encrypted": record.AuthConfigJSON,
		"retry_times":           record.RetryTimes,
		"timeout_ms":            record.TimeoutMS,
		"health_status":         record.HealthStatus,
		"enabled":               record.Enabled,
	}).Error
}

func (s *Service) DeleteAdminProvider(ctx context.Context, routeID string) error {
	record, err := s.resolveProviderByRoute(ctx, routeID)
	if err != nil {
		return err
	}
	return s.db.WithContext(ctx).Delete(record).Error
}

func (s *Service) HealthCheckProvider(ctx context.Context, routeID string) (map[string]any, error) {
	record, err := s.resolveProviderByRoute(ctx, routeID)
	if err != nil {
		return nil, err
	}

	result := s.checkProviderHealth(ctx, record)
	now := time.Now()
	record.HealthStatus = result.Health
	record.LastCheckedAt = &now
	if err := s.db.WithContext(ctx).Save(record).Error; err != nil {
		return nil, err
	}

	return map[string]any{
		"provider_key":    record.ProviderKey,
		"health":          record.HealthStatus,
		"last_checked_at": record.LastCheckedAt,
		"message":         result.Message,
		"status_code":     result.StatusCode,
		"reachable":       result.Reachable,
		"base_url":        result.BaseURL,
	}, nil
}

func (s *Service) ListAdminActions(ctx context.Context, providerRouteID string) ([]map[string]any, error) {
	provider, err := s.resolveProviderByRoute(ctx, providerRouteID)
	if err != nil {
		return nil, err
	}

	var items []model.IntegrationAction
	if err := s.db.WithContext(ctx).Where("provider_id = ?", provider.ID).Order("id ASC").Find(&items).Error; err != nil {
		return nil, err
	}

	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		result = append(result, map[string]any{
			"id":              item.ID,
			"provider_key":    provider.ProviderKey,
			"action_key":      item.ActionKey,
			"http_method":     item.HTTPMethod,
			"path_template":   item.PathTemplate,
			"success_path":    item.SuccessPath,
			"message_path":    item.MessagePath,
			"code_list_path":  item.CodeListPath,
			"enabled":         item.Enabled,
			"header_template": parseJSON[map[string]any](item.HeaderTemplateJSON),
			"query_template":  parseJSON[map[string]any](item.QueryTemplateJSON),
			"body_template":   parseJSON[map[string]any](item.BodyTemplateJSON),
		})
	}
	return result, nil
}

func (s *Service) UpsertAdminAction(ctx context.Context, routeID string, input ActionUpsertInput) error {
	provider, err := s.resolveProviderByRoute(ctx, input.ProviderKey)
	if err != nil {
		return err
	}

	record := model.IntegrationAction{
		ProviderID:         provider.ID,
		ActionKey:          input.ActionKey,
		HTTPMethod:         defaultString(input.HTTPMethod, "POST"),
		PathTemplate:       input.PathTemplate,
		SuccessPath:        defaultString(input.SuccessPath, "success"),
		MessagePath:        input.MessagePath,
		CodeListPath:       input.CodeListPath,
		Enabled:            input.Enabled,
		HeaderTemplateJSON: jsonValue(input.HeaderTemplate),
		QueryTemplateJSON:  jsonValue(input.QueryTemplate),
		BodyTemplateJSON:   jsonValue(input.BodyTemplate),
	}

	if routeID == "" {
		return s.db.WithContext(ctx).Create(&record).Error
	}
	existing, err := s.resolveActionByRoute(ctx, routeID)
	if err != nil {
		return err
	}
	return s.db.WithContext(ctx).Model(existing).Updates(map[string]any{
		"provider_id":     record.ProviderID,
		"action_key":      record.ActionKey,
		"http_method":     record.HTTPMethod,
		"path_template":   record.PathTemplate,
		"success_path":    record.SuccessPath,
		"message_path":    record.MessagePath,
		"code_list_path":  record.CodeListPath,
		"enabled":         record.Enabled,
		"header_template": record.HeaderTemplateJSON,
		"query_template":  record.QueryTemplateJSON,
		"body_template":   record.BodyTemplateJSON,
	}).Error
}

func (s *Service) DeleteAdminAction(ctx context.Context, routeID string) error {
	record, err := s.resolveActionByRoute(ctx, routeID)
	if err != nil {
		return err
	}
	return s.db.WithContext(ctx).Delete(record).Error
}

func (s *Service) TestAdminAction(ctx context.Context, routeID string, input AdminActionTestInput) (map[string]any, error) {
	return s.BuildAdminActionTestResult(ctx, routeID, input)
}

func (s *Service) ListAdminFulfillmentStrategies(ctx context.Context) ([]map[string]any, error) {
	var items []model.FulfillmentStrategy
	if err := s.db.WithContext(ctx).Order("id ASC").Find(&items).Error; err != nil {
		return nil, err
	}

	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		result = append(result, map[string]any{
			"id":                item.ID,
			"strategy_key":      item.StrategyKey,
			"strategy_name":     item.StrategyName,
			"fulfillment_type":  item.FulfillmentType,
			"provider_key":      item.ProviderKey,
			"action_key":        item.ActionKey,
			"enabled":           item.Enabled,
			"request_template":  parseJSON[map[string]any](item.RequestTemplateJSON),
			"result_schema":     parseJSON[map[string]any](item.ResultSchemaJSON),
			"delivery_template": parseJSON[map[string]any](item.DeliveryTemplateJSON),
			"retry_policy":      parseJSON[map[string]any](item.RetryPolicyJSON),
		})
	}
	return result, nil
}

func (s *Service) UpsertAdminFulfillmentStrategy(ctx context.Context, routeID string, input FulfillmentStrategyUpsertInput) error {
	record := model.FulfillmentStrategy{
		StrategyKey:          input.StrategyKey,
		StrategyName:         input.StrategyName,
		FulfillmentType:      input.FulfillmentType,
		ProviderKey:          input.ProviderKey,
		ActionKey:            input.ActionKey,
		Enabled:              input.Enabled,
		RequestTemplateJSON:  jsonValue(input.RequestTemplate),
		ResultSchemaJSON:     jsonValue(input.ResultSchema),
		DeliveryTemplateJSON: jsonValue(input.DeliveryTemplate),
		RetryPolicyJSON:      jsonValue(input.RetryPolicy),
	}

	if routeID == "" {
		return s.db.WithContext(ctx).Create(&record).Error
	}
	existing, err := s.resolveFulfillmentStrategyByRoute(ctx, routeID)
	if err != nil {
		return err
	}
	return s.db.WithContext(ctx).Model(existing).Updates(map[string]any{
		"strategy_key":      record.StrategyKey,
		"strategy_name":     record.StrategyName,
		"fulfillment_type":  record.FulfillmentType,
		"provider_key":      record.ProviderKey,
		"action_key":        record.ActionKey,
		"enabled":           record.Enabled,
		"request_template":  record.RequestTemplateJSON,
		"result_schema":     record.ResultSchemaJSON,
		"delivery_template": record.DeliveryTemplateJSON,
		"retry_policy":      record.RetryPolicyJSON,
	}).Error
}

func (s *Service) DeleteAdminFulfillmentStrategy(ctx context.Context, routeID string) error {
	record, err := s.resolveFulfillmentStrategyByRoute(ctx, routeID)
	if err != nil {
		return err
	}
	return s.db.WithContext(ctx).Delete(record).Error
}

func (s *Service) PreviewAdminFulfillmentStrategy(ctx context.Context, routeID string) (map[string]any, error) {
	record, err := s.resolveFulfillmentStrategyByRoute(ctx, routeID)
	if err != nil {
		return nil, err
	}

	return s.buildAdminFulfillmentStrategyPreview(ctx, record)
}

func (s *Service) ListAdminDeliveryStrategies(ctx context.Context) ([]map[string]any, error) {
	var items []model.DeliveryStrategy
	if err := s.db.WithContext(ctx).Order("id ASC").Find(&items).Error; err != nil {
		return nil, err
	}

	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		result = append(result, map[string]any{
			"id":               item.ID,
			"strategy_key":     item.StrategyKey,
			"strategy_name":    item.StrategyName,
			"channel_type":     item.ChannelType,
			"mask_policy":      item.MaskPolicy,
			"resend_allowed":   item.ResendAllowed,
			"enabled":          item.Enabled,
			"message_template": parseJSON[map[string]any](item.MessageTemplateJSON),
		})
	}
	return result, nil
}

func (s *Service) UpsertAdminDeliveryStrategy(ctx context.Context, routeID string, input DeliveryStrategyUpsertInput) error {
	record := model.DeliveryStrategy{
		StrategyKey:         input.StrategyKey,
		StrategyName:        input.StrategyName,
		ChannelType:         input.ChannelType,
		MaskPolicy:          input.MaskPolicy,
		ResendAllowed:       input.ResendAllowed,
		Enabled:             input.Enabled,
		MessageTemplateJSON: jsonValue(input.MessageTemplate),
	}

	if routeID == "" {
		return s.db.WithContext(ctx).Create(&record).Error
	}
	existing, err := s.resolveDeliveryStrategyByRoute(ctx, routeID)
	if err != nil {
		return err
	}
	return s.db.WithContext(ctx).Model(existing).Updates(map[string]any{
		"strategy_key":     record.StrategyKey,
		"strategy_name":    record.StrategyName,
		"channel_type":     record.ChannelType,
		"mask_policy":      record.MaskPolicy,
		"resend_allowed":   record.ResendAllowed,
		"enabled":          record.Enabled,
		"message_template": record.MessageTemplateJSON,
	}).Error
}

func (s *Service) DeleteAdminDeliveryStrategy(ctx context.Context, routeID string) error {
	record, err := s.resolveDeliveryStrategyByRoute(ctx, routeID)
	if err != nil {
		return err
	}
	return s.db.WithContext(ctx).Delete(record).Error
}

func (s *Service) TestAdminDeliveryStrategy(ctx context.Context, routeID string) (map[string]any, error) {
	record, err := s.resolveDeliveryStrategyByRoute(ctx, routeID)
	if err != nil {
		return nil, err
	}

	return s.buildAdminDeliveryStrategyTest(ctx, record)
}
