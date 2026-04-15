package service

import (
	"context"
	"fmt"
	"strings"

	"passdock/server/internal/model"
)

var bootstrapProviderDefaultSecrets = map[string]string{
	"new_api_prod":    "passdock-dev-secret",
	"new_api_staging": "passdock-staging-secret",
}

func (s *Service) isStrictProviderRuntime() bool {
	switch strings.ToLower(strings.TrimSpace(s.cfg.AppEnv)) {
	case "production", "staging":
		return true
	default:
		return false
	}
}

func isMockProviderBaseURL(value string) bool {
	return strings.HasPrefix(strings.ToLower(strings.TrimSpace(value)), "mock://")
}

func (s *Service) deriveProviderHealthStatus(current string, baseURL string) string {
	if !isMockProviderBaseURL(baseURL) {
		return current
	}
	if s.isStrictProviderRuntime() {
		return "failed"
	}
	if strings.TrimSpace(current) == "" || strings.EqualFold(strings.TrimSpace(current), "healthy") {
		return "unknown"
	}
	return current
}

func (s *Service) validateProviderRuntimeTarget(provider *model.IntegrationProvider) error {
	if provider == nil || !provider.Enabled {
		return nil
	}
	if !s.isStrictProviderRuntime() {
		return nil
	}
	if isMockProviderBaseURL(provider.BaseURL) {
		return fmt.Errorf(
			"provider %s is still using mock bootstrap target %s in %s",
			provider.ProviderKey,
			strings.TrimSpace(provider.BaseURL),
			s.cfg.AppEnv,
		)
	}
	if usesBootstrapProviderDefaultSecret(provider) {
		return fmt.Errorf(
			"provider %s is still using bootstrap default auth credentials in %s",
			provider.ProviderKey,
			s.cfg.AppEnv,
		)
	}

	return nil
}

func (s *Service) ValidateProviderBootstrapTargets(ctx context.Context) error {
	if !s.isStrictProviderRuntime() {
		return nil
	}

	var providers []model.IntegrationProvider
	if err := s.db.WithContext(ctx).
		Where("enabled = ?", true).
		Order("id ASC").
		Find(&providers).Error; err != nil {
		return err
	}

	invalid := make([]string, 0)
	for _, provider := range providers {
		if err := s.validateProviderRuntimeTarget(&provider); err != nil {
			invalid = append(invalid, err.Error())
		}
	}

	if len(invalid) == 0 {
		return nil
	}

	return fmt.Errorf(
		"enabled providers are not deployment-ready in %s: %s",
		s.cfg.AppEnv,
		strings.Join(invalid, ", "),
	)
}

func usesBootstrapProviderDefaultSecret(provider *model.IntegrationProvider) bool {
	if provider == nil {
		return false
	}

	expectedSecret, ok := bootstrapProviderDefaultSecrets[strings.TrimSpace(provider.ProviderKey)]
	if !ok || strings.TrimSpace(expectedSecret) == "" {
		return false
	}

	authConfig := parseJSON[map[string]any](provider.AuthConfigJSON)
	secret := strings.TrimSpace(lookupString(authConfig, "secret"))
	return secret != "" && secret == expectedSecret
}
