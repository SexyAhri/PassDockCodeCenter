package service

import (
	"context"
	"strings"
	"testing"

	"passdock/server/internal/config"
)

func TestValidateProviderBootstrapTargetsFailsInProduction(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{
		AppEnv: "production",
	})
	if err := svc.seedReferenceData(context.Background()); err != nil {
		t.Fatalf("seedReferenceData returned error: %v", err)
	}

	err := svc.ValidateProviderBootstrapTargets(context.Background())
	if err == nil {
		t.Fatalf("expected validation error for production mock providers")
	}
	if !strings.Contains(err.Error(), "new_api_prod") {
		t.Fatalf("expected new_api_prod in validation error, got %v", err)
	}
}

func TestExecuteIntegrationActionRejectsMockProviderInProduction(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{
		AppEnv: "production",
	})
	if err := svc.seedReferenceData(context.Background()); err != nil {
		t.Fatalf("seedReferenceData returned error: %v", err)
	}

	_, err := svc.ExecuteIntegrationAction(context.Background(), "new_api_prod", "query_issue_result", ExecuteActionInput{
		TemplateData: map[string]any{
			"order_no": "PD-MOCK-BLOCKED",
		},
	})
	if err == nil {
		t.Fatalf("expected mock provider execution to be rejected in production")
	}
	if !strings.Contains(err.Error(), "mock bootstrap target") {
		t.Fatalf("expected mock bootstrap target error, got %v", err)
	}
}

func TestValidateProviderBootstrapTargetsFailsForBootstrapDefaultSecretInProduction(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{
		AppEnv:            "production",
		NewAPIProdBaseURL: "https://newapi-internal.example.com",
	})
	if err := svc.seedReferenceData(context.Background()); err != nil {
		t.Fatalf("seedReferenceData returned error: %v", err)
	}

	err := svc.ValidateProviderBootstrapTargets(context.Background())
	if err == nil {
		t.Fatalf("expected validation error for production bootstrap auth defaults")
	}
	if !strings.Contains(err.Error(), "bootstrap default auth credentials") {
		t.Fatalf("expected bootstrap auth default error, got %v", err)
	}
}
