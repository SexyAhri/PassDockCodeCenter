package service

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"
)

func (s *Service) GetAdminTelegramWebhookSetup(ctx context.Context, botKey string) (map[string]any, error) {
	config, err := s.ResolveTelegramBotConfig(ctx, botKey)
	if err != nil {
		return nil, err
	}

	resolvedBotKey := defaultString(normalizeTelegramBotKey(config.BotKey), "default")
	resolvedURL := s.telegramWebhookResolvedURL(resolvedBotKey, config.WebhookURL)

	return map[string]any{
		"bot_key":                resolvedBotKey,
		"enabled":                config.Enabled,
		"source":                 config.Source,
		"bot_username":           config.BotUsername,
		"bot_token_masked":       maskValue(config.BotToken, 6),
		"webhook_url":            config.WebhookURL,
		"webhook_url_resolved":   resolvedURL,
		"webhook_path":           s.telegramWebhookPath(resolvedBotKey),
		"webhook_secret_masked":  maskValue(config.WebhookSecret, 6),
		"webhook_secret_header":  "X-Telegram-Bot-Api-Secret-Token",
		"webhook_ip":             config.WebhookIP,
		"allowed_updates":        append([]string{}, config.AllowedUpdates...),
		"max_connections":        config.MaxConnections,
		"drop_pending_updates":   config.DropPendingUpdates,
		"requires_app_base_url":  strings.TrimSpace(config.WebhookURL) == "",
		"token_configured":       strings.TrimSpace(config.BotToken) != "",
		"webhook_secret_present": strings.TrimSpace(config.WebhookSecret) != "",
	}, nil
}

func (s *Service) GetAdminTelegramWebhookInfo(ctx context.Context, botKey string) (map[string]any, error) {
	config, err := s.resolveTelegramBotAPIConfig(ctx, botKey)
	if err != nil {
		return nil, err
	}

	var envelope struct {
		OK          bool   `json:"ok"`
		Description string `json:"description"`
		Result      struct {
			URL                          string   `json:"url"`
			HasCustomCertificate         bool     `json:"has_custom_certificate"`
			PendingUpdateCount           int64    `json:"pending_update_count"`
			IPAddress                    string   `json:"ip_address"`
			LastErrorDate                int64    `json:"last_error_date"`
			LastErrorMessage             string   `json:"last_error_message"`
			LastSynchronizationErrorDate int64    `json:"last_synchronization_error_date"`
			MaxConnections               int      `json:"max_connections"`
			AllowedUpdates               []string `json:"allowed_updates"`
		} `json:"result"`
	}
	if err := s.telegramAPIJSONRequest(ctx, config, "getWebhookInfo", map[string]any{}, &envelope); err != nil {
		return nil, err
	}

	return map[string]any{
		"bot_key":                         config.BotKey,
		"url":                             strings.TrimSpace(envelope.Result.URL),
		"has_custom_certificate":          envelope.Result.HasCustomCertificate,
		"pending_update_count":            envelope.Result.PendingUpdateCount,
		"ip_address":                      strings.TrimSpace(envelope.Result.IPAddress),
		"last_error_date":                 telegramUnixTimePointer(envelope.Result.LastErrorDate),
		"last_error_message":              strings.TrimSpace(envelope.Result.LastErrorMessage),
		"last_synchronization_error_date": telegramUnixTimePointer(envelope.Result.LastSynchronizationErrorDate),
		"max_connections":                 envelope.Result.MaxConnections,
		"allowed_updates":                 append([]string{}, envelope.Result.AllowedUpdates...),
		"expected_webhook_url":            s.telegramWebhookResolvedURL(config.BotKey, config.WebhookURL),
		"expected_secret_header":          "X-Telegram-Bot-Api-Secret-Token",
	}, nil
}

func (s *Service) SyncAdminTelegramWebhook(ctx context.Context, botKey string) (map[string]any, error) {
	config, err := s.resolveTelegramBotAPIConfig(ctx, botKey)
	if err != nil {
		return nil, err
	}

	resolvedURL := s.telegramWebhookResolvedURL(config.BotKey, config.WebhookURL)
	if strings.TrimSpace(resolvedURL) == "" {
		return nil, ErrInvalidInput
	}

	payload := map[string]any{
		"url": resolvedURL,
	}
	if strings.TrimSpace(config.WebhookSecret) != "" {
		payload["secret_token"] = strings.TrimSpace(config.WebhookSecret)
	}
	if strings.TrimSpace(config.WebhookIP) != "" {
		payload["ip_address"] = strings.TrimSpace(config.WebhookIP)
	}
	if len(config.AllowedUpdates) > 0 {
		payload["allowed_updates"] = append([]string{}, config.AllowedUpdates...)
	}
	if config.MaxConnections > 0 {
		payload["max_connections"] = config.MaxConnections
	}
	if config.DropPendingUpdates {
		payload["drop_pending_updates"] = true
	}

	var envelope struct {
		OK          bool   `json:"ok"`
		Result      bool   `json:"result"`
		Description string `json:"description"`
	}
	if err := s.telegramAPIJSONRequest(ctx, config, "setWebhook", payload, &envelope); err != nil {
		return nil, err
	}

	return map[string]any{
		"bot_key":              config.BotKey,
		"set":                  envelope.Result,
		"url":                  resolvedURL,
		"secret_header":        "X-Telegram-Bot-Api-Secret-Token",
		"allowed_updates":      append([]string{}, config.AllowedUpdates...),
		"max_connections":      config.MaxConnections,
		"drop_pending_updates": config.DropPendingUpdates,
	}, nil
}

func (s *Service) DeleteAdminTelegramWebhook(ctx context.Context, botKey string, dropPendingUpdates bool) (map[string]any, error) {
	config, err := s.resolveTelegramBotAPIConfig(ctx, botKey)
	if err != nil {
		return nil, err
	}

	payload := map[string]any{}
	if dropPendingUpdates {
		payload["drop_pending_updates"] = true
	}

	var envelope struct {
		OK          bool   `json:"ok"`
		Result      bool   `json:"result"`
		Description string `json:"description"`
	}
	if err := s.telegramAPIJSONRequest(ctx, config, "deleteWebhook", payload, &envelope); err != nil {
		return nil, err
	}

	return map[string]any{
		"bot_key":              config.BotKey,
		"deleted":              envelope.Result,
		"drop_pending_updates": dropPendingUpdates,
	}, nil
}

func (s *Service) resolveTelegramBotAPIConfig(ctx context.Context, botKey string) (TelegramBotRuntimeConfig, error) {
	config, err := s.ResolveTelegramBotConfig(ctx, botKey)
	if err != nil {
		return TelegramBotRuntimeConfig{}, err
	}
	if strings.TrimSpace(config.BotToken) == "" {
		return TelegramBotRuntimeConfig{}, fmt.Errorf("telegram bot token is not configured")
	}
	if err := validateTelegramWebhookSecret(strings.TrimSpace(config.WebhookSecret)); err != nil {
		return TelegramBotRuntimeConfig{}, err
	}

	config.BotKey = defaultString(normalizeTelegramBotKey(config.BotKey), "default")
	return config, nil
}

func (s *Service) telegramWebhookResolvedURL(botKey string, explicitURL string) string {
	if strings.TrimSpace(explicitURL) != "" {
		return strings.TrimSpace(explicitURL)
	}

	baseURL := strings.TrimRight(strings.TrimSpace(s.cfg.AppBaseURL), "/")
	if baseURL == "" {
		return ""
	}

	return baseURL + s.telegramWebhookPath(botKey)
}

func (s *Service) telegramWebhookPath(botKey string) string {
	return fmt.Sprintf("/api/v1/bots/%s/telegram/webhook", url.PathEscape(defaultString(normalizeTelegramBotKey(botKey), "default")))
}

func telegramUnixTimePointer(value int64) *time.Time {
	if value <= 0 {
		return nil
	}

	timeValue := time.Unix(value, 0).UTC()
	return &timeValue
}
