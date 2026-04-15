package model

import "time"

type UserSession struct {
	BaseModel
	UserID     uint       `gorm:"not null;index:idx_user_sessions_user_id" json:"user_id"`
	TokenHash  string     `gorm:"not null;uniqueIndex:uk_user_sessions_token_hash" json:"-"`
	Scope      string     `gorm:"not null;default:user;index:idx_user_sessions_scope_status,priority:1" json:"scope"`
	Status     string     `gorm:"not null;default:active;index:idx_user_sessions_scope_status,priority:2" json:"status"`
	ExpiresAt  time.Time  `gorm:"index:idx_user_sessions_expires_at" json:"expires_at"`
	LastUsedAt *time.Time `json:"last_used_at,omitempty"`
	UserAgent  string     `json:"user_agent"`
	IPAddress  string     `json:"ip_address"`
}
