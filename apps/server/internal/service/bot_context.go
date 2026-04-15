package service

import (
	"context"
	"encoding/json"
	"sort"
	"strings"
	"time"

	"passdock/server/internal/model"
)

type telegramWebhookContext struct {
	BotKey           string
	ChatID           string
	Username         string
	TelegramUserID   string
	DisplayName      string
	MessageID        string
	MessageText      string
	ReplyToMessage   string
	ReplyToMessageID string
	CallbackQueryID  string
	CallbackData     string
	Media            *telegramMediaAttachment
	Binding          *model.TelegramBinding
	User             *model.User
}

type telegramCommand struct {
	Name    string
	Args    []string
	RawArgs string
}

type telegramDeliveryView struct {
	DeliveryChannel string
	DeliveryStatus  string
	Target          string
	DeliveredAt     *time.Time
	Codes           []string
	PlainContent    string
	MaskedContent   string
}

func parseTelegramCommand(text string) telegramCommand {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return telegramCommand{}
	}

	parts := strings.Fields(trimmed)
	if len(parts) == 0 {
		return telegramCommand{}
	}

	token := strings.TrimSpace(parts[0])
	if !strings.HasPrefix(token, "/") {
		return telegramCommand{}
	}

	name := strings.TrimPrefix(token, "/")
	if index := strings.Index(name, "@"); index >= 0 {
		name = name[:index]
	}

	return telegramCommand{
		Name:    strings.ToLower(strings.TrimSpace(name)),
		Args:    parts[1:],
		RawArgs: strings.TrimSpace(strings.TrimPrefix(trimmed, token)),
	}
}

func (s *Service) buildTelegramWebhookContext(
	ctx context.Context,
	botKey string,
	event telegramWebhookEvent,
) (telegramWebhookContext, error) {
	botCtx := telegramWebhookContext{
		BotKey:           defaultString(normalizeTelegramBotKey(botKey), "default"),
		ChatID:           strings.TrimSpace(event.ChatID),
		Username:         normalizeTelegramUsername(event.Username),
		TelegramUserID:   normalizeTelegramLookupValue(event.TelegramUserID),
		DisplayName:      strings.TrimSpace(event.DisplayName),
		MessageID:        strings.TrimSpace(event.MessageID),
		MessageText:      strings.TrimSpace(event.MessageText),
		ReplyToMessage:   strings.TrimSpace(event.ReplyToMessage),
		ReplyToMessageID: strings.TrimSpace(event.ReplyToMessageID),
		CallbackQueryID:  strings.TrimSpace(event.CallbackQueryID),
		CallbackData:     strings.TrimSpace(event.CallbackData),
		Media:            event.Media,
	}

	binding, err := s.resolveTelegramWebhookBinding(ctx, botCtx)
	if err != nil {
		return botCtx, err
	}
	botCtx.Binding = binding
	if binding != nil {
		if botCtx.Username == "" {
			botCtx.Username = normalizeTelegramUsername(binding.TelegramUsername)
		}

		user, err := s.resolveUserByID(ctx, binding.UserID)
		if err != nil && err != ErrNotFound {
			return botCtx, err
		}
		if err == nil {
			botCtx.User = user
			if botCtx.DisplayName == "" {
				botCtx.DisplayName = strings.TrimSpace(user.DisplayName)
			}
		}
	}

	return botCtx, nil
}

func (s *Service) resolveTelegramWebhookBinding(
	ctx context.Context,
	botCtx telegramWebhookContext,
) (*model.TelegramBinding, error) {
	candidates := []string{
		botCtx.TelegramUserID,
		botCtx.ChatID,
		botCtx.Username,
	}
	for _, candidate := range candidates {
		binding, err := s.resolveTelegramBindingByLookupTx(ctx, s.db, candidate, botCtx.BotKey)
		if err != nil {
			return nil, err
		}
		if binding != nil {
			return binding, nil
		}
	}

	return nil, nil
}

func (botCtx telegramWebhookContext) buyerRef() string {
	for _, value := range botCtx.lookupValues() {
		if value != "" {
			return "tg:" + value
		}
	}

	return "tg:guest"
}

func (botCtx telegramWebhookContext) lookupValues() []string {
	values := []string{
		botCtx.TelegramUserID,
		botCtx.Username,
		botCtx.ChatID,
	}
	result := make([]string, 0, len(values))
	seen := map[string]struct{}{}
	for _, value := range values {
		normalized := normalizeTelegramLookupValue(value)
		if normalized == "" {
			continue
		}
		if _, exists := seen[normalized]; exists {
			continue
		}
		seen[normalized] = struct{}{}
		result = append(result, normalized)
	}

	return result
}

func (botCtx telegramWebhookContext) userID() *uint {
	if botCtx.User == nil {
		return nil
	}
	return &botCtx.User.ID
}

func (botCtx telegramWebhookContext) display() string {
	switch {
	case strings.TrimSpace(botCtx.DisplayName) != "":
		return botCtx.DisplayName
	case botCtx.User != nil && strings.TrimSpace(botCtx.User.DisplayName) != "":
		return botCtx.User.DisplayName
	case botCtx.Username != "":
		return "@" + botCtx.Username
	case botCtx.TelegramUserID != "":
		return botCtx.TelegramUserID
	default:
		return "there"
	}
}

func (s *Service) listTelegramAccessibleOrders(
	ctx context.Context,
	botCtx telegramWebhookContext,
	limit int,
) ([]model.Order, error) {
	if limit <= 0 {
		limit = 5
	}

	result := make([]model.Order, 0, limit)
	seen := map[uint]struct{}{}
	appendOrders := func(items []model.Order) {
		for _, order := range items {
			if order.ID == 0 || !s.telegramContextOwnsOrder(botCtx, &order) {
				continue
			}
			if _, exists := seen[order.ID]; exists {
				continue
			}
			seen[order.ID] = struct{}{}
			result = append(result, order)
		}
	}

	if userID := botCtx.userID(); userID != nil {
		var orders []model.Order
		if err := s.db.WithContext(ctx).
			Preload("OrderItems").
			Where("user_id = ?", *userID).
			Order("created_at DESC, id DESC").
			Limit(limit * 4).
			Find(&orders).Error; err != nil {
			return nil, err
		}
		appendOrders(orders)
	}

	lookupRefs := make([]string, 0, len(botCtx.lookupValues()))
	for _, value := range botCtx.lookupValues() {
		lookupRefs = append(lookupRefs, "tg:"+value)
	}
	if len(lookupRefs) > 0 {
		var orders []model.Order
		if err := s.db.WithContext(ctx).
			Preload("OrderItems").
			Where("source_channel = ?", "telegram").
			Where("buyer_ref IN ?", lookupRefs).
			Order("created_at DESC, id DESC").
			Limit(limit * 4).
			Find(&orders).Error; err != nil {
			return nil, err
		}
		appendOrders(orders)
	}

	sort.Slice(result, func(i, j int) bool {
		if result[i].CreatedAt.Equal(result[j].CreatedAt) {
			return result[i].ID > result[j].ID
		}
		return result[i].CreatedAt.After(result[j].CreatedAt)
	})

	if len(result) > limit {
		result = result[:limit]
	}

	return result, nil
}

func (s *Service) resolveTelegramAccessibleOrder(
	ctx context.Context,
	botCtx telegramWebhookContext,
	orderNo string,
) (*model.Order, error) {
	order, err := s.resolveOrderByNo(ctx, strings.TrimSpace(orderNo))
	if err != nil {
		return nil, err
	}
	if !s.telegramContextOwnsOrder(botCtx, order) {
		return nil, ErrNotFound
	}

	return order, nil
}

func (s *Service) telegramContextOwnsOrder(
	botCtx telegramWebhookContext,
	order *model.Order,
) bool {
	if order == nil {
		return false
	}

	if botCtx.User != nil && order.UserID != nil && *order.UserID == botCtx.User.ID {
		return true
	}

	if strings.TrimSpace(order.SourceChannel) != "telegram" {
		return false
	}

	orderBot := strings.TrimSpace(orderBotKey(*order))
	if orderBot != "" && orderBot != botCtx.BotKey {
		return false
	}

	orderLookup := normalizeTelegramLookupValue(order.BuyerRef)
	if orderLookup == "" {
		return false
	}

	for _, lookup := range botCtx.lookupValues() {
		if lookup == orderLookup {
			return true
		}
	}

	return false
}

func (s *Service) getTelegramOrderDeliveryView(
	ctx context.Context,
	order *model.Order,
) (telegramDeliveryView, error) {
	view := telegramDeliveryView{}
	if order == nil {
		return view, ErrNotFound
	}

	var delivery model.DeliveryRecord
	_ = s.db.WithContext(ctx).
		Where("order_id = ?", order.ID).
		Order("id DESC").
		First(&delivery).Error

	var issue model.CodeIssueRecord
	_ = s.db.WithContext(ctx).
		Where("order_id = ?", order.ID).
		Order("id DESC").
		First(&issue).Error

	var fulfillment model.FulfillmentRecord
	_ = s.db.WithContext(ctx).
		Where("order_id = ?", order.ID).
		Order("id DESC").
		First(&fulfillment).Error

	view.DeliveryChannel = delivery.DeliveryChannel
	view.DeliveryStatus = delivery.DeliveryStatus
	view.Target = delivery.DeliveryTarget
	view.DeliveredAt = delivery.DeliveredAt
	view.MaskedContent = strings.TrimSpace(delivery.DeliveredContentMasked)

	if issue.ID != 0 && strings.TrimSpace(issue.IssuedCodeEncrypted) != "" {
		plain, err := s.decryptString(issue.IssuedCodeEncrypted)
		if err != nil {
			return view, err
		}

		if strings.TrimSpace(plain) != "" {
			var codes []string
			if err := json.Unmarshal([]byte(plain), &codes); err != nil {
				return view, err
			}
			view.Codes = codes
		}
		if view.MaskedContent == "" {
			view.MaskedContent = strings.TrimSpace(issue.IssuedCodeMasked)
		}
	}

	if len(view.Codes) > 0 {
		view.PlainContent = strings.Join(view.Codes, ", ")
	}

	if view.PlainContent == "" && strings.TrimSpace(fulfillment.ResultDataEncrypted) != "" {
		plain, err := s.decryptString(fulfillment.ResultDataEncrypted)
		if err != nil {
			return view, err
		}
		view.PlainContent = strings.TrimSpace(plain)
	}

	if view.MaskedContent == "" {
		view.MaskedContent = strings.TrimSpace(fulfillment.ResultDataMasked)
	}

	return view, nil
}

func formatTelegramTime(value *time.Time) string {
	if value == nil || value.IsZero() {
		return "-"
	}

	return value.Local().Format("2006-01-02 15:04")
}
