package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	AppName                    string
	AppEnv                     string
	AppPort                    string
	AppBaseURL                 string
	AppTimezone                string
	LogLevel                   string
	BootstrapReferenceData     string
	SeedSampleBusinessData     string
	DBDriver                   string
	SQLitePath                 string
	PostgresDSN                string
	SessionSecret              string
	InternalSignKey            string
	InternalSignSecret         string
	TelegramEnabled            bool
	TelegramBotKey             string
	TelegramBotToken           string
	TelegramWebhookSecret      string
	TelegramWebhookURL         string
	TelegramWebhookIP          string
	TelegramAllowedUpdates     []string
	TelegramMaxConnections     int
	TelegramDropPendingUpdates bool
	TelegramBotUsername        string
	CORSAllowOrigins           []string
	StorageType                string
	StorageLocalPath           string
	StoragePublicPath          string
	MinIOEndpoint              string
	MinIOAccessKey             string
	MinIOSecretKey             string
	MinIOBucket                string
	MinIORegion                string
	MinIOUseSSL                bool
	UploadMaxFileSizeMB        int
	OrderExpireMinutes         int
	PaymentReviewTimeout       int
	OrderSweepIntervalSeconds  int
	AsyncConcurrency           int
	AsyncPollIntervalSeconds   int
	DeliveryRetryMaxRetries    int
	DeliveryRetryDelaySeconds  int
	OKXWatcherEnabled          bool
	OKXWatcherAPIURL           string
	OKXWatcherAPIToken         string
	OKXWatcherTimeoutMS        int
	OKXWatcherIntervalSeconds  int
	OKXWatcherBatchSize        int
	OKXAdapterChain            string
	OKXAdapterReceiveAddress   string
	AdminBearerToken           string
	NewAPIProdBaseURL          string
	NewAPIProdKeyID            string
	NewAPIProdSecret           string
	NewAPIProdTimeoutMS        int
	NewAPIProdRetryTimes       int
	NewAPIStagingBaseURL       string
	NewAPIStagingKeyID         string
	NewAPIStagingSecret        string
	NewAPIStagingTimeoutMS     int
	NewAPIStagingRetryTimes    int
}

func Load() Config {
	return Config{
		AppName:                    getEnv("APP_NAME", "PassDock"),
		AppEnv:                     getEnv("APP_ENV", "development"),
		AppPort:                    getEnv("APP_PORT", "8080"),
		AppBaseURL:                 getEnv("APP_BASE_URL", "http://localhost:8080"),
		AppTimezone:                getEnv("APP_TIMEZONE", "Asia/Shanghai"),
		LogLevel:                   getEnv("APP_LOG_LEVEL", "info"),
		BootstrapReferenceData:     getEnv("BOOTSTRAP_REFERENCE_DATA", ""),
		SeedSampleBusinessData:     getEnv("SEED_SAMPLE_BUSINESS_DATA", ""),
		DBDriver:                   getEnv("DB_DRIVER", "sqlite"),
		SQLitePath:                 getEnv("SQLITE_PATH", "./data/passdock.db"),
		PostgresDSN:                getEnv("POSTGRES_DSN", ""),
		SessionSecret:              getEnv("SESSION_SECRET", "passdock-session-secret"),
		InternalSignKey:            getEnv("INTERNAL_SIGN_KEY", "passdock-system"),
		InternalSignSecret:         getEnv("INTERNAL_SIGN_SECRET", "passdock-internal-secret"),
		TelegramEnabled:            getEnvBool("TELEGRAM_ENABLED", false),
		TelegramBotKey:             getEnv("TELEGRAM_BOT_KEY", "default"),
		TelegramBotToken:           getEnv("TELEGRAM_BOT_TOKEN", ""),
		TelegramWebhookSecret:      getEnv("TELEGRAM_WEBHOOK_SECRET", ""),
		TelegramWebhookURL:         getEnv("TELEGRAM_WEBHOOK_URL", ""),
		TelegramWebhookIP:          getEnv("TELEGRAM_WEBHOOK_IP_ADDRESS", ""),
		TelegramAllowedUpdates:     splitOptionalCSV(getEnv("TELEGRAM_WEBHOOK_ALLOWED_UPDATES", "")),
		TelegramMaxConnections:     getEnvInt("TELEGRAM_WEBHOOK_MAX_CONNECTIONS", 40),
		TelegramDropPendingUpdates: getEnvBool("TELEGRAM_WEBHOOK_DROP_PENDING_UPDATES", false),
		TelegramBotUsername:        getEnv("TELEGRAM_BOT_USERNAME", ""),
		CORSAllowOrigins:           splitCSV(getEnv("CORS_ALLOW_ORIGINS", "*")),
		StorageType:                getEnv("STORAGE_TYPE", "local"),
		StorageLocalPath:           getEnv("STORAGE_LOCAL_PATH", "./storage"),
		StoragePublicPath:          normalizePublicPath(getEnv("STORAGE_PUBLIC_PATH", "/uploads")),
		MinIOEndpoint:              getEnv("MINIO_ENDPOINT", ""),
		MinIOAccessKey:             getEnv("MINIO_ACCESS_KEY", ""),
		MinIOSecretKey:             getEnv("MINIO_SECRET_KEY", ""),
		MinIOBucket:                getEnv("MINIO_BUCKET", ""),
		MinIORegion:                getEnv("MINIO_REGION", "us-east-1"),
		MinIOUseSSL:                getEnvBool("MINIO_USE_SSL", false),
		UploadMaxFileSizeMB:        getEnvInt("UPLOAD_MAX_FILE_SIZE_MB", 8),
		OrderExpireMinutes:         getEnvInt("ORDER_EXPIRE_MINUTES", 30),
		PaymentReviewTimeout:       getEnvInt("PAYMENT_REVIEW_TIMEOUT_MINUTES", 60),
		OrderSweepIntervalSeconds:  getEnvInt("ORDER_SWEEP_INTERVAL_SECONDS", 30),
		AsyncConcurrency:           getEnvInt("ASYNC_CONCURRENCY", 10),
		AsyncPollIntervalSeconds:   getEnvInt("ASYNC_POLL_INTERVAL_SECONDS", 10),
		DeliveryRetryMaxRetries:    getEnvInt("DELIVERY_RETRY_MAX_RETRIES", 2),
		DeliveryRetryDelaySeconds:  getEnvInt("DELIVERY_RETRY_DELAY_SECONDS", 60),
		OKXWatcherEnabled:          getEnvBool("OKX_WATCHER_ENABLED", false),
		OKXWatcherAPIURL:           getEnv("OKX_WATCHER_API_URL", ""),
		OKXWatcherAPIToken:         getEnv("OKX_WATCHER_API_TOKEN", ""),
		OKXWatcherTimeoutMS:        getEnvInt("OKX_WATCHER_TIMEOUT_MS", 10000),
		OKXWatcherIntervalSeconds:  getEnvInt("OKX_WATCHER_INTERVAL_SECONDS", 60),
		OKXWatcherBatchSize:        getEnvInt("OKX_WATCHER_BATCH_SIZE", 50),
		OKXAdapterChain:            getEnv("OKX_ADAPTER_CHAIN", "tron"),
		OKXAdapterReceiveAddress:   getEnv("OKX_ADAPTER_RECEIVE_ADDRESS", ""),
		AdminBearerToken:           getEnv("ADMIN_BEARER_TOKEN", ""),
		NewAPIProdBaseURL:          getEnv("NEW_API_PROD_BASE_URL", ""),
		NewAPIProdKeyID:            getEnv("NEW_API_PROD_KEY_ID", ""),
		NewAPIProdSecret:           getEnv("NEW_API_PROD_SECRET", ""),
		NewAPIProdTimeoutMS:        getEnvInt("NEW_API_PROD_TIMEOUT_MS", 10000),
		NewAPIProdRetryTimes:       getEnvInt("NEW_API_PROD_RETRY_TIMES", 2),
		NewAPIStagingBaseURL:       getEnv("NEW_API_STAGING_BASE_URL", ""),
		NewAPIStagingKeyID:         getEnv("NEW_API_STAGING_KEY_ID", ""),
		NewAPIStagingSecret:        getEnv("NEW_API_STAGING_SECRET", ""),
		NewAPIStagingTimeoutMS:     getEnvInt("NEW_API_STAGING_TIMEOUT_MS", 8000),
		NewAPIStagingRetryTimes:    getEnvInt("NEW_API_STAGING_RETRY_TIMES", 1),
	}
}

func (c Config) ListenAddress() string {
	return ":" + c.AppPort
}

func (c Config) ShouldBootstrapReferenceData() bool {
	return resolveOptionalBool(c.BootstrapReferenceData, true)
}

func (c Config) ShouldSeedSampleBusinessData() bool {
	return resolveOptionalBool(c.SeedSampleBusinessData, !isStrictAppEnv(c.AppEnv))
}

func getEnv(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	return value
}

func getEnvInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}

	return parsed
}

func getEnvBool(key string, fallback bool) bool {
	value := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	if value == "" {
		return fallback
	}

	switch value {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return fallback
	}
}

func resolveOptionalBool(value string, fallback bool) bool {
	switch strings.TrimSpace(strings.ToLower(value)) {
	case "":
		return fallback
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return fallback
	}
}

func splitCSV(value string) []string {
	if strings.TrimSpace(value) == "" {
		return []string{"*"}
	}

	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))

	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}

	if len(result) == 0 {
		return []string{"*"}
	}

	return result
}

func splitOptionalCSV(value string) []string {
	if strings.TrimSpace(value) == "" {
		return nil
	}

	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}

	if len(result) == 0 {
		return nil
	}

	return result
}

func normalizePublicPath(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" || trimmed == "/" {
		return "/uploads"
	}

	trimmed = "/" + strings.Trim(trimmed, "/")
	return trimmed
}

func isStrictAppEnv(value string) bool {
	switch strings.TrimSpace(strings.ToLower(value)) {
	case "production", "staging":
		return true
	default:
		return false
	}
}
