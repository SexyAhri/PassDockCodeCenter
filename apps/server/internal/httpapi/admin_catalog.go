package httpapi

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"passdock/server/internal/service"
)

type productRequest struct {
	ProductType            string         `json:"product_type"`
	SKU                    string         `json:"sku"`
	Name                   string         `json:"name"`
	Description            string         `json:"description"`
	DisplayPrice           string         `json:"display_price"`
	Currency               string         `json:"currency"`
	Enabled                bool           `json:"enabled"`
	SortOrder              int            `json:"sort_order"`
	FulfillmentStrategyKey string         `json:"fulfillment_strategy_key"`
	DeliveryStrategyKey    string         `json:"delivery_strategy_key"`
	Metadata               map[string]any `json:"metadata"`
	PaymentMethods         []string       `json:"payment_methods"`
}

type productPriceRequest struct {
	PriceID        string `json:"price_id"`
	TemplateName   string `json:"template_name"`
	PaymentMethod  string `json:"payment_method"`
	Amount         string `json:"amount"`
	OriginalAmount string `json:"original_amount"`
	Currency       string `json:"currency"`
	BillingCycle   string `json:"billing_cycle"`
	Enabled        bool   `json:"enabled"`
	SortOrder      int    `json:"sort_order"`
}

type paymentChannelRequest struct {
	ChannelKey     string `json:"channel_key"`
	ChannelName    string `json:"channel_name"`
	ChannelType    string `json:"channel_type"`
	ProviderName   string `json:"provider_name"`
	Currency       string `json:"currency"`
	SettlementMode string `json:"settlement_mode"`
	Enabled        bool   `json:"enabled"`
	QRValue        string `json:"qr_value"`
	Reference      string `json:"reference"`
	Config         struct {
		QRContent               string            `json:"qr_content"`
		DisplayNameZH           string            `json:"display_name_zh"`
		DisplayNameEN           string            `json:"display_name_en"`
		ModeLabelZH             string            `json:"mode_label_zh"`
		ModeLabelEN             string            `json:"mode_label_en"`
		Reference               string            `json:"reference"`
		AutoFulfill             bool              `json:"auto_fulfill"`
		AutoDeliver             bool              `json:"auto_deliver"`
		CallbackAuthType        string            `json:"callback_auth_type"`
		CallbackSecret          string            `json:"callback_secret"`
		CallbackKey             string            `json:"callback_key"`
		CallbackHeaderName      string            `json:"callback_header_name"`
		CallbackSignHeader      string            `json:"callback_sign_header"`
		CallbackTimestampHeader string            `json:"callback_timestamp_header"`
		CallbackNonceHeader     string            `json:"callback_nonce_header"`
		CallbackSignatureParam  string            `json:"callback_signature_param"`
		CallbackTimestampParam  string            `json:"callback_timestamp_param"`
		CallbackNonceParam      string            `json:"callback_nonce_param"`
		CallbackTTLSeconds      int               `json:"callback_ttl_seconds"`
		CallbackSignSource      string            `json:"callback_sign_source"`
		CallbackPayloadMapping  map[string]string `json:"callback_payload_mapping"`
		CallbackSuccessField    string            `json:"callback_success_field"`
		CallbackSuccessValues   []string          `json:"callback_success_values"`
		RefundProviderKey       string            `json:"refund_provider_key"`
		RefundActionKey         string            `json:"refund_action_key"`
		RefundStatusPath        string            `json:"refund_status_path"`
		RefundReceiptPath       string            `json:"refund_receipt_path"`
	} `json:"config"`
}

type providerRequest struct {
	ProviderKey  string         `json:"provider_key"`
	ProviderName string         `json:"provider_name"`
	BaseURL      string         `json:"base_url"`
	AuthType     string         `json:"auth_type"`
	RetryTimes   int            `json:"retry_times"`
	TimeoutMS    int            `json:"timeout_ms"`
	Enabled      bool           `json:"enabled"`
	Health       string         `json:"health"`
	AuthConfig   map[string]any `json:"auth_config"`
}

type actionRequest struct {
	ProviderKey    string         `json:"provider_key"`
	ActionKey      string         `json:"action_key"`
	HTTPMethod     string         `json:"http_method"`
	PathTemplate   string         `json:"path_template"`
	SuccessPath    string         `json:"success_path"`
	MessagePath    string         `json:"message_path"`
	CodeListPath   string         `json:"code_list_path"`
	Enabled        bool           `json:"enabled"`
	HeaderTemplate map[string]any `json:"header_template"`
	QueryTemplate  map[string]any `json:"query_template"`
	BodyTemplate   map[string]any `json:"body_template"`
}

type actionTestRequest struct {
	Mode string `json:"mode"`
}

type fulfillmentStrategyRequest struct {
	StrategyKey      string         `json:"strategy_key"`
	StrategyName     string         `json:"strategy_name"`
	FulfillmentType  string         `json:"fulfillment_type"`
	ProviderKey      string         `json:"provider_key"`
	ActionKey        string         `json:"action_key"`
	Enabled          bool           `json:"enabled"`
	RequestTemplate  map[string]any `json:"request_template"`
	ResultSchema     map[string]any `json:"result_schema"`
	DeliveryTemplate map[string]any `json:"delivery_template"`
	RetryPolicy      map[string]any `json:"retry_policy"`
}

type deliveryStrategyRequest struct {
	StrategyKey     string         `json:"strategy_key"`
	StrategyName    string         `json:"strategy_name"`
	ChannelType     string         `json:"channel_type"`
	MaskPolicy      string         `json:"mask_policy"`
	ResendAllowed   bool           `json:"resend_allowed"`
	Enabled         bool           `json:"enabled"`
	MessageTemplate map[string]any `json:"message_template"`
}

func (h *Handler) registerAdminCatalogRoutes(admin *gin.RouterGroup) {
	admin.GET("/products", h.listAdminProducts)
	admin.POST("/products", h.createAdminProduct)
	admin.PUT("/products/:productId", h.updateAdminProduct)
	admin.DELETE("/products/:productId", h.deleteAdminProduct)
	admin.GET("/products/:productId/prices", h.listAdminProductPrices)
	admin.POST("/products/:productId/prices", h.upsertAdminProductPrice)
	admin.DELETE("/products/:productId/prices/:priceId", h.deleteAdminProductPrice)

	admin.GET("/payment-channels", h.listAdminPaymentChannels)
	admin.POST("/payment-channels", h.createAdminPaymentChannel)
	admin.PUT("/payment-channels/:channelId", h.updateAdminPaymentChannel)
	admin.DELETE("/payment-channels/:channelId", h.deleteAdminPaymentChannel)

	integrations := admin.Group("/integrations")
	integrations.GET("/providers", h.listAdminProviders)
	integrations.POST("/providers", h.createAdminProvider)
	integrations.PUT("/providers/:providerId", h.updateAdminProvider)
	integrations.DELETE("/providers/:providerId", h.deleteAdminProvider)
	integrations.POST("/providers/:providerId/health-check", h.healthCheckAdminProvider)
	integrations.GET("/providers/:providerId/actions", h.listAdminActions)
	integrations.POST("/providers/:providerId/actions", h.createAdminAction)
	integrations.PUT("/actions/:actionId", h.updateAdminAction)
	integrations.DELETE("/actions/:actionId", h.deleteAdminAction)
	integrations.POST("/actions/:actionId/test", h.testAdminAction)

	admin.GET("/fulfillment-strategies", h.listAdminFulfillmentStrategies)
	admin.POST("/fulfillment-strategies", h.createAdminFulfillmentStrategy)
	admin.PUT("/fulfillment-strategies/:strategyId", h.updateAdminFulfillmentStrategy)
	admin.DELETE("/fulfillment-strategies/:strategyId", h.deleteAdminFulfillmentStrategy)
	admin.POST("/fulfillment-strategies/:strategyId/preview", h.previewAdminFulfillmentStrategy)

	admin.GET("/delivery-strategies", h.listAdminDeliveryStrategies)
	admin.POST("/delivery-strategies", h.createAdminDeliveryStrategy)
	admin.PUT("/delivery-strategies/:strategyId", h.updateAdminDeliveryStrategy)
	admin.DELETE("/delivery-strategies/:strategyId", h.deleteAdminDeliveryStrategy)
	admin.POST("/delivery-strategies/:strategyId/test", h.testAdminDeliveryStrategy)
}

func (h *Handler) listAdminProducts(c *gin.Context) {
	data, err := h.svc.ListAdminProducts(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}
	respondOK(c, map[string]any{"items": data})
}

func (h *Handler) createAdminProduct(c *gin.Context) {
	h.upsertAdminProduct(c, "")
}

func (h *Handler) updateAdminProduct(c *gin.Context) {
	h.upsertAdminProduct(c, c.Param("productId"))
}

func (h *Handler) upsertAdminProduct(c *gin.Context, routeID string) {
	var request productRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}

	if err := h.svc.UpsertAdminProduct(c.Request.Context(), routeID, service.ProductUpsertInput{
		ProductType:            request.ProductType,
		SKU:                    request.SKU,
		Name:                   request.Name,
		Description:            request.Description,
		DisplayPrice:           request.DisplayPrice,
		Currency:               request.Currency,
		Enabled:                request.Enabled,
		SortOrder:              request.SortOrder,
		FulfillmentStrategyKey: request.FulfillmentStrategyKey,
		DeliveryStrategyKey:    request.DeliveryStrategyKey,
		Metadata:               request.Metadata,
		PaymentMethods:         request.PaymentMethods,
	}); err != nil {
		respondError(c, err)
		return
	}

	action := "create_product"
	target := request.SKU
	if routeID != "" {
		action = "update_product"
		target = routeID
	}
	h.svc.RecordAdminAction(c.Request.Context(), h.auditMeta(c), "products", action, target, "product", request)
	c.Status(http.StatusNoContent)
}

func (h *Handler) deleteAdminProduct(c *gin.Context) {
	if err := h.svc.DeleteAdminProduct(c.Request.Context(), c.Param("productId")); err != nil {
		respondError(c, err)
		return
	}
	h.svc.RecordAdminAction(c.Request.Context(), h.auditMeta(c), "products", "delete_product", c.Param("productId"), "product", nil)
	c.Status(http.StatusNoContent)
}

func (h *Handler) listAdminProductPrices(c *gin.Context) {
	data, err := h.svc.ListAdminProductPrices(c.Request.Context(), c.Param("productId"))
	if err != nil {
		respondError(c, err)
		return
	}
	respondOK(c, map[string]any{"items": data})
}

func (h *Handler) upsertAdminProductPrice(c *gin.Context) {
	var request productPriceRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}

	if err := h.svc.UpsertAdminProductPrice(c.Request.Context(), c.Param("productId"), service.ProductPriceUpsertInput{
		PriceID:        request.PriceID,
		TemplateName:   request.TemplateName,
		PaymentMethod:  request.PaymentMethod,
		Amount:         request.Amount,
		OriginalAmount: request.OriginalAmount,
		Currency:       request.Currency,
		BillingCycle:   request.BillingCycle,
		Enabled:        request.Enabled,
		SortOrder:      request.SortOrder,
	}); err != nil {
		respondError(c, err)
		return
	}

	target := firstNonEmpty(request.PriceID, request.TemplateName+":"+request.PaymentMethod)
	h.svc.RecordAdminAction(c.Request.Context(), h.auditMeta(c), "products", "upsert_price_template", target, "product_price", request)
	c.Status(http.StatusNoContent)
}

func (h *Handler) deleteAdminProductPrice(c *gin.Context) {
	if err := h.svc.DeleteAdminProductPrice(c.Request.Context(), c.Param("productId"), c.Param("priceId")); err != nil {
		respondError(c, err)
		return
	}
	h.svc.RecordAdminAction(c.Request.Context(), h.auditMeta(c), "products", "delete_price_template", c.Param("priceId"), "product_price", nil)
	c.Status(http.StatusNoContent)
}

func (h *Handler) listAdminPaymentChannels(c *gin.Context) {
	data, err := h.svc.ListAdminPaymentChannels(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}
	respondOK(c, map[string]any{"items": data})
}

func (h *Handler) createAdminPaymentChannel(c *gin.Context) {
	h.upsertAdminPaymentChannel(c, "")
}

func (h *Handler) updateAdminPaymentChannel(c *gin.Context) {
	h.upsertAdminPaymentChannel(c, c.Param("channelId"))
}

func (h *Handler) upsertAdminPaymentChannel(c *gin.Context, routeID string) {
	var request paymentChannelRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}

	if err := h.svc.UpsertAdminPaymentChannel(c.Request.Context(), routeID, service.PaymentChannelUpsertInput{
		ChannelKey:              request.ChannelKey,
		ChannelName:             request.ChannelName,
		ChannelType:             request.ChannelType,
		ProviderName:            request.ProviderName,
		Currency:                request.Currency,
		SettlementMode:          request.SettlementMode,
		Enabled:                 request.Enabled,
		QRValue:                 firstNonEmpty(request.Config.QRContent, request.QRValue),
		DisplayNameZH:           request.Config.DisplayNameZH,
		DisplayNameEN:           request.Config.DisplayNameEN,
		ModeLabelZH:             request.Config.ModeLabelZH,
		ModeLabelEN:             request.Config.ModeLabelEN,
		Reference:               firstNonEmpty(request.Config.Reference, request.Reference),
		AutoFulfill:             request.Config.AutoFulfill,
		AutoDeliver:             request.Config.AutoDeliver,
		CallbackAuthType:        request.Config.CallbackAuthType,
		CallbackSecret:          request.Config.CallbackSecret,
		CallbackKey:             request.Config.CallbackKey,
		CallbackHeaderName:      request.Config.CallbackHeaderName,
		CallbackSignHeader:      request.Config.CallbackSignHeader,
		CallbackTimestampHeader: request.Config.CallbackTimestampHeader,
		CallbackNonceHeader:     request.Config.CallbackNonceHeader,
		CallbackSignatureParam:  request.Config.CallbackSignatureParam,
		CallbackTimestampParam:  request.Config.CallbackTimestampParam,
		CallbackNonceParam:      request.Config.CallbackNonceParam,
		CallbackTTLSeconds:      request.Config.CallbackTTLSeconds,
		CallbackSignSource:      request.Config.CallbackSignSource,
		CallbackPayloadMapping:  request.Config.CallbackPayloadMapping,
		CallbackSuccessField:    request.Config.CallbackSuccessField,
		CallbackSuccessValues:   request.Config.CallbackSuccessValues,
		RefundProviderKey:       request.Config.RefundProviderKey,
		RefundActionKey:         request.Config.RefundActionKey,
		RefundStatusPath:        request.Config.RefundStatusPath,
		RefundReceiptPath:       request.Config.RefundReceiptPath,
	}); err != nil {
		respondError(c, err)
		return
	}

	action := "create_payment_channel"
	target := request.ChannelKey
	if routeID != "" {
		action = "update_payment_channel"
		target = routeID
	}
	h.svc.RecordAdminAction(c.Request.Context(), h.auditMeta(c), "payment_channels", action, target, "payment_channel", request)
	c.Status(http.StatusNoContent)
}

func (h *Handler) deleteAdminPaymentChannel(c *gin.Context) {
	if err := h.svc.DeleteAdminPaymentChannel(c.Request.Context(), c.Param("channelId")); err != nil {
		respondError(c, err)
		return
	}
	h.svc.RecordAdminAction(c.Request.Context(), h.auditMeta(c), "payment_channels", "delete_payment_channel", c.Param("channelId"), "payment_channel", nil)
	c.Status(http.StatusNoContent)
}

func (h *Handler) listAdminProviders(c *gin.Context) {
	data, err := h.svc.ListAdminProviders(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}
	respondOK(c, map[string]any{"items": data})
}

func (h *Handler) createAdminProvider(c *gin.Context) {
	h.upsertAdminProvider(c, "")
}

func (h *Handler) updateAdminProvider(c *gin.Context) {
	h.upsertAdminProvider(c, c.Param("providerId"))
}

func (h *Handler) upsertAdminProvider(c *gin.Context, routeID string) {
	var request providerRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}

	if err := h.svc.UpsertAdminProvider(c.Request.Context(), routeID, service.ProviderUpsertInput{
		ProviderKey:  request.ProviderKey,
		ProviderName: request.ProviderName,
		BaseURL:      request.BaseURL,
		AuthType:     request.AuthType,
		RetryTimes:   request.RetryTimes,
		TimeoutMS:    request.TimeoutMS,
		Enabled:      request.Enabled,
		Health:       request.Health,
		AuthConfig:   request.AuthConfig,
	}); err != nil {
		respondError(c, err)
		return
	}

	action := "create_provider"
	target := request.ProviderKey
	if routeID != "" {
		action = "update_provider"
		target = routeID
	}
	h.svc.RecordAdminAction(c.Request.Context(), h.auditMeta(c), "integration_providers", action, target, "integration_provider", request)
	c.Status(http.StatusNoContent)
}

func (h *Handler) deleteAdminProvider(c *gin.Context) {
	if err := h.svc.DeleteAdminProvider(c.Request.Context(), c.Param("providerId")); err != nil {
		respondError(c, err)
		return
	}
	h.svc.RecordAdminAction(c.Request.Context(), h.auditMeta(c), "integration_providers", "delete_provider", c.Param("providerId"), "integration_provider", nil)
	c.Status(http.StatusNoContent)
}

func (h *Handler) healthCheckAdminProvider(c *gin.Context) {
	data, err := h.svc.HealthCheckProvider(c.Request.Context(), c.Param("providerId"))
	if err != nil {
		respondError(c, err)
		return
	}
	h.svc.RecordAdminAction(c.Request.Context(), h.auditMeta(c), "integration_providers", "health_check_provider", c.Param("providerId"), "integration_provider", data)
	respondOK(c, data)
}

func (h *Handler) listAdminActions(c *gin.Context) {
	data, err := h.svc.ListAdminActions(c.Request.Context(), c.Param("providerId"))
	if err != nil {
		respondError(c, err)
		return
	}
	respondOK(c, map[string]any{"items": data})
}

func (h *Handler) createAdminAction(c *gin.Context) {
	h.upsertAdminAction(c, "")
}

func (h *Handler) updateAdminAction(c *gin.Context) {
	h.upsertAdminAction(c, c.Param("actionId"))
}

func (h *Handler) upsertAdminAction(c *gin.Context, routeID string) {
	var request actionRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}

	if routeID == "" && request.ProviderKey == "" {
		request.ProviderKey = c.Param("providerId")
	}

	if err := h.svc.UpsertAdminAction(c.Request.Context(), routeID, service.ActionUpsertInput{
		ProviderKey:    request.ProviderKey,
		ActionKey:      request.ActionKey,
		HTTPMethod:     request.HTTPMethod,
		PathTemplate:   request.PathTemplate,
		SuccessPath:    request.SuccessPath,
		MessagePath:    request.MessagePath,
		CodeListPath:   request.CodeListPath,
		Enabled:        request.Enabled,
		HeaderTemplate: request.HeaderTemplate,
		QueryTemplate:  request.QueryTemplate,
		BodyTemplate:   request.BodyTemplate,
	}); err != nil {
		respondError(c, err)
		return
	}

	action := "create_action"
	target := request.ActionKey
	if routeID != "" {
		action = "update_action"
		target = routeID
	}
	h.svc.RecordAdminAction(c.Request.Context(), h.auditMeta(c), "integration_actions", action, target, "integration_action", request)
	c.Status(http.StatusNoContent)
}

func (h *Handler) deleteAdminAction(c *gin.Context) {
	if err := h.svc.DeleteAdminAction(c.Request.Context(), c.Param("actionId")); err != nil {
		respondError(c, err)
		return
	}
	h.svc.RecordAdminAction(c.Request.Context(), h.auditMeta(c), "integration_actions", "delete_action", c.Param("actionId"), "integration_action", nil)
	c.Status(http.StatusNoContent)
}

func (h *Handler) testAdminAction(c *gin.Context) {
	var request actionTestRequest
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&request); err != nil {
			respondError(c, service.ErrInvalidInput)
			return
		}
	}

	data, err := h.svc.TestAdminAction(c.Request.Context(), c.Param("actionId"), service.AdminActionTestInput{
		Mode: request.Mode,
	})
	if err != nil {
		respondError(c, err)
		return
	}
	h.svc.RecordAdminAction(c.Request.Context(), h.auditMeta(c), "integration_actions", "test_action", c.Param("actionId"), "integration_action", data)
	respondOK(c, data)
}

func (h *Handler) listAdminFulfillmentStrategies(c *gin.Context) {
	data, err := h.svc.ListAdminFulfillmentStrategies(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}
	respondOK(c, map[string]any{"items": data})
}

func (h *Handler) createAdminFulfillmentStrategy(c *gin.Context) {
	h.upsertAdminFulfillmentStrategy(c, "")
}

func (h *Handler) updateAdminFulfillmentStrategy(c *gin.Context) {
	h.upsertAdminFulfillmentStrategy(c, c.Param("strategyId"))
}

func (h *Handler) upsertAdminFulfillmentStrategy(c *gin.Context, routeID string) {
	var request fulfillmentStrategyRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}

	if err := h.svc.UpsertAdminFulfillmentStrategy(c.Request.Context(), routeID, service.FulfillmentStrategyUpsertInput{
		StrategyKey:      request.StrategyKey,
		StrategyName:     request.StrategyName,
		FulfillmentType:  request.FulfillmentType,
		ProviderKey:      request.ProviderKey,
		ActionKey:        request.ActionKey,
		Enabled:          request.Enabled,
		RequestTemplate:  request.RequestTemplate,
		ResultSchema:     request.ResultSchema,
		DeliveryTemplate: request.DeliveryTemplate,
		RetryPolicy:      request.RetryPolicy,
	}); err != nil {
		respondError(c, err)
		return
	}

	action := "create_fulfillment_strategy"
	target := request.StrategyKey
	if routeID != "" {
		action = "update_fulfillment_strategy"
		target = routeID
	}
	h.svc.RecordAdminAction(c.Request.Context(), h.auditMeta(c), "fulfillment_strategies", action, target, "fulfillment_strategy", request)
	c.Status(http.StatusNoContent)
}

func (h *Handler) deleteAdminFulfillmentStrategy(c *gin.Context) {
	if err := h.svc.DeleteAdminFulfillmentStrategy(c.Request.Context(), c.Param("strategyId")); err != nil {
		respondError(c, err)
		return
	}
	h.svc.RecordAdminAction(c.Request.Context(), h.auditMeta(c), "fulfillment_strategies", "delete_fulfillment_strategy", c.Param("strategyId"), "fulfillment_strategy", nil)
	c.Status(http.StatusNoContent)
}

func (h *Handler) previewAdminFulfillmentStrategy(c *gin.Context) {
	data, err := h.svc.PreviewAdminFulfillmentStrategy(c.Request.Context(), c.Param("strategyId"))
	if err != nil {
		respondError(c, err)
		return
	}
	h.svc.RecordAdminAction(c.Request.Context(), h.auditMeta(c), "fulfillment_strategies", "preview_fulfillment_strategy", c.Param("strategyId"), "fulfillment_strategy", data)
	respondOK(c, data)
}

func (h *Handler) listAdminDeliveryStrategies(c *gin.Context) {
	data, err := h.svc.ListAdminDeliveryStrategies(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}
	respondOK(c, map[string]any{"items": data})
}

func (h *Handler) createAdminDeliveryStrategy(c *gin.Context) {
	h.upsertAdminDeliveryStrategy(c, "")
}

func (h *Handler) updateAdminDeliveryStrategy(c *gin.Context) {
	h.upsertAdminDeliveryStrategy(c, c.Param("strategyId"))
}

func (h *Handler) upsertAdminDeliveryStrategy(c *gin.Context, routeID string) {
	var request deliveryStrategyRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}

	if err := h.svc.UpsertAdminDeliveryStrategy(c.Request.Context(), routeID, service.DeliveryStrategyUpsertInput{
		StrategyKey:     request.StrategyKey,
		StrategyName:    request.StrategyName,
		ChannelType:     request.ChannelType,
		MaskPolicy:      request.MaskPolicy,
		ResendAllowed:   request.ResendAllowed,
		Enabled:         request.Enabled,
		MessageTemplate: request.MessageTemplate,
	}); err != nil {
		respondError(c, err)
		return
	}

	action := "create_delivery_strategy"
	target := request.StrategyKey
	if routeID != "" {
		action = "update_delivery_strategy"
		target = routeID
	}
	h.svc.RecordAdminAction(c.Request.Context(), h.auditMeta(c), "delivery_strategies", action, target, "delivery_strategy", request)
	c.Status(http.StatusNoContent)
}

func (h *Handler) deleteAdminDeliveryStrategy(c *gin.Context) {
	if err := h.svc.DeleteAdminDeliveryStrategy(c.Request.Context(), c.Param("strategyId")); err != nil {
		respondError(c, err)
		return
	}
	h.svc.RecordAdminAction(c.Request.Context(), h.auditMeta(c), "delivery_strategies", "delete_delivery_strategy", c.Param("strategyId"), "delivery_strategy", nil)
	c.Status(http.StatusNoContent)
}

func (h *Handler) testAdminDeliveryStrategy(c *gin.Context) {
	data, err := h.svc.TestAdminDeliveryStrategy(c.Request.Context(), c.Param("strategyId"))
	if err != nil {
		respondError(c, err)
		return
	}
	h.svc.RecordAdminAction(c.Request.Context(), h.auditMeta(c), "delivery_strategies", "test_delivery_strategy", c.Param("strategyId"), "delivery_strategy", data)
	respondOK(c, data)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
