package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"

	"gorm.io/gorm"

	"passdock/server/internal/model"
)

type PaymentCallbackInput struct {
	OrderNo         string
	PaymentMethod   string
	Amount          string
	Currency        string
	Note            string
	ThirdPartyTxnNo string
	ChainTxHash     string
	PayerAccount    string
	AutoFulfill     bool
	AutoDeliver     bool
	RawPayload      map[string]any
}

func buildPaymentCallbackKey(channelKey string, input PaymentCallbackInput) string {
	externalRef := firstNonEmpty(strings.TrimSpace(input.ThirdPartyTxnNo), strings.TrimSpace(input.ChainTxHash))
	if externalRef != "" {
		return sha256HexStrings("payment_callback", channelKey, externalRef)
	}

	return sha256HexStrings(
		"payment_callback",
		channelKey,
		strings.TrimSpace(input.OrderNo),
		strings.TrimSpace(input.PaymentMethod),
		strings.TrimSpace(input.Amount),
		strings.TrimSpace(input.Currency),
		strings.TrimSpace(input.PayerAccount),
		stablePayloadHash(map[string]any{
			"order_no":           input.OrderNo,
			"payment_method":     input.PaymentMethod,
			"amount":             input.Amount,
			"currency":           input.Currency,
			"third_party_txn_no": input.ThirdPartyTxnNo,
			"chain_tx_hash":      input.ChainTxHash,
			"payer_account":      input.PayerAccount,
		}),
	)
}

func buildPaymentWatcherKey(channelKey string, input OnchainConfirmationInput) string {
	externalRef := firstNonEmpty(strings.TrimSpace(input.ChainTxHash), strings.TrimSpace(input.ThirdPartyTxnNo))
	if externalRef != "" {
		return sha256HexStrings("payment_watcher", channelKey, externalRef)
	}

	return sha256HexStrings(
		"payment_watcher",
		channelKey,
		strings.TrimSpace(input.OrderNo),
		strings.TrimSpace(input.Amount),
		strings.TrimSpace(input.Currency),
	)
}

func (s *Service) HandlePaymentCallback(
	ctx context.Context,
	channelKey string,
	input PaymentCallbackInput,
	meta AuditMeta,
) (map[string]any, error) {
	if strings.TrimSpace(input.OrderNo) == "" {
		return nil, ErrInvalidInput
	}

	callbackKey := buildPaymentCallbackKey(channelKey, input)
	order, orderErr := s.resolveOrderByNo(ctx, input.OrderNo)
	if orderErr != nil && orderErr != ErrNotFound {
		return nil, orderErr
	}
	existingLog, err := s.resolvePaymentCallbackLogByCallbackKey(ctx, callbackKey)
	if err != nil && err != ErrNotFound {
		return nil, err
	}
	if existingLog != nil {
		if existingLog.OrderNo != "" && existingLog.OrderNo != input.OrderNo {
			return nil, ErrInvalidState
		}

		return map[string]any{
			"channel_key":  channelKey,
			"order_no":     defaultString(existingLog.OrderNo, input.OrderNo),
			"auto_fulfill": false,
			"auto_deliver": false,
			"accepted":     true,
			"duplicate":    true,
			"status":       existingLog.Status,
			"message":      "Payment callback already consumed.",
		}, nil
	}
	if order != nil {
		existingExternalPayment, resolveErr := s.resolvePaymentRecordByExternalRefsTx(
			ctx,
			s.db,
			input.ThirdPartyTxnNo,
			input.ChainTxHash,
		)
		if resolveErr != nil && resolveErr != ErrNotFound {
			return nil, resolveErr
		}
		if existingExternalPayment != nil {
			if existingExternalPayment.OrderID != order.ID {
				return nil, ErrInvalidState
			}
			if order.PaymentStatus == "paid" && order.Status != "paid_pending_review" {
				return map[string]any{
					"channel_key":  channelKey,
					"order_no":     order.OrderNo,
					"auto_fulfill": false,
					"auto_deliver": false,
					"accepted":     true,
					"duplicate":    true,
					"status":       "success",
					"message":      "Payment callback already consumed.",
				}, nil
			}
		}
	}

	rawPayload := copyMap(input.RawPayload)
	rawPayload["channel_key"] = channelKey
	rawPayload["third_party_txn_no"] = input.ThirdPartyTxnNo
	rawPayload["chain_tx_hash"] = input.ChainTxHash
	rawPayload["payer_account"] = input.PayerAccount

	if err := s.ConfirmAdminOrderPayment(ctx, input.OrderNo, ConfirmPaymentInput{
		PaymentMethod:   input.PaymentMethod,
		Amount:          input.Amount,
		Currency:        input.Currency,
		Note:            defaultString(input.Note, "payment callback accepted"),
		ThirdPartyTxnNo: input.ThirdPartyTxnNo,
		ChainTxHash:     input.ChainTxHash,
		PayerAccount:    input.PayerAccount,
		RawPayload:      rawPayload,
		SourceType:      "payment_callback",
		SuccessMessage:  "Payment callback accepted and order moved forward.",
		CallbackKey:     callbackKey,
	}, meta); err != nil {
		if isUniqueConstraintError(err) {
			if duplicateLog, resolveErr := s.resolvePaymentCallbackLogByCallbackKey(ctx, callbackKey); resolveErr == nil && duplicateLog != nil {
				return map[string]any{
					"channel_key":  channelKey,
					"order_no":     defaultString(duplicateLog.OrderNo, input.OrderNo),
					"auto_fulfill": false,
					"auto_deliver": false,
					"accepted":     true,
					"duplicate":    true,
					"status":       duplicateLog.Status,
					"message":      "Payment callback already consumed.",
				}, nil
			}
		}
		return nil, err
	}

	automation, err := s.ApplyPaymentPostConfirmAutomation(ctx, input.OrderNo, input.AutoFulfill, input.AutoDeliver, meta)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"channel_key":         channelKey,
		"order_no":            input.OrderNo,
		"auto_fulfill":        automation.EffectiveAutoFulfill,
		"auto_deliver":        automation.EffectiveAutoDeliver,
		"config_auto_fulfill": automation.ConfigAutoFulfill,
		"config_auto_deliver": automation.ConfigAutoDeliver,
		"accepted":            true,
		"duplicate":           false,
	}, nil
}

func (s *Service) resolvePaymentCallbackLogByCallbackKey(ctx context.Context, callbackKey string) (*model.PaymentCallbackLog, error) {
	return s.resolvePaymentCallbackLogByCallbackKeyTx(ctx, s.db, callbackKey)
}

func (s *Service) resolvePaymentCallbackLogByCallbackKeyTx(
	ctx context.Context,
	tx *gorm.DB,
	callbackKey string,
) (*model.PaymentCallbackLog, error) {
	if strings.TrimSpace(callbackKey) == "" {
		return nil, ErrNotFound
	}

	var record model.PaymentCallbackLog
	if err := tx.WithContext(ctx).Where("callback_key = ?", strings.TrimSpace(callbackKey)).First(&record).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &record, nil
}

func (s *Service) resolvePaymentWatcherRecordByWatcherKey(ctx context.Context, watcherKey string) (*model.PaymentWatcherRecord, error) {
	return s.resolvePaymentWatcherRecordByWatcherKeyTx(ctx, s.db, watcherKey)
}

func (s *Service) resolvePaymentWatcherRecordByWatcherKeyTx(
	ctx context.Context,
	tx *gorm.DB,
	watcherKey string,
) (*model.PaymentWatcherRecord, error) {
	if strings.TrimSpace(watcherKey) == "" {
		return nil, ErrNotFound
	}

	var record model.PaymentWatcherRecord
	if err := tx.WithContext(ctx).Where("watcher_key = ?", strings.TrimSpace(watcherKey)).First(&record).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &record, nil
}

func (s *Service) resolvePaymentRecordByExternalRefsTx(
	ctx context.Context,
	tx *gorm.DB,
	thirdPartyTxnNo string,
	chainTxHash string,
) (*model.PaymentRecord, error) {
	trimmedThirdPartyTxnNo := strings.TrimSpace(thirdPartyTxnNo)
	trimmedChainTxHash := strings.TrimSpace(chainTxHash)
	if trimmedThirdPartyTxnNo == "" && trimmedChainTxHash == "" {
		return nil, ErrNotFound
	}

	var record model.PaymentRecord
	query := tx.WithContext(ctx).Model(&model.PaymentRecord{})

	switch {
	case trimmedThirdPartyTxnNo != "" && trimmedChainTxHash != "":
		query = query.Where("third_party_txn_no = ? OR chain_tx_hash = ?", trimmedThirdPartyTxnNo, trimmedChainTxHash)
	case trimmedThirdPartyTxnNo != "":
		query = query.Where("third_party_txn_no = ?", trimmedThirdPartyTxnNo)
	default:
		query = query.Where("chain_tx_hash = ?", trimmedChainTxHash)
	}

	if err := query.Order("id DESC").First(&record).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &record, nil
}

func redactSensitivePayload(value any) any {
	switch typed := value.(type) {
	case map[string]any:
		result := make(map[string]any, len(typed))
		for key, entry := range typed {
			result[key] = redactSensitivePayloadValue(key, entry)
		}
		return result
	case []any:
		result := make([]any, 0, len(typed))
		for _, entry := range typed {
			result = append(result, redactSensitivePayload(entry))
		}
		return result
	default:
		return value
	}
}

func redactSensitivePayloadValue(key string, value any) any {
	switch typed := value.(type) {
	case map[string]any:
		return redactSensitivePayload(typed)
	case []any:
		result := make([]any, 0, len(typed))
		for _, entry := range typed {
			result = append(result, redactSensitivePayload(entry))
		}
		return result
	case string:
		return redactSensitiveString(key, typed)
	default:
		return value
	}
}

func redactSensitiveString(key string, value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}

	lowerKey := strings.ToLower(strings.TrimSpace(key))

	switch {
	case containsAny(lowerKey, "token", "secret", "password", "authorization", "cookie", "signature", "sign"):
		return "[REDACTED]"
	case containsAny(lowerKey, "payer_account", "payer", "third_party_txn_no", "merchant_order_no", "chain_tx_hash", "object_url", "object_key"):
		return maskValue(trimmed, 6)
	default:
		return trimmed
	}
}

func isUniqueConstraintError(err error) bool {
	if err == nil {
		return false
	}

	text := strings.ToLower(err.Error())
	return strings.Contains(text, "unique constraint") || strings.Contains(text, "duplicate key")
}

func sha256HexStrings(parts ...string) string {
	sum := sha256.Sum256([]byte(strings.Join(parts, "\n")))
	return hex.EncodeToString(sum[:])
}

func stablePayloadHash(payload map[string]any) string {
	if len(payload) == 0 {
		return ""
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return ""
	}

	sum := sha256.Sum256(body)
	return hex.EncodeToString(sum[:])
}

func containsAny(value string, fragments ...string) bool {
	for _, fragment := range fragments {
		if strings.Contains(value, fragment) {
			return true
		}
	}

	return false
}

func stringPointerOrNil(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}

	return &trimmed
}
