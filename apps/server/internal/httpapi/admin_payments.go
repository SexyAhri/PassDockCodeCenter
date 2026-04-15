package httpapi

import (
	"github.com/gin-gonic/gin"

	"passdock/server/internal/service"
)

func (h *Handler) registerAdminPaymentRoutes(admin *gin.RouterGroup) {
	admin.GET("/payment-records", h.listAdminPaymentRecords)
	admin.GET("/payment-records/:paymentId", h.getAdminPaymentRecordDetail)
	admin.GET("/payment-proofs", h.listAdminPaymentProofs)
	admin.GET("/payment-proofs/:proofId", h.getAdminPaymentProofDetail)
	admin.GET("/payment-proofs/:proofId/file", h.serveAdminPaymentProofObject)
	admin.GET("/callback-logs", h.listAdminCallbackLogs)
	admin.GET("/callback-logs/:logId", h.getAdminCallbackLogDetail)
	admin.GET("/watcher-records", h.listAdminWatcherRecords)
	admin.GET("/watcher-records/:recordId", h.getAdminWatcherRecordDetail)
}

func (h *Handler) listAdminPaymentRecords(c *gin.Context) {
	data, err := h.svc.ListAdminPaymentRecords(c.Request.Context(), service.AdminPaymentFilters{
		OrderNo:       c.Query("order_no"),
		PaymentStatus: c.Query("payment_status"),
		PaymentMethod: c.Query("payment_method"),
		SourceChannel: c.Query("source_channel"),
		Page:          parseInt(c.Query("page")),
		PageSize:      parseInt(c.Query("page_size")),
	})
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}

func (h *Handler) getAdminPaymentRecordDetail(c *gin.Context) {
	data, err := h.svc.GetAdminPaymentRecordDetail(c.Request.Context(), c.Param("paymentId"))
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}

func (h *Handler) listAdminPaymentProofs(c *gin.Context) {
	data, err := h.svc.ListAdminPaymentProofs(c.Request.Context(), service.AdminPaymentProofFilters{
		OrderNo:       c.Query("order_no"),
		ReviewStatus:  c.Query("review_status"),
		PaymentMethod: c.Query("payment_method"),
		SourceChannel: c.Query("source_channel"),
		Page:          parseInt(c.Query("page")),
		PageSize:      parseInt(c.Query("page_size")),
	})
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}

func (h *Handler) getAdminPaymentProofDetail(c *gin.Context) {
	data, err := h.svc.GetAdminPaymentProofDetail(c.Request.Context(), c.Param("proofId"))
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}

func (h *Handler) serveAdminPaymentProofObject(c *gin.Context) {
	object, err := h.svc.OpenAdminPaymentProofObject(c.Request.Context(), c.Param("proofId"))
	if err != nil {
		respondError(c, err)
		return
	}
	defer object.Reader.Close()

	streamUploadedObject(c, object)
}

func (h *Handler) listAdminCallbackLogs(c *gin.Context) {
	data, err := h.svc.ListAdminCallbackLogs(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}

func (h *Handler) getAdminCallbackLogDetail(c *gin.Context) {
	data, err := h.svc.GetAdminCallbackLogDetail(c.Request.Context(), c.Param("logId"))
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}

func (h *Handler) listAdminWatcherRecords(c *gin.Context) {
	data, err := h.svc.ListAdminWatcherRecords(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}

func (h *Handler) getAdminWatcherRecordDetail(c *gin.Context) {
	data, err := h.svc.GetAdminWatcherRecordDetail(c.Request.Context(), c.Param("recordId"))
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}
