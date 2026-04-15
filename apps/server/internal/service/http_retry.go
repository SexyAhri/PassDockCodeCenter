package service

import (
	"io"
	"net/http"
	"strings"
)

const (
	defaultMinIORetryAttempts        = 3
	defaultTelegramSafeRetryAttempts = 3
)

func executeRetriedHTTPRequest(
	attempts int,
	buildRequest func() (*http.Request, error),
	doRequest func(*http.Request) (*http.Response, error),
	shouldRetry func(*http.Response, error) bool,
) (*http.Response, error) {
	if attempts <= 0 {
		attempts = 1
	}

	var lastResp *http.Response
	var lastErr error

	for attempt := 1; attempt <= attempts; attempt++ {
		request, err := buildRequest()
		if err != nil {
			return nil, err
		}

		response, err := doRequest(request)
		lastResp = response
		lastErr = err
		if attempt >= attempts || !shouldRetry(response, err) {
			return response, err
		}

		if response != nil && response.Body != nil {
			_, _ = io.Copy(io.Discard, response.Body)
			_ = response.Body.Close()
		}
	}

	return lastResp, lastErr
}

func shouldRetryTransientHTTPRequest(response *http.Response, err error) bool {
	if err != nil {
		return shouldRetryHTTPProviderAttempt(0, err)
	}
	if response == nil {
		return false
	}

	return shouldRetryHTTPProviderAttempt(response.StatusCode, nil)
}

func telegramAPIMethodAllowsRetry(method string) bool {
	switch strings.TrimSpace(method) {
	case "getFile", "getWebhookInfo", "setWebhook", "deleteWebhook":
		return true
	default:
		return false
	}
}
