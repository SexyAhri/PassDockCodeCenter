package service

import (
	"context"
	"fmt"
	"net/http"
	neturl "net/url"
	"strings"
	"time"

	"passdock/server/internal/model"
)

type providerHealthCheckResult struct {
	Health     string
	Message    string
	StatusCode int
	Reachable  bool
	BaseURL    string
}

func (s *Service) checkProviderHealth(
	ctx context.Context,
	provider *model.IntegrationProvider,
) providerHealthCheckResult {
	if provider == nil {
		return providerHealthCheckResult{
			Health:  "failed",
			Message: "Provider is missing.",
		}
	}

	baseURL := strings.TrimSpace(provider.BaseURL)
	if baseURL == "" {
		return providerHealthCheckResult{
			Health:  "failed",
			Message: "Provider base URL is empty.",
		}
	}
	if err := s.validateProviderRuntimeTarget(provider); err != nil {
		return providerHealthCheckResult{
			Health:  "failed",
			Message: err.Error(),
			BaseURL: baseURL,
		}
	}

	switch {
	case strings.HasPrefix(baseURL, "mock://"):
		return providerHealthCheckResult{
			Health:    "unknown",
			Message:   "Provider is using the local mock bootstrap target.",
			Reachable: true,
			BaseURL:   baseURL,
		}
	case strings.HasPrefix(baseURL, "internal://"):
		return providerHealthCheckResult{
			Health:    "healthy",
			Message:   "Provider is using an internal in-process route.",
			Reachable: true,
			BaseURL:   baseURL,
		}
	}

	spec, err := s.buildProviderHealthCheckRequest(provider)
	if err != nil {
		return providerHealthCheckResult{
			Health:  "failed",
			Message: err.Error(),
			BaseURL: baseURL,
		}
	}

	client := &http.Client{Timeout: time.Duration(maxInt(provider.TimeoutMS, 3000)) * time.Millisecond}
	attempts := maxInt(provider.RetryTimes, 0) + 1

	var (
		statusCode int
		lastErr    error
	)

	for attempt := 1; attempt <= attempts; attempt++ {
		responseBody, nextStatusCode, err := executeSingleHTTPProviderRequest(ctx, client, spec)
		_ = responseBody
		if err == nil {
			statusCode = nextStatusCode
			return buildProviderHealthCheckHTTPResult(baseURL, statusCode)
		}

		statusCode = nextStatusCode
		lastErr = err
		if attempt >= attempts || !shouldRetryHTTPProviderAttempt(statusCode, err) {
			break
		}
	}

	if lastErr != nil {
		return providerHealthCheckResult{
			Health:  "failed",
			Message: lastErr.Error(),
			BaseURL: baseURL,
		}
	}

	return buildProviderHealthCheckHTTPResult(baseURL, statusCode)
}

func buildProviderHealthCheckHTTPResult(baseURL string, statusCode int) providerHealthCheckResult {
	result := providerHealthCheckResult{
		StatusCode: statusCode,
		Reachable:  true,
		BaseURL:    baseURL,
	}

	switch {
	case statusCode >= 200 && statusCode < 400:
		result.Health = "healthy"
		result.Message = fmt.Sprintf("Upstream responded with status %d.", statusCode)
	case statusCode >= 400 && statusCode < 500:
		result.Health = "degraded"
		result.Message = fmt.Sprintf("Upstream is reachable but returned status %d. Check auth or base URL.", statusCode)
	default:
		result.Health = "failed"
		result.Message = fmt.Sprintf("Upstream is reachable but returned server status %d.", statusCode)
	}

	return result
}

func (s *Service) buildProviderHealthCheckRequest(
	provider *model.IntegrationProvider,
) (*actionRequestSpec, error) {
	baseURL := strings.TrimSpace(provider.BaseURL)
	parsed, err := neturl.Parse(baseURL)
	if err != nil {
		return nil, fmt.Errorf("invalid provider base URL: %w", err)
	}
	if parsed.Scheme == "" || parsed.Host == "" {
		return nil, fmt.Errorf("invalid provider base URL")
	}

	spec := &actionRequestSpec{
		Method:  http.MethodGet,
		Path:    defaultString(parsed.EscapedPath(), "/"),
		Headers: map[string]string{},
		Query:   parsed.Query(),
	}
	if err := s.applyActionAuth(provider, spec); err != nil {
		return nil, err
	}

	if strings.TrimSpace(parsed.Path) == "" {
		parsed.Path = "/"
	}
	parsed.RawQuery = spec.Query.Encode()
	spec.URL = parsed.String()

	return spec, nil
}
