package service

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"passdock/server/internal/config"
	"passdock/server/internal/model"
)

func TestSeedRuntimeDefaultsSkipsSampleBusinessDataInProductionByDefault(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{
		AppEnv: "production",
	})

	if err := svc.SeedRuntimeDefaults(); err != nil {
		t.Fatalf("SeedRuntimeDefaults returned error: %v", err)
	}

	var orderCount int64
	if err := svc.db.Model(&model.Order{}).Count(&orderCount).Error; err != nil {
		t.Fatalf("count orders returned error: %v", err)
	}
	if orderCount != 0 {
		t.Fatalf("expected no sample orders in production bootstrap, got %d", orderCount)
	}

	var productCount int64
	if err := svc.db.Model(&model.Product{}).Count(&productCount).Error; err != nil {
		t.Fatalf("count products returned error: %v", err)
	}
	if productCount == 0 {
		t.Fatalf("expected reference products to be seeded")
	}
}

func TestSeedRuntimeDefaultsSeedsSampleBusinessDataInDevelopmentByDefault(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{
		AppEnv: "development",
	})

	if err := svc.SeedRuntimeDefaults(); err != nil {
		t.Fatalf("SeedRuntimeDefaults returned error: %v", err)
	}

	var orderCount int64
	if err := svc.db.Model(&model.Order{}).Count(&orderCount).Error; err != nil {
		t.Fatalf("count orders returned error: %v", err)
	}
	if orderCount == 0 {
		t.Fatalf("expected sample orders in development bootstrap")
	}
}

func TestSeedRuntimeDefaultsAllowsExplicitSampleSeedInProduction(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch {
		case request.Method == http.MethodPost && request.URL.Path == "/api/internal/redemption/issue":
			writer.Header().Set("Content-Type", "application/json")
			_, _ = writer.Write([]byte(`{"success":true,"data":{"codes":["REDEMPTION-CODE-001"]}}`))
		case request.Method == http.MethodPost && request.URL.Path == "/api/internal/subscription_code/issue":
			writer.Header().Set("Content-Type", "application/json")
			_, _ = writer.Write([]byte(`{"success":true,"data":{"codes":["SUBSCRIPTION-CODE-001"]}}`))
		case request.Method == http.MethodGet && strings.HasPrefix(request.URL.Path, "/api/internal/code_issue/"):
			writer.Header().Set("Content-Type", "application/json")
			_, _ = writer.Write([]byte(`{"success":true,"data":{"codes":["QUERY-CODE-001"]}}`))
		default:
			http.NotFound(writer, request)
		}
	}))
	defer server.Close()

	svc := newSystemSecurityTestService(t, config.Config{
		AppEnv:                 "production",
		SeedSampleBusinessData: "true",
		NewAPIProdBaseURL:      server.URL,
		NewAPIProdKeyID:        "passdock-prod",
		NewAPIProdSecret:       "prod-secret",
	})

	if err := svc.SeedRuntimeDefaults(); err != nil {
		t.Fatalf("SeedRuntimeDefaults returned error: %v", err)
	}

	var orderCount int64
	if err := svc.db.Model(&model.Order{}).Count(&orderCount).Error; err != nil {
		t.Fatalf("count orders returned error: %v", err)
	}
	if orderCount == 0 {
		t.Fatalf("expected explicit production sample seed override to create orders")
	}
}
