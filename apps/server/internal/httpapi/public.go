package httpapi

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"passdock/server/internal/service"
)

type createOrderRequest struct {
	ProductID     uint   `json:"product_id"`
	PriceID       string `json:"price_id"`
	PaymentMethod string `json:"payment_method"`
	SourceChannel string `json:"source_channel"`
	BotKey        string `json:"bot_key"`
	BuyerRef      string `json:"buyer_ref"`
	Quantity      int    `json:"quantity"`
	Currency      string `json:"currency"`
}

type uploadPaymentProofRequest struct {
	ProofType string `json:"proof_type"`
	ObjectKey string `json:"object_key"`
	ObjectURL string `json:"object_url"`
	Note      string `json:"note"`
}

type storefrontTicketRequest struct {
	Subject  string `json:"subject"`
	Content  string `json:"content"`
	Priority string `json:"priority"`
}

func (h *Handler) registerPublicRoutes(group *gin.RouterGroup) {
	public := group.Group("/public")
	public.GET("/products", h.listPublicProducts)
	public.GET("/payment-channels", h.listPublicPaymentChannels)
}

func (h *Handler) registerStorefrontOrderRoutes(group *gin.RouterGroup) {
	orders := group.Group("/orders")
	orders.POST("", h.createStorefrontOrder)
	orders.GET("/:orderNo", h.getStorefrontOrder)
	orders.POST("/:orderNo/mark-paid", h.markStorefrontOrderPaid)
	orders.POST("/:orderNo/cancel", h.cancelStorefrontOrder)
	orders.POST("/:orderNo/payment-proofs", h.uploadStorefrontPaymentProof)
	orders.GET("/:orderNo/payment-proofs/:proofId/file", h.serveStorefrontPaymentProofObject)
	orders.GET("/:orderNo/payment-proof-uploads/*objectKey", h.serveStorefrontUploadedPaymentProofObject)
	orders.GET("/:orderNo/delivery", h.getStorefrontOrderDelivery)
	orders.GET("/:orderNo/tickets", h.listStorefrontOrderTickets)
	orders.POST("/:orderNo/tickets", h.createStorefrontOrderTicket)
}

func (h *Handler) listPublicProducts(c *gin.Context) {
	data, err := h.svc.ListPublicProducts(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, map[string]any{"items": data})
}

func (h *Handler) listPublicPaymentChannels(c *gin.Context) {
	data, err := h.svc.ListPublicPaymentChannels(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, map[string]any{"items": data})
}

func (h *Handler) createStorefrontOrder(c *gin.Context) {
	var request createOrderRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}

	var userID *uint
	if user, _, err := h.authenticateRequest(c.Request.Context(), c.GetHeader("Authorization")); err == nil {
		userID = &user.ID
	}

	data, err := h.svc.CreateOrder(c.Request.Context(), service.CreateOrderInput{
		UserID:        userID,
		ProductID:     request.ProductID,
		PriceID:       request.PriceID,
		PaymentMethod: request.PaymentMethod,
		SourceChannel: request.SourceChannel,
		BotKey:        request.BotKey,
		BuyerRef:      request.BuyerRef,
		Quantity:      request.Quantity,
		Currency:      request.Currency,
	})
	if err != nil {
		respondError(c, err)
		return
	}

	respondCreated(c, data)
}

func (h *Handler) getStorefrontOrder(c *gin.Context) {
	data, err := h.svc.GetPublicStorefrontOrder(c.Request.Context(), c.Param("orderNo"), h.storefrontOrderAccessInput(c))
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}

func (h *Handler) markStorefrontOrderPaid(c *gin.Context) {
	if err := h.svc.MarkPublicStorefrontOrderPaid(
		c.Request.Context(),
		c.Param("orderNo"),
		h.storefrontOrderAccessInput(c),
	); err != nil {
		respondError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *Handler) cancelStorefrontOrder(c *gin.Context) {
	if err := h.svc.CancelPublicStorefrontOrder(
		c.Request.Context(),
		c.Param("orderNo"),
		h.storefrontOrderAccessInput(c),
	); err != nil {
		respondError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *Handler) uploadStorefrontPaymentProof(c *gin.Context) {
	var request uploadPaymentProofRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}

	if err := h.svc.UploadPublicPaymentProof(
		c.Request.Context(),
		c.Param("orderNo"),
		h.storefrontOrderAccessInput(c),
		service.UploadPaymentProofInput{
			ProofType: request.ProofType,
			ObjectKey: request.ObjectKey,
			ObjectURL: request.ObjectURL,
			Note:      request.Note,
		},
	); err != nil {
		respondError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *Handler) getStorefrontOrderDelivery(c *gin.Context) {
	data, err := h.svc.GetPublicStorefrontOrderDelivery(
		c.Request.Context(),
		c.Param("orderNo"),
		h.storefrontOrderAccessInput(c),
	)
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}

func (h *Handler) serveStorefrontPaymentProofObject(c *gin.Context) {
	object, err := h.svc.OpenStorefrontPaymentProofObject(
		c.Request.Context(),
		c.Param("orderNo"),
		c.Param("proofId"),
		h.storefrontProtectedObjectAccessInput(c),
	)
	if err != nil {
		respondError(c, err)
		return
	}
	defer object.Reader.Close()

	streamUploadedObject(c, object)
}

func (h *Handler) serveStorefrontUploadedPaymentProofObject(c *gin.Context) {
	object, err := h.svc.OpenStorefrontUploadedPaymentProofObject(
		c.Request.Context(),
		c.Param("orderNo"),
		c.Param("objectKey"),
		h.storefrontProtectedObjectAccessInput(c),
	)
	if err != nil {
		respondError(c, err)
		return
	}
	defer object.Reader.Close()

	streamUploadedObject(c, object)
}

func (h *Handler) listStorefrontOrderTickets(c *gin.Context) {
	data, err := h.svc.ListPublicStorefrontOrderTickets(
		c.Request.Context(),
		c.Param("orderNo"),
		h.storefrontOrderAccessInput(c),
	)
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}

func (h *Handler) createStorefrontOrderTicket(c *gin.Context) {
	var request storefrontTicketRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}

	data, err := h.svc.CreatePublicStorefrontOrderTicket(
		c.Request.Context(),
		c.Param("orderNo"),
		h.storefrontOrderAccessInput(c),
		service.CreateSupportTicketInput{
			Subject:  request.Subject,
			Content:  request.Content,
			Priority: request.Priority,
		},
	)
	if err != nil {
		respondError(c, err)
		return
	}

	respondCreated(c, data)
}

func (h *Handler) storefrontOrderAccessInput(c *gin.Context) service.StorefrontOrderAccessInput {
	return service.StorefrontOrderAccessInput{
		UserID:           h.optionalCurrentUserID(c),
		OrderAccessToken: c.GetHeader(storefrontOrderAccessHeader),
	}
}

func (h *Handler) storefrontProtectedObjectAccessInput(c *gin.Context) service.StorefrontOrderAccessInput {
	accessToken := strings.TrimSpace(c.Query("access_token"))
	if accessToken == "" {
		accessToken = c.GetHeader(storefrontOrderAccessHeader)
	}

	return service.StorefrontOrderAccessInput{
		UserID:           h.optionalCurrentUserID(c),
		OrderAccessToken: accessToken,
	}
}
