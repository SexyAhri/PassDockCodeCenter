package model

import (
	"time"

	"gorm.io/datatypes"
)

type PaymentCallbackLog struct {
	BaseModel
	OrderID        *uint          `gorm:"index:idx_payment_callback_logs_order_id" json:"order_id,omitempty"`
	OrderNo        string         `gorm:"index:idx_payment_callback_logs_order_no" json:"order_no"`
	CallbackKey    *string        `gorm:"uniqueIndex:uk_payment_callback_logs_callback_key" json:"callback_key,omitempty"`
	ChannelKey     string         `gorm:"not null;index:idx_payment_callback_logs_channel_status,priority:1" json:"channel_key"`
	Status         string         `gorm:"not null;index:idx_payment_callback_logs_channel_status,priority:2" json:"status"`
	Message        string         `json:"message"`
	SourceType     string         `gorm:"not null;default:system" json:"source_type"`
	RawPayloadJSON datatypes.JSON `gorm:"column:raw_payload" json:"raw_payload"`
	ProcessedAt    *time.Time     `json:"processed_at,omitempty"`
}

type PaymentWatcherRecord struct {
	BaseModel
	OrderID        *uint          `gorm:"index:idx_payment_watcher_records_order_id" json:"order_id,omitempty"`
	OrderNo        string         `gorm:"index:idx_payment_watcher_records_order_no" json:"order_no"`
	WatcherKey     *string        `gorm:"uniqueIndex:uk_payment_watcher_records_watcher_key" json:"watcher_key,omitempty"`
	ChannelKey     string         `gorm:"not null" json:"channel_key"`
	ChainTxHash    string         `gorm:"not null;index:idx_payment_watcher_records_chain_tx_hash" json:"chain_tx_hash"`
	Amount         float64        `gorm:"not null;default:0" json:"amount"`
	Currency       string         `gorm:"not null;default:USDT" json:"currency"`
	Status         string         `gorm:"not null;default:pending;index:idx_payment_watcher_records_status" json:"status"`
	RawPayloadJSON datatypes.JSON `gorm:"column:raw_payload" json:"raw_payload"`
	ConfirmedAt    *time.Time     `json:"confirmed_at,omitempty"`
}

type RefundRecord struct {
	BaseModel
	OrderID             uint           `gorm:"not null;index:idx_refund_records_order_id" json:"order_id"`
	PaymentRecordID     *uint          `gorm:"index:idx_refund_records_payment_record_id" json:"payment_record_id,omitempty"`
	RefundNo            string         `gorm:"not null;uniqueIndex:uk_refund_records_refund_no" json:"refund_no"`
	RefundType          string         `gorm:"not null;index:idx_refund_records_type_status,priority:1" json:"refund_type"`
	PaymentMethod       string         `gorm:"not null" json:"payment_method"`
	ChannelKey          string         `gorm:"not null;index:idx_refund_records_channel_status,priority:1" json:"channel_key"`
	ProviderKey         string         `json:"provider_key"`
	ActionKey           string         `json:"action_key"`
	Amount              float64        `gorm:"not null;default:0" json:"amount"`
	Currency            string         `gorm:"not null;default:USD" json:"currency"`
	Status              string         `gorm:"not null;default:pending;index:idx_refund_records_type_status,priority:2;index:idx_refund_records_channel_status,priority:2" json:"status"`
	ReceiptNo           string         `gorm:"index:idx_refund_records_receipt_no" json:"receipt_no"`
	RequestPayloadJSON  datatypes.JSON `gorm:"column:request_payload" json:"request_payload"`
	ResponsePayloadJSON datatypes.JSON `gorm:"column:response_payload" json:"response_payload"`
	FailureMessage      string         `json:"failure_message"`
	AttemptNo           int            `gorm:"not null;default:1" json:"attempt_no"`
	RequestedAt         *time.Time     `json:"requested_at,omitempty"`
	ProcessedAt         *time.Time     `json:"processed_at,omitempty"`
	RefundedAt          *time.Time     `json:"refunded_at,omitempty"`
}
