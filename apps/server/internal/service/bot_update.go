package service

import (
	"fmt"
	"strings"
)

type telegramWebhookEvent struct {
	EventType        string
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
}

type telegramMediaAttachment struct {
	Kind        string
	FileID      string
	FileName    string
	ContentType string
	FileSize    int64
}

func parseTelegramWebhookEvent(payload map[string]any) telegramWebhookEvent {
	if callback, ok := payload["callback_query"].(map[string]any); ok {
		return parseTelegramCallbackEvent(callback)
	}
	if message, ok := payload["message"].(map[string]any); ok {
		return parseTelegramMessageEvent("message", message)
	}
	if message, ok := payload["edited_message"].(map[string]any); ok {
		return parseTelegramMessageEvent("edited_message", message)
	}

	return telegramWebhookEvent{}
}

func parseTelegramCallbackEvent(callback map[string]any) telegramWebhookEvent {
	event := telegramWebhookEvent{
		EventType:       "callback_query",
		CallbackQueryID: strings.TrimSpace(stringValue(callback["id"])),
		CallbackData:    strings.TrimSpace(stringValue(callback["data"])),
	}

	if message, ok := callback["message"].(map[string]any); ok {
		messageEvent := parseTelegramMessageEvent("callback_message", message)
		event.ChatID = messageEvent.ChatID
		event.MessageID = messageEvent.MessageID
		event.MessageText = messageEvent.MessageText
	}

	if from, ok := callback["from"].(map[string]any); ok {
		event.TelegramUserID = telegramWebhookNumericString(from["id"])
		event.Username = normalizeTelegramUsername(stringValue(from["username"]))
		event.DisplayName = buildTelegramDisplayName(from)
	}

	return event
}

func parseTelegramMessageEvent(eventType string, message map[string]any) telegramWebhookEvent {
	event := telegramWebhookEvent{
		EventType: eventType,
		MessageID: telegramWebhookNumericString(message["message_id"]),
	}

	if chat, ok := message["chat"].(map[string]any); ok {
		event.ChatID = telegramWebhookNumericString(chat["id"])
		if event.Username == "" {
			event.Username = normalizeTelegramUsername(stringValue(chat["username"]))
		}
	}

	if from, ok := message["from"].(map[string]any); ok {
		event.TelegramUserID = telegramWebhookNumericString(from["id"])
		if event.Username == "" {
			event.Username = normalizeTelegramUsername(stringValue(from["username"]))
		}
		event.DisplayName = buildTelegramDisplayName(from)
	}

	text := strings.TrimSpace(stringValue(message["text"]))
	caption := strings.TrimSpace(stringValue(message["caption"]))
	event.MessageText = firstNonEmpty(text, caption)

	if replyTo, ok := message["reply_to_message"].(map[string]any); ok {
		event.ReplyToMessage = firstNonEmpty(
			strings.TrimSpace(stringValue(replyTo["text"])),
			strings.TrimSpace(stringValue(replyTo["caption"])),
		)
		event.ReplyToMessageID = telegramWebhookNumericString(replyTo["message_id"])
	}

	event.Media = parseTelegramMessageMedia(message)
	return event
}

func parseTelegramMessageMedia(message map[string]any) *telegramMediaAttachment {
	if photos, ok := message["photo"].([]any); ok && len(photos) > 0 {
		var selected map[string]any
		for _, item := range photos {
			photo, ok := item.(map[string]any)
			if !ok {
				continue
			}
			if selected == nil || telegramWebhookInt64(photo["file_size"]) >= telegramWebhookInt64(selected["file_size"]) {
				selected = photo
			}
		}
		if selected != nil {
			return &telegramMediaAttachment{
				Kind:        "photo",
				FileID:      strings.TrimSpace(stringValue(selected["file_id"])),
				ContentType: "image/jpeg",
				FileSize:    telegramWebhookInt64(selected["file_size"]),
			}
		}
	}

	if document, ok := message["document"].(map[string]any); ok {
		return &telegramMediaAttachment{
			Kind:        "document",
			FileID:      strings.TrimSpace(stringValue(document["file_id"])),
			FileName:    strings.TrimSpace(stringValue(document["file_name"])),
			ContentType: strings.TrimSpace(stringValue(document["mime_type"])),
			FileSize:    telegramWebhookInt64(document["file_size"]),
		}
	}

	return nil
}

func telegramWebhookNumericString(value any) string {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case float64:
		return fmt.Sprintf("%.0f", typed)
	case float32:
		return fmt.Sprintf("%.0f", typed)
	case int:
		return fmt.Sprintf("%d", typed)
	case int64:
		return fmt.Sprintf("%d", typed)
	case uint:
		return fmt.Sprintf("%d", typed)
	case uint64:
		return fmt.Sprintf("%d", typed)
	default:
		return ""
	}
}

func telegramWebhookInt64(value any) int64 {
	switch typed := value.(type) {
	case int:
		return int64(typed)
	case int64:
		return typed
	case float64:
		return int64(typed)
	case float32:
		return int64(typed)
	default:
		return 0
	}
}

func buildTelegramDisplayName(values map[string]any) string {
	firstName := strings.TrimSpace(stringValue(values["first_name"]))
	lastName := strings.TrimSpace(stringValue(values["last_name"]))
	return strings.TrimSpace(strings.Join([]string{firstName, lastName}, " "))
}
