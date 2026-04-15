package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"passdock/server/internal/model"
)

type PaymentCallbackVerification struct {
	Channel *model.PaymentChannel
	Config  paymentChannelConfig
}

func normalizePaymentChannelConfig(config paymentChannelConfig, fallbackDisplayName string) paymentChannelConfig {
	config.QRContent = strings.TrimSpace(config.QRContent)
	config.DisplayName = defaultString(strings.TrimSpace(config.DisplayName), strings.TrimSpace(fallbackDisplayName))
	config.DisplayNameZH = defaultString(strings.TrimSpace(config.DisplayNameZH), config.DisplayName)
	config.DisplayNameEN = defaultString(strings.TrimSpace(config.DisplayNameEN), config.DisplayName)
	config.ModeLabelZH = strings.TrimSpace(config.ModeLabelZH)
	config.ModeLabelEN = strings.TrimSpace(config.ModeLabelEN)
	config.Reference = strings.TrimSpace(config.Reference)
	config.CallbackAuthType = normalizePaymentCallbackAuthType(config.CallbackAuthType)
	config.CallbackSecret = strings.TrimSpace(config.CallbackSecret)
	config.CallbackKey = strings.TrimSpace(config.CallbackKey)
	config.CallbackHeaderName = strings.TrimSpace(config.CallbackHeaderName)
	config.CallbackSignHeader = strings.TrimSpace(config.CallbackSignHeader)
	config.CallbackTimestampHeader = strings.TrimSpace(config.CallbackTimestampHeader)
	config.CallbackNonceHeader = strings.TrimSpace(config.CallbackNonceHeader)
	config.CallbackSignatureParam = strings.TrimSpace(config.CallbackSignatureParam)
	config.CallbackTimestampParam = strings.TrimSpace(config.CallbackTimestampParam)
	config.CallbackNonceParam = strings.TrimSpace(config.CallbackNonceParam)
	config.CallbackSignSource = normalizePaymentCallbackSignSource(config.CallbackSignSource)
	config.CallbackPayloadMapping = normalizePaymentCallbackPayloadMapping(config.CallbackPayloadMapping)
	config.CallbackSuccessField = strings.TrimSpace(config.CallbackSuccessField)
	config.CallbackSuccessValues = normalizePaymentCallbackSuccessValues(config.CallbackSuccessValues)
	config.RefundProviderKey = strings.TrimSpace(config.RefundProviderKey)
	config.RefundActionKey = strings.TrimSpace(config.RefundActionKey)
	config.RefundStatusPath = strings.TrimSpace(config.RefundStatusPath)
	config.RefundReceiptPath = strings.TrimSpace(config.RefundReceiptPath)

	switch config.CallbackAuthType {
	case "static_header":
		config.CallbackHeaderName = defaultString(config.CallbackHeaderName, "X-PassDock-Callback-Token")
	case "hmac_sha256":
		if config.CallbackKey != "" {
			config.CallbackHeaderName = defaultString(config.CallbackHeaderName, "X-PassDock-Key")
		}
		if config.CallbackSignHeader == "" && config.CallbackSignatureParam == "" {
			config.CallbackSignHeader = "X-PassDock-Sign"
		}
		if signSourceUsesTimestamp(config.CallbackSignSource) {
			if config.CallbackTimestampHeader == "" && config.CallbackTimestampParam == "" {
				config.CallbackTimestampHeader = "X-PassDock-Timestamp"
			}
			if config.CallbackTTLSeconds <= 0 {
				config.CallbackTTLSeconds = 300
			}
		}
		if signSourceUsesNonce(config.CallbackSignSource) && config.CallbackNonceHeader == "" && config.CallbackNonceParam == "" {
			config.CallbackNonceHeader = "X-PassDock-Nonce"
		}
	default:
		config.CallbackAuthType = "none"
		config.CallbackSignSource = ""
	}

	return config
}

func (s *Service) storefrontPaymentChannelConfig(channel *model.PaymentChannel) paymentChannelConfig {
	if channel == nil {
		return paymentChannelConfig{}
	}

	config := normalizePaymentChannelConfig(parseJSON[paymentChannelConfig](channel.ConfigJSON), channel.ChannelName)
	config.QRContent = s.resolveStorefrontPaymentQRContent(channel.ChannelType, config.QRContent)
	return config
}

func (s *Service) resolveStorefrontPaymentQRContent(channelType, qrContent string) string {
	trimmed := strings.TrimSpace(qrContent)
	if channelType != "okx_usdt" {
		return trimmed
	}

	if trimmed != "" && !looksLikeBootstrapOKXQRContent(trimmed) {
		return trimmed
	}

	if receiveAddress := strings.TrimSpace(s.cfg.OKXAdapterReceiveAddress); receiveAddress != "" {
		return receiveAddress
	}

	return trimmed
}

func looksLikeBootstrapOKXQRContent(value string) bool {
	normalized := strings.ToLower(strings.TrimSpace(value))
	if normalized == "" {
		return true
	}

	return normalized == "okx://wallet/passdock/usdt" || strings.Contains(normalized, "passdock/usdt")
}

func buildPaymentChannelConfig(input PaymentChannelUpsertInput, existing *paymentChannelConfig) (paymentChannelConfig, error) {
	config := paymentChannelConfig{
		QRContent:               strings.TrimSpace(input.QRValue),
		DisplayName:             defaultString(strings.TrimSpace(input.DisplayNameEN), defaultString(strings.TrimSpace(input.DisplayNameZH), strings.TrimSpace(input.ChannelName))),
		DisplayNameZH:           strings.TrimSpace(input.DisplayNameZH),
		DisplayNameEN:           strings.TrimSpace(input.DisplayNameEN),
		ModeLabelZH:             strings.TrimSpace(input.ModeLabelZH),
		ModeLabelEN:             strings.TrimSpace(input.ModeLabelEN),
		Reference:               strings.TrimSpace(input.Reference),
		AutoFulfill:             input.AutoFulfill,
		AutoDeliver:             input.AutoDeliver,
		CallbackAuthType:        strings.TrimSpace(input.CallbackAuthType),
		CallbackSecret:          strings.TrimSpace(input.CallbackSecret),
		CallbackKey:             strings.TrimSpace(input.CallbackKey),
		CallbackHeaderName:      strings.TrimSpace(input.CallbackHeaderName),
		CallbackSignHeader:      strings.TrimSpace(input.CallbackSignHeader),
		CallbackTimestampHeader: strings.TrimSpace(input.CallbackTimestampHeader),
		CallbackNonceHeader:     strings.TrimSpace(input.CallbackNonceHeader),
		CallbackSignatureParam:  strings.TrimSpace(input.CallbackSignatureParam),
		CallbackTimestampParam:  strings.TrimSpace(input.CallbackTimestampParam),
		CallbackNonceParam:      strings.TrimSpace(input.CallbackNonceParam),
		CallbackTTLSeconds:      input.CallbackTTLSeconds,
		CallbackSignSource:      strings.TrimSpace(input.CallbackSignSource),
		CallbackPayloadMapping:  copyStringMap(input.CallbackPayloadMapping),
		CallbackSuccessField:    strings.TrimSpace(input.CallbackSuccessField),
		CallbackSuccessValues:   copyStringSlice(input.CallbackSuccessValues),
		RefundProviderKey:       strings.TrimSpace(input.RefundProviderKey),
		RefundActionKey:         strings.TrimSpace(input.RefundActionKey),
		RefundStatusPath:        strings.TrimSpace(input.RefundStatusPath),
		RefundReceiptPath:       strings.TrimSpace(input.RefundReceiptPath),
	}

	if existing != nil && config.CallbackSecret == "" {
		config.CallbackSecret = existing.CallbackSecret
	}
	if existing != nil && len(config.CallbackPayloadMapping) == 0 {
		config.CallbackPayloadMapping = copyStringMap(existing.CallbackPayloadMapping)
	}
	if existing != nil && config.CallbackSuccessField == "" {
		config.CallbackSuccessField = strings.TrimSpace(existing.CallbackSuccessField)
	}
	if existing != nil && len(config.CallbackSuccessValues) == 0 {
		config.CallbackSuccessValues = copyStringSlice(existing.CallbackSuccessValues)
	}

	config = normalizePaymentChannelConfig(config, input.ChannelName)
	if err := validatePaymentChannelConfig(config); err != nil {
		return paymentChannelConfig{}, err
	}

	return config, nil
}

func validatePaymentChannelConfig(config paymentChannelConfig) error {
	switch config.CallbackAuthType {
	case "none":
		return nil
	case "static_header":
		if strings.TrimSpace(config.CallbackSecret) == "" {
			return fmt.Errorf("%w: callback secret is required", ErrInvalidInput)
		}
		if strings.TrimSpace(config.CallbackHeaderName) == "" {
			return fmt.Errorf("%w: callback header name is required", ErrInvalidInput)
		}
		return nil
	case "hmac_sha256":
		if strings.TrimSpace(config.CallbackSecret) == "" {
			return fmt.Errorf("%w: callback secret is required", ErrInvalidInput)
		}
		if strings.TrimSpace(config.CallbackSignHeader) == "" && strings.TrimSpace(config.CallbackSignatureParam) == "" {
			return fmt.Errorf("%w: callback signature source is required", ErrInvalidInput)
		}
		if config.CallbackTTLSeconds < 0 {
			return fmt.Errorf("%w: callback ttl must be greater than or equal to zero", ErrInvalidInput)
		}
		return nil
	default:
		return fmt.Errorf("%w: unsupported callback auth type", ErrInvalidInput)
	}
}

func normalizePaymentCallbackAuthType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "static_header":
		return "static_header"
	case "hmac_sha256":
		return "hmac_sha256"
	default:
		return "none"
	}
}

func normalizePaymentCallbackSignSource(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "body_sha256":
		return "body_sha256"
	case "timestamp_body":
		return "timestamp_body"
	case "method_path_timestamp_nonce_body_sha256":
		return "method_path_timestamp_nonce_body_sha256"
	default:
		return "body"
	}
}

func normalizePaymentCallbackPayloadMapping(values map[string]string) map[string]string {
	if len(values) == 0 {
		return nil
	}

	result := make(map[string]string, len(values))
	for key, value := range values {
		normalizedKey := strings.TrimSpace(strings.ToLower(key))
		normalizedValue := strings.TrimSpace(value)
		if normalizedKey == "" || normalizedValue == "" {
			continue
		}
		result[normalizedKey] = normalizedValue
	}
	if len(result) == 0 {
		return nil
	}

	return result
}

func normalizePaymentCallbackSuccessValues(values []string) []string {
	if len(values) == 0 {
		return nil
	}

	result := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	if len(result) == 0 {
		return nil
	}

	return result
}

func copyStringMap(source map[string]string) map[string]string {
	if len(source) == 0 {
		return nil
	}

	result := make(map[string]string, len(source))
	for key, value := range source {
		result[key] = value
	}

	return result
}

func copyStringSlice(source []string) []string {
	if len(source) == 0 {
		return nil
	}

	result := make([]string, len(source))
	copy(result, source)
	return result
}

func signSourceUsesTimestamp(value string) bool {
	switch strings.TrimSpace(value) {
	case "timestamp_body", "method_path_timestamp_nonce_body_sha256":
		return true
	default:
		return false
	}
}

func signSourceUsesNonce(value string) bool {
	return strings.TrimSpace(value) == "method_path_timestamp_nonce_body_sha256"
}

func (s *Service) VerifyPaymentCallbackRequest(
	ctx context.Context,
	channelKey string,
	request *http.Request,
	body []byte,
) (*PaymentCallbackVerification, error) {
	if request == nil {
		return nil, ErrInvalidInput
	}

	channel, err := s.resolvePaymentChannelByRoute(ctx, channelKey)
	if err != nil {
		return nil, err
	}
	if !channel.Enabled {
		return nil, ErrInvalidState
	}

	config := normalizePaymentChannelConfig(parseJSON[paymentChannelConfig](channel.ConfigJSON), channel.ChannelName)
	if err := s.verifyPaymentCallbackAuthRequest(request, body, config); err != nil {
		return nil, err
	}

	return &PaymentCallbackVerification{
		Channel: channel,
		Config:  config,
	}, nil
}

func (s *Service) verifyPaymentCallbackAuthRequest(
	request *http.Request,
	body []byte,
	config paymentChannelConfig,
) error {
	switch config.CallbackAuthType {
	case "none":
		return nil
	case "static_header":
		return verifyStaticHeaderPaymentCallback(request, config)
	case "hmac_sha256":
		return verifyHMACPaymentCallback(request, body, config)
	default:
		return ErrInvalidState
	}
}

func verifyStaticHeaderPaymentCallback(request *http.Request, config paymentChannelConfig) error {
	expected := strings.TrimSpace(config.CallbackSecret)
	headerName := strings.TrimSpace(config.CallbackHeaderName)
	actual := strings.TrimSpace(request.Header.Get(headerName))
	if expected == "" || actual == "" {
		return ErrUnauthorized
	}
	if subtle.ConstantTimeCompare([]byte(actual), []byte(expected)) != 1 {
		return ErrUnauthorized
	}
	return nil
}

func verifyHMACPaymentCallback(request *http.Request, body []byte, config paymentChannelConfig) error {
	secret := strings.TrimSpace(config.CallbackSecret)
	if secret == "" {
		return ErrInvalidState
	}

	signature := lookupPaymentCallbackRequestValue(request, config.CallbackSignHeader, config.CallbackSignatureParam)
	signature = normalizePaymentCallbackSignature(signature)
	if signature == "" {
		return ErrUnauthorized
	}

	if config.CallbackKey != "" {
		expectedKey := strings.TrimSpace(config.CallbackKey)
		actualKey := lookupPaymentCallbackRequestValue(request, config.CallbackHeaderName, "")
		if actualKey == "" || subtle.ConstantTimeCompare([]byte(strings.TrimSpace(actualKey)), []byte(expectedKey)) != 1 {
			return ErrUnauthorized
		}
	}

	timestamp := lookupPaymentCallbackRequestValue(request, config.CallbackTimestampHeader, config.CallbackTimestampParam)
	nonce := lookupPaymentCallbackRequestValue(request, config.CallbackNonceHeader, config.CallbackNonceParam)

	if signSourceUsesTimestamp(config.CallbackSignSource) || config.CallbackTTLSeconds > 0 || timestamp != "" {
		parsedTimestamp, err := parsePaymentCallbackTimestamp(timestamp)
		if err != nil {
			return ErrUnauthorized
		}

		ttlSeconds := config.CallbackTTLSeconds
		if ttlSeconds <= 0 {
			ttlSeconds = 300
		}

		now := time.Now().Unix()
		ts := parsedTimestamp.Unix()
		if now-ts > int64(ttlSeconds) || ts-now > int64(ttlSeconds) {
			return ErrUnauthorized
		}
	}

	source, err := buildPaymentCallbackSignSource(request, body, config.CallbackSignSource, timestamp, nonce)
	if err != nil {
		return err
	}

	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(source))
	expectedSignature := hex.EncodeToString(mac.Sum(nil))
	if subtle.ConstantTimeCompare([]byte(signature), []byte(expectedSignature)) != 1 {
		return ErrUnauthorized
	}

	return nil
}

func lookupPaymentCallbackRequestValue(request *http.Request, headerName string, queryParam string) string {
	if request == nil {
		return ""
	}

	if strings.TrimSpace(headerName) != "" {
		if value := strings.TrimSpace(request.Header.Get(headerName)); value != "" {
			return value
		}
	}

	if strings.TrimSpace(queryParam) != "" {
		return strings.TrimSpace(request.URL.Query().Get(queryParam))
	}

	return ""
}

func normalizePaymentCallbackSignature(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	normalized = strings.TrimPrefix(normalized, "sha256=")
	normalized = strings.TrimPrefix(normalized, "hmac-sha256=")
	return normalized
}

func parsePaymentCallbackTimestamp(value string) (time.Time, error) {
	raw := strings.TrimSpace(value)
	if raw == "" {
		return time.Time{}, fmt.Errorf("%w: callback timestamp is required", ErrUnauthorized)
	}

	parsed, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return time.Time{}, err
	}

	if parsed > 1_000_000_000_000 {
		return time.UnixMilli(parsed), nil
	}

	return time.Unix(parsed, 0), nil
}

func buildPaymentCallbackSignSource(
	request *http.Request,
	body []byte,
	signSource string,
	timestamp string,
	nonce string,
) (string, error) {
	switch strings.TrimSpace(signSource) {
	case "body_sha256":
		bodyHash := sha256.Sum256(body)
		return hex.EncodeToString(bodyHash[:]), nil
	case "timestamp_body":
		if strings.TrimSpace(timestamp) == "" {
			return "", ErrUnauthorized
		}
		return timestamp + "\n" + string(body), nil
	case "method_path_timestamp_nonce_body_sha256":
		if strings.TrimSpace(timestamp) == "" || strings.TrimSpace(nonce) == "" {
			return "", ErrUnauthorized
		}
		bodyHash := sha256.Sum256(body)
		return strings.Join([]string{
			strings.ToUpper(defaultString(request.Method, http.MethodPost)),
			request.URL.Path,
			timestamp,
			nonce,
			hex.EncodeToString(bodyHash[:]),
		}, "\n"), nil
	default:
		return string(body), nil
	}
}
