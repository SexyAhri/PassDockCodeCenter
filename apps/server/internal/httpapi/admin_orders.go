package httpapi

import (
	"bytes"
	"io"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"passdock/server/internal/service"
)

type confirmPaymentRequest struct {
	PaymentMethod string `json:"payment_method"`
	Amount        string `json:"amount"`
	Currency      string `json:"currency"`
	Note          string `json:"note"`
}

type assignTicketRequest struct {
	AssignedTo string `json:"assigned_to"`
}

type resolveTicketRequest struct {
	Note string `json:"note"`
}

type callbackPaymentRequest struct {
	OrderNo         string `json:"order_no"`
	PaymentMethod   string `json:"payment_method"`
	Amount          string `json:"amount"`
	Currency        string `json:"currency"`
	Note            string `json:"note"`
	ThirdPartyTxnNo string `json:"third_party_txn_no"`
	ChainTxHash     string `json:"chain_tx_hash"`
	PayerAccount    string `json:"payer_account"`
	AutoFulfill     bool   `json:"auto_fulfill"`
	AutoDeliver     bool   `json:"auto_deliver"`
}

type executeActionRequest struct {
	Payload map[string]any `json:"payload"`
	DryRun  bool           `json:"dry_run"`
}

func (h *Handler) registerAdminOrderRoutes(admin *gin.RouterGroup) {
	admin.GET("/orders", h.listAdminOrders)
	admin.GET("/orders/:orderNo", h.getAdminOrderDetail)
	admin.POST("/orders/:orderNo/confirm-payment", h.confirmAdminOrderPayment)
	admin.POST("/orders/:orderNo/reject-payment", h.rejectAdminOrderPayment)
	admin.POST("/orders/:orderNo/fulfill", h.fulfillAdminOrder)
	admin.POST("/orders/:orderNo/retry-fulfillment", h.retryAdminOrderFulfillment)
	admin.POST("/orders/:orderNo/deliver", h.deliverAdminOrder)
	admin.POST("/orders/:orderNo/complete-delivery", h.completeAdminOrderDelivery)
	admin.POST("/orders/:orderNo/retry-delivery", h.retryAdminOrderDelivery)
	admin.POST("/orders/:orderNo/cancel", h.cancelAdminOrder)
	admin.POST("/orders/:orderNo/refund", h.refundAdminOrder)
	admin.POST("/orders/:orderNo/refund/mark", h.markAdminOrderRefund)
	admin.POST("/orders/:orderNo/refund/original", h.requestAdminOrderOriginalRefund)
	admin.POST("/orders/:orderNo/resend", h.resendAdminOrderDelivery)

	admin.GET("/fulfillment-records", h.listAdminFulfillmentRecords)
	admin.GET("/fulfillment-records/:recordId", h.getAdminFulfillmentRecordDetail)
	admin.GET("/code-issue-records", h.listAdminCodeIssueRecords)
	admin.GET("/code-issue-records/:recordId", h.getAdminCodeIssueRecordDetail)
	admin.POST("/code-issue-records/:recordId/retry", h.retryAdminCodeIssueRecord)
	admin.GET("/delivery-records", h.listAdminDeliveryRecords)
	admin.GET("/delivery-records/:recordId", h.getAdminDeliveryRecordDetail)

	admin.GET("/tickets", h.listAdminTickets)
	admin.GET("/tickets/:ticketNo", h.getAdminTicketDetail)
	admin.POST("/tickets/:ticketNo/assign", h.assignAdminTicket)
	admin.POST("/tickets/:ticketNo/resolve", h.resolveAdminTicket)
}

func (h *Handler) registerCallbackRoutes(api *gin.RouterGroup) {
	callbacks := api.Group("/callbacks")
	callbacks.POST("/payments/:channelKey", h.handlePaymentCallback)
}

func (h *Handler) registerInternalRoutes(internal *gin.RouterGroup) {
	internal.POST("/orders/:orderNo/fulfillment-jobs", h.requireInternalClientScope("orders.fulfillment"), h.internalFulfillOrder)
	internal.POST("/orders/:orderNo/delivery-jobs", h.requireInternalClientScope("orders.delivery"), h.internalDeliverOrder)
	internal.POST("/orders/:orderNo/expire", h.requireInternalClientScope("orders.expire"), h.internalExpireOrder)
	internal.POST("/orders/:orderNo/sync", h.requireInternalClientScope("orders.read"), h.internalSyncOrder)
	internal.POST(
		"/integrations/:providerKey/actions/:actionKey/execute",
		h.requireInternalClientScope("integrations.execute"),
		h.internalExecuteAction,
	)
	internal.POST("/payments/onchain/confirm", h.requireInternalClientScope("payments.confirm"), h.internalOnchainConfirm)
}

func (h *Handler) listAdminOrders(c *gin.Context) {
	data, err := h.svc.ListAdminOrders(c.Request.Context(), service.AdminOrderFilters{
		OrderNo:        c.Query("order_no"),
		Status:         c.Query("status"),
		PaymentStatus:  c.Query("payment_status"),
		DeliveryStatus: c.Query("delivery_status"),
		PaymentMethod:  c.Query("payment_method"),
		SourceChannel:  c.Query("source_channel"),
		Page:           parseInt(c.Query("page")),
		PageSize:       parseInt(c.Query("page_size")),
	})
	if err != nil {
		respondError(c, err)
		return
	}
	respondOK(c, data)
}

func (h *Handler) getAdminOrderDetail(c *gin.Context) {
	data, err := h.svc.GetAdminOrderDetail(c.Request.Context(), c.Param("orderNo"))
	if err != nil {
		respondError(c, err)
		return
	}
	respondOK(c, data)
}

func (h *Handler) confirmAdminOrderPayment(c *gin.Context) {
	var request confirmPaymentRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}

	if err := h.svc.ConfirmAdminOrderPayment(c.Request.Context(), c.Param("orderNo"), service.ConfirmPaymentInput{
		PaymentMethod: request.PaymentMethod,
		Amount:        request.Amount,
		Currency:      request.Currency,
		Note:          request.Note,
		SourceType:    "admin_confirm_payment",
	}, h.auditMeta(c)); err != nil {
		respondError(c, err)
		return
	}

	if _, err := h.svc.ApplyPaymentPostConfirmAutomation(
		c.Request.Context(),
		c.Param("orderNo"),
		false,
		false,
		h.auditMeta(c),
	); err != nil {
		respondError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *Handler) rejectAdminOrderPayment(c *gin.Context) {
	var request resolveTicketRequest
	_ = c.ShouldBindJSON(&request)

	if err := h.svc.RejectAdminOrderPayment(c.Request.Context(), c.Param("orderNo"), request.Note, h.auditMeta(c)); err != nil {
		respondError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *Handler) fulfillAdminOrder(c *gin.Context) {
	if err := h.svc.FulfillAdminOrder(c.Request.Context(), c.Param("orderNo"), h.auditMeta(c)); err != nil {
		respondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) retryAdminOrderFulfillment(c *gin.Context) {
	if err := h.svc.RetryAdminOrderFulfillment(c.Request.Context(), c.Param("orderNo"), h.auditMeta(c)); err != nil {
		respondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) deliverAdminOrder(c *gin.Context) {
	if err := h.svc.DeliverAdminOrder(c.Request.Context(), c.Param("orderNo"), h.auditMeta(c)); err != nil {
		respondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) completeAdminOrderDelivery(c *gin.Context) {
	var request resolveTicketRequest
	_ = c.ShouldBindJSON(&request)

	if err := h.svc.CompleteAdminOrderDelivery(c.Request.Context(), c.Param("orderNo"), request.Note, h.auditMeta(c)); err != nil {
		respondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) retryAdminOrderDelivery(c *gin.Context) {
	if err := h.svc.RetryAdminOrderDelivery(c.Request.Context(), c.Param("orderNo"), h.auditMeta(c)); err != nil {
		respondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) cancelAdminOrder(c *gin.Context) {
	var request resolveTicketRequest
	_ = c.ShouldBindJSON(&request)

	if err := h.svc.CancelAdminOrder(c.Request.Context(), c.Param("orderNo"), request.Note, h.auditMeta(c)); err != nil {
		respondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) refundAdminOrder(c *gin.Context) {
	h.markAdminOrderRefund(c)
}

func (h *Handler) markAdminOrderRefund(c *gin.Context) {
	var request resolveTicketRequest
	_ = c.ShouldBindJSON(&request)

	data, err := h.svc.MarkAdminOrderRefund(c.Request.Context(), c.Param("orderNo"), request.Note, h.auditMeta(c))
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}

func (h *Handler) requestAdminOrderOriginalRefund(c *gin.Context) {
	var request resolveTicketRequest
	_ = c.ShouldBindJSON(&request)

	data, err := h.svc.RequestAdminOrderOriginalRefund(c.Request.Context(), c.Param("orderNo"), request.Note, h.auditMeta(c))
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}

func (h *Handler) resendAdminOrderDelivery(c *gin.Context) {
	if err := h.svc.ResendAdminOrderDelivery(c.Request.Context(), c.Param("orderNo"), h.auditMeta(c)); err != nil {
		respondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) listAdminFulfillmentRecords(c *gin.Context) {
	data, err := h.svc.ListAdminFulfillmentRecords(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}
	respondOK(c, data)
}

func (h *Handler) getAdminFulfillmentRecordDetail(c *gin.Context) {
	data, err := h.svc.GetAdminFulfillmentRecordDetail(c.Request.Context(), c.Param("recordId"))
	if err != nil {
		respondError(c, err)
		return
	}
	respondOK(c, data)
}

func (h *Handler) listAdminCodeIssueRecords(c *gin.Context) {
	data, err := h.svc.ListAdminCodeIssueRecords(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}
	respondOK(c, data)
}

func (h *Handler) getAdminCodeIssueRecordDetail(c *gin.Context) {
	data, err := h.svc.GetAdminCodeIssueRecordDetail(c.Request.Context(), c.Param("recordId"))
	if err != nil {
		respondError(c, err)
		return
	}
	respondOK(c, data)
}

func (h *Handler) retryAdminCodeIssueRecord(c *gin.Context) {
	if err := h.svc.RetryAdminCodeIssueRecord(c.Request.Context(), c.Param("recordId"), h.auditMeta(c)); err != nil {
		respondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) listAdminDeliveryRecords(c *gin.Context) {
	data, err := h.svc.ListAdminDeliveryRecords(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}
	respondOK(c, data)
}

func (h *Handler) getAdminDeliveryRecordDetail(c *gin.Context) {
	data, err := h.svc.GetAdminDeliveryRecordDetail(c.Request.Context(), c.Param("recordId"))
	if err != nil {
		respondError(c, err)
		return
	}
	respondOK(c, data)
}

func (h *Handler) listAdminTickets(c *gin.Context) {
	data, err := h.svc.ListAdminTickets(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}
	respondOK(c, data)
}

func (h *Handler) getAdminTicketDetail(c *gin.Context) {
	data, err := h.svc.GetAdminTicketDetail(c.Request.Context(), c.Param("ticketNo"))
	if err != nil {
		respondError(c, err)
		return
	}
	respondOK(c, data)
}

func (h *Handler) assignAdminTicket(c *gin.Context) {
	var request assignTicketRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}

	if err := h.svc.AssignAdminTicket(c.Request.Context(), c.Param("ticketNo"), request.AssignedTo, h.auditMeta(c)); err != nil {
		respondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) resolveAdminTicket(c *gin.Context) {
	var request resolveTicketRequest
	_ = c.ShouldBindJSON(&request)

	if err := h.svc.ResolveAdminTicket(c.Request.Context(), c.Param("ticketNo"), request.Note, h.auditMeta(c)); err != nil {
		respondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) handlePaymentCallback(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}
	c.Request.Body = io.NopCloser(bytes.NewReader(body))

	verification, err := h.svc.VerifyPaymentCallbackRequest(c.Request.Context(), c.Param("channelKey"), c.Request, body)
	if err != nil {
		respondError(c, err)
		return
	}

	input, err := h.svc.NormalizePaymentCallbackInput(c.Request, body, verification)
	if err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}

	data, err := h.svc.HandlePaymentCallback(c.Request.Context(), c.Param("channelKey"), input, service.AuditMeta{RequestIP: c.ClientIP()})
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}

func (h *Handler) internalFulfillOrder(c *gin.Context) {
	if err := h.svc.FulfillAdminOrder(c.Request.Context(), c.Param("orderNo"), service.AuditMeta{RequestIP: c.ClientIP()}); err != nil {
		respondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) internalDeliverOrder(c *gin.Context) {
	if err := h.svc.DeliverAdminOrder(c.Request.Context(), c.Param("orderNo"), service.AuditMeta{RequestIP: c.ClientIP()}); err != nil {
		respondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) internalExpireOrder(c *gin.Context) {
	if err := h.svc.ExpireOrder(c.Request.Context(), c.Param("orderNo")); err != nil {
		respondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) internalSyncOrder(c *gin.Context) {
	data, err := h.svc.GetAdminOrderDetail(c.Request.Context(), c.Param("orderNo"))
	if err != nil {
		respondError(c, err)
		return
	}
	respondOK(c, data)
}

func (h *Handler) internalExecuteAction(c *gin.Context) {
	var request executeActionRequest
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&request); err != nil {
			respondError(c, service.ErrInvalidInput)
			return
		}
	}

	data, err := h.svc.ExecuteIntegrationAction(c.Request.Context(), c.Param("providerKey"), c.Param("actionKey"), service.ExecuteActionInput{
		TemplateData: request.Payload,
		DryRun:       request.DryRun,
	})
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data.ToMap())
}

func (h *Handler) internalOnchainConfirm(c *gin.Context) {
	var request callbackPaymentRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}

	data, err := h.svc.HandleOnchainConfirmation(c.Request.Context(), service.OnchainConfirmationInput{
		OrderNo:         request.OrderNo,
		PaymentMethod:   request.PaymentMethod,
		Amount:          request.Amount,
		Currency:        request.Currency,
		ChainTxHash:     request.ChainTxHash,
		PayerAccount:    request.PayerAccount,
		ThirdPartyTxnNo: request.ThirdPartyTxnNo,
		Note:            request.Note,
	}, service.AuditMeta{RequestIP: c.ClientIP()})
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}

func parseInt(value string) int {
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0
	}
	return parsed
}
