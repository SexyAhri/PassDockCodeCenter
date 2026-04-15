package model

import (
	"time"

	"gorm.io/datatypes"
)

type Order struct {
	BaseModel
	OrderNo         string          `gorm:"not null;uniqueIndex:uk_orders_order_no" json:"order_no"`
	UserID          *uint           `gorm:"index:idx_orders_user_id" json:"user_id,omitempty"`
	ProductID       *uint           `gorm:"index:idx_orders_product_id" json:"product_id,omitempty"`
	ProductSnapshot datatypes.JSON  `gorm:"column:product_snapshot" json:"product_snapshot"`
	PaymentMethod   string          `gorm:"not null" json:"payment_method"`
	Currency        string          `gorm:"not null;default:USD" json:"currency"`
	PriceAmount     float64         `gorm:"not null;default:0" json:"price_amount"`
	PayAmount       float64         `json:"pay_amount"`
	Status          string          `gorm:"not null;default:created;index:idx_orders_status" json:"status"`
	PaymentStatus   string          `gorm:"not null;default:unpaid;index:idx_orders_payment_status" json:"payment_status"`
	DeliveryStatus  string          `gorm:"not null;default:pending;index:idx_orders_delivery_status" json:"delivery_status"`
	SourceChannel   string          `gorm:"not null;default:web;index:idx_orders_source_channel" json:"source_channel"`
	BuyerRef        string          `json:"buyer_ref"`
	ExternalRef     string          `gorm:"uniqueIndex:uk_orders_external_ref" json:"external_ref"`
	MetadataJSON    datatypes.JSON  `gorm:"column:metadata" json:"metadata"`
	ExpireAt        *time.Time      `json:"expire_at,omitempty"`
	PaidAt          *time.Time      `json:"paid_at,omitempty"`
	DeliveredAt     *time.Time      `json:"delivered_at,omitempty"`
	CancelledAt     *time.Time      `json:"cancelled_at,omitempty"`
	CompletedAt     *time.Time      `json:"completed_at,omitempty"`
	OrderItems      []OrderItem     `gorm:"foreignKey:OrderID" json:"-"`
	PaymentProofs   []PaymentProof  `gorm:"foreignKey:OrderID" json:"-"`
	PaymentRecords  []PaymentRecord `gorm:"foreignKey:OrderID" json:"-"`
	RefundRecords   []RefundRecord  `gorm:"foreignKey:OrderID" json:"-"`
}

type OrderItem struct {
	BaseModel
	OrderID                uint           `gorm:"not null;index:idx_order_items_order_id" json:"order_id"`
	ProductID              *uint          `gorm:"index:idx_order_items_product_id" json:"product_id,omitempty"`
	ProductSnapshot        datatypes.JSON `gorm:"column:product_snapshot" json:"product_snapshot"`
	Quantity               int            `gorm:"not null;default:1" json:"quantity"`
	UnitAmount             float64        `gorm:"not null;default:0" json:"unit_amount"`
	LineAmount             float64        `gorm:"not null;default:0" json:"line_amount"`
	FulfillmentStrategyKey string         `json:"fulfillment_strategy_key"`
	DeliveryStrategyKey    string         `json:"delivery_strategy_key"`
}

type OrderEvent struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	OrderID      uint           `gorm:"not null;index:idx_order_events_order_id" json:"order_id"`
	EventType    string         `gorm:"not null;index:idx_order_events_event_type" json:"event_type"`
	FromStatus   string         `json:"from_status"`
	ToStatus     string         `json:"to_status"`
	OperatorType string         `gorm:"not null;default:system" json:"operator_type"`
	OperatorID   *uint          `json:"operator_id,omitempty"`
	PayloadJSON  datatypes.JSON `gorm:"column:payload" json:"payload"`
	CreatedAt    time.Time      `gorm:"index:idx_order_events_created_at" json:"created_at"`
}

type PaymentRecord struct {
	BaseModel
	OrderID         uint           `gorm:"not null;index:idx_payment_records_order_id" json:"order_id"`
	PaymentMethod   string         `gorm:"not null" json:"payment_method"`
	MerchantOrderNo string         `json:"merchant_order_no"`
	ThirdPartyTxnNo string         `gorm:"index:idx_payment_records_third_party_txn_no" json:"third_party_txn_no"`
	ChainTxHash     string         `gorm:"index:idx_payment_records_chain_tx_hash" json:"chain_tx_hash"`
	PayerAccount    string         `json:"payer_account"`
	Amount          float64        `gorm:"not null;default:0" json:"amount"`
	Currency        string         `gorm:"not null;default:USD" json:"currency"`
	Status          string         `gorm:"not null;default:pending;index:idx_payment_records_status" json:"status"`
	RawPayloadJSON  datatypes.JSON `gorm:"column:raw_payload" json:"raw_payload"`
	ConfirmedAt     *time.Time     `json:"confirmed_at,omitempty"`
	FailedAt        *time.Time     `json:"failed_at,omitempty"`
}

type PaymentProof struct {
	BaseModel
	OrderID      uint       `gorm:"not null;index:idx_payment_proofs_order_id" json:"order_id"`
	ProofType    string     `gorm:"not null" json:"proof_type"`
	ObjectKey    string     `gorm:"not null" json:"object_key"`
	ObjectURL    string     `json:"object_url"`
	ReviewStatus string     `gorm:"not null;default:pending;index:idx_payment_proofs_review_status" json:"review_status"`
	ReviewedBy   *uint      `json:"reviewed_by,omitempty"`
	ReviewedAt   *time.Time `json:"reviewed_at,omitempty"`
	Note         string     `json:"note"`
}

type FulfillmentRecord struct {
	BaseModel
	OrderID             uint           `gorm:"not null;index:idx_fulfillment_records_order_id" json:"order_id"`
	StrategyKey         string         `gorm:"not null;index:idx_fulfillment_records_strategy_status,priority:1" json:"strategy_key"`
	FulfillmentType     string         `gorm:"not null" json:"fulfillment_type"`
	ProviderKey         string         `gorm:"index:idx_fulfillment_records_provider_action,priority:1" json:"provider_key"`
	ActionKey           string         `gorm:"index:idx_fulfillment_records_provider_action,priority:2" json:"action_key"`
	Status              string         `gorm:"not null;default:pending;index:idx_fulfillment_records_strategy_status,priority:2" json:"status"`
	RequestPayloadJSON  datatypes.JSON `gorm:"column:request_payload" json:"request_payload"`
	ResponsePayloadJSON datatypes.JSON `gorm:"column:response_payload" json:"response_payload"`
	ResultDataEncrypted string         `json:"result_data_encrypted"`
	ResultDataMasked    string         `json:"result_data_masked"`
	ExternalRef         string         `gorm:"uniqueIndex:uk_fulfillment_records_external_ref" json:"external_ref"`
	ErrorMessage        string         `json:"error_message"`
	StartedAt           *time.Time     `json:"started_at,omitempty"`
	FinishedAt          *time.Time     `json:"finished_at,omitempty"`
}

type CodeIssueRecord struct {
	BaseModel
	OrderID             uint       `gorm:"not null;index:idx_code_issue_records_order_id" json:"order_id"`
	OrderNo             string     `gorm:"not null;uniqueIndex:uk_code_issue_records_order_no" json:"order_no"`
	FulfillmentRecordID *uint      `gorm:"index:idx_code_issue_records_fulfillment_record_id" json:"fulfillment_record_id,omitempty"`
	CodeType            string     `gorm:"not null;index:idx_code_issue_records_code_type_status,priority:1" json:"code_type"`
	IssueStatus         string     `gorm:"not null;default:pending;index:idx_code_issue_records_code_type_status,priority:2" json:"issue_status"`
	ProviderKey         string     `json:"provider_key"`
	ActionKey           string     `json:"action_key"`
	IssuedCodeEncrypted string     `json:"issued_code_encrypted"`
	IssuedCodeMasked    string     `json:"issued_code_masked"`
	IssuedCount         int        `gorm:"not null;default:0" json:"issued_count"`
	IssuedAt            *time.Time `json:"issued_at,omitempty"`
	ErrorMessage        string     `json:"error_message"`
}

type DeliveryRecord struct {
	BaseModel
	OrderID                uint       `gorm:"not null;index:idx_delivery_records_order_id" json:"order_id"`
	FulfillmentRecordID    *uint      `gorm:"index:idx_delivery_records_fulfillment_record_id" json:"fulfillment_record_id,omitempty"`
	DeliveryChannel        string     `gorm:"not null;index:idx_delivery_records_channel_status,priority:1" json:"delivery_channel"`
	DeliveryTarget         string     `json:"delivery_target"`
	DeliveryStatus         string     `gorm:"not null;default:pending;index:idx_delivery_records_channel_status,priority:2" json:"delivery_status"`
	MessageID              string     `json:"message_id"`
	DeliveredContentMasked string     `json:"delivered_content_masked"`
	ErrorMessage           string     `json:"error_message"`
	DeliveredAt            *time.Time `json:"delivered_at,omitempty"`
}
