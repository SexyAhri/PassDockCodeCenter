package service

import (
	"context"
	"testing"

	"passdock/server/internal/config"
)

func TestSeedDefaultsUsesEnvBootstrapForNewAPIProviders(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{
		NewAPIProdBaseURL:       "https://newapi-internal.example.com",
		NewAPIProdKeyID:         "passdock-prod",
		NewAPIProdSecret:        "prod-secret",
		NewAPIProdTimeoutMS:     15000,
		NewAPIProdRetryTimes:    3,
		NewAPIStagingBaseURL:    "https://staging-newapi-internal.example.com",
		NewAPIStagingKeyID:      "passdock-staging-real",
		NewAPIStagingSecret:     "staging-secret",
		NewAPIStagingTimeoutMS:  9000,
		NewAPIStagingRetryTimes: 2,
	})

	if err := svc.seedReferenceData(context.Background()); err != nil {
		t.Fatalf("seedReferenceData returned error: %v", err)
	}

	prod, err := svc.resolveProviderByRoute(context.Background(), "new_api_prod")
	if err != nil {
		t.Fatalf("resolveProviderByRoute new_api_prod returned error: %v", err)
	}
	if prod.BaseURL != "https://newapi-internal.example.com" {
		t.Fatalf("expected prod base url from config, got %q", prod.BaseURL)
	}
	if prod.TimeoutMS != 15000 {
		t.Fatalf("expected prod timeout 15000, got %d", prod.TimeoutMS)
	}
	if prod.RetryTimes != 3 {
		t.Fatalf("expected prod retry times 3, got %d", prod.RetryTimes)
	}

	prodAuth := parseJSON[map[string]any](prod.AuthConfigJSON)
	if stringValue(prodAuth["key_id"]) != "passdock-prod" {
		t.Fatalf("expected prod key id passdock-prod, got %#v", prodAuth["key_id"])
	}
	if stringValue(prodAuth["secret"]) != "prod-secret" {
		t.Fatalf("expected prod secret prod-secret, got %#v", prodAuth["secret"])
	}

	staging, err := svc.resolveProviderByRoute(context.Background(), "new_api_staging")
	if err != nil {
		t.Fatalf("resolveProviderByRoute new_api_staging returned error: %v", err)
	}
	if staging.BaseURL != "https://staging-newapi-internal.example.com" {
		t.Fatalf("expected staging base url from config, got %q", staging.BaseURL)
	}
	if staging.TimeoutMS != 9000 {
		t.Fatalf("expected staging timeout 9000, got %d", staging.TimeoutMS)
	}
	if staging.RetryTimes != 2 {
		t.Fatalf("expected staging retry times 2, got %d", staging.RetryTimes)
	}
}
