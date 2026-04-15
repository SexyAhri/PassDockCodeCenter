package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"passdock/server/internal/model"
)

type TelegramBindInput struct {
	Email            string
	DisplayName      string
	TelegramUserID   string
	TelegramUsername string
	ChatID           string
}

type TelegramTestSendInput struct {
	ChatID   string
	Message  string
	Operator string
}

type TelegramWebhookSimulationInput struct {
	ChatID         string
	Text           string
	TelegramUserID string
	Username       string
	Operator       string
}

func (s *Service) ListAdminTelegramBindings(ctx context.Context, botKey string) ([]map[string]any, error) {
	var bindings []model.TelegramBinding
	if err := s.db.WithContext(ctx).
		Where("bot_key = ?", defaultString(botKey, "default")).
		Order("bound_at DESC, id DESC").
		Find(&bindings).Error; err != nil {
		return nil, err
	}

	items := make([]map[string]any, 0, len(bindings))
	for _, binding := range bindings {
		var user model.User
		_ = s.db.WithContext(ctx).Where("id = ?", binding.UserID).First(&user).Error

		email := ""
		if user.Email != nil {
			email = *user.Email
		}

		items = append(items, map[string]any{
			"id":                binding.ID,
			"binding_id":        binding.ID,
			"bot_key":           binding.BotKey,
			"user_id":           binding.UserID,
			"display_name":      user.DisplayName,
			"email":             email,
			"user_status":       user.Status,
			"user_role":         user.Role,
			"telegram_user_id":  binding.TelegramUserID,
			"telegram_username": binding.TelegramUsername,
			"chat_id":           binding.ChatID,
			"bound_at":          binding.BoundAt,
			"last_login_at":     user.LastLoginAt,
		})
	}

	return items, nil
}

func (s *Service) ListAdminTelegramDeliveryRecords(ctx context.Context, botKey string) ([]map[string]any, error) {
	desiredBotKey := defaultString(botKey, "default")

	var records []model.DeliveryRecord
	if err := s.db.WithContext(ctx).
		Where("delivery_channel = ?", "telegram").
		Order("created_at DESC, id DESC").
		Find(&records).Error; err != nil {
		return nil, err
	}

	items := make([]map[string]any, 0, len(records))
	for _, record := range records {
		var order model.Order
		_ = s.db.WithContext(ctx).Where("id = ?", record.OrderID).First(&order).Error

		binding, err := s.resolveTelegramBindingForDeliveryTx(ctx, s.db, &record, &order, desiredBotKey)
		if err != nil {
			return nil, err
		}
		if binding == nil {
			continue
		}

		items = append(items, map[string]any{
			"id":               record.ID,
			"record_id":        record.ID,
			"bot_key":          binding.BotKey,
			"order_no":         order.OrderNo,
			"delivery_channel": record.DeliveryChannel,
			"channel_type":     record.DeliveryChannel,
			"target":           record.DeliveryTarget,
			"status":           record.DeliveryStatus,
			"message_id":       record.MessageID,
			"started_at":       record.CreatedAt,
			"finished_at":      record.DeliveredAt,
		})
	}

	return items, nil
}

func (s *Service) HandleTelegramWebhook(ctx context.Context, botKey string, payload map[string]any) (map[string]any, error) {
	event := parseTelegramWebhookEvent(payload)
	botCtx, err := s.buildTelegramWebhookContext(ctx, botKey, event)
	if err != nil {
		return nil, err
	}

	response := map[string]any{
		"bot_key":           botCtx.BotKey,
		"chat_id":           botCtx.ChatID,
		"event_type":        defaultString(event.EventType, "message"),
		"telegram_user_id":  botCtx.TelegramUserID,
		"telegram_username": botCtx.Username,
	}
	if botCtx.Binding != nil {
		response["binding_id"] = botCtx.Binding.ID
		response["user_id"] = botCtx.Binding.UserID
	}

	var (
		reply   telegramReply
		command telegramCommand
	)

	switch {
	case strings.TrimSpace(botCtx.CallbackQueryID) != "":
		reply, err = s.handleTelegramCallback(ctx, botCtx, botCtx.CallbackData)
		response["callback_data"] = botCtx.CallbackData
	case botCtx.Media != nil:
		reply, err = s.handleTelegramProofUpload(ctx, botCtx)
	case s.isTelegramSupportReply(botCtx):
		reply, err = s.handleTelegramSupportReply(ctx, botCtx)
	default:
		command = parseTelegramCommand(botCtx.MessageText)
		reply, err = s.handleTelegramCommandReply(ctx, botCtx, command)
		response["command"] = command.Name
	}
	if err != nil {
		return nil, err
	}
	response["text"] = reply.Text
	for key, value := range reply.Meta {
		response[key] = value
	}

	if strings.TrimSpace(botCtx.CallbackQueryID) != "" {
		if err := s.answerTelegramCallbackQuery(
			ctx,
			botCtx.BotKey,
			botCtx.CallbackQueryID,
			firstNonEmpty(reply.CallbackText, "Updated"),
			reply.CallbackShowAlert,
		); err != nil {
			return nil, err
		}
		response["callback_status"] = "answered"
	}

	if botCtx.ChatID != "" && strings.TrimSpace(reply.Text) != "" {
		sendResult, err := s.sendTelegramMessageWithOptions(ctx, botCtx.BotKey, botCtx.ChatID, reply.Text, telegramSendOptions{
			ReplyMarkup:           reply.ReplyMarkup,
			DisableWebPagePreview: reply.DisableWebPagePreview,
			ReplyToMessageID:      reply.ReplyToMessageID,
		})
		if err != nil {
			return nil, err
		}
		response["message_id"] = sendResult.MessageID
		response["status"] = "sent"
		response["sent_at"] = sendResult.SentAt
	} else if response["callback_status"] != nil {
		response["status"] = "acknowledged"
	}

	return response, nil
}

func (s *Service) BindTelegramUser(ctx context.Context, botKey string, input TelegramBindInput) (map[string]any, error) {
	if input.TelegramUserID == "" || input.ChatID == "" {
		return nil, ErrInvalidInput
	}

	var user *model.User
	if strings.TrimSpace(input.Email) != "" {
		resolved, err := s.resolveUserByEmail(ctx, input.Email)
		if err == nil {
			user = resolved
		} else if err != ErrNotFound {
			return nil, err
		} else {
			return nil, ErrNotFound
		}
	}
	if user == nil {
		displayName := defaultString(input.DisplayName, defaultString(input.TelegramUsername, "telegram-user"))
		email := strings.ToLower(strings.ReplaceAll(displayName, " ", ".")) + "@telegram.passdock.local"
		resolved, err := s.resolveUserByEmail(ctx, email)
		if err == nil {
			user = resolved
		} else {
			passwordHash, hashErr := HashPassword(generateFallbackPassword(input.TelegramUserID))
			if hashErr != nil {
				return nil, hashErr
			}

			user = &model.User{
				Email:          &email,
				PasswordHash:   &passwordHash,
				DisplayName:    displayName,
				Role:           "user",
				Status:         "active",
				Locale:         "en-US",
				TelegramUserID: &input.TelegramUserID,
			}
			if createErr := s.db.WithContext(ctx).Create(user).Error; createErr != nil {
				return nil, createErr
			}
		}
	}

	now := time.Now()
	binding := model.TelegramBinding{
		UserID:           user.ID,
		BotKey:           defaultString(botKey, "default"),
		TelegramUserID:   input.TelegramUserID,
		TelegramUsername: input.TelegramUsername,
		ChatID:           input.ChatID,
		BoundAt:          now,
	}

	if err := s.db.WithContext(ctx).
		Where("bot_key = ? AND telegram_user_id = ?", binding.BotKey, binding.TelegramUserID).
		Assign(binding).
		FirstOrCreate(&model.TelegramBinding{}).Error; err != nil {
		return nil, err
	}

	user.TelegramUserID = &input.TelegramUserID
	if err := s.db.WithContext(ctx).Save(user).Error; err != nil {
		return nil, err
	}

	return map[string]any{
		"bot_key":           binding.BotKey,
		"user_id":           user.ID,
		"display_name":      user.DisplayName,
		"telegram_user_id":  input.TelegramUserID,
		"telegram_username": input.TelegramUsername,
		"chat_id":           input.ChatID,
		"bound_at":          now,
	}, nil
}

func (s *Service) RetryTelegramDelivery(ctx context.Context, botKey, deliveryRecordID string, meta AuditMeta) (map[string]any, error) {
	result := map[string]any{}
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var record model.DeliveryRecord
		query := tx.WithContext(ctx)
		if id, ok := parseUintRoute(deliveryRecordID); ok {
			if err := query.First(&record, id).Error; err != nil && err != gorm.ErrRecordNotFound {
				return err
			}
		}
		if record.ID == 0 {
			if err := query.Where("message_id = ?", deliveryRecordID).First(&record).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					return ErrNotFound
				}
				return err
			}
		}
		if record.DeliveryChannel != "telegram" {
			return ErrInvalidState
		}

		var order model.Order
		if err := tx.WithContext(ctx).Where("id = ?", record.OrderID).First(&order).Error; err != nil {
			return err
		}

		deliveryPayload, err := s.buildTelegramRetryPayload(ctx, tx, &order, &record, botKey)
		if err != nil {
			return err
		}

		record.DeliveryChannel = "telegram"
		record.DeliveryTarget = deliveryPayload.Target
		record.DeliveredContentMasked = deliveryPayload.MaskedContent
		record.DeliveryStatus = "sending"
		record.ErrorMessage = ""
		record.DeliveredAt = nil
		record.MessageID = ""
		if err := tx.Save(record).Error; err != nil {
			return err
		}

		sendResult, err := s.sendTelegramMessage(ctx, deliveryPayload.BotKey, deliveryPayload.Target, deliveryPayload.MessageText)
		if err != nil {
			record.DeliveryStatus = "failed"
			record.ErrorMessage = err.Error()
			if saveErr := tx.Save(&record).Error; saveErr != nil {
				return saveErr
			}

			order.DeliveryStatus = "failed"
			order.UpdatedAt = time.Now()
			if saveErr := tx.Save(&order).Error; saveErr != nil {
				return saveErr
			}
			return err
		}

		now := sendResult.SentAt
		record.DeliveryStatus = "sent"
		record.DeliveredAt = &now
		record.MessageID = sendResult.MessageID
		record.ErrorMessage = ""
		if err := tx.Save(&record).Error; err != nil {
			return err
		}

		order.Status = "completed"
		order.DeliveryStatus = "sent"
		order.DeliveredAt = &now
		order.CompletedAt = &now
		order.UpdatedAt = now
		if err := tx.Save(&order).Error; err != nil {
			return err
		}

		result = map[string]any{
			"bot_key":         deliveryPayload.BotKey,
			"record_id":       record.ID,
			"message_id":      record.MessageID,
			"delivery_status": record.DeliveryStatus,
			"delivered_at":    record.DeliveredAt,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	s.RecordAdminAction(ctx, meta, "bots", "retry_telegram_delivery", deliveryRecordID, "delivery_record", map[string]any{
		"bot_key": botKey,
	})

	return result, nil
}

func (s *Service) TestTelegramSend(ctx context.Context, botKey string, input TelegramTestSendInput, meta AuditMeta) (map[string]any, error) {
	if input.ChatID == "" || input.Message == "" {
		return nil, ErrInvalidInput
	}

	sendResult, err := s.sendTelegramMessage(ctx, botKey, input.ChatID, input.Message)
	if err != nil {
		return nil, err
	}

	result := map[string]any{
		"bot_key":    sendResult.BotKey,
		"chat_id":    sendResult.ChatID,
		"message":    input.Message,
		"message_id": sendResult.MessageID,
		"status":     "sent",
		"operator":   input.Operator,
		"sent_at":    sendResult.SentAt,
	}

	s.RecordAdminAction(ctx, meta, "bots", "telegram_test_send", botKey, "bot", result)
	return result, nil
}

func (s *Service) SimulateTelegramWebhook(
	ctx context.Context,
	botKey string,
	input TelegramWebhookSimulationInput,
	meta AuditMeta,
) (map[string]any, error) {
	if strings.TrimSpace(input.ChatID) == "" ||
		strings.TrimSpace(input.Text) == "" ||
		strings.TrimSpace(input.TelegramUserID) == "" {
		return nil, ErrInvalidInput
	}

	payload := map[string]any{
		"message": map[string]any{
			"message_id": time.Now().Unix(),
			"date":       time.Now().Unix(),
			"text":       input.Text,
			"chat": map[string]any{
				"id":       input.ChatID,
				"type":     "private",
				"username": input.Username,
			},
			"from": map[string]any{
				"id":         input.TelegramUserID,
				"is_bot":     false,
				"username":   input.Username,
				"first_name": defaultString(input.Username, "PassDock"),
			},
		},
	}

	result, err := s.HandleTelegramWebhook(ctx, botKey, payload)
	if err != nil {
		return nil, err
	}

	s.RecordAdminAction(ctx, meta, "bots", "telegram_webhook_simulation", botKey, "bot", map[string]any{
		"bot_key":          defaultString(botKey, "default"),
		"chat_id":          input.ChatID,
		"telegram_user_id": input.TelegramUserID,
		"username":         input.Username,
		"text":             input.Text,
		"operator":         input.Operator,
		"result":           result,
	})

	return result, nil
}

type telegramSendResult struct {
	BotKey    string
	ChatID    string
	MessageID string
	SentAt    time.Time
}

func (s *Service) buildTelegramRetryPayload(
	ctx context.Context,
	tx *gorm.DB,
	order *model.Order,
	record *model.DeliveryRecord,
	botKey string,
) (resolvedDeliveryPayload, error) {
	_, deliveryStrategyKey, err := s.orderStrategyKeys(order)
	if err != nil {
		return resolvedDeliveryPayload{}, err
	}

	deliveryStrategy, err := s.resolveDeliveryStrategyByRoute(ctx, deliveryStrategyKey)
	if err != nil {
		return resolvedDeliveryPayload{}, err
	}

	payload, err := s.buildDeliveryPayload(ctx, tx, order, deliveryStrategy)
	if err != nil {
		return resolvedDeliveryPayload{}, err
	}

	binding, err := s.resolveTelegramBindingForDeliveryTx(ctx, tx, record, order, defaultString(botKey, "default"))
	if err != nil {
		return resolvedDeliveryPayload{}, err
	}
	if binding != nil {
		payload.Channel = "telegram"
		payload.Target = binding.ChatID
		payload.BotKey = binding.BotKey
	}

	if strings.TrimSpace(payload.Target) == "" {
		payload.Target = strings.TrimSpace(record.DeliveryTarget)
	}
	if strings.TrimSpace(payload.BotKey) == "" {
		payload.BotKey = defaultString(botKey, "default")
	}
	if strings.TrimSpace(payload.MessageText) == "" {
		payload.MessageText = s.defaultTelegramDeliveryMessage(order.OrderNo, payload.MaskedContent)
	}
	if strings.TrimSpace(payload.Target) == "" {
		return resolvedDeliveryPayload{}, ErrNotFound
	}

	return payload, nil
}

func (s *Service) sendTelegramMessage(ctx context.Context, botKey, chatID, message string) (telegramSendResult, error) {
	return s.sendTelegramMessageWithOptions(ctx, botKey, chatID, message, telegramSendOptions{
		DisableWebPagePreview: true,
	})
}

func (s *Service) resolveTelegramCredentials(ctx context.Context, botKey string) (TelegramBotRuntimeConfig, error) {
	config, err := s.ResolveTelegramBotConfig(ctx, botKey)
	if err != nil {
		return TelegramBotRuntimeConfig{}, err
	}

	if !config.Enabled {
		return TelegramBotRuntimeConfig{}, fmt.Errorf("telegram delivery is disabled")
	}

	if strings.TrimSpace(config.BotToken) == "" {
		return TelegramBotRuntimeConfig{}, fmt.Errorf("telegram bot token is not configured")
	}

	return config, nil
}

func (s *Service) defaultTelegramDeliveryMessage(orderNo string, maskedContent string) string {
	content := strings.TrimSpace(maskedContent)
	if content == "" {
		return fmt.Sprintf("PassDock order %s is ready. Please open the website order center to view the result.", orderNo)
	}

	return fmt.Sprintf("PassDock order %s delivery result:\n%s", orderNo, content)
}

func parseWebhookMessage(payload map[string]any) map[string]string {
	result := map[string]string{}

	if message, ok := payload["message"].(map[string]any); ok {
		if text, ok := message["text"].(string); ok {
			result["text"] = text
		}
		if chat, ok := message["chat"].(map[string]any); ok {
			switch value := chat["id"].(type) {
			case string:
				result["chat_id"] = value
			case float64:
				result["chat_id"] = fmt.Sprintf("%.0f", value)
			}
			if username, ok := chat["username"].(string); ok {
				result["username"] = username
			}
		}
		if from, ok := message["from"].(map[string]any); ok {
			switch value := from["id"].(type) {
			case string:
				result["user_id"] = value
			case float64:
				result["user_id"] = fmt.Sprintf("%.0f", value)
			}
			if username, ok := from["username"].(string); ok && result["username"] == "" {
				result["username"] = username
			}
			firstName := strings.TrimSpace(stringValue(from["first_name"]))
			lastName := strings.TrimSpace(stringValue(from["last_name"]))
			result["display_name"] = strings.TrimSpace(strings.Join([]string{firstName, lastName}, " "))
		}
	}

	return result
}

func generateFallbackPassword(seed string) string {
	return "Passdock@" + defaultString(seed, "telegram")
}
