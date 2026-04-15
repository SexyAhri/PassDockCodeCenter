package service

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
)

func (s *Service) NormalizePaymentCallbackInput(
	request *http.Request,
	body []byte,
	verification *PaymentCallbackVerification,
) (PaymentCallbackInput, error) {
	if verification == nil || verification.Channel == nil {
		return PaymentCallbackInput{}, ErrInvalidInput
	}

	payload, err := decodePaymentCallbackPayload(request, body)
	if err != nil {
		return PaymentCallbackInput{}, err
	}
	if err := validatePaymentCallbackPayloadStatus(payload, verification.Config); err != nil {
		return PaymentCallbackInput{}, err
	}

	input := PaymentCallbackInput{
		OrderNo:         paymentCallbackPayloadString(payload, verification.Config, "order_no"),
		PaymentMethod:   defaultString(paymentCallbackPayloadString(payload, verification.Config, "payment_method"), verification.Channel.ChannelType),
		Amount:          paymentCallbackPayloadString(payload, verification.Config, "amount"),
		Currency:        defaultString(paymentCallbackPayloadString(payload, verification.Config, "currency"), verification.Channel.Currency),
		Note:            paymentCallbackPayloadString(payload, verification.Config, "note"),
		ThirdPartyTxnNo: paymentCallbackPayloadString(payload, verification.Config, "third_party_txn_no"),
		ChainTxHash:     paymentCallbackPayloadString(payload, verification.Config, "chain_tx_hash"),
		PayerAccount:    paymentCallbackPayloadString(payload, verification.Config, "payer_account"),
		AutoFulfill:     paymentCallbackPayloadBool(payload, verification.Config, "auto_fulfill"),
		AutoDeliver:     paymentCallbackPayloadBool(payload, verification.Config, "auto_deliver"),
		RawPayload:      payload,
	}
	if strings.TrimSpace(input.OrderNo) == "" {
		return PaymentCallbackInput{}, ErrInvalidInput
	}

	return input, nil
}

func decodePaymentCallbackPayload(request *http.Request, body []byte) (map[string]any, error) {
	payload := map[string]any{}
	contentType := ""
	if request != nil {
		contentType = strings.ToLower(strings.TrimSpace(request.Header.Get("Content-Type")))
	}
	trimmedBody := strings.TrimSpace(string(body))

	if trimmedBody != "" {
		if looksLikeJSONPayload(trimmedBody, contentType) {
			var decoded any
			if err := json.Unmarshal(body, &decoded); err == nil {
				if object, ok := decoded.(map[string]any); ok {
					payload = mergeStringAnyMap(payload, object)
				}
			}
		}
		if len(payload) == 0 {
			if values, err := url.ParseQuery(trimmedBody); err == nil && len(values) > 0 {
				payload = mergeStringAnyMap(payload, urlValuesToStringAnyMap(values))
			}
		}
	}

	if request != nil && len(request.URL.Query()) > 0 {
		payload = mergeMissingStringAnyMap(payload, urlValuesToStringAnyMap(request.URL.Query()))
	}
	if len(payload) == 0 {
		return nil, ErrInvalidInput
	}

	return payload, nil
}

func looksLikeJSONPayload(body string, contentType string) bool {
	trimmed := strings.TrimSpace(body)
	if trimmed == "" {
		return false
	}
	if strings.Contains(contentType, "json") {
		return true
	}
	return strings.HasPrefix(trimmed, "{")
}

func validatePaymentCallbackPayloadStatus(payload map[string]any, config paymentChannelConfig) error {
	field := strings.TrimSpace(config.CallbackSuccessField)
	if field == "" {
		return nil
	}

	value, ok := lookupPath(payload, field)
	if !ok {
		return ErrInvalidInput
	}
	if len(config.CallbackSuccessValues) == 0 {
		if boolValue(value) {
			return nil
		}
		return ErrInvalidInput
	}
	if paymentCallbackSuccessMatches(value, config.CallbackSuccessValues) {
		return nil
	}

	return ErrInvalidInput
}

func paymentCallbackSuccessMatches(value any, expected []string) bool {
	actual := strings.TrimSpace(strings.ToLower(stringifyTemplateValue(value)))
	if actual == "" {
		return false
	}

	for _, item := range expected {
		if actual == strings.ToLower(strings.TrimSpace(item)) {
			return true
		}
	}

	return false
}

func paymentCallbackPayloadString(payload map[string]any, config paymentChannelConfig, field string) string {
	value, ok := paymentCallbackPayloadValue(payload, config, field)
	if !ok {
		return ""
	}
	return strings.TrimSpace(stringifyTemplateValue(value))
}

func paymentCallbackPayloadBool(payload map[string]any, config paymentChannelConfig, field string) bool {
	value, ok := paymentCallbackPayloadValue(payload, config, field)
	if !ok {
		return false
	}
	return boolValue(value)
}

func paymentCallbackPayloadValue(payload map[string]any, config paymentChannelConfig, field string) (any, bool) {
	if len(payload) == 0 {
		return nil, false
	}

	mappingKey := strings.ToLower(strings.TrimSpace(field))
	if mappedPath := strings.TrimSpace(config.CallbackPayloadMapping[mappingKey]); mappedPath != "" {
		if value, ok := lookupPath(payload, mappedPath); ok {
			return value, true
		}
	}

	return lookupPath(payload, field)
}

func urlValuesToStringAnyMap(values url.Values) map[string]any {
	result := make(map[string]any, len(values))
	for key, items := range values {
		switch len(items) {
		case 0:
			result[key] = ""
		case 1:
			result[key] = items[0]
		default:
			valuesCopy := make([]any, 0, len(items))
			for _, item := range items {
				valuesCopy = append(valuesCopy, item)
			}
			result[key] = valuesCopy
		}
	}
	return result
}

func mergeStringAnyMap(base map[string]any, extra map[string]any) map[string]any {
	if base == nil {
		base = map[string]any{}
	}
	for key, value := range extra {
		base[key] = value
	}
	return base
}

func mergeMissingStringAnyMap(base map[string]any, extra map[string]any) map[string]any {
	if base == nil {
		base = map[string]any{}
	}
	for key, value := range extra {
		if _, exists := base[key]; !exists {
			base[key] = value
		}
	}
	return base
}
