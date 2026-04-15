package service

import (
	"context"
	"io"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
)

func TestExecuteRetriedHTTPRequestRetriesTransientFailures(t *testing.T) {
	var attempts atomic.Int32

	response, err := executeRetriedHTTPRequest(
		3,
		func() (*http.Request, error) {
			return http.NewRequestWithContext(context.Background(), http.MethodGet, "https://example.com/health", nil)
		},
		func(request *http.Request) (*http.Response, error) {
			current := attempts.Add(1)
			if current == 1 {
				return nil, context.DeadlineExceeded
			}

			return &http.Response{
				StatusCode: http.StatusNoContent,
				Body:       io.NopCloser(strings.NewReader("")),
			}, nil
		},
		shouldRetryTransientHTTPRequest,
	)
	if err != nil {
		t.Fatalf("executeRetriedHTTPRequest returned error: %v", err)
	}
	defer response.Body.Close()

	if attempts.Load() != 2 {
		t.Fatalf("expected 2 attempts, got %d", attempts.Load())
	}
	if response.StatusCode != http.StatusNoContent {
		t.Fatalf("expected status 204, got %d", response.StatusCode)
	}
}

func TestExecuteRetriedHTTPRequestDoesNotRetryNonRetryableStatus(t *testing.T) {
	var attempts atomic.Int32

	response, err := executeRetriedHTTPRequest(
		3,
		func() (*http.Request, error) {
			return http.NewRequestWithContext(context.Background(), http.MethodGet, "https://example.com/health", nil)
		},
		func(request *http.Request) (*http.Response, error) {
			attempts.Add(1)
			return &http.Response{
				StatusCode: http.StatusBadRequest,
				Body:       io.NopCloser(strings.NewReader("bad request")),
			}, nil
		},
		shouldRetryTransientHTTPRequest,
	)
	if err != nil {
		t.Fatalf("executeRetriedHTTPRequest returned unexpected error: %v", err)
	}
	defer response.Body.Close()

	if attempts.Load() != 1 {
		t.Fatalf("expected 1 attempt, got %d", attempts.Load())
	}
}

func TestTelegramAPIMethodAllowsRetry(t *testing.T) {
	if !telegramAPIMethodAllowsRetry("getFile") {
		t.Fatalf("expected getFile to allow retry")
	}
	if !telegramAPIMethodAllowsRetry("setWebhook") {
		t.Fatalf("expected setWebhook to allow retry")
	}
	if telegramAPIMethodAllowsRetry("sendMessage") {
		t.Fatalf("expected sendMessage to remain non-retryable")
	}
}
