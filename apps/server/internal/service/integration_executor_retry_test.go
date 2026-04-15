package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"passdock/server/internal/config"
)

func TestExecuteIntegrationActionRetriesSafeGETTimeout(t *testing.T) {
	var queryCalls atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet || !strings.HasPrefix(request.URL.Path, "/api/internal/code_issue/") {
			http.NotFound(writer, request)
			return
		}

		attempt := queryCalls.Add(1)
		if attempt == 1 {
			time.Sleep(120 * time.Millisecond)
		}

		writer.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(writer).Encode(map[string]any{
			"success": true,
			"message": "issue result loaded",
			"data": map[string]any{
				"order_no": "PD-RETRY-QUERY",
				"codes":    []string{"SAFE-QUERY-CODE"},
			},
		})
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

	result, err := svc.ExecuteIntegrationAction(context.Background(), "new_api_prod", "query_issue_result", ExecuteActionInput{
		TemplateData: map[string]any{
			"order_no": "PD-RETRY-QUERY",
		},
	})
	if err != nil {
		t.Fatalf("ExecuteIntegrationAction returned error: %v", err)
	}

	if queryCalls.Load() != 2 {
		t.Fatalf("expected 2 query attempts, got %d", queryCalls.Load())
	}
	if len(result.Codes) != 1 || result.Codes[0] != "SAFE-QUERY-CODE" {
		t.Fatalf("expected retried query code SAFE-QUERY-CODE, got %#v", result.Codes)
	}
}

func TestExecuteIntegrationActionDoesNotRetryMutationPOST(t *testing.T) {
	var issueCalls atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost || request.URL.Path != "/api/internal/redemption/issue" {
			http.NotFound(writer, request)
			return
		}

		issueCalls.Add(1)
		writer.Header().Set("Content-Type", "application/json")
		writer.WriteHeader(http.StatusBadGateway)
		_ = json.NewEncoder(writer).Encode(map[string]any{
			"success": false,
			"message": "upstream temporary failure",
		})
	}))
	defer server.Close()

	svc := newSystemSecurityTestService(t, config.Config{
		NewAPIProdBaseURL:    server.URL,
		NewAPIProdKeyID:      "passdock-prod",
		NewAPIProdSecret:     "prod-secret",
		NewAPIProdTimeoutMS:  1000,
		NewAPIProdRetryTimes: 3,
	})
	if err := svc.seedReferenceData(context.Background()); err != nil {
		t.Fatalf("seedReferenceData returned error: %v", err)
	}

	_, err := svc.ExecuteIntegrationAction(context.Background(), "new_api_prod", "issue_recharge_code", ExecuteActionInput{
		TemplateData: map[string]any{
			"order_no":   "PD-NO-RETRY-ISSUE",
			"product_id": "credit-trial",
			"count":      1,
		},
	})
	if err == nil {
		t.Fatalf("expected ExecuteIntegrationAction to return error for mutation POST failure")
	}

	if issueCalls.Load() != 1 {
		t.Fatalf("expected mutation POST to execute once, got %d attempts", issueCalls.Load())
	}
}
