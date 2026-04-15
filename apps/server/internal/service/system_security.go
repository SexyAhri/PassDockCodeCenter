package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"gorm.io/gorm"
	"passdock/server/internal/model"
)

const telegramBotConfigModule = "telegram_bot_configs"

var telegramWebhookSecretPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,256}$`)

type TelegramBotConfigUpsertInput struct {
	BotKey             string
	BotToken           string
	WebhookSecret      string
	WebhookURL         string
	WebhookIP          string
	AllowedUpdates     []string
	MaxConnections     int
	DropPendingUpdates bool
	BotUsername        string
	Enabled            bool
}

type TelegramBotRuntimeConfig struct {
	BotKey             string
	BotToken           string
	WebhookSecret      string
	WebhookURL         string
	WebhookIP          string
	AllowedUpdates     []string
	MaxConnections     int
	DropPendingUpdates bool
	BotUsername        string
	Enabled            bool
	Source             string
}

type InternalClientKeyUpsertInput struct {
	ClientKey    string
	ClientName   string
	ClientSecret string
	Scopes       string
	AllowedIPs   string
	Status       string
}

type telegramBotConfigPayload struct {
	BotKey             string   `json:"bot_key"`
	BotToken           string   `json:"bot_token"`
	WebhookSecret      string   `json:"webhook_secret"`
	WebhookURL         string   `json:"webhook_url"`
	WebhookIP          string   `json:"webhook_ip"`
	AllowedUpdates     []string `json:"allowed_updates"`
	MaxConnections     int      `json:"max_connections"`
	DropPendingUpdates bool     `json:"drop_pending_updates"`
	BotUsername        string   `json:"bot_username"`
	Enabled            bool     `json:"enabled"`
}

func (s *Service) ListAdminTelegramConfigs(ctx context.Context) ([]map[string]any, error) {
	var settings []model.RuntimeSetting
	if err := s.db.WithContext(ctx).
		Where("module = ?", telegramBotConfigModule).
		Order("name ASC, id ASC").
		Find(&settings).Error; err != nil {
		return nil, err
	}

	items := make([]map[string]any, 0, len(settings)+1)
	seenBotKeys := make(map[string]struct{}, len(settings))
	for _, setting := range settings {
		config := parseTelegramBotConfigPayload(setting)
		seenBotKeys[config.BotKey] = struct{}{}
		items = append(items, map[string]any{
			"id":                   setting.ID,
			"key":                  config.BotKey,
			"bot_key":              config.BotKey,
			"bot_username":         config.BotUsername,
			"bot_token":            config.BotToken,
			"bot_token_masked":     maskValue(config.BotToken, 6),
			"webhook_secret":       config.WebhookSecret,
			"webhook_masked":       maskValue(config.WebhookSecret, 6),
			"webhook_url":          config.WebhookURL,
			"webhook_url_resolved": s.telegramWebhookResolvedURL(config.BotKey, config.WebhookURL),
			"webhook_ip":           config.WebhookIP,
			"allowed_updates":      append([]string{}, config.AllowedUpdates...),
			"max_connections":      config.MaxConnections,
			"drop_pending_updates": config.DropPendingUpdates,
			"enabled":              config.Enabled,
			"source":               "db",
		})
	}

	config := s.buildStaticTelegramBotConfig("")
	if telegramBotConfigLooksConfigured(config) {
		if _, exists := seenBotKeys[config.BotKey]; !exists {
			items = append(items, map[string]any{
				"key":                  config.BotKey,
				"bot_key":              config.BotKey,
				"bot_username":         config.BotUsername,
				"bot_token":            config.BotToken,
				"bot_token_masked":     maskValue(config.BotToken, 6),
				"webhook_secret":       config.WebhookSecret,
				"webhook_masked":       maskValue(config.WebhookSecret, 6),
				"webhook_url":          config.WebhookURL,
				"webhook_url_resolved": s.telegramWebhookResolvedURL(config.BotKey, config.WebhookURL),
				"webhook_ip":           config.WebhookIP,
				"allowed_updates":      append([]string{}, config.AllowedUpdates...),
				"max_connections":      config.MaxConnections,
				"drop_pending_updates": config.DropPendingUpdates,
				"enabled":              config.Enabled,
				"source":               "config",
			})
		}
	}

	return items, nil
}

func (s *Service) UpsertAdminTelegramConfig(ctx context.Context, routeID string, input TelegramBotConfigUpsertInput) error {
	botKey := normalizeTelegramBotKey(input.BotKey)
	if botKey == "" {
		return ErrInvalidInput
	}
	if err := validateTelegramWebhookSecret(strings.TrimSpace(input.WebhookSecret)); err != nil {
		return err
	}

	payload, err := json.Marshal(telegramBotConfigPayload{
		BotKey:             botKey,
		BotToken:           strings.TrimSpace(input.BotToken),
		WebhookSecret:      strings.TrimSpace(input.WebhookSecret),
		WebhookURL:         strings.TrimSpace(input.WebhookURL),
		WebhookIP:          strings.TrimSpace(input.WebhookIP),
		AllowedUpdates:     normalizeDelimitedList(input.AllowedUpdates),
		MaxConnections:     normalizeTelegramWebhookMaxConnections(input.MaxConnections),
		DropPendingUpdates: input.DropPendingUpdates,
		BotUsername:        strings.TrimSpace(input.BotUsername),
		Enabled:            input.Enabled,
	})
	if err != nil {
		return err
	}

	record := model.RuntimeSetting{
		Module: telegramBotConfigModule,
		Name:   telegramBotConfigSettingName(botKey),
		Value:  string(payload),
		Scope:  "db",
	}

	if routeID == "" {
		return s.db.WithContext(ctx).Create(&record).Error
	}

	existing, err := s.resolveTelegramBotConfigSetting(ctx, routeID)
	if err != nil {
		if err == ErrNotFound && normalizeTelegramBotKey(routeID) == botKey {
			return s.db.WithContext(ctx).Create(&record).Error
		}
		return err
	}

	return s.db.WithContext(ctx).Model(existing).Updates(record).Error
}

func (s *Service) DeleteAdminTelegramConfig(ctx context.Context, routeID string) error {
	record, err := s.resolveTelegramBotConfigSetting(ctx, routeID)
	if err != nil {
		if err == ErrNotFound && normalizeTelegramBotKey(routeID) == normalizeTelegramBotKey(s.cfg.TelegramBotKey) {
			return nil
		}
		return err
	}

	return s.db.WithContext(ctx).Delete(record).Error
}

func (s *Service) ResolveTelegramBotConfig(ctx context.Context, botKey string) (TelegramBotRuntimeConfig, error) {
	resolvedBotKey := normalizeTelegramBotKey(botKey)
	if resolvedBotKey == "" {
		resolvedBotKey = "default"
	}

	if record, err := s.resolveTelegramBotConfigSetting(ctx, resolvedBotKey); err == nil {
		config := parseTelegramBotConfigPayload(*record)
		config.Source = "db"
		return config, nil
	} else if err != ErrNotFound {
		return TelegramBotRuntimeConfig{}, err
	}

	return s.buildStaticTelegramBotConfig(resolvedBotKey), nil
}

func (s *Service) ListAdminInternalClientKeys(ctx context.Context) ([]map[string]any, error) {
	var items []model.InternalClientKey
	if err := s.db.WithContext(ctx).Order("created_at DESC, id DESC").Find(&items).Error; err != nil {
		return nil, err
	}

	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		secret, _ := s.decryptString(item.ClientSecretEncrypted)
		status := normalizeInternalClientStatus(item.Status)
		result = append(result, map[string]any{
			"id":                   item.ID,
			"key":                  item.ClientKey,
			"client_key":           item.ClientKey,
			"client_name":          item.ClientName,
			"client_secret":        secret,
			"client_secret_masked": maskValue(secret, 6),
			"scopes":               strings.TrimSpace(item.Scopes),
			"allowed_ips":          strings.TrimSpace(item.AllowedIPs),
			"status":               status,
			"enabled":              status == "active",
		})
	}

	return result, nil
}

func (s *Service) UpsertAdminInternalClientKey(ctx context.Context, routeID string, input InternalClientKeyUpsertInput) error {
	clientKey := strings.TrimSpace(input.ClientKey)
	clientName := strings.TrimSpace(input.ClientName)
	if clientKey == "" || clientName == "" {
		return ErrInvalidInput
	}

	status := normalizeInternalClientStatus(input.Status)

	if routeID == "" && strings.TrimSpace(input.ClientSecret) == "" {
		return ErrInvalidInput
	}

	record := model.InternalClientKey{
		ClientKey:  clientKey,
		ClientName: clientName,
		Scopes:     normalizeDelimitedText(input.Scopes),
		AllowedIPs: normalizeDelimitedText(input.AllowedIPs),
		Status:     status,
	}

	if routeID == "" {
		encrypted, err := s.encryptString(strings.TrimSpace(input.ClientSecret))
		if err != nil {
			return err
		}
		record.ClientSecretEncrypted = encrypted
		return s.db.WithContext(ctx).Create(&record).Error
	}

	existing, err := s.resolveInternalClientKeyByRoute(ctx, routeID)
	if err != nil {
		if err == ErrNotFound && strings.TrimSpace(routeID) == clientKey {
			if strings.TrimSpace(input.ClientSecret) == "" {
				return ErrInvalidInput
			}
			encrypted, encryptErr := s.encryptString(strings.TrimSpace(input.ClientSecret))
			if encryptErr != nil {
				return encryptErr
			}
			record.ClientSecretEncrypted = encrypted
			return s.db.WithContext(ctx).Create(&record).Error
		}
		return err
	}

	record.ClientSecretEncrypted = existing.ClientSecretEncrypted
	if secret := strings.TrimSpace(input.ClientSecret); secret != "" {
		encrypted, err := s.encryptString(secret)
		if err != nil {
			return err
		}
		record.ClientSecretEncrypted = encrypted
	}

	return s.db.WithContext(ctx).Model(existing).Updates(record).Error
}

func (s *Service) DeleteAdminInternalClientKey(ctx context.Context, routeID string) error {
	record, err := s.resolveInternalClientKeyByRoute(ctx, routeID)
	if err != nil {
		return err
	}

	return s.db.WithContext(ctx).Delete(record).Error
}

func (s *Service) resolveTelegramBotConfigSetting(ctx context.Context, botKey string) (*model.RuntimeSetting, error) {
	var record model.RuntimeSetting
	if err := s.db.WithContext(ctx).
		Where("module = ? AND name = ?", telegramBotConfigModule, telegramBotConfigSettingName(botKey)).
		First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &record, nil
}

func parseTelegramBotConfigPayload(setting model.RuntimeSetting) TelegramBotRuntimeConfig {
	var payload telegramBotConfigPayload
	_ = json.Unmarshal([]byte(setting.Value), &payload)

	botKey := normalizeTelegramBotKey(payload.BotKey)
	if botKey == "" {
		botKey = normalizeTelegramBotKey(strings.TrimPrefix(setting.Name, "telegram.bot."))
	}
	if botKey == "" {
		botKey = "default"
	}

	return TelegramBotRuntimeConfig{
		BotKey:             botKey,
		BotToken:           strings.TrimSpace(payload.BotToken),
		WebhookSecret:      strings.TrimSpace(payload.WebhookSecret),
		WebhookURL:         strings.TrimSpace(payload.WebhookURL),
		WebhookIP:          strings.TrimSpace(payload.WebhookIP),
		AllowedUpdates:     normalizeDelimitedList(payload.AllowedUpdates),
		MaxConnections:     normalizeTelegramWebhookMaxConnections(payload.MaxConnections),
		DropPendingUpdates: payload.DropPendingUpdates,
		BotUsername:        strings.TrimSpace(payload.BotUsername),
		Enabled:            payload.Enabled,
	}
}

func (s *Service) buildStaticTelegramBotConfig(botKey string) TelegramBotRuntimeConfig {
	configuredKey := normalizeTelegramBotKey(s.cfg.TelegramBotKey)
	if configuredKey == "" {
		configuredKey = "default"
	}

	resolvedBotKey := normalizeTelegramBotKey(botKey)
	if resolvedBotKey == "" {
		resolvedBotKey = configuredKey
	}

	config := TelegramBotRuntimeConfig{
		BotKey: resolvedBotKey,
		Source: "config",
	}

	if resolvedBotKey != configuredKey {
		return config
	}

	config.BotToken = strings.TrimSpace(s.cfg.TelegramBotToken)
	config.WebhookSecret = strings.TrimSpace(s.cfg.TelegramWebhookSecret)
	config.WebhookURL = strings.TrimSpace(s.cfg.TelegramWebhookURL)
	config.WebhookIP = strings.TrimSpace(s.cfg.TelegramWebhookIP)
	config.AllowedUpdates = normalizeDelimitedList(s.cfg.TelegramAllowedUpdates)
	config.MaxConnections = normalizeTelegramWebhookMaxConnections(s.cfg.TelegramMaxConnections)
	config.DropPendingUpdates = s.cfg.TelegramDropPendingUpdates
	config.BotUsername = strings.TrimSpace(s.cfg.TelegramBotUsername)
	config.Enabled = s.cfg.TelegramEnabled
	return config
}

func normalizeTelegramBotKey(value string) string {
	text := strings.TrimSpace(value)
	if text == "" {
		return ""
	}
	return text
}

func telegramBotConfigLooksConfigured(config TelegramBotRuntimeConfig) bool {
	return config.Enabled ||
		strings.TrimSpace(config.BotToken) != "" ||
		strings.TrimSpace(config.WebhookSecret) != "" ||
		strings.TrimSpace(config.WebhookURL) != "" ||
		strings.TrimSpace(config.WebhookIP) != "" ||
		len(config.AllowedUpdates) > 0 ||
		strings.TrimSpace(config.BotUsername) != ""
}

func telegramBotConfigSettingName(botKey string) string {
	return "telegram.bot." + defaultString(normalizeTelegramBotKey(botKey), "default")
}

func normalizeInternalClientStatus(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "disabled":
		return "disabled"
	case "revoked":
		return "revoked"
	default:
		return "active"
	}
}

func normalizeDelimitedText(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}

	lines := strings.FieldsFunc(trimmed, func(r rune) bool {
		return r == ',' || r == '\n' || r == '\r' || r == ';'
	})
	result := make([]string, 0, len(lines))
	seen := map[string]struct{}{}
	for _, line := range lines {
		item := strings.TrimSpace(line)
		if item == "" {
			continue
		}
		if _, exists := seen[item]; exists {
			continue
		}
		seen[item] = struct{}{}
		result = append(result, item)
	}

	return strings.Join(result, ",")
}

func normalizeDelimitedList(values []string) []string {
	if len(values) == 0 {
		return nil
	}

	result := make([]string, 0, len(values))
	seen := map[string]struct{}{}
	for _, value := range values {
		item := strings.TrimSpace(value)
		if item == "" {
			continue
		}
		if _, exists := seen[item]; exists {
			continue
		}
		seen[item] = struct{}{}
		result = append(result, item)
	}

	if len(result) == 0 {
		return nil
	}

	return result
}

func normalizeTelegramWebhookMaxConnections(value int) int {
	switch {
	case value <= 0:
		return 40
	case value > 100:
		return 100
	default:
		return value
	}
}

func validateTelegramWebhookSecret(value string) error {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	if telegramWebhookSecretPattern.MatchString(trimmed) {
		return nil
	}

	return fmt.Errorf("telegram webhook secret must be 1-256 chars and only contain letters, numbers, underscores, or hyphens")
}
