package service

import (
	"context"
	"errors"
	"log"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"

	"passdock/server/internal/model"
)

const (
	asyncJobTypeFulfillmentRetry = "order_fulfillment_retry"
	asyncJobTypeDeliveryRetry    = "order_delivery_retry"

	asyncJobStatusPending   = "pending"
	asyncJobStatusRunning   = "running"
	asyncJobStatusSucceeded = "succeeded"
	asyncJobStatusFailed    = "failed"
	asyncJobStatusCancelled = "cancelled"
)

type asyncJobContextKey string

const asyncJobAttemptContextKey asyncJobContextKey = "passdock_async_job_attempt"

type asyncRetryPolicy struct {
	MaxRetries    int
	BackoffSecond []int
}

type AsyncJobSweepResult struct {
	Claimed   int `json:"claimed"`
	Succeeded int `json:"succeeded"`
	Failed    int `json:"failed"`
	Cancelled int `json:"cancelled"`
}

func (s *Service) runAsyncJobWorker(ctx context.Context) {
	if ctx == nil {
		ctx = context.Background()
	}

	s.executeAsyncJobSweep(ctx)

	for {
		interval := time.Duration(maxInt(s.asyncPollIntervalSeconds(ctx), 10)) * time.Second
		timer := time.NewTimer(interval)

		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
			s.executeAsyncJobSweep(ctx)
		}
	}
}

func (s *Service) executeAsyncJobSweep(ctx context.Context) {
	result, err := s.RunAsyncJobSweep(ctx)
	if err != nil {
		log.Printf("passdock: async retry sweep failed: %v", err)
		return
	}

	if result.Claimed == 0 {
		return
	}

	log.Printf(
		"passdock: async retry sweep processed claimed=%d succeeded=%d failed=%d cancelled=%d",
		result.Claimed,
		result.Succeeded,
		result.Failed,
		result.Cancelled,
	)
}

func (s *Service) RunAsyncJobSweep(ctx context.Context) (AsyncJobSweepResult, error) {
	if ctx == nil {
		ctx = context.Background()
	}

	result := AsyncJobSweepResult{}
	batchSize := maxInt(s.asyncConcurrency(ctx), 1)

	for {
		now := time.Now()
		jobs := make([]model.AsyncJob, 0, batchSize)
		for len(jobs) < batchSize {
			job, err := s.claimNextAsyncJob(ctx, now)
			if err != nil {
				return result, err
			}
			if job == nil {
				break
			}
			jobs = append(jobs, *job)
		}
		if len(jobs) == 0 {
			return result, nil
		}

		result.Claimed += len(jobs)

		type jobOutcome struct {
			status string
		}

		outcomes := make(chan jobOutcome, len(jobs))
		for _, job := range jobs {
			job := job
			go func() {
				outcomes <- jobOutcome{status: s.executeAsyncJob(ctx, &job)}
			}()
		}

		for range jobs {
			switch outcome := <-outcomes; outcome.status {
			case asyncJobStatusSucceeded:
				result.Succeeded++
			case asyncJobStatusCancelled:
				result.Cancelled++
			default:
				result.Failed++
			}
		}

		if len(jobs) < batchSize {
			return result, nil
		}
	}
}

func (s *Service) executeAsyncJob(ctx context.Context, job *model.AsyncJob) string {
	if job == nil {
		return asyncJobStatusCancelled
	}

	execCtx := context.WithValue(ctx, asyncJobAttemptContextKey, job.Attempt)
	err := s.runAsyncJob(execCtx, job)
	now := time.Now()

	switch {
	case err == nil:
		_ = s.updateAsyncJobStatus(context.Background(), job.ID, asyncJobStatusRunning, map[string]any{
			"status":        asyncJobStatusSucceeded,
			"finished_at":   now,
			"error_message": "",
		})
		return asyncJobStatusSucceeded
	case isAsyncTerminalJobError(err):
		_ = s.updateAsyncJobStatus(context.Background(), job.ID, asyncJobStatusRunning, map[string]any{
			"status":        asyncJobStatusCancelled,
			"finished_at":   now,
			"cancelled_at":  now,
			"error_message": strings.TrimSpace(err.Error()),
		})
		return asyncJobStatusCancelled
	default:
		_ = s.updateAsyncJobStatus(context.Background(), job.ID, asyncJobStatusRunning, map[string]any{
			"status":        asyncJobStatusFailed,
			"finished_at":   now,
			"error_message": strings.TrimSpace(err.Error()),
		})
		return asyncJobStatusFailed
	}
}

func (s *Service) runAsyncJob(ctx context.Context, job *model.AsyncJob) error {
	if job == nil {
		return ErrInvalidInput
	}

	switch strings.TrimSpace(job.JobType) {
	case asyncJobTypeFulfillmentRetry:
		return s.RetryAdminOrderFulfillment(ctx, strings.TrimSpace(job.OrderNo), AuditMeta{})
	case asyncJobTypeDeliveryRetry:
		return s.RetryAdminOrderDelivery(ctx, strings.TrimSpace(job.OrderNo), AuditMeta{})
	default:
		return ErrInvalidInput
	}
}

func (s *Service) claimNextAsyncJob(ctx context.Context, now time.Time) (*model.AsyncJob, error) {
	var claimed model.AsyncJob
	noDueJob := false
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var candidate model.AsyncJob
		if err := tx.WithContext(ctx).
			Where("status = ?", asyncJobStatusPending).
			Order("run_at ASC, id ASC").
			First(&candidate).Error; err != nil {
			return err
		}
		if candidate.RunAt.After(now) {
			noDueJob = true
			return nil
		}

		updates := map[string]any{
			"status":          asyncJobStatusRunning,
			"started_at":      now,
			"last_attempt_at": now,
			"cancelled_at":    nil,
		}
		result := tx.WithContext(ctx).
			Model(&model.AsyncJob{}).
			Where("id = ? AND status = ?", candidate.ID, asyncJobStatusPending).
			Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}

		candidate.Status = asyncJobStatusRunning
		candidate.StartedAt = &now
		candidate.LastAttemptAt = &now
		claimed = candidate
		return nil
	})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	if noDueJob {
		return nil, nil
	}

	return &claimed, nil
}

func (s *Service) updateAsyncJobStatus(ctx context.Context, jobID uint, expectedStatus string, updates map[string]any) error {
	if jobID == 0 {
		return nil
	}

	query := s.db.WithContext(ctx).Model(&model.AsyncJob{}).Where("id = ?", jobID)
	if strings.TrimSpace(expectedStatus) != "" {
		query = query.Where("status = ?", strings.TrimSpace(expectedStatus))
	}

	return query.Updates(updates).Error
}

func (s *Service) scheduleFulfillmentRetryIfNeededTx(
	ctx context.Context,
	tx *gorm.DB,
	order *model.Order,
	record *model.FulfillmentRecord,
	message string,
) error {
	if tx == nil || order == nil || record == nil {
		return nil
	}

	strategy, err := s.resolveFulfillmentStrategyByRoute(ctx, record.StrategyKey)
	if err != nil {
		if err == ErrNotFound {
			return nil
		}
		return err
	}

	policy := parseAsyncRetryPolicy(parseJSON[map[string]any](strategy.RetryPolicyJSON))
	nextAttempt := currentAsyncRetryAttempt(ctx) + 1
	if policy.MaxRetries < nextAttempt {
		return nil
	}

	runAt := time.Now().Add(policy.delayForAttempt(nextAttempt, 60))
	return s.replacePendingAsyncJobTx(ctx, tx, asyncJobUpsertInput{
		OrderID:     &order.ID,
		OrderNo:     order.OrderNo,
		JobType:     asyncJobTypeFulfillmentRetry,
		Attempt:     nextAttempt,
		MaxAttempts: policy.MaxRetries,
		RunAt:       runAt,
		Payload: map[string]any{
			"strategy_key":           record.StrategyKey,
			"fulfillment_record_id":  record.ID,
			"last_error":             strings.TrimSpace(message),
			"retry_source":           "fulfillment_failed",
			"next_attempt_sequence":  nextAttempt,
			"configured_max_retries": policy.MaxRetries,
		},
	})
}

func (s *Service) scheduleDeliveryRetryIfNeededTx(
	ctx context.Context,
	tx *gorm.DB,
	order *model.Order,
	record *model.DeliveryRecord,
	message string,
) error {
	if tx == nil || order == nil || record == nil {
		return nil
	}

	_, deliveryStrategyKey, err := s.orderStrategyKeys(order)
	if err != nil {
		if err == ErrInvalidInput {
			return nil
		}
		return err
	}

	deliveryStrategy, err := s.resolveDeliveryStrategyByRoute(ctx, deliveryStrategyKey)
	if err != nil {
		if err == ErrNotFound {
			return nil
		}
		return err
	}
	if !deliveryStrategy.ResendAllowed {
		return nil
	}

	policy := asyncRetryPolicy{
		MaxRetries: s.deliveryRetryMaxRetries(ctx),
		BackoffSecond: []int{
			s.deliveryRetryDelaySeconds(ctx),
		},
	}
	nextAttempt := currentAsyncRetryAttempt(ctx) + 1
	if policy.MaxRetries < nextAttempt {
		return nil
	}

	runAt := time.Now().Add(policy.delayForAttempt(nextAttempt, 60))
	return s.replacePendingAsyncJobTx(ctx, tx, asyncJobUpsertInput{
		OrderID:     &order.ID,
		OrderNo:     order.OrderNo,
		JobType:     asyncJobTypeDeliveryRetry,
		Attempt:     nextAttempt,
		MaxAttempts: policy.MaxRetries,
		RunAt:       runAt,
		Payload: map[string]any{
			"delivery_record_id":     record.ID,
			"delivery_channel":       record.DeliveryChannel,
			"last_error":             strings.TrimSpace(message),
			"retry_source":           "delivery_failed",
			"next_attempt_sequence":  nextAttempt,
			"configured_max_retries": policy.MaxRetries,
		},
	})
}

type asyncJobUpsertInput struct {
	OrderID     *uint
	OrderNo     string
	JobType     string
	Attempt     int
	MaxAttempts int
	RunAt       time.Time
	Payload     map[string]any
}

func (s *Service) replacePendingAsyncJobTx(ctx context.Context, tx *gorm.DB, input asyncJobUpsertInput) error {
	if tx == nil || strings.TrimSpace(input.JobType) == "" || strings.TrimSpace(input.OrderNo) == "" {
		return nil
	}

	now := time.Now()
	if err := s.cancelPendingAsyncJobsTx(ctx, tx, input.OrderID, input.OrderNo, "superseded_by_new_retry", input.JobType); err != nil {
		return err
	}

	record := model.AsyncJob{
		OrderID:     input.OrderID,
		OrderNo:     strings.TrimSpace(input.OrderNo),
		JobType:     strings.TrimSpace(input.JobType),
		Status:      asyncJobStatusPending,
		Attempt:     input.Attempt,
		MaxAttempts: input.MaxAttempts,
		PayloadJSON: jsonValue(input.Payload),
		RunAt:       input.RunAt,
	}
	if record.RunAt.IsZero() {
		record.RunAt = now
	}

	return tx.WithContext(ctx).Create(&record).Error
}

func (s *Service) cancelPendingAsyncJobsTx(
	ctx context.Context,
	tx *gorm.DB,
	orderID *uint,
	orderNo string,
	reason string,
	jobTypes ...string,
) error {
	if tx == nil {
		return nil
	}

	query := tx.WithContext(ctx).Model(&model.AsyncJob{}).Where("status = ?", asyncJobStatusPending)
	switch {
	case orderID != nil && *orderID > 0:
		query = query.Where("order_id = ?", *orderID)
	case strings.TrimSpace(orderNo) != "":
		query = query.Where("order_no = ?", strings.TrimSpace(orderNo))
	default:
		return nil
	}
	if len(jobTypes) > 0 {
		query = query.Where("job_type IN ?", jobTypes)
	}

	now := time.Now()
	return query.Updates(map[string]any{
		"status":        asyncJobStatusCancelled,
		"cancelled_at":  now,
		"finished_at":   now,
		"error_message": strings.TrimSpace(reason),
	}).Error
}

func parseAsyncRetryPolicy(payload map[string]any) asyncRetryPolicy {
	result := asyncRetryPolicy{}
	if value, ok := parseAsyncInt(payload["max_retries"]); ok && value >= 0 {
		result.MaxRetries = value
	}

	switch typed := payload["backoff_seconds"].(type) {
	case []any:
		for _, value := range typed {
			if parsed, ok := parseAsyncInt(value); ok && parsed >= 0 {
				result.BackoffSecond = append(result.BackoffSecond, parsed)
			}
		}
	case []int:
		for _, value := range typed {
			if value >= 0 {
				result.BackoffSecond = append(result.BackoffSecond, value)
			}
		}
	}

	if len(result.BackoffSecond) == 0 {
		if delay, ok := parseAsyncInt(payload["delay_seconds"]); ok && delay >= 0 {
			result.BackoffSecond = []int{delay}
		}
	}

	return result
}

func (p asyncRetryPolicy) delayForAttempt(attempt int, fallbackSeconds int) time.Duration {
	if attempt <= 0 {
		attempt = 1
	}

	if len(p.BackoffSecond) > 0 {
		index := attempt - 1
		if index < 0 {
			index = 0
		}
		if index >= len(p.BackoffSecond) {
			index = len(p.BackoffSecond) - 1
		}
		return time.Duration(maxInt(p.BackoffSecond[index], 0)) * time.Second
	}

	return time.Duration(maxInt(fallbackSeconds, 0)) * time.Second
}

func parseAsyncInt(value any) (int, bool) {
	switch typed := value.(type) {
	case int:
		return typed, true
	case int8:
		return int(typed), true
	case int16:
		return int(typed), true
	case int32:
		return int(typed), true
	case int64:
		return int(typed), true
	case uint:
		return int(typed), true
	case uint8:
		return int(typed), true
	case uint16:
		return int(typed), true
	case uint32:
		return int(typed), true
	case uint64:
		return int(typed), true
	case float32:
		return int(typed), true
	case float64:
		return int(typed), true
	case string:
		parsed, err := strconv.Atoi(strings.TrimSpace(typed))
		if err != nil {
			return 0, false
		}
		return parsed, true
	default:
		return 0, false
	}
}

func currentAsyncRetryAttempt(ctx context.Context) int {
	if ctx == nil {
		return 0
	}

	value := ctx.Value(asyncJobAttemptContextKey)
	attempt, ok := value.(int)
	if !ok || attempt < 0 {
		return 0
	}

	return attempt
}

func isAsyncTerminalJobError(err error) bool {
	return errors.Is(err, ErrInvalidState) || errors.Is(err, ErrNotFound)
}

func auditEventOperator(meta AuditMeta) (string, *uint) {
	if meta.AdminUserID != nil || strings.TrimSpace(meta.RequestIP) != "" {
		return "admin", meta.AdminUserID
	}

	return "system", nil
}

func shouldWriteAdminLog(meta AuditMeta) bool {
	return meta.AdminUserID != nil || strings.TrimSpace(meta.RequestIP) != ""
}
