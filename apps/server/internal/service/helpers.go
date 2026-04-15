package service

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"
	"unicode"

	"gorm.io/datatypes"
	"gorm.io/gorm"

	"passdock/server/internal/model"
)

var (
	ErrNotFound              = errors.New("resource not found")
	ErrInvalidInput          = errors.New("invalid input")
	ErrInvalidState          = errors.New("invalid state")
	ErrInsufficientInventory = errors.New("insufficient inventory")
	ErrUnauthorized          = errors.New("unauthorized")
)

type paymentChannelConfig struct {
	QRContent               string            `json:"qr_content"`
	DisplayName             string            `json:"display_name"`
	DisplayNameZH           string            `json:"display_name_zh,omitempty"`
	DisplayNameEN           string            `json:"display_name_en,omitempty"`
	ModeLabelZH             string            `json:"mode_label_zh,omitempty"`
	ModeLabelEN             string            `json:"mode_label_en,omitempty"`
	Reference               string            `json:"reference"`
	AutoFulfill             bool              `json:"auto_fulfill,omitempty"`
	AutoDeliver             bool              `json:"auto_deliver,omitempty"`
	CallbackAuthType        string            `json:"callback_auth_type"`
	CallbackSecret          string            `json:"callback_secret,omitempty"`
	CallbackKey             string            `json:"callback_key,omitempty"`
	CallbackHeaderName      string            `json:"callback_header_name,omitempty"`
	CallbackSignHeader      string            `json:"callback_sign_header,omitempty"`
	CallbackTimestampHeader string            `json:"callback_timestamp_header,omitempty"`
	CallbackNonceHeader     string            `json:"callback_nonce_header,omitempty"`
	CallbackSignatureParam  string            `json:"callback_signature_param,omitempty"`
	CallbackTimestampParam  string            `json:"callback_timestamp_param,omitempty"`
	CallbackNonceParam      string            `json:"callback_nonce_param,omitempty"`
	CallbackTTLSeconds      int               `json:"callback_ttl_seconds,omitempty"`
	CallbackSignSource      string            `json:"callback_sign_source,omitempty"`
	CallbackPayloadMapping  map[string]string `json:"callback_payload_mapping,omitempty"`
	CallbackSuccessField    string            `json:"callback_success_field,omitempty"`
	CallbackSuccessValues   []string          `json:"callback_success_values,omitempty"`
	RefundProviderKey       string            `json:"refund_provider_key,omitempty"`
	RefundActionKey         string            `json:"refund_action_key,omitempty"`
	RefundStatusPath        string            `json:"refund_status_path,omitempty"`
	RefundReceiptPath       string            `json:"refund_receipt_path,omitempty"`
}

type productMetadata struct {
	NameZH          string   `json:"name_zh"`
	NameEN          string   `json:"name_en"`
	BadgeZH         string   `json:"badge_zh"`
	BadgeEN         string   `json:"badge_en"`
	CycleLabelZH    string   `json:"cycle_label_zh"`
	CycleLabelEN    string   `json:"cycle_label_en"`
	DeliveryLabelZH string   `json:"delivery_label_zh"`
	DeliveryLabelEN string   `json:"delivery_label_en"`
	StockLabelZH    string   `json:"stock_label_zh"`
	StockLabelEN    string   `json:"stock_label_en"`
	StatusLabelZH   string   `json:"status_label_zh"`
	StatusLabelEN   string   `json:"status_label_en"`
	OriginalPrice   string   `json:"original_price"`
	BillingCycle    string   `json:"billing_cycle"`
	Inventory       int      `json:"inventory"`
	PaymentMethods  []string `json:"payment_methods"`
	TagsZH          []string `json:"tags_zh"`
	TagsEN          []string `json:"tags_en"`
	CheckoutNotesZH []string `json:"checkout_notes_zh"`
	CheckoutNotesEN []string `json:"checkout_notes_en"`
	ArtVariant      string   `json:"art_variant"`
}

func jsonValue(value any) datatypes.JSON {
	if value == nil {
		return datatypes.JSON([]byte("{}"))
	}

	payload, err := json.Marshal(value)
	if err != nil {
		return datatypes.JSON([]byte("{}"))
	}

	return datatypes.JSON(payload)
}

func parseJSON[T any](value datatypes.JSON) T {
	var result T
	if len(value) == 0 {
		return result
	}

	_ = json.Unmarshal(value, &result)
	return result
}

func formatAmount(value float64) string {
	return strconv.FormatFloat(value, 'f', 2, 64)
}

func parseFloat(value string) (float64, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return 0, nil
	}

	return strconv.ParseFloat(trimmed, 64)
}

func parseUintRoute(value string) (uint, bool) {
	parsed, err := strconv.ParseUint(strings.TrimSpace(value), 10, 64)
	if err != nil {
		return 0, false
	}

	return uint(parsed), true
}

func (s *Service) encryptString(plain string) (string, error) {
	if plain == "" {
		return "", nil
	}

	block, err := aes.NewCipher(s.cryptoKey[:])
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	cipherPayload := gcm.Seal(nonce, nonce, []byte(plain), nil)
	return base64.StdEncoding.EncodeToString(cipherPayload), nil
}

func (s *Service) decryptString(cipherText string) (string, error) {
	if strings.TrimSpace(cipherText) == "" {
		return "", nil
	}

	raw, err := base64.StdEncoding.DecodeString(cipherText)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(s.cryptoKey[:])
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	if len(raw) < gcm.NonceSize() {
		return "", fmt.Errorf("cipher payload too short")
	}

	nonce := raw[:gcm.NonceSize()]
	body := raw[gcm.NonceSize():]
	plain, err := gcm.Open(nil, nonce, body, nil)
	if err != nil {
		return "", err
	}

	return string(plain), nil
}

func generateCode(length int) (string, error) {
	if length < 2 {
		length = 32
	}

	bytes := make([]byte, (length+1)/2)
	if _, err := io.ReadFull(rand.Reader, bytes); err != nil {
		return "", err
	}

	code := strings.ToUpper(hex.EncodeToString(bytes))
	if len(code) > length {
		code = code[:length]
	}

	return code, nil
}

func maskValue(value string, visibleTail int) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}

	if visibleTail <= 0 || len(trimmed) <= visibleTail {
		return strings.Repeat("*", len(trimmed))
	}

	return strings.Repeat("*", len(trimmed)-visibleTail) + trimmed[len(trimmed)-visibleTail:]
}

func orderNo() string {
	suffix, err := generateCode(6)
	if err != nil {
		return fmt.Sprintf("PD%s%06d", time.Now().Format("20060102150405"), time.Now().UnixNano()%1000000)
	}
	return "PD" + time.Now().Format("20060102150405") + suffix
}

func ticketNo() string {
	suffix, err := generateCode(4)
	if err != nil {
		return fmt.Sprintf("TK%s%04d", time.Now().Format("20060102150405"), time.Now().UnixNano()%10000)
	}
	return "TK" + time.Now().Format("20060102150405") + suffix
}

func ptrTime(value time.Time) *time.Time {
	return &value
}

func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}

	return ""
}

func stringValue(value any) string {
	if text, ok := value.(string); ok {
		return text
	}
	return ""
}

func intValue(value any) int {
	switch typed := value.(type) {
	case int:
		return typed
	case float64:
		return int(typed)
	default:
		return 0
	}
}

func normalizeStringList(primary []string, fallback any) []string {
	if len(primary) > 0 {
		return primary
	}

	switch typed := fallback.(type) {
	case []string:
		return typed
	case []any:
		result := make([]string, 0, len(typed))
		for _, item := range typed {
			if text, ok := item.(string); ok && strings.TrimSpace(text) != "" {
				result = append(result, text)
			}
		}
		return result
	default:
		return nil
	}
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func generateOpaqueToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, bytes); err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

func (s *Service) logAdminAction(ctx context.Context, tx *gorm.DB, meta AuditMeta, module, action, targetID, targetType string, payload any) {
	if tx == nil {
		tx = s.db
	}

	body := ""
	if payload != nil {
		raw, err := json.Marshal(payload)
		if err == nil {
			body = string(raw)
		}
	}

	entry := model.AdminOperationLog{
		AdminUserID:    meta.AdminUserID,
		Module:         module,
		Action:         action,
		TargetID:       targetID,
		TargetType:     targetType,
		RequestIP:      meta.RequestIP,
		RequestPayload: body,
		CreatedAt:      time.Now(),
	}

	_ = tx.WithContext(ctx).Create(&entry).Error
}

func (s *Service) RecordAdminAction(ctx context.Context, meta AuditMeta, module, action, targetID, targetType string, payload any) {
	s.logAdminAction(ctx, s.db, meta, module, action, targetID, targetType, payload)
}

func (s *Service) resolveProductByRoute(ctx context.Context, routeID string) (*model.Product, error) {
	var record model.Product
	query := s.db.WithContext(ctx).Preload("ProductPrices")

	if id, ok := parseUintRoute(routeID); ok {
		if err := query.First(&record, id).Error; err == nil {
			return &record, nil
		}
	}

	if err := query.Where("sku = ?", routeID).First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &record, nil
}

func (s *Service) resolveProductPriceByRoute(ctx context.Context, productID uint, routeID string) (*model.ProductPrice, error) {
	var record model.ProductPrice
	query := s.db.WithContext(ctx).Where("product_id = ?", productID)

	if id, ok := parseUintRoute(routeID); ok {
		if err := query.First(&record, id).Error; err == nil {
			return &record, nil
		}
	}

	if templateName, paymentMethod, ok := parseProductPriceRouteID(routeID); ok {
		if err := query.Where("template_name = ? AND payment_method = ?", templateName, paymentMethod).First(&record).Error; err == nil {
			return &record, nil
		}
	}

	if err := query.Where("template_name = ?", routeID).First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &record, nil
}

func parseProductPriceRouteID(routeID string) (templateName string, paymentMethod string, ok bool) {
	trimmed := strings.TrimSpace(routeID)
	if trimmed == "" {
		return "", "", false
	}

	index := strings.LastIndex(trimmed, ":")
	if index <= 0 || index >= len(trimmed)-1 {
		return "", "", false
	}

	templateName = strings.TrimSpace(trimmed[:index])
	paymentMethod = strings.TrimSpace(trimmed[index+1:])
	if templateName == "" || paymentMethod == "" {
		return "", "", false
	}

	switch paymentMethod {
	case "wechat_qr", "alipay_qr", "okx_usdt":
		return templateName, paymentMethod, true
	default:
		return "", "", false
	}
}

func (s *Service) resolvePaymentChannelByRoute(ctx context.Context, routeID string) (*model.PaymentChannel, error) {
	var record model.PaymentChannel
	if err := s.db.WithContext(ctx).Where("channel_key = ?", routeID).First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &record, nil
}

func (s *Service) resolveProviderByRoute(ctx context.Context, routeID string) (*model.IntegrationProvider, error) {
	var record model.IntegrationProvider
	if err := s.db.WithContext(ctx).Where("provider_key = ?", routeID).First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &record, nil
}

func (s *Service) resolveActionByRoute(ctx context.Context, routeID string) (*model.IntegrationAction, error) {
	var record model.IntegrationAction
	if err := s.db.WithContext(ctx).Where("action_key = ?", routeID).First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &record, nil
}

func (s *Service) resolveFulfillmentStrategyByRoute(ctx context.Context, routeID string) (*model.FulfillmentStrategy, error) {
	var record model.FulfillmentStrategy
	if err := s.db.WithContext(ctx).Where("strategy_key = ?", routeID).First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &record, nil
}

func (s *Service) resolveDeliveryStrategyByRoute(ctx context.Context, routeID string) (*model.DeliveryStrategy, error) {
	var record model.DeliveryStrategy
	if err := s.db.WithContext(ctx).Where("strategy_key = ?", routeID).First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &record, nil
}

func (s *Service) resolveOrderByNo(ctx context.Context, value string) (*model.Order, error) {
	return s.resolveOrderByNoTx(ctx, s.db, value)
}

func (s *Service) resolveOrderByNoTx(ctx context.Context, tx *gorm.DB, value string) (*model.Order, error) {
	var record model.Order
	if err := tx.WithContext(ctx).
		Preload("OrderItems").
		Preload("PaymentProofs").
		Preload("PaymentRecords").
		Where("order_no = ?", value).
		First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &record, nil
}

func (s *Service) resolveFulfillmentRecordByRoute(ctx context.Context, routeID string) (*model.FulfillmentRecord, error) {
	var record model.FulfillmentRecord
	query := s.db.WithContext(ctx)

	if id, ok := parseUintRoute(routeID); ok {
		if err := query.First(&record, id).Error; err == nil {
			return &record, nil
		}
	}

	if err := query.Where("external_ref = ?", routeID).First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &record, nil
}

func (s *Service) resolveDeliveryRecordByRoute(ctx context.Context, routeID string) (*model.DeliveryRecord, error) {
	var record model.DeliveryRecord
	query := s.db.WithContext(ctx)

	if id, ok := parseUintRoute(routeID); ok {
		if err := query.First(&record, id).Error; err == nil {
			return &record, nil
		}
	}

	if err := query.Where("message_id = ?", routeID).First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &record, nil
}

func (s *Service) resolvePaymentRecordByRoute(ctx context.Context, routeID string) (*model.PaymentRecord, error) {
	var record model.PaymentRecord
	query := s.db.WithContext(ctx)

	if id, ok := parseUintRoute(routeID); ok {
		if err := query.First(&record, id).Error; err == nil {
			return &record, nil
		}
	}

	if err := query.
		Where("merchant_order_no = ? OR third_party_txn_no = ? OR chain_tx_hash = ?", routeID, routeID, routeID).
		First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &record, nil
}

func (s *Service) resolvePaymentProofByRoute(ctx context.Context, routeID string) (*model.PaymentProof, error) {
	var record model.PaymentProof
	query := s.db.WithContext(ctx)

	if id, ok := parseUintRoute(routeID); ok {
		if err := query.First(&record, id).Error; err == nil {
			return &record, nil
		}
	}

	if err := query.Where("object_key = ?", routeID).First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &record, nil
}

func (s *Service) resolvePaymentCallbackLogByRoute(ctx context.Context, routeID string) (*model.PaymentCallbackLog, error) {
	var record model.PaymentCallbackLog
	query := s.db.WithContext(ctx)

	if id, ok := parseUintRoute(routeID); ok {
		if err := query.First(&record, id).Error; err == nil {
			return &record, nil
		}
	}

	if err := query.Where("order_no = ?", routeID).Order("created_at DESC, id DESC").First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &record, nil
}

func (s *Service) resolvePaymentWatcherRecordByRoute(ctx context.Context, routeID string) (*model.PaymentWatcherRecord, error) {
	var record model.PaymentWatcherRecord
	query := s.db.WithContext(ctx)

	if id, ok := parseUintRoute(routeID); ok {
		if err := query.First(&record, id).Error; err == nil {
			return &record, nil
		}
	}

	if err := query.Where("chain_tx_hash = ? OR order_no = ?", routeID, routeID).Order("created_at DESC, id DESC").First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &record, nil
}

func (s *Service) resolveAdminOperationLogByRoute(ctx context.Context, routeID string) (*model.AdminOperationLog, error) {
	var record model.AdminOperationLog
	query := s.db.WithContext(ctx)

	if id, ok := parseUintRoute(routeID); ok {
		if err := query.First(&record, id).Error; err == nil {
			return &record, nil
		}
	}

	if err := query.Where("target_id = ?", routeID).Order("created_at DESC, id DESC").First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &record, nil
}

func (s *Service) resolveCodeIssueRecordByRoute(ctx context.Context, routeID string) (*model.CodeIssueRecord, error) {
	var record model.CodeIssueRecord
	query := s.db.WithContext(ctx)

	if id, ok := parseUintRoute(routeID); ok {
		if err := query.First(&record, id).Error; err == nil {
			return &record, nil
		}
	}

	if err := query.Where("order_no = ?", routeID).First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &record, nil
}

func (s *Service) resolveTicketByNo(ctx context.Context, value string) (*model.SupportTicket, error) {
	var record model.SupportTicket
	if err := s.db.WithContext(ctx).Where("ticket_no = ?", value).First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &record, nil
}

func (s *Service) resolveUserByDisplayName(ctx context.Context, name string) (*model.User, error) {
	var record model.User
	if err := s.db.WithContext(ctx).Where("display_name = ?", name).First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			email := strings.ToLower(strings.ReplaceAll(name, " ", ".")) + "@passdock.local"
			record = model.User{
				DisplayName: name,
				Role:        "operator",
				Status:      "active",
				Locale:      "en-US",
				Email:       &email,
			}
			if createErr := s.db.WithContext(ctx).Create(&record).Error; createErr != nil {
				return nil, createErr
			}
			return &record, nil
		}
		return nil, err
	}
	return &record, nil
}

func (s *Service) resolveUserByID(ctx context.Context, id uint) (*model.User, error) {
	var record model.User
	if err := s.db.WithContext(ctx).First(&record, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &record, nil
}

func (s *Service) resolveUserByEmail(ctx context.Context, email string) (*model.User, error) {
	var record model.User
	if err := s.db.WithContext(ctx).Where("email = ?", strings.ToLower(strings.TrimSpace(email))).First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &record, nil
}

func orderBotKey(order model.Order) string {
	meta := parseJSON[map[string]any](order.MetadataJSON)
	if value, ok := meta["bot_key"].(string); ok {
		return strings.TrimSpace(value)
	}

	return ""
}

func normalizeTelegramLookupValue(value string) string {
	text := strings.TrimSpace(value)
	if text == "" {
		return ""
	}

	lower := strings.ToLower(text)
	switch {
	case strings.HasPrefix(lower, "tg:"):
		text = text[3:]
	case strings.HasPrefix(lower, "telegram:"):
		text = text[len("telegram:"):]
	}

	return strings.TrimSpace(strings.TrimPrefix(text, "@"))
}

func normalizeTelegramUsername(value string) string {
	return strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(value), "@"))
}

func latestTelegramBindingQuery(query *gorm.DB) *gorm.DB {
	return query.Order("bound_at DESC, id DESC")
}

func (s *Service) resolveTelegramBindingByLookupTx(
	ctx context.Context,
	tx *gorm.DB,
	lookup string,
	preferredBotKey string,
) (*model.TelegramBinding, error) {
	normalized := normalizeTelegramLookupValue(lookup)
	if normalized == "" {
		return nil, nil
	}

	username := normalizeTelegramUsername(normalized)
	query := tx.WithContext(ctx).Model(&model.TelegramBinding{})
	if strings.TrimSpace(preferredBotKey) != "" {
		query = query.Where("bot_key = ?", strings.TrimSpace(preferredBotKey))
	}

	var record model.TelegramBinding
	if err := latestTelegramBindingQuery(query).
		Where("chat_id = ? OR telegram_user_id = ? OR telegram_username = ?", normalized, normalized, username).
		First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return &record, nil
}

func (s *Service) resolveTelegramBindingForOrderTx(
	ctx context.Context,
	tx *gorm.DB,
	order *model.Order,
	preferredBotKey string,
) (*model.TelegramBinding, error) {
	if order == nil {
		return nil, nil
	}

	botKey := strings.TrimSpace(preferredBotKey)
	if botKey == "" {
		botKey = orderBotKey(*order)
	}

	lookup := normalizeTelegramLookupValue(order.BuyerRef)
	if order.UserID != nil && lookup != "" {
		username := normalizeTelegramUsername(lookup)
		query := tx.WithContext(ctx).Model(&model.TelegramBinding{}).Where("user_id = ?", *order.UserID)
		if botKey != "" {
			query = query.Where("bot_key = ?", botKey)
		}

		var record model.TelegramBinding
		if err := latestTelegramBindingQuery(query).
			Where("chat_id = ? OR telegram_user_id = ? OR telegram_username = ?", lookup, lookup, username).
			First(&record).Error; err == nil {
			return &record, nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}

	if order.UserID != nil {
		query := tx.WithContext(ctx).Model(&model.TelegramBinding{}).Where("user_id = ?", *order.UserID)
		if botKey != "" {
			query = query.Where("bot_key = ?", botKey)
		}

		var record model.TelegramBinding
		if err := latestTelegramBindingQuery(query).First(&record).Error; err == nil {
			return &record, nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}

	if lookup != "" {
		return s.resolveTelegramBindingByLookupTx(ctx, tx, lookup, botKey)
	}

	return nil, nil
}

func (s *Service) resolveTelegramBindingForDeliveryTx(
	ctx context.Context,
	tx *gorm.DB,
	record *model.DeliveryRecord,
	order *model.Order,
	preferredBotKey string,
) (*model.TelegramBinding, error) {
	if record == nil || record.DeliveryChannel != "telegram" {
		return nil, nil
	}

	if binding, err := s.resolveTelegramBindingByLookupTx(ctx, tx, record.DeliveryTarget, preferredBotKey); err != nil {
		return nil, err
	} else if binding != nil {
		return binding, nil
	}

	return s.resolveTelegramBindingForOrderTx(ctx, tx, order, preferredBotKey)
}

func (s *Service) resolveRuntimeSettingByName(ctx context.Context, name string) (*model.RuntimeSetting, error) {
	var record model.RuntimeSetting
	if err := s.db.WithContext(ctx).Where("name = ?", name).First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &record, nil
}

func (s *Service) resolveInternalClientKeyByRoute(ctx context.Context, routeID string) (*model.InternalClientKey, error) {
	var record model.InternalClientKey
	query := s.db.WithContext(ctx)

	if id, ok := parseUintRoute(routeID); ok {
		if err := query.First(&record, id).Error; err == nil {
			return &record, nil
		}
	}

	if err := query.Where("client_key = ?", routeID).First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &record, nil
}

func buildCustomerName(order model.Order) string {
	meta := parseJSON[map[string]any](order.MetadataJSON)
	if value, ok := meta["customer_name"].(string); ok && strings.TrimSpace(value) != "" {
		if strings.TrimSpace(value) == strings.TrimSpace(order.BuyerRef) {
			return humanizeBuyerRef(value)
		}
		return value
	}
	if strings.TrimSpace(order.BuyerRef) == "" {
		return "Guest"
	}
	return humanizeBuyerRef(order.BuyerRef)
}

func humanizeBuyerRef(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "Guest"
	}

	if index := strings.Index(trimmed, ":"); index >= 0 && index < len(trimmed)-1 {
		trimmed = trimmed[index+1:]
	}

	normalized := strings.NewReplacer("-", " ", "_", " ", ".", " ").Replace(trimmed)
	parts := strings.Fields(normalized)
	if len(parts) == 0 {
		return value
	}

	for index, part := range parts {
		runes := []rune(strings.ToLower(part))
		if len(runes) == 0 {
			continue
		}
		runes[0] = unicode.ToUpper(runes[0])
		parts[index] = string(runes)
	}

	return strings.Join(parts, " ")
}

func (s *Service) productSnapshot(product model.Product) map[string]any {
	meta := parseJSON[productMetadata](product.MetadataJSON)
	return map[string]any{
		"product_id":               product.ID,
		"sku":                      product.SKU,
		"name":                     product.Name,
		"name_zh":                  meta.NameZH,
		"name_en":                  meta.NameEN,
		"display_price":            formatAmount(product.DisplayPrice),
		"currency":                 product.Currency,
		"fulfillment_strategy_key": product.FulfillmentStrategyKey,
		"delivery_strategy_key":    product.DeliveryStrategyKey,
		"metadata":                 meta,
	}
}
