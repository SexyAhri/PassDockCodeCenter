package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"passdock/server/internal/config"
)

func TestHealthCheckProviderPerformsRealHTTPProbe(t *testing.T) {
	var receivedKey string

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		receivedKey = request.Header.Get("X-PassDock-Key")
		writer.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	svc := newSystemSecurityTestService(t, config.Config{
		NewAPIProdBaseURL:    server.URL,
		NewAPIProdKeyID:      "passdock-prod",
		NewAPIProdSecret:     "prod-secret",
		NewAPIProdTimeoutMS:  5000,
		NewAPIProdRetryTimes: 1,
	})

	if err := svc.seedReferenceData(context.Background()); err != nil {
		t.Fatalf("seedReferenceData returned error: %v", err)
	}

	result, err := svc.HealthCheckProvider(context.Background(), "new_api_prod")
	if err != nil {
		t.Fatalf("HealthCheckProvider returned error: %v", err)
	}
	if result["health"] != "healthy" {
		t.Fatalf("expected healthy result, got %#v", result)
	}
	if result["reachable"] != true {
		t.Fatalf("expected reachable true, got %#v", result["reachable"])
	}
	if receivedKey != "passdock-prod" {
		t.Fatalf("expected X-PassDock-Key passdock-prod, got %q", receivedKey)
	}
}

func TestHealthCheckProviderReportsMockBootstrapTarget(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{})
	if err := svc.seedReferenceData(context.Background()); err != nil {
		t.Fatalf("seedReferenceData returned error: %v", err)
	}

	result, err := svc.HealthCheckProvider(context.Background(), "new_api_prod")
	if err != nil {
		t.Fatalf("HealthCheckProvider returned error: %v", err)
	}
	if result["health"] != "unknown" {
		t.Fatalf("expected unknown health for mock target, got %#v", result["health"])
	}
	if result["reachable"] != true {
		t.Fatalf("expected reachable true for mock target, got %#v", result["reachable"])
	}
}

func TestHealthCheckProviderRejectsMockBootstrapTargetInProduction(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{
		AppEnv: "production",
	})
	if err := svc.seedReferenceData(context.Background()); err != nil {
		t.Fatalf("seedReferenceData returned error: %v", err)
	}

	result, err := svc.HealthCheckProvider(context.Background(), "new_api_prod")
	if err != nil {
		t.Fatalf("HealthCheckProvider returned error: %v", err)
	}
	if result["health"] != "failed" {
		t.Fatalf("expected failed health for production mock target, got %#v", result["health"])
	}
	if result["reachable"] != false {
		t.Fatalf("expected reachable false for production mock target, got %#v", result["reachable"])
	}
}

func TestHealthCheckProviderRejectsBootstrapDefaultSecretInProduction(t *testing.T) {
	var attempts atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		attempts.Add(1)
		writer.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	svc := newSystemSecurityTestService(t, config.Config{
		AppEnv:            "production",
		NewAPIProdBaseURL: server.URL,
	})
	if err := svc.seedReferenceData(context.Background()); err != nil {
		t.Fatalf("seedReferenceData returned error: %v", err)
	}

	result, err := svc.HealthCheckProvider(context.Background(), "new_api_prod")
	if err != nil {
		t.Fatalf("HealthCheckProvider returned error: %v", err)
	}
	if result["health"] != "failed" {
		t.Fatalf("expected failed health for bootstrap default auth, got %#v", result["health"])
	}
	if attempts.Load() != 0 {
		t.Fatalf("expected no outbound health probe when bootstrap auth defaults are active, got %d", attempts.Load())
	}
}

func TestHealthCheckProviderRetriesTransientTimeout(t *testing.T) {
	var attempts atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		current := attempts.Add(1)
		if current == 1 {
			time.Sleep(120 * time.Millisecond)
		}

		writer.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	svc := newSystemSecurityTestService(t, config.Config{
		NewAPIProdBaseURL:    server.URL,
		NewAPIProdKeyID:      "passdock-prod",
		NewAPIProdSecret:     "prod-secret",
		NewAPIProdTimeoutMS:  50,
		NewAPIProdRetryTimes: 1,
	})

	if err := svc.seedReferenceData(context.Background()); err != nil {
		t.Fatalf("seedReferenceData returned error: %v", err)
	}

	result, err := svc.HealthCheckProvider(context.Background(), "new_api_prod")
	if err != nil {
		t.Fatalf("HealthCheckProvider returned error: %v", err)
	}
	if result["health"] != "healthy" {
		t.Fatalf("expected healthy result after retry, got %#v", result)
	}
	if attempts.Load() != 2 {
		t.Fatalf("expected 2 health probe attempts, got %d", attempts.Load())
	}
}
