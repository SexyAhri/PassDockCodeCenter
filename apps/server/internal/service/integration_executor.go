package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"

	"passdock/server/internal/model"
)

var (
	templatePattern     = regexp.MustCompile(`\{\{\s*([a-zA-Z0-9_.\-\[\]]+)\s*\}\}`)
	bracketIndexPattern = regexp.MustCompile(`\[(\d+)\]`)
)

type ExecuteActionInput struct {
	TemplateData map[string]any
	DryRun       bool
}

type ExecuteActionResult struct {
	ProviderKey string
	ActionKey   string
	DryRun      bool
	Success     bool
	Message     string
	Codes       []string
	Request     map[string]any
	Response    any
}

type actionRequestSpec struct {
	Method    string
	Path      string
	URL       string
	Headers   map[string]string
	Query     url.Values
	Body      any
	BodyBytes []byte
}

func (s *Service) ExecuteIntegrationAction(
	ctx context.Context,
	providerRouteID string,
	actionRouteID string,
	input ExecuteActionInput,
) (*ExecuteActionResult, error) {
	provider, action, err := s.resolveProviderAction(ctx, providerRouteID, actionRouteID)
	if err != nil {
		return nil, err
	}
	if !provider.Enabled || !action.Enabled {
		return nil, ErrInvalidState
	}

	requestSpec, err := s.renderActionRequest(provider, action, input.TemplateData)
	if err != nil {
		return nil, err
	}

	result := &ExecuteActionResult{
		ProviderKey: provider.ProviderKey,
		ActionKey:   action.ActionKey,
		DryRun:      input.DryRun,
		Success:     true,
		Message:     "Action request rendered successfully.",
		Request:     requestSpec.previewMap(),
	}

	if input.DryRun {
		return result, nil
	}

	var response any
	switch {
	case strings.HasPrefix(provider.BaseURL, "internal://"), strings.HasPrefix(provider.BaseURL, "mock://"):
		response, err = s.executeInternalProviderAction(ctx, provider, action, requestSpec, input.TemplateData)
	default:
		response, err = s.executeHTTPProviderAction(ctx, provider, requestSpec)
	}
	result.Response = response
	if err != nil {
		result.Success = false
		result.Message = err.Error()
		return result, err
	}

	result.Success = extractSuccess(response, action.SuccessPath)
	result.Message = extractMessage(response, action.MessagePath)
	result.Codes = extractStringList(response, action.CodeListPath)
	if result.Message == "" {
		if result.Success {
			result.Message = "Action executed successfully."
		} else {
			result.Message = "Upstream action reported failure."
		}
	}
	if !result.Success {
		return result, fmt.Errorf("%s", result.Message)
	}

	return result, nil
}

func (r *ExecuteActionResult) ToMap() map[string]any {
	if r == nil {
		return map[string]any{}
	}

	return map[string]any{
		"provider_key": r.ProviderKey,
		"action_key":   r.ActionKey,
		"dry_run":      r.DryRun,
		"success":      r.Success,
		"message":      r.Message,
		"codes":        r.Codes,
		"request":      r.Request,
		"response":     r.Response,
	}
}

func (s *Service) renderActionRequest(
	provider *model.IntegrationProvider,
	action *model.IntegrationAction,
	templateData map[string]any,
) (*actionRequestSpec, error) {
	data := copyMap(templateData)

	headers := renderTemplateStringMap(parseJSON[map[string]any](action.HeaderTemplateJSON), data)
	queryValues := renderTemplateQuery(parseJSON[map[string]any](action.QueryTemplateJSON), data)
	body := renderTemplateValue(parseJSON[map[string]any](action.BodyTemplateJSON), data)
	method := strings.ToUpper(defaultString(action.HTTPMethod, http.MethodPost))
	path := renderPathTemplate(action.PathTemplate, data)

	spec := &actionRequestSpec{
		Method:  method,
		Path:    path,
		Headers: headers,
		Query:   queryValues,
		Body:    body,
	}

	if method != http.MethodGet && method != http.MethodDelete {
		if body == nil {
			spec.BodyBytes = []byte("{}")
		} else {
			payload, err := json.Marshal(body)
			if err != nil {
				return nil, err
			}
			spec.BodyBytes = payload
		}
		if _, ok := spec.Headers["Content-Type"]; !ok {
			spec.Headers["Content-Type"] = "application/json"
		}
	}

	if err := s.applyActionAuth(provider, spec); err != nil {
		return nil, err
	}

	baseURL := strings.TrimRight(provider.BaseURL, "/")
	fullURL := baseURL + path
	if encoded := spec.Query.Encode(); encoded != "" {
		fullURL += "?" + encoded
	}
	spec.URL = fullURL

	return spec, nil
}

func (s *Service) applyActionAuth(provider *model.IntegrationProvider, spec *actionRequestSpec) error {
	authConfig := parseJSON[map[string]any](provider.AuthConfigJSON)

	switch provider.AuthType {
	case "bearer_token":
		token := lookupString(authConfig, "token", "access_token", "bearer_token")
		if token != "" {
			spec.Headers["Authorization"] = "Bearer " + token
		}
	case "static_header":
		if nested, ok := authConfig["headers"].(map[string]any); ok {
			for key, value := range nested {
				spec.Headers[key] = stringifyTemplateValue(value)
			}
		}
		name := lookupString(authConfig, "header_name")
		value := lookupString(authConfig, "header_value", "value")
		if name != "" && value != "" {
			spec.Headers[name] = value
		}
	case "hmac_sha256":
		bodyHash := sha256.Sum256(spec.BodyBytes)
		timestamp := strconv.FormatInt(time.Now().Unix(), 10)
		nonce, err := generateCode(16)
		if err != nil {
			return err
		}
		secret := lookupString(authConfig, "secret")
		keyID := lookupString(authConfig, "key_id")
		mac := hmac.New(sha256.New, []byte(secret))
		source := strings.Join([]string{
			spec.Method,
			spec.Path,
			timestamp,
			nonce,
			hex.EncodeToString(bodyHash[:]),
		}, "\n")
		_, _ = mac.Write([]byte(source))
		signature := hex.EncodeToString(mac.Sum(nil))
		spec.Headers[defaultString(lookupString(authConfig, "key_header"), "X-PassDock-Key")] = keyID
		spec.Headers[defaultString(lookupString(authConfig, "timestamp_header"), "X-PassDock-Timestamp")] = timestamp
		spec.Headers[defaultString(lookupString(authConfig, "nonce_header"), "X-PassDock-Nonce")] = nonce
		spec.Headers[defaultString(lookupString(authConfig, "sign_header"), "X-PassDock-Sign")] = signature
	case "query_signature":
		bodyHash := sha256.Sum256(spec.BodyBytes)
		timestamp := strconv.FormatInt(time.Now().Unix(), 10)
		nonce, err := generateCode(16)
		if err != nil {
			return err
		}
		secret := lookupString(authConfig, "secret")
		keyID := lookupString(authConfig, "key_id")
		mac := hmac.New(sha256.New, []byte(secret))
		source := strings.Join([]string{
			spec.Method,
			spec.Path,
			timestamp,
			nonce,
			hex.EncodeToString(bodyHash[:]),
		}, "\n")
		_, _ = mac.Write([]byte(source))
		spec.Query.Set(defaultString(lookupString(authConfig, "key_param"), "key"), keyID)
		spec.Query.Set(defaultString(lookupString(authConfig, "timestamp_param"), "ts"), timestamp)
		spec.Query.Set(defaultString(lookupString(authConfig, "nonce_param"), "nonce"), nonce)
		spec.Query.Set(defaultString(lookupString(authConfig, "sign_param"), "sign"), hex.EncodeToString(mac.Sum(nil)))
	}

	return nil
}

func (s *Service) executeHTTPProviderAction(
	ctx context.Context,
	provider *model.IntegrationProvider,
	spec *actionRequestSpec,
) (any, error) {
	client := &http.Client{Timeout: time.Duration(maxInt(provider.TimeoutMS, 3000)) * time.Millisecond}
	attempts := maxInt(provider.RetryTimes, 0) + 1
	retryableMethod := canRetryHTTPProviderMethod(spec.Method)

	var lastResponse any
	var lastStatusCode int
	var lastErr error

	for attempt := 1; attempt <= attempts; attempt++ {
		responseBody, statusCode, err := executeSingleHTTPProviderRequest(ctx, client, spec)
		if err == nil {
			return responseBody, nil
		}

		lastResponse = responseBody
		lastStatusCode = statusCode
		lastErr = err

		if !retryableMethod || attempt >= attempts || !shouldRetryHTTPProviderAttempt(lastStatusCode, lastErr) {
			break
		}
	}

	return lastResponse, lastErr
}

func executeSingleHTTPProviderRequest(
	ctx context.Context,
	client *http.Client,
	spec *actionRequestSpec,
) (any, int, error) {
	var body io.Reader
	if len(spec.BodyBytes) > 0 {
		body = bytes.NewReader(spec.BodyBytes)
	}

	request, err := http.NewRequestWithContext(ctx, spec.Method, spec.URL, body)
	if err != nil {
		return nil, 0, err
	}
	for key, value := range spec.Headers {
		request.Header.Set(key, value)
	}

	response, err := client.Do(request)
	if err != nil {
		return nil, 0, err
	}
	defer response.Body.Close()

	payload, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, response.StatusCode, err
	}

	var decoded any
	if len(bytes.TrimSpace(payload)) == 0 {
		decoded = map[string]any{}
	} else if err := json.Unmarshal(payload, &decoded); err != nil {
		decoded = map[string]any{
			"status_code": response.StatusCode,
			"body":        string(payload),
		}
	}

	if response.StatusCode >= http.StatusBadRequest {
		return map[string]any{
			"status_code": response.StatusCode,
			"body":        decoded,
		}, response.StatusCode, fmt.Errorf("upstream request failed with status %d", response.StatusCode)
	}

	return decoded, response.StatusCode, nil
}

func canRetryHTTPProviderMethod(method string) bool {
	switch strings.ToUpper(strings.TrimSpace(method)) {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return true
	default:
		return false
	}
}

func shouldRetryHTTPProviderAttempt(statusCode int, err error) bool {
	if statusCode == http.StatusRequestTimeout ||
		statusCode == http.StatusTooEarly ||
		statusCode == http.StatusTooManyRequests ||
		statusCode == http.StatusBadGateway ||
		statusCode == http.StatusServiceUnavailable ||
		statusCode == http.StatusGatewayTimeout ||
		statusCode >= http.StatusInternalServerError {
		return true
	}
	if err == nil {
		return false
	}
	if errors.Is(err, context.Canceled) {
		return false
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}

	var netErr net.Error
	return errors.As(err, &netErr)
}

func (s *Service) executeInternalProviderAction(
	ctx context.Context,
	_ *model.IntegrationProvider,
	action *model.IntegrationAction,
	spec *actionRequestSpec,
	templateData map[string]any,
) (any, error) {
	switch action.ActionKey {
	case "issue_recharge_code":
		return s.executeInternalIssueAction(spec, templateData, "redemption")
	case "issue_subscription_code":
		return s.executeInternalIssueAction(spec, templateData, "subscription_code")
	case "query_issue_result":
		return s.executeInternalQueryIssue(ctx, spec, templateData)
	case "manual_review_delivery":
		return map[string]any{
			"queued":  true,
			"message": "Manual review delivery task queued.",
			"data": map[string]any{
				"order_no": lookupPayloadValue(spec, templateData, "order_no"),
			},
		}, nil
	default:
		return map[string]any{
			"success": true,
			"message": fmt.Sprintf("Internal action %s executed.", action.ActionKey),
		}, nil
	}
}

func (s *Service) executeInternalIssueAction(
	spec *actionRequestSpec,
	templateData map[string]any,
	codeType string,
) (map[string]any, error) {
	count := maxInt(lookupPayloadInt(spec, templateData, "count"), 1)
	if count > 20 {
		count = 20
	}

	codes := make([]string, 0, count)
	for index := 0; index < count; index++ {
		code, err := generateCode(32)
		if err != nil {
			return nil, err
		}
		codes = append(codes, code)
	}

	orderNo := stringifyTemplateValue(lookupPayloadValue(spec, templateData, "order_no"))
	return map[string]any{
		"success": true,
		"message": "Codes issued successfully.",
		"data": map[string]any{
			"order_no":  orderNo,
			"code_type": codeType,
			"codes":     codes,
		},
	}, nil
}

func (s *Service) executeInternalQueryIssue(
	ctx context.Context,
	spec *actionRequestSpec,
	templateData map[string]any,
) (map[string]any, error) {
	orderNo := stringifyTemplateValue(lookupPayloadValue(spec, templateData, "order_no"))
	if orderNo == "" {
		return map[string]any{
			"success": false,
			"message": "order_no is required",
		}, nil
	}

	var issue model.CodeIssueRecord
	if err := s.db.WithContext(ctx).Where("order_no = ?", orderNo).First(&issue).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return map[string]any{
				"success": false,
				"message": "Issue record not found.",
			}, nil
		}
		return nil, err
	}

	plain, err := s.decryptString(issue.IssuedCodeEncrypted)
	if err != nil {
		return nil, err
	}

	var codes []string
	if err := json.Unmarshal([]byte(plain), &codes); err != nil {
		return nil, err
	}

	return map[string]any{
		"success": true,
		"message": "Issue record loaded successfully.",
		"data": map[string]any{
			"order_no":  orderNo,
			"code_type": issue.CodeType,
			"codes":     codes,
		},
	}, nil
}

func (s *Service) resolveProviderAction(
	ctx context.Context,
	providerRouteID string,
	actionRouteID string,
) (*model.IntegrationProvider, *model.IntegrationAction, error) {
	provider, err := s.resolveProviderByRoute(ctx, providerRouteID)
	if err != nil {
		return nil, nil, err
	}
	if err := s.validateProviderRuntimeTarget(provider); err != nil {
		return nil, nil, err
	}

	var action model.IntegrationAction
	if id, ok := parseUintRoute(actionRouteID); ok {
		if err := s.db.WithContext(ctx).
			Where("provider_id = ?", provider.ID).
			First(&action, id).Error; err == nil {
			return provider, &action, nil
		}
	}

	if err := s.db.WithContext(ctx).
		Where("provider_id = ? AND action_key = ?", provider.ID, actionRouteID).
		First(&action).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil, ErrNotFound
		}
		return nil, nil, err
	}

	return provider, &action, nil
}

func (s *actionRequestSpec) previewMap() map[string]any {
	return map[string]any{
		"method":  s.Method,
		"path":    s.Path,
		"url":     s.URL,
		"headers": s.Headers,
		"query":   s.Query,
		"body":    s.Body,
	}
}

func renderTemplateStringMap(values map[string]any, templateData map[string]any) map[string]string {
	result := make(map[string]string, len(values))
	for key, value := range values {
		result[key] = stringifyTemplateValue(renderTemplateValue(value, templateData))
	}
	return result
}

func renderTemplateQuery(values map[string]any, templateData map[string]any) url.Values {
	result := url.Values{}
	for key, value := range values {
		rendered := renderTemplateValue(value, templateData)
		switch typed := rendered.(type) {
		case []string:
			for _, item := range typed {
				result.Add(key, item)
			}
		case []any:
			for _, item := range typed {
				result.Add(key, stringifyTemplateValue(item))
			}
		default:
			text := stringifyTemplateValue(typed)
			if text != "" {
				result.Set(key, text)
			}
		}
	}
	return result
}

func renderTemplateValue(value any, templateData map[string]any) any {
	switch typed := value.(type) {
	case map[string]any:
		result := make(map[string]any, len(typed))
		for key, item := range typed {
			result[key] = renderTemplateValue(item, templateData)
		}
		return result
	case []any:
		result := make([]any, 0, len(typed))
		for _, item := range typed {
			result = append(result, renderTemplateValue(item, templateData))
		}
		return result
	case string:
		return renderTemplateString(typed, templateData)
	default:
		return value
	}
}

func renderTemplateString(value string, templateData map[string]any) any {
	trimmed := strings.TrimSpace(value)
	matches := templatePattern.FindStringSubmatch(trimmed)
	if len(matches) == 2 && matches[0] == trimmed {
		if resolved, ok := lookupPath(templateData, matches[1]); ok {
			return resolved
		}
		return ""
	}

	return templatePattern.ReplaceAllStringFunc(value, func(match string) string {
		parts := templatePattern.FindStringSubmatch(match)
		if len(parts) != 2 {
			return match
		}
		resolved, ok := lookupPath(templateData, parts[1])
		if !ok {
			return ""
		}
		return stringifyTemplateValue(resolved)
	})
}

func renderPathTemplate(value string, templateData map[string]any) string {
	result := stringifyTemplateValue(renderTemplateString(value, templateData))
	for key, item := range templateData {
		placeholder := "{" + key + "}"
		if strings.Contains(result, placeholder) {
			result = strings.ReplaceAll(result, placeholder, url.PathEscape(stringifyTemplateValue(item)))
		}
	}
	return result
}

func extractSuccess(payload any, successPath string) bool {
	value, ok := lookupPath(payload, defaultString(successPath, "success"))
	if !ok {
		return true
	}
	return boolValue(value)
}

func extractMessage(payload any, messagePath string) string {
	if messagePath != "" {
		if value, ok := lookupPath(payload, messagePath); ok {
			return stringifyTemplateValue(value)
		}
	}
	if value, ok := lookupPath(payload, "message"); ok {
		return stringifyTemplateValue(value)
	}
	if value, ok := lookupPath(payload, "msg"); ok {
		return stringifyTemplateValue(value)
	}
	return ""
}

func extractStringList(payload any, listPath string) []string {
	if strings.TrimSpace(listPath) == "" {
		return nil
	}
	value, ok := lookupPath(payload, listPath)
	if !ok {
		return nil
	}

	switch typed := value.(type) {
	case []string:
		return typed
	case []any:
		result := make([]string, 0, len(typed))
		for _, item := range typed {
			text := stringifyTemplateValue(item)
			if text != "" {
				result = append(result, text)
			}
		}
		return result
	default:
		text := stringifyTemplateValue(value)
		if text == "" {
			return nil
		}
		return []string{text}
	}
}

func lookupPath(value any, path string) (any, bool) {
	if strings.TrimSpace(path) == "" {
		return value, true
	}

	current := value
	for _, part := range splitLookupPath(path) {
		switch typed := current.(type) {
		case map[string]any:
			next, ok := typed[part]
			if !ok {
				return nil, false
			}
			current = next
		case []any:
			index, err := strconv.Atoi(part)
			if err != nil || index < 0 || index >= len(typed) {
				return nil, false
			}
			current = typed[index]
		default:
			return nil, false
		}
	}

	return current, true
}

func splitLookupPath(path string) []string {
	normalized := strings.TrimSpace(path)
	if normalized == "" {
		return nil
	}

	normalized = bracketIndexPattern.ReplaceAllString(normalized, ".$1")

	rawParts := strings.Split(normalized, ".")
	parts := make([]string, 0, len(rawParts))
	for _, part := range rawParts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		parts = append(parts, part)
	}

	return parts
}

func copyMap(source map[string]any) map[string]any {
	result := make(map[string]any, len(source))
	for key, value := range source {
		result[key] = value
	}
	return result
}

func stringifyTemplateValue(value any) string {
	switch typed := value.(type) {
	case nil:
		return ""
	case string:
		return typed
	case fmt.Stringer:
		return typed.String()
	case json.Number:
		return typed.String()
	default:
		return fmt.Sprint(value)
	}
}

func lookupString(values map[string]any, keys ...string) string {
	for _, key := range keys {
		if value, ok := values[key]; ok {
			text := strings.TrimSpace(stringifyTemplateValue(value))
			if text != "" {
				return text
			}
		}
	}
	return ""
}

func lookupPayloadValue(spec *actionRequestSpec, templateData map[string]any, key string) any {
	if body, ok := spec.Body.(map[string]any); ok {
		if value, exists := body[key]; exists {
			return value
		}
	}
	if value := spec.Query.Get(key); value != "" {
		return value
	}
	if value, ok := templateData[key]; ok {
		return value
	}
	return ""
}

func lookupPayloadInt(spec *actionRequestSpec, templateData map[string]any, key string) int {
	value := lookupPayloadValue(spec, templateData, key)
	switch typed := value.(type) {
	case int:
		return typed
	case int64:
		return int(typed)
	case float64:
		return int(typed)
	case json.Number:
		number, _ := typed.Int64()
		return int(number)
	default:
		parsed, _ := strconv.Atoi(strings.TrimSpace(stringifyTemplateValue(value)))
		return parsed
	}
}

func boolValue(value any) bool {
	switch typed := value.(type) {
	case bool:
		return typed
	case string:
		switch strings.ToLower(strings.TrimSpace(typed)) {
		case "1", "true", "yes", "ok", "success":
			return true
		default:
			return false
		}
	case float64:
		return typed != 0
	case int:
		return typed != 0
	default:
		return false
	}
}

func maxInt(value int, fallback int) int {
	if value > 0 {
		return value
	}
	return fallback
}
