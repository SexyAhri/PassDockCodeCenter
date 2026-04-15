package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"passdock/server/internal/config"
	"passdock/server/internal/database"
)

func TestAuthenticateInternalClientRequestSupportsBootstrapConfig(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{
		InternalSignKey:    "passdock-bootstrap",
		InternalSignSecret: "bootstrap-secret",
	})

	body := []byte(`{"dry_run":true}`)
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	nonce := "bootstrap-nonce"
	path := "/internal/v1/orders/PD202604140001/sync"
	signature := signInternalRequest(http.MethodPost, path, timestamp, nonce, body, "bootstrap-secret")

	request := httptest.NewRequest(http.MethodPost, path, strings.NewReader(string(body)))
	request.Header.Set("X-PassDock-Key", "passdock-bootstrap")
	request.Header.Set("X-PassDock-Timestamp", timestamp)
	request.Header.Set("X-PassDock-Nonce", nonce)
	request.Header.Set("X-PassDock-Sign", signature)

	identity, err := svc.AuthenticateInternalClientRequest(
		context.Background(),
		request,
		"127.0.0.1",
		body,
		"orders.read",
	)
	if err != nil {
		t.Fatalf("AuthenticateInternalClientRequest returned error: %v", err)
	}
	if identity == nil {
		t.Fatalf("expected internal client identity")
	}
	if identity.ClientKey != "passdock-bootstrap" {
		t.Fatalf("expected bootstrap client key, got %q", identity.ClientKey)
	}
	if !internalClientAllowsScope(identity.Scopes, "orders.read") {
		t.Fatalf("expected bootstrap scopes to allow orders.read")
	}
}

func TestListAdminTelegramConfigsKeepsConfigSourceVisible(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{
		TelegramEnabled:       true,
		TelegramBotKey:        "default",
		TelegramBotToken:      "default-token",
		TelegramWebhookSecret: "default-webhook",
		TelegramBotUsername:   "passdock_bot",
	})

	err := svc.UpsertAdminTelegramConfig(context.Background(), "", TelegramBotConfigUpsertInput{
		BotKey:        "ops",
		BotToken:      "ops-token",
		WebhookSecret: "ops-webhook",
		BotUsername:   "ops_bot",
		Enabled:       true,
	})
	if err != nil {
		t.Fatalf("UpsertAdminTelegramConfig returned error: %v", err)
	}

	items, err := svc.ListAdminTelegramConfigs(context.Background())
	if err != nil {
		t.Fatalf("ListAdminTelegramConfigs returned error: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 telegram configs, got %d", len(items))
	}

	var foundDefault bool
	for _, item := range items {
		if item["bot_key"] == "default" && item["source"] == "config" {
			foundDefault = true
			break
		}
	}
	if !foundDefault {
		t.Fatalf("expected config-backed default telegram bot to remain visible")
	}
}

func TestUpsertAdminInternalClientKeyCreatesRecordWhenRouteMatchesBootstrapKey(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{
		InternalSignKey:    "passdock-system",
		InternalSignSecret: "bootstrap-secret",
	})

	err := svc.UpsertAdminInternalClientKey(context.Background(), "passdock-system", InternalClientKeyUpsertInput{
		ClientKey:    "passdock-system",
		ClientName:   "PassDock system override",
		ClientSecret: "override-secret",
		Scopes:       "orders.read,integrations.execute",
		AllowedIPs:   "127.0.0.1",
		Status:       "active",
	})
	if err != nil {
		t.Fatalf("UpsertAdminInternalClientKey returned error: %v", err)
	}

	record, err := svc.resolveInternalClientKeyByRoute(context.Background(), "passdock-system")
	if err != nil {
		t.Fatalf("resolveInternalClientKeyByRoute returned error: %v", err)
	}
	secret, err := svc.decryptString(record.ClientSecretEncrypted)
	if err != nil {
		t.Fatalf("decryptString returned error: %v", err)
	}
	if secret != "override-secret" {
		t.Fatalf("expected override secret, got %q", secret)
	}
}

func TestUpsertAdminTelegramConfigRejectsInvalidWebhookSecret(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{})

	err := svc.UpsertAdminTelegramConfig(context.Background(), "", TelegramBotConfigUpsertInput{
		BotKey:        "ops",
		BotToken:      "ops-token",
		WebhookSecret: "invalid secret with spaces",
		Enabled:       true,
	})
	if err == nil {
		t.Fatalf("expected invalid webhook secret to be rejected")
	}
}

func TestResolveTelegramBotAPIConfigRejectsInvalidWebhookSecretFromBootstrapConfig(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{
		TelegramEnabled:       true,
		TelegramBotKey:        "default",
		TelegramBotToken:      "default-token",
		TelegramWebhookSecret: "invalid secret with spaces",
	})

	_, err := svc.resolveTelegramBotAPIConfig(context.Background(), "default")
	if err == nil {
		t.Fatalf("expected invalid bootstrap webhook secret to be rejected")
	}
}

func newSystemSecurityTestService(t *testing.T, partial config.Config) *Service {
	t.Helper()

	cfg := config.Config{
		AppEnv:                 partial.AppEnv,
		DBDriver:               "sqlite",
		SQLitePath:             filepath.Join(t.TempDir(), "passdock-test.db"),
		SessionSecret:          "test-session-secret",
		InternalSignKey:        "passdock-system",
		InternalSignSecret:     "test-internal-secret",
		TelegramBotKey:         "default",
		BootstrapReferenceData: partial.BootstrapReferenceData,
		SeedSampleBusinessData: partial.SeedSampleBusinessData,
	}
	if strings.TrimSpace(partial.InternalSignKey) != "" {
		cfg.InternalSignKey = partial.InternalSignKey
	}
	if strings.TrimSpace(partial.InternalSignSecret) != "" {
		cfg.InternalSignSecret = partial.InternalSignSecret
	}
	if strings.TrimSpace(partial.TelegramBotKey) != "" {
		cfg.TelegramBotKey = partial.TelegramBotKey
	}
	cfg.TelegramEnabled = partial.TelegramEnabled
	cfg.TelegramBotToken = partial.TelegramBotToken
	cfg.TelegramWebhookSecret = partial.TelegramWebhookSecret
	cfg.TelegramBotUsername = partial.TelegramBotUsername
	cfg.NewAPIProdBaseURL = partial.NewAPIProdBaseURL
	cfg.NewAPIProdKeyID = partial.NewAPIProdKeyID
	cfg.NewAPIProdSecret = partial.NewAPIProdSecret
	cfg.NewAPIProdTimeoutMS = partial.NewAPIProdTimeoutMS
	cfg.NewAPIProdRetryTimes = partial.NewAPIProdRetryTimes
	cfg.NewAPIStagingBaseURL = partial.NewAPIStagingBaseURL
	cfg.NewAPIStagingKeyID = partial.NewAPIStagingKeyID
	cfg.NewAPIStagingSecret = partial.NewAPIStagingSecret
	cfg.NewAPIStagingTimeoutMS = partial.NewAPIStagingTimeoutMS
	cfg.NewAPIStagingRetryTimes = partial.NewAPIStagingRetryTimes
	cfg.AsyncConcurrency = partial.AsyncConcurrency
	cfg.AsyncPollIntervalSeconds = partial.AsyncPollIntervalSeconds
	cfg.DeliveryRetryMaxRetries = partial.DeliveryRetryMaxRetries
	cfg.DeliveryRetryDelaySeconds = partial.DeliveryRetryDelaySeconds
	cfg.OKXWatcherEnabled = partial.OKXWatcherEnabled
	cfg.OKXWatcherAPIURL = partial.OKXWatcherAPIURL
	cfg.OKXWatcherAPIToken = partial.OKXWatcherAPIToken
	cfg.OKXWatcherTimeoutMS = partial.OKXWatcherTimeoutMS
	cfg.OKXWatcherIntervalSeconds = partial.OKXWatcherIntervalSeconds
	cfg.OKXWatcherBatchSize = partial.OKXWatcherBatchSize

	db, err := database.Open(cfg)
	if err != nil {
		t.Fatalf("database.Open returned error: %v", err)
	}
	if err := database.AutoMigrate(db); err != nil {
		t.Fatalf("database.AutoMigrate returned error: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("db.DB returned error: %v", err)
	}
	t.Cleanup(func() {
		_ = sqlDB.Close()
	})

	return New(cfg, db)
}

func signInternalRequest(method string, path string, timestamp string, nonce string, body []byte, secret string) string {
	bodyHash := sha256.Sum256(body)
	source := strings.Join([]string{
		strings.ToUpper(strings.TrimSpace(method)),
		path,
		timestamp,
		nonce,
		hex.EncodeToString(bodyHash[:]),
	}, "\n")

	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(source))
	return hex.EncodeToString(mac.Sum(nil))
}
