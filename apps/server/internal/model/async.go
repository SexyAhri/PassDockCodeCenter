package model

import (
	"time"

	"gorm.io/datatypes"
)

type AsyncJob struct {
	BaseModel
	OrderID       *uint          `gorm:"index:idx_async_jobs_order_type_status,priority:1" json:"order_id,omitempty"`
	OrderNo       string         `gorm:"index:idx_async_jobs_order_no" json:"order_no"`
	JobType       string         `gorm:"not null;index:idx_async_jobs_status_run_at,priority:2;index:idx_async_jobs_order_type_status,priority:2" json:"job_type"`
	Status        string         `gorm:"not null;default:pending;index:idx_async_jobs_status_run_at,priority:1;index:idx_async_jobs_order_type_status,priority:3" json:"status"`
	Attempt       int            `gorm:"not null;default:1" json:"attempt"`
	MaxAttempts   int            `gorm:"not null;default:0" json:"max_attempts"`
	PayloadJSON   datatypes.JSON `gorm:"column:payload" json:"payload"`
	RunAt         time.Time      `gorm:"not null;index:idx_async_jobs_status_run_at,priority:3" json:"run_at"`
	StartedAt     *time.Time     `json:"started_at,omitempty"`
	LastAttemptAt *time.Time     `json:"last_attempt_at,omitempty"`
	FinishedAt    *time.Time     `json:"finished_at,omitempty"`
	CancelledAt   *time.Time     `json:"cancelled_at,omitempty"`
	ErrorMessage  string         `json:"error_message"`
}
