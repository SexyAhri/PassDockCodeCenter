package app

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type ClientCredential struct {
	KeyID  string
	Secret string
}

type Config struct {
	Port                       string
	StorePath                  string
	ProdClient                 ClientCredential
	StagingClient              ClientCredential
	UpstreamBaseURL            string
	UpstreamAccessToken        string
	UpstreamUserID             string
	DefaultRechargeQuota       int64
	DefaultSubscriptionGroup   string
	SubscriptionModelLimits    []string
	SubscriptionUnlimitedQuota bool
}

func LoadConfig() Config {
	return Config{
		Port:                       getEnv("NEW_API_ADAPTER_PORT", "8070"),
		StorePath:                  getEnv("NEW_API_ADAPTER_STORE_PATH", "/app/data/newapi-adapter-store.json"),
		ProdClient:                 ClientCredential{KeyID: strings.TrimSpace(getEnv("NEW_API_PROD_KEY_ID", "")), Secret: strings.TrimSpace(getEnv("NEW_API_PROD_SECRET", ""))},
		StagingClient:              ClientCredential{KeyID: strings.TrimSpace(getEnv("NEW_API_STAGING_KEY_ID", "")), Secret: strings.TrimSpace(getEnv("NEW_API_STAGING_SECRET", ""))},
		UpstreamBaseURL:            strings.TrimRight(strings.TrimSpace(getEnv("NEW_API_UPSTREAM_BASE_URL", "")), "/"),
		UpstreamAccessToken:        strings.TrimSpace(getEnv("NEW_API_UPSTREAM_ACCESS_TOKEN", "")),
		UpstreamUserID:             strings.TrimSpace(getEnv("NEW_API_UPSTREAM_USER_ID", "1")),
		DefaultRechargeQuota:       int64(getEnvInt("NEW_API_UPSTREAM_DEFAULT_RECHARGE_QUOTA", 500000)),
		DefaultSubscriptionGroup:   strings.TrimSpace(getEnv("NEW_API_UPSTREAM_SUBSCRIPTION_GROUP", "default")),
		SubscriptionModelLimits:    splitCSV(getEnv("NEW_API_UPSTREAM_SUBSCRIPTION_MODEL_LIMITS", "")),
		SubscriptionUnlimitedQuota: getEnvBool("NEW_API_UPSTREAM_SUBSCRIPTION_UNLIMITED_QUOTA", true),
	}
}

func (c Config) Validate() error {
	if c.Port == "" {
		return fmt.Errorf("NEW_API_ADAPTER_PORT is required")
	}
	if c.StorePath == "" {
		return fmt.Errorf("NEW_API_ADAPTER_STORE_PATH is required")
	}
	if c.UpstreamBaseURL == "" {
		return fmt.Errorf("NEW_API_UPSTREAM_BASE_URL is required")
	}
	if c.UpstreamAccessToken == "" {
		return fmt.Errorf("NEW_API_UPSTREAM_ACCESS_TOKEN is required")
	}
	if c.UpstreamUserID == "" {
		return fmt.Errorf("NEW_API_UPSTREAM_USER_ID is required")
	}
	if c.ProdClient.KeyID == "" || c.ProdClient.Secret == "" {
		return fmt.Errorf("NEW_API_PROD_KEY_ID and NEW_API_PROD_SECRET are required")
	}
	if c.StagingClient.KeyID == "" || c.StagingClient.Secret == "" {
		return fmt.Errorf("NEW_API_STAGING_KEY_ID and NEW_API_STAGING_SECRET are required")
	}
	if c.DefaultRechargeQuota < 0 {
		return fmt.Errorf("NEW_API_UPSTREAM_DEFAULT_RECHARGE_QUOTA must be zero or positive")
	}
	return nil
}

func (c Config) FindClient(clientKey string) (ClientCredential, bool) {
	switch strings.TrimSpace(clientKey) {
	case c.ProdClient.KeyID:
		return c.ProdClient, true
	case c.StagingClient.KeyID:
		return c.StagingClient, true
	default:
		return ClientCredential{}, false
	}
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

func splitCSV(value string) []string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	seen := map[string]struct{}{}
	for _, part := range parts {
		item := strings.TrimSpace(part)
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
