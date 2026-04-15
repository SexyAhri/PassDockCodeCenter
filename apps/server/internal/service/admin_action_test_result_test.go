package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"passdock/server/internal/config"
)

func TestBuildAdminActionTestResultExecutesInternalMockAction(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{})
	if err := svc.SeedDefaults(); err != nil {
		t.Fatalf("SeedDefaults returned error: %v", err)
	}

	result, err := svc.BuildAdminActionTestResult(context.Background(), "issue_recharge_code", AdminActionTestInput{})
	if err != nil {
		t.Fatalf("BuildAdminActionTestResult returned error: %v", err)
	}

	if result["dry_run"] != false {
		t.Fatalf("expected dry_run false for mock/internal action test, got %#v", result["dry_run"])
	}
	if result["execution_mode"] != adminActionTestExecutionModeInternal {
		t.Fatalf("expected executed_internal mode, got %#v", result["execution_mode"])
	}
	if result["status_code"] != http.StatusOK {
		t.Fatalf("expected status code 200, got %#v", result["status_code"])
	}

	codes, ok := result["codes"].([]string)
	if !ok || len(codes) == 0 {
		t.Fatalf("expected issued codes in action test result, got %#v", result["codes"])
	}
}

func TestBuildAdminActionTestResultSkipsExternalMutationExecution(t *testing.T) {
	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requestCount++
		writer.WriteHeader(http.StatusCreated)
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

	result, err := svc.BuildAdminActionTestResult(context.Background(), "issue_recharge_code", AdminActionTestInput{})
	if err != nil {
		t.Fatalf("BuildAdminActionTestResult returned error: %v", err)
	}

	if result["dry_run"] != true {
		t.Fatalf("expected dry_run true for external mutation action test, got %#v", result["dry_run"])
	}
	if result["execution_mode"] != adminActionTestExecutionModeExternal {
		t.Fatalf("expected render_only_external mode, got %#v", result["execution_mode"])
	}
	if requestCount != 0 {
		t.Fatalf("expected no external mutation request during action test, got %d", requestCount)
	}
}

func TestBuildAdminActionTestResultPreviewModeNeverExecutesUpstream(t *testing.T) {
	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requestCount++
		writer.WriteHeader(http.StatusCreated)
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

	result, err := svc.BuildAdminActionTestResult(context.Background(), "issue_recharge_code", AdminActionTestInput{
		Mode: "preview",
	})
	if err != nil {
		t.Fatalf("BuildAdminActionTestResult returned error: %v", err)
	}

	if result["execution_mode"] != adminActionTestExecutionModePreview {
		t.Fatalf("expected preview_only mode, got %#v", result["execution_mode"])
	}
	if requestCount != 0 {
		t.Fatalf("expected preview mode not to call upstream, got %d", requestCount)
	}
}

func TestBuildAdminActionTestResultAllowsExternalLiveForLocalSandbox(t *testing.T) {
	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requestCount++
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"success":true,"data":{"codes":["LIVE-CODE-001"]}}`))
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

	result, err := svc.BuildAdminActionTestResult(context.Background(), "issue_recharge_code", AdminActionTestInput{
		Mode: "live",
	})
	if err != nil {
		t.Fatalf("BuildAdminActionTestResult returned error: %v", err)
	}

	if result["execution_mode"] != adminActionTestExecutionModeLive {
		t.Fatalf("expected executed_external_live mode, got %#v", result["execution_mode"])
	}
	if requestCount != 1 {
		t.Fatalf("expected one live upstream request, got %d", requestCount)
	}
}

func TestBuildAdminActionTestResultBlocksExternalLiveForProductionMutation(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{
		NewAPIProdBaseURL:    "https://api.example.com",
		NewAPIProdKeyID:      "passdock-prod",
		NewAPIProdSecret:     "prod-secret",
		NewAPIProdTimeoutMS:  5000,
		NewAPIProdRetryTimes: 1,
	})
	if err := svc.seedReferenceData(context.Background()); err != nil {
		t.Fatalf("seedReferenceData returned error: %v", err)
	}

	if _, err := svc.BuildAdminActionTestResult(context.Background(), "issue_recharge_code", AdminActionTestInput{
		Mode: "live",
	}); err == nil {
		t.Fatalf("expected external live test to be blocked for production mutation target")
	}
}
