package model

import (
	"time"

	"gorm.io/datatypes"
)

type PaymentChannel struct {
	BaseModel
	ChannelKey     string         `gorm:"not null;uniqueIndex:uk_payment_channels_channel_key" json:"channel_key"`
	ChannelName    string         `gorm:"not null" json:"channel_name"`
	ChannelType    string         `gorm:"not null" json:"channel_type"`
	ProviderName   string         `gorm:"not null;default:''" json:"provider_name"`
	SettlementMode string         `gorm:"not null;default:manual" json:"settlement_mode"`
	ConfigJSON     datatypes.JSON `gorm:"column:config_encrypted" json:"config_encrypted"`
	Currency       string         `gorm:"not null;default:USD" json:"currency"`
	Enabled        bool           `gorm:"not null;default:true;index:idx_payment_channels_enabled_sort,priority:1" json:"enabled"`
	SortOrder      int            `gorm:"not null;default:0;index:idx_payment_channels_enabled_sort,priority:2" json:"sort_order"`
}

type IntegrationProvider struct {
	BaseModel
	ProviderKey        string              `gorm:"not null;uniqueIndex:uk_integration_providers_provider_key" json:"provider_key"`
	ProviderName       string              `gorm:"not null" json:"provider_name"`
	BaseURL            string              `gorm:"not null" json:"base_url"`
	AuthType           string              `gorm:"not null;default:none" json:"auth_type"`
	AuthConfigJSON     datatypes.JSON      `gorm:"column:auth_config_encrypted" json:"auth_config_encrypted"`
	TimeoutMS          int                 `gorm:"not null;default:10000" json:"timeout_ms"`
	RetryTimes         int                 `gorm:"not null;default:2" json:"retry_times"`
	HealthStatus       string              `gorm:"not null;default:unknown" json:"health_status"`
	LastCheckedAt      *time.Time          `json:"last_checked_at,omitempty"`
	Enabled            bool                `gorm:"not null;default:true;index:idx_integration_providers_enabled" json:"enabled"`
	IntegrationActions []IntegrationAction `gorm:"foreignKey:ProviderID" json:"-"`
}

type IntegrationAction struct {
	BaseModel
	ProviderID         uint           `gorm:"not null;uniqueIndex:uk_integration_actions_provider_action,priority:1" json:"provider_id"`
	ActionKey          string         `gorm:"not null;uniqueIndex:uk_integration_actions_provider_action,priority:2" json:"action_key"`
	HTTPMethod         string         `gorm:"not null;default:POST" json:"http_method"`
	PathTemplate       string         `gorm:"not null" json:"path_template"`
	HeaderTemplateJSON datatypes.JSON `gorm:"column:header_template" json:"header_template"`
	QueryTemplateJSON  datatypes.JSON `gorm:"column:query_template" json:"query_template"`
	BodyTemplateJSON   datatypes.JSON `gorm:"column:body_template" json:"body_template"`
	SuccessPath        string         `json:"success_path"`
	MessagePath        string         `json:"message_path"`
	CodeListPath       string         `json:"code_list_path"`
	ResultTransformer  string         `json:"result_transformer"`
	Enabled            bool           `gorm:"not null;default:true;index:idx_integration_actions_enabled" json:"enabled"`
}

type FulfillmentStrategy struct {
	BaseModel
	StrategyKey          string         `gorm:"not null;uniqueIndex:uk_fulfillment_strategies_strategy_key" json:"strategy_key"`
	StrategyName         string         `gorm:"not null" json:"strategy_name"`
	FulfillmentType      string         `gorm:"not null;index:idx_fulfillment_strategies_type_enabled,priority:1" json:"fulfillment_type"`
	ProviderKey          string         `json:"provider_key"`
	ActionKey            string         `json:"action_key"`
	RequestTemplateJSON  datatypes.JSON `gorm:"column:request_template" json:"request_template"`
	ResultSchemaJSON     datatypes.JSON `gorm:"column:result_schema" json:"result_schema"`
	DeliveryTemplateJSON datatypes.JSON `gorm:"column:delivery_template" json:"delivery_template"`
	RetryPolicyJSON      datatypes.JSON `gorm:"column:retry_policy" json:"retry_policy"`
	Enabled              bool           `gorm:"not null;default:true;index:idx_fulfillment_strategies_type_enabled,priority:2" json:"enabled"`
}

type DeliveryStrategy struct {
	BaseModel
	StrategyKey         string         `gorm:"not null;uniqueIndex:uk_delivery_strategies_strategy_key" json:"strategy_key"`
	StrategyName        string         `gorm:"not null" json:"strategy_name"`
	ChannelType         string         `gorm:"not null;index:idx_delivery_strategies_channel_enabled,priority:1" json:"channel_type"`
	MessageTemplateJSON datatypes.JSON `gorm:"column:message_template" json:"message_template"`
	MaskPolicy          string         `json:"mask_policy"`
	ResendAllowed       bool           `gorm:"not null;default:true" json:"resend_allowed"`
	Enabled             bool           `gorm:"not null;default:true;index:idx_delivery_strategies_channel_enabled,priority:2" json:"enabled"`
}

type Product struct {
	BaseModel
	ProductType            string         `gorm:"not null;index:idx_products_type_enabled_sort,priority:1" json:"product_type"`
	SKU                    string         `gorm:"not null;uniqueIndex:uk_products_sku" json:"sku"`
	Name                   string         `gorm:"not null" json:"name"`
	Description            string         `json:"description"`
	DisplayPrice           float64        `gorm:"not null;default:0" json:"display_price"`
	Currency               string         `gorm:"not null;default:USD" json:"currency"`
	Enabled                bool           `gorm:"not null;default:true;index:idx_products_type_enabled_sort,priority:2" json:"enabled"`
	SortOrder              int            `gorm:"not null;default:0;index:idx_products_type_enabled_sort,priority:3" json:"sort_order"`
	FulfillmentStrategyKey string         `gorm:"not null;index:idx_products_fulfillment_strategy_key" json:"fulfillment_strategy_key"`
	DeliveryStrategyKey    string         `json:"delivery_strategy_key"`
	MetadataJSON           datatypes.JSON `gorm:"column:metadata" json:"metadata"`
	ProductPrices          []ProductPrice `gorm:"foreignKey:ProductID" json:"-"`
}

type ProductPrice struct {
	BaseModel
	ProductID      uint    `gorm:"not null;uniqueIndex:uk_product_prices_product_template_payment_currency,priority:1" json:"product_id"`
	TemplateName   string  `gorm:"uniqueIndex:uk_product_prices_product_template_payment_currency,priority:2" json:"template_name"`
	PaymentMethod  string  `gorm:"not null;uniqueIndex:uk_product_prices_product_template_payment_currency,priority:3" json:"payment_method"`
	Currency       string  `gorm:"not null;default:USD;uniqueIndex:uk_product_prices_product_template_payment_currency,priority:4" json:"currency"`
	Amount         float64 `gorm:"not null;default:0" json:"amount"`
	Enabled        bool    `gorm:"not null;default:true;index:idx_product_prices_enabled" json:"enabled"`
	OriginalAmount float64 `json:"original_amount"`
	BillingCycle   string  `json:"billing_cycle"`
	SortOrder      int     `gorm:"not null;default:0" json:"sort_order"`
}
