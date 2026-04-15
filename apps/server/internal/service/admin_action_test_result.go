package service

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"gorm.io/gorm"

	"passdock/server/internal/model"
)

const (
	adminActionTestExecutionModeInternal = "executed_internal"
	adminActionTestExecutionModeExternal = "render_only_external"
	adminActionTestExecutionModePreview  = "preview_only"
	adminActionTestExecutionModeLive     = "executed_external_live"
)

type AdminActionTestInput struct {
	Mode string `json:"mode"`
}

func (s *Service) BuildAdminActionTestResult(
	ctx context.Context,
	actionRouteID string,
	input AdminActionTestInput,
) (map[string]any, error) {
	action, err := s.resolveActionByRoute(ctx, actionRouteID)
	if err != nil {
		return nil, err
	}

	var provider model.IntegrationProvider
	if err := s.db.WithContext(ctx).First(&provider, action.ProviderID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrNotFound
		}
		return nil, err
	}

	templateData, sampleSource, err := s.buildAdminActionTestTemplateData(ctx, &provider, action)
	if err != nil {
		return nil, err
	}

	mode := normalizeAdminActionTestMode(input.Mode)
	dryRun, executionMode, executionNote, liveAllowed, liveGuardReason, planErr := planAdminActionTestExecution(
		&provider,
		action,
		mode,
	)
	if planErr != nil {
		return nil, planErr
	}
	result, execErr := s.ExecuteIntegrationAction(ctx, provider.ProviderKey, action.ActionKey, ExecuteActionInput{
		DryRun:       dryRun,
		TemplateData: templateData,
	})
	if result == nil && execErr != nil {
		return nil, execErr
	}
	if result == nil {
		return nil, ErrInvalidState
	}

	payload := result.ToMap()
	payload["provider_key"] = provider.ProviderKey
	payload["action_key"] = action.ActionKey
	payload["template_data"] = templateData
	payload["sample_source"] = sampleSource
	payload["execution_mode"] = executionMode
	payload["requested_mode"] = mode
	payload["live_test_allowed"] = liveAllowed
	if strings.TrimSpace(executionNote) != "" {
		payload["execution_note"] = executionNote
	}
	if strings.TrimSpace(liveGuardReason) != "" {
		payload["live_test_guard_reason"] = liveGuardReason
	}

	if request, ok := payload["request"].(map[string]any); ok {
		payload["request_method"] = stringifyTemplateValue(request["method"])
		payload["request_url"] = stringifyTemplateValue(request["url"])
	}

	if response, ok := payload["response"].(map[string]any); ok {
		if statusCode, exists := response["status_code"]; exists {
			payload["status_code"] = statusCode
		}
	}

	if strings.TrimSpace(stringValue(payload["response_message"])) == "" {
		payload["response_message"] = result.Message
	}

	if executionMode == adminActionTestExecutionModeInternal && execErr == nil {
		payload["status_code"] = http.StatusOK
	}

	if execErr != nil {
		payload["success"] = false
		payload["error"] = true
		payload["message"] = defaultString(strings.TrimSpace(result.Message), execErr.Error())
		payload["response_message"] = defaultString(strings.TrimSpace(result.Message), execErr.Error())
		return payload, nil
	}

	if dryRun {
		payload["message"] = defaultString(strings.TrimSpace(executionNote), "Action template rendered successfully.")
	} else {
		payload["message"] = defaultString(strings.TrimSpace(result.Message), "Action executed successfully.")
	}
	payload["error"] = false

	return payload, nil
}

func normalizeAdminActionTestMode(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "preview":
		return "preview"
	case "live":
		return "live"
	default:
		return "auto"
	}
}

func planAdminActionTestExecution(
	provider *model.IntegrationProvider,
	action *model.IntegrationAction,
	mode string,
) (bool, string, string, bool, string, error) {
	liveAllowed, liveGuardReason := adminActionExternalLiveAllowed(provider, action)

	if provider == nil {
		return true, adminActionTestExecutionModePreview, "Action test rendered only because the provider is missing.", false, "Provider is missing.", nil
	}

	baseURL := strings.TrimSpace(provider.BaseURL)
	if mode == "preview" {
		return true, adminActionTestExecutionModePreview, "Action template rendered in preview mode without calling the upstream.", liveAllowed, liveGuardReason, nil
	}
	if mode == "live" {
		switch {
		case strings.HasPrefix(baseURL, "mock://"), strings.HasPrefix(baseURL, "internal://"):
			return false, adminActionTestExecutionModeInternal, "Action executed against the local internal/mock adapter.", true, "", nil
		case liveAllowed:
			return false, adminActionTestExecutionModeLive, "Action executed against the configured external sandbox or read-only upstream target.", true, "", nil
		default:
			return false, "", "", false, liveGuardReason, fmt.Errorf("%w: %s", ErrInvalidState, defaultString(strings.TrimSpace(liveGuardReason), "External live test is blocked for this provider/action."))
		}
	}

	switch {
	case strings.HasPrefix(baseURL, "mock://"), strings.HasPrefix(baseURL, "internal://"):
		return false, adminActionTestExecutionModeInternal, "Action executed against the local internal/mock adapter.", true, "", nil
	default:
		return true, adminActionTestExecutionModeExternal, "Live execution skipped for external upstream actions to avoid creating or mutating real resources. Use preview mode for template checks or enable a sandbox/read-only target for live tests.", liveAllowed, liveGuardReason, nil
	}
}

func adminActionExternalLiveAllowed(
	provider *model.IntegrationProvider,
	action *model.IntegrationAction,
) (bool, string) {
	if provider == nil {
		return false, "Provider is missing."
	}

	baseURL := strings.TrimSpace(strings.ToLower(provider.BaseURL))
	switch {
	case strings.HasPrefix(baseURL, "mock://"), strings.HasPrefix(baseURL, "internal://"):
		return true, ""
	}

	if action != nil {
		method := strings.ToUpper(strings.TrimSpace(action.HTTPMethod))
		switch method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			return true, ""
		}
	}

	if providerBaseURLLooksSafeForLiveTest(baseURL) {
		return true, ""
	}

	return false, "External live test is only allowed for sandbox/test/staging/local upstreams or read-only actions."
}

func providerBaseURLLooksSafeForLiveTest(baseURL string) bool {
	value := strings.TrimSpace(strings.ToLower(baseURL))
	if value == "" {
		return false
	}

	safeHints := []string{
		"localhost",
		"127.0.0.1",
		".local",
		"sandbox",
		"staging",
		"test",
		"dev",
	}
	for _, hint := range safeHints {
		if strings.Contains(value, hint) {
			return true
		}
	}

	return false
}

func (s *Service) buildAdminActionTestTemplateData(
	ctx context.Context,
	provider *model.IntegrationProvider,
	action *model.IntegrationAction,
) (map[string]any, string, error) {
	if action == nil {
		return defaultAdminActionTestTemplateData(), "synthetic_sample", nil
	}

	if templateData, source, ok, err := s.loadAdminActionQueryTemplateData(ctx, action); err != nil {
		return nil, "", err
	} else if ok {
		return templateData, source, nil
	}

	strategy, err := s.findFulfillmentStrategyForAction(ctx, provider, action)
	if err != nil {
		return nil, "", err
	}
	if strategy == nil {
		return defaultAdminActionTestTemplateData(), "synthetic_sample", nil
	}

	previewContext, err := s.resolveAdminStrategyPreviewContext(ctx, strategy.StrategyKey, "", strategy.FulfillmentType)
	if err != nil {
		return nil, "", err
	}

	templateData := s.buildFulfillmentTemplateData(
		previewContext.Order,
		strategy,
		orderQuantity(*previewContext.Order),
	)
	templateData["codes"] = append([]string{}, previewContext.Codes...)
	templateData["masked_codes"] = append([]string{}, previewContext.MaskedCodes...)
	templateData["content"] = previewContext.PlainContent
	templateData["masked_content"] = previewContext.MaskedContent

	if requestTemplate := parseJSON[map[string]any](strategy.RequestTemplateJSON); len(requestTemplate) > 0 {
		if renderedRequest, ok := renderTemplateValue(requestTemplate, templateData).(map[string]any); ok {
			for key, value := range renderedRequest {
				templateData[key] = value
			}
		}
	}

	return templateData, previewContext.Source, nil
}

func (s *Service) loadAdminActionQueryTemplateData(
	ctx context.Context,
	action *model.IntegrationAction,
) (map[string]any, string, bool, error) {
	if action == nil || strings.TrimSpace(action.ActionKey) != "query_issue_result" {
		return nil, "", false, nil
	}

	var issue model.CodeIssueRecord
	if err := s.db.WithContext(ctx).
		Order("id DESC").
		First(&issue).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return defaultAdminActionTestTemplateData(), "synthetic_sample", true, nil
		}
		return nil, "", false, err
	}

	templateData := defaultAdminActionTestTemplateData()
	templateData["order_no"] = issue.OrderNo

	if codes, err := s.loadIssueCodes(issue); err == nil && len(codes) > 0 {
		templateData["codes"] = append([]string{}, codes...)
		templateData["masked_codes"] = maskCodes(codes)
		templateData["content"] = strings.Join(codes, ", ")
		templateData["masked_content"] = strings.Join(maskCodes(codes), ", ")
	}

	if order, err := s.resolveOrderByNo(ctx, issue.OrderNo); err == nil && order != nil {
		templateData["buyer_ref"] = order.BuyerRef
		templateData["payment_method"] = order.PaymentMethod
		templateData["source_channel"] = order.SourceChannel
		templateData["currency"] = order.Currency
		templateData["count"] = orderQuantity(*order)
		productSnapshot := parseJSON[map[string]any](order.ProductSnapshot)
		if productID, exists := productSnapshot["product_id"]; exists {
			templateData["product_id"] = productID
		}
		if productName := s.orderProductName(*order); strings.TrimSpace(productName) != "" {
			templateData["product_name"] = productName
		}
	}

	return templateData, "latest_issue_record", true, nil
}

func (s *Service) findFulfillmentStrategyForAction(
	ctx context.Context,
	provider *model.IntegrationProvider,
	action *model.IntegrationAction,
) (*model.FulfillmentStrategy, error) {
	if provider == nil || action == nil {
		return nil, nil
	}

	var strategy model.FulfillmentStrategy
	if err := s.db.WithContext(ctx).
		Where("provider_key = ? AND action_key = ?", provider.ProviderKey, action.ActionKey).
		Order("enabled DESC, id ASC").
		First(&strategy).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}

	return &strategy, nil
}

func defaultAdminActionTestTemplateData() map[string]any {
	return map[string]any{
		"order_no":        "PD-TEST-0001",
		"product_id":      1001,
		"product_name":    "PassDock Test Product",
		"buyer_ref":       "test:buyer",
		"payment_method":  "wechat_qr",
		"source_channel":  "admin",
		"count":           1,
		"currency":        "RMB",
		"code_name":       "PASSDOCK-TEST",
		"quota":           1000000,
		"expired_time":    0,
		"duration_unit":   "month",
		"duration_value":  1,
		"custom_seconds":  0,
		"available_group": "",
	}
}
