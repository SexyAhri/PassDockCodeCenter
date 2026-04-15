package service

import (
	"strings"

	"passdock/server/internal/model"
)

func (s *Service) bootstrapIntegrationProviders() []model.IntegrationProvider {
	return []model.IntegrationProvider{
		s.bootstrapNewAPIProvider(
			"new_api_prod",
			"new-api internal adapter (production)",
			"mock://new-api-prod",
			"passdock-dev",
			"passdock-dev-secret",
			s.cfg.NewAPIProdBaseURL,
			s.cfg.NewAPIProdKeyID,
			s.cfg.NewAPIProdSecret,
			s.cfg.NewAPIProdTimeoutMS,
			s.cfg.NewAPIProdRetryTimes,
		),
		s.bootstrapNewAPIProvider(
			"new_api_staging",
			"new-api internal adapter (staging)",
			"mock://new-api-staging",
			"passdock-staging",
			"passdock-staging-secret",
			s.cfg.NewAPIStagingBaseURL,
			s.cfg.NewAPIStagingKeyID,
			s.cfg.NewAPIStagingSecret,
			s.cfg.NewAPIStagingTimeoutMS,
			s.cfg.NewAPIStagingRetryTimes,
		),
		{
			ProviderKey:    "manual_review_queue",
			ProviderName:   "manual review queue",
			BaseURL:        "internal://ops/manual-review",
			AuthType:       "none",
			AuthConfigJSON: jsonValue(map[string]any{}),
			TimeoutMS:      3000,
			RetryTimes:     0,
			HealthStatus:   "degraded",
			Enabled:        true,
		},
	}
}

func (s *Service) bootstrapNewAPIProvider(
	providerKey string,
	providerName string,
	fallbackBaseURL string,
	fallbackKeyID string,
	fallbackSecret string,
	envBaseURL string,
	envKeyID string,
	envSecret string,
	timeoutMS int,
	retryTimes int,
) model.IntegrationProvider {
	baseURL := strings.TrimSpace(envBaseURL)
	if baseURL == "" {
		baseURL = fallbackBaseURL
	}

	keyID := strings.TrimSpace(envKeyID)
	if keyID == "" {
		keyID = fallbackKeyID
	}

	secret := strings.TrimSpace(envSecret)
	if secret == "" {
		secret = fallbackSecret
	}

	health := "healthy"
	if strings.HasPrefix(baseURL, "mock://") {
		if s.isStrictProviderRuntime() {
			health = "failed"
		} else {
			health = "unknown"
		}
	} else if s.isStrictProviderRuntime() && strings.TrimSpace(secret) != "" && secret == fallbackSecret {
		health = "failed"
	}

	return model.IntegrationProvider{
		ProviderKey:  providerKey,
		ProviderName: providerName,
		BaseURL:      baseURL,
		AuthType:     "hmac_sha256",
		AuthConfigJSON: jsonValue(map[string]any{
			"key_id":      keyID,
			"secret":      secret,
			"sign_header": "X-PassDock-Sign",
		}),
		TimeoutMS:    maxInt(timeoutMS, 3000),
		RetryTimes:   maxInt(retryTimes, 0),
		HealthStatus: health,
		Enabled:      true,
	}
}
