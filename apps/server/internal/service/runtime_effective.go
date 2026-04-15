package service

import (
	"context"
	"os"
	"strconv"
	"strings"
	"time"

	"passdock/server/internal/model"
)

type runtimeSettingSpec struct {
	Module       string
	EnvKey       string
	DefaultValue string
	Description  string
	AppliesLive  bool
}

type runtimeSettingResolved struct {
	EffectiveValue string
	ValueSource    string
	AppliesLive    bool
	Description    string
	EnvKey         string
}

var runtimeSettingSpecs = map[string]runtimeSettingSpec{
	"ORDER_EXPIRE_MINUTES": {
		Module:       "orders",
		EnvKey:       "ORDER_EXPIRE_MINUTES",
		DefaultValue: "30",
		Description:  "Minutes before an awaiting-payment order expires.",
		AppliesLive:  true,
	},
	"PAYMENT_REVIEW_TIMEOUT_MINUTES": {
		Module:       "payments",
		EnvKey:       "PAYMENT_REVIEW_TIMEOUT_MINUTES",
		DefaultValue: "60",
		Description:  "Minutes before a pending-review payment is considered overdue.",
		AppliesLive:  true,
	},
	"ORDER_SWEEP_INTERVAL_SECONDS": {
		Module:       "orders",
		EnvKey:       "ORDER_SWEEP_INTERVAL_SECONDS",
		DefaultValue: "30",
		Description:  "Seconds between automated order expiration and payment-review timeout sweeps.",
		AppliesLive:  true,
	},
	"ASYNC_CONCURRENCY": {
		Module:       "queue",
		EnvKey:       "ASYNC_CONCURRENCY",
		DefaultValue: "10",
		Description:  "Maximum number of async retry jobs processed in parallel per worker sweep.",
		AppliesLive:  true,
	},
	"ASYNC_POLL_INTERVAL_SECONDS": {
		Module:       "queue",
		EnvKey:       "ASYNC_POLL_INTERVAL_SECONDS",
		DefaultValue: "10",
		Description:  "Seconds between async retry queue polling runs.",
		AppliesLive:  true,
	},
	"DELIVERY_RETRY_MAX_RETRIES": {
		Module:       "queue",
		EnvKey:       "DELIVERY_RETRY_MAX_RETRIES",
		DefaultValue: "2",
		Description:  "Maximum automatic delivery retry attempts when resend is allowed.",
		AppliesLive:  true,
	},
	"DELIVERY_RETRY_DELAY_SECONDS": {
		Module:       "queue",
		EnvKey:       "DELIVERY_RETRY_DELAY_SECONDS",
		DefaultValue: "60",
		Description:  "Delay in seconds before each automatic delivery retry.",
		AppliesLive:  true,
	},
	"OKX_WATCHER_ENABLED": {
		Module:       "payments",
		EnvKey:       "OKX_WATCHER_ENABLED",
		DefaultValue: "false",
		Description:  "Enable the built-in OKX USDT watcher worker.",
		AppliesLive:  true,
	},
	"OKX_WATCHER_INTERVAL_SECONDS": {
		Module:       "payments",
		EnvKey:       "OKX_WATCHER_INTERVAL_SECONDS",
		DefaultValue: "60",
		Description:  "Seconds between OKX watcher polling runs.",
		AppliesLive:  true,
	},
	"OKX_WATCHER_BATCH_SIZE": {
		Module:       "payments",
		EnvKey:       "OKX_WATCHER_BATCH_SIZE",
		DefaultValue: "50",
		Description:  "Maximum number of pending OKX orders checked per watcher run.",
		AppliesLive:  true,
	},
}

func (s *Service) resolveRuntimeSetting(ctx context.Context, name string, fallback string) runtimeSettingResolved {
	spec, known := runtimeSettingSpecs[name]
	resolved := runtimeSettingResolved{
		EffectiveValue: strings.TrimSpace(fallback),
		ValueSource:    "default",
		AppliesLive:    known && spec.AppliesLive,
		Description:    strings.TrimSpace(spec.Description),
		EnvKey:         strings.TrimSpace(spec.EnvKey),
	}

	if envValue, ok := lookupRuntimeSettingEnv(spec.EnvKey); ok {
		resolved.EffectiveValue = envValue
		resolved.ValueSource = "env"
		return resolved
	}

	record, err := s.resolveRuntimeSettingByName(ctx, name)
	if err == nil {
		if normalized, ok := normalizeRuntimeSettingValue(name, record.Value); ok {
			resolved.EffectiveValue = normalized
			resolved.ValueSource = "db"
			if strings.TrimSpace(record.Description) != "" {
				resolved.Description = strings.TrimSpace(record.Description)
			}
			return resolved
		}
	}

	if normalized, ok := normalizeRuntimeSettingValue(name, resolved.EffectiveValue); ok {
		resolved.EffectiveValue = normalized
		return resolved
	}

	if known {
		if normalized, ok := normalizeRuntimeSettingValue(name, spec.DefaultValue); ok {
			resolved.EffectiveValue = normalized
		}
	}

	return resolved
}

func (s *Service) resolveRuntimeIntSetting(ctx context.Context, name string, fallback int) int {
	resolved := s.resolveRuntimeSetting(ctx, name, strconv.Itoa(fallback))
	parsed, err := strconv.Atoi(strings.TrimSpace(resolved.EffectiveValue))
	if err != nil || parsed <= 0 {
		return fallback
	}

	return parsed
}

func (s *Service) resolveRuntimeNonNegativeIntSetting(ctx context.Context, name string, fallback int) int {
	resolved := s.resolveRuntimeSetting(ctx, name, strconv.Itoa(fallback))
	parsed, err := strconv.Atoi(strings.TrimSpace(resolved.EffectiveValue))
	if err != nil || parsed < 0 {
		return fallback
	}

	return parsed
}

func (s *Service) orderExpireMinutes(ctx context.Context) int {
	return s.resolveRuntimeIntSetting(ctx, "ORDER_EXPIRE_MINUTES", s.cfg.OrderExpireMinutes)
}

func (s *Service) paymentReviewTimeoutMinutes(ctx context.Context) int {
	return s.resolveRuntimeIntSetting(ctx, "PAYMENT_REVIEW_TIMEOUT_MINUTES", s.cfg.PaymentReviewTimeout)
}

func (s *Service) orderSweepIntervalSeconds(ctx context.Context) int {
	return s.resolveRuntimeIntSetting(ctx, "ORDER_SWEEP_INTERVAL_SECONDS", s.cfg.OrderSweepIntervalSeconds)
}

func (s *Service) asyncConcurrency(ctx context.Context) int {
	return s.resolveRuntimeIntSetting(ctx, "ASYNC_CONCURRENCY", s.cfg.AsyncConcurrency)
}

func (s *Service) asyncPollIntervalSeconds(ctx context.Context) int {
	return s.resolveRuntimeIntSetting(ctx, "ASYNC_POLL_INTERVAL_SECONDS", s.cfg.AsyncPollIntervalSeconds)
}

func (s *Service) deliveryRetryMaxRetries(ctx context.Context) int {
	return s.resolveRuntimeNonNegativeIntSetting(ctx, "DELIVERY_RETRY_MAX_RETRIES", s.cfg.DeliveryRetryMaxRetries)
}

func (s *Service) deliveryRetryDelaySeconds(ctx context.Context) int {
	return s.resolveRuntimeNonNegativeIntSetting(ctx, "DELIVERY_RETRY_DELAY_SECONDS", s.cfg.DeliveryRetryDelaySeconds)
}

func (s *Service) okxWatcherEnabled(ctx context.Context) bool {
	return s.resolveRuntimeBoolSetting(ctx, "OKX_WATCHER_ENABLED", s.cfg.OKXWatcherEnabled)
}

func (s *Service) okxWatcherIntervalSeconds(ctx context.Context) int {
	return s.resolveRuntimeIntSetting(ctx, "OKX_WATCHER_INTERVAL_SECONDS", s.cfg.OKXWatcherIntervalSeconds)
}

func (s *Service) okxWatcherBatchSize(ctx context.Context) int {
	return s.resolveRuntimeIntSetting(ctx, "OKX_WATCHER_BATCH_SIZE", s.cfg.OKXWatcherBatchSize)
}

func (s *Service) paymentReviewDeadline(ctx context.Context, order *model.Order) (*time.Time, bool) {
	return paymentReviewDeadlineWithTimeout(order, s.paymentReviewTimeoutMinutes(ctx))
}

func paymentReviewDeadlineWithTimeout(order *model.Order, timeoutMinutes int) (*time.Time, bool) {
	return paymentReviewDeadlineWithTimeoutAt(order, timeoutMinutes, time.Now())
}

func paymentReviewDeadlineWithTimeoutAt(order *model.Order, timeoutMinutes int, now time.Time) (*time.Time, bool) {
	if order == nil || order.PaidAt == nil {
		return nil, false
	}
	if order.PaymentStatus != "pending_review" && order.Status != "paid_pending_review" {
		return nil, false
	}

	if timeoutMinutes <= 0 {
		return nil, false
	}

	deadline := order.PaidAt.Add(time.Duration(timeoutMinutes) * time.Minute)
	return &deadline, now.After(deadline)
}

func lookupRuntimeSettingEnv(envKey string) (string, bool) {
	key := strings.TrimSpace(envKey)
	if key == "" {
		return "", false
	}

	value, exists := os.LookupEnv(key)
	if !exists {
		return "", false
	}

	normalized, ok := normalizeRuntimeSettingValue(key, value)
	if !ok {
		return "", false
	}

	return normalized, true
}

func normalizeRuntimeSettingValue(name string, value string) (string, bool) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", false
	}

	switch strings.TrimSpace(name) {
	case "ORDER_EXPIRE_MINUTES",
		"PAYMENT_REVIEW_TIMEOUT_MINUTES",
		"ORDER_SWEEP_INTERVAL_SECONDS",
		"ASYNC_CONCURRENCY",
		"ASYNC_POLL_INTERVAL_SECONDS",
		"OKX_WATCHER_INTERVAL_SECONDS",
		"OKX_WATCHER_BATCH_SIZE":
		parsed, err := strconv.Atoi(trimmed)
		if err != nil || parsed <= 0 {
			return "", false
		}
		return strconv.Itoa(parsed), true
	case "DELIVERY_RETRY_MAX_RETRIES", "DELIVERY_RETRY_DELAY_SECONDS":
		parsed, err := strconv.Atoi(trimmed)
		if err != nil || parsed < 0 {
			return "", false
		}
		return strconv.Itoa(parsed), true
	case "OKX_WATCHER_ENABLED":
		switch strings.ToLower(trimmed) {
		case "1", "true", "yes", "on":
			return "true", true
		case "0", "false", "no", "off":
			return "false", true
		default:
			return "", false
		}
	default:
		return trimmed, true
	}
}

func (s *Service) resolveRuntimeBoolSetting(ctx context.Context, name string, fallback bool) bool {
	fallbackValue := "false"
	if fallback {
		fallbackValue = "true"
	}

	resolved := s.resolveRuntimeSetting(ctx, name, fallbackValue)
	switch strings.ToLower(strings.TrimSpace(resolved.EffectiveValue)) {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return fallback
	}
}
