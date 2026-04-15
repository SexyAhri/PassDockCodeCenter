package service

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
)

type ReadinessReport struct {
	Status string                    `json:"status"`
	Checks map[string]ReadinessCheck `json:"checks"`
}

type ReadinessCheck struct {
	Status  string `json:"status"`
	Backend string `json:"backend,omitempty"`
	Target  string `json:"target,omitempty"`
	Message string `json:"message,omitempty"`
}

func (s *Service) ReadinessReport(ctx context.Context) ReadinessReport {
	report := ReadinessReport{
		Status: "ready",
		Checks: map[string]ReadinessCheck{
			"database": s.databaseReadinessCheck(ctx),
			"storage":  s.storageReadinessCheck(ctx),
		},
	}

	for _, check := range report.Checks {
		if check.Status != "ready" {
			report.Status = "not_ready"
			break
		}
	}

	return report
}

func (s *Service) databaseReadinessCheck(ctx context.Context) ReadinessCheck {
	sqlDB, err := s.db.DB()
	if err != nil {
		return newNotReadyCheck("database", strings.TrimSpace(s.cfg.DBDriver), err)
	}

	if err := sqlDB.PingContext(ctx); err != nil {
		return newNotReadyCheck("database", strings.TrimSpace(s.cfg.DBDriver), err)
	}

	return newReadyCheck("database", strings.TrimSpace(s.cfg.DBDriver))
}

func (s *Service) storageReadinessCheck(ctx context.Context) ReadinessCheck {
	switch backend := normalizeUploadStorageType(s.cfg.StorageType); backend {
	case "local":
		return s.localStorageReadinessCheck()
	case "minio":
		return s.minIOStorageReadinessCheck(ctx)
	default:
		return newNotReadyCheck(backend, "", fmt.Errorf("storage type %q is not supported", s.cfg.StorageType))
	}
}

func (s *Service) localStorageReadinessCheck() ReadinessCheck {
	target := strings.TrimSpace(s.cfg.StorageLocalPath)
	if target == "" {
		return newNotReadyCheck("local", "", fmt.Errorf("storage path is empty"))
	}

	info, err := os.Stat(target)
	if err != nil {
		return newNotReadyCheck("local", target, err)
	}
	if !info.IsDir() {
		return newNotReadyCheck("local", target, fmt.Errorf("storage path is not a directory"))
	}

	return newReadyCheck("local", target)
}

func (s *Service) minIOStorageReadinessCheck(ctx context.Context) ReadinessCheck {
	target, err := s.buildMinIOBucketURL()
	if err != nil {
		return newNotReadyCheck("minio", "", err)
	}

	response, err := executeRetriedHTTPRequest(
		defaultMinIORetryAttempts,
		func() (*http.Request, error) {
			return s.buildSignedMinIORequest(
				ctx,
				http.MethodHead,
				target,
				nil,
				0,
				"",
				emptyPayloadSHA256,
			)
		},
		http.DefaultClient.Do,
		shouldRetryTransientHTTPRequest,
	)
	if err != nil {
		return newNotReadyCheck("minio", target, err)
	}
	defer response.Body.Close()

	if response.StatusCode >= http.StatusOK && response.StatusCode < http.StatusMultipleChoices {
		return newReadyCheck("minio", target)
	}
	if response.StatusCode == http.StatusNotFound {
		return newNotReadyCheck("minio", target, fmt.Errorf("bucket is missing"))
	}

	return newNotReadyCheck("minio", target, s.readMinIOError(response))
}

func newReadyCheck(backend string, target string) ReadinessCheck {
	return ReadinessCheck{
		Status:  "ready",
		Backend: strings.TrimSpace(backend),
		Target:  strings.TrimSpace(target),
	}
}

func newNotReadyCheck(backend string, target string, err error) ReadinessCheck {
	check := ReadinessCheck{
		Status:  "not_ready",
		Backend: strings.TrimSpace(backend),
		Target:  strings.TrimSpace(target),
	}
	if err != nil {
		check.Message = err.Error()
	}

	return check
}
