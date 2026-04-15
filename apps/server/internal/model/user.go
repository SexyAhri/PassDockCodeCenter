package model

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	BaseModel
	Email          *string        `gorm:"uniqueIndex:uk_users_email" json:"email,omitempty"`
	PasswordHash   *string        `json:"-"`
	DisplayName    string         `gorm:"not null;default:''" json:"display_name"`
	Role           string         `gorm:"not null;default:user;index:idx_users_role_status,priority:1" json:"role"`
	TelegramUserID *string        `gorm:"uniqueIndex:uk_users_telegram_user_id" json:"telegram_user_id,omitempty"`
	Status         string         `gorm:"not null;default:active;index:idx_users_role_status,priority:2" json:"status"`
	Locale         string         `gorm:"not null;default:zh-CN" json:"locale"`
	LastLoginAt    *time.Time     `json:"last_login_at,omitempty"`
	DeletedAt      gorm.DeletedAt `gorm:"index:idx_users_deleted_at" json:"-"`
}

type TelegramBinding struct {
	BaseModel
	UserID           uint   `gorm:"not null;index:idx_telegram_bindings_user_id" json:"user_id"`
	BotKey           string `gorm:"not null;default:default;uniqueIndex:uk_telegram_bindings_bot_user;uniqueIndex:uk_telegram_bindings_bot_chat" json:"bot_key"`
	TelegramUserID   string `gorm:"not null;uniqueIndex:uk_telegram_bindings_bot_user" json:"telegram_user_id"`
	TelegramUsername string `json:"telegram_username"`
	ChatID           string `gorm:"not null;uniqueIndex:uk_telegram_bindings_bot_chat" json:"chat_id"`
	BoundAt          time.Time
}

type InternalClientKey struct {
	BaseModel
	ClientKey             string `gorm:"not null;uniqueIndex:uk_internal_client_keys_client_key" json:"client_key"`
	ClientName            string `gorm:"not null" json:"client_name"`
	ClientSecretEncrypted string `gorm:"not null" json:"-"`
	Scopes                string `json:"scopes"`
	AllowedIPs            string `json:"allowed_ips"`
	Status                string `gorm:"not null;default:active;index:idx_internal_client_keys_status" json:"status"`
}

type AdminOperationLog struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	AdminUserID    *uint     `gorm:"index:idx_admin_operation_logs_admin_user_id" json:"admin_user_id,omitempty"`
	Module         string    `gorm:"not null;index:idx_admin_operation_logs_module_action,priority:1" json:"module"`
	Action         string    `gorm:"not null;index:idx_admin_operation_logs_module_action,priority:2" json:"action"`
	TargetID       string    `json:"target_id"`
	TargetType     string    `json:"target_type"`
	RequestIP      string    `json:"request_ip"`
	RequestPayload string    `json:"request_payload"`
	CreatedAt      time.Time `gorm:"index:idx_admin_operation_logs_created_at" json:"created_at"`
}
