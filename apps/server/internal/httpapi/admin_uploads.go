package httpapi

import (
	"path/filepath"

	"passdock/server/internal/service"

	"github.com/gin-gonic/gin"
)

func (h *Handler) registerAdminUploadRoutes(admin *gin.RouterGroup) {
	uploads := admin.Group("/uploads")
	uploads.POST("/payment-channel-assets", h.uploadAdminPaymentChannelAsset)
}

func (h *Handler) uploadAdminPaymentChannelAsset(c *gin.Context) {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}

	data, err := h.svc.SaveUploadedObject(c.Request.Context(), service.SaveUploadedObjectInput{
		Namespace: filepath.ToSlash(filepath.Join("payment-channels", "assets")),
		File:      fileHeader,
	})
	if err != nil {
		respondError(c, err)
		return
	}
	targetID, _ := data["object_key"].(string)

	h.svc.RecordAdminAction(
		c.Request.Context(),
		h.auditMeta(c),
		"payment_channels",
		"upload_payment_channel_asset",
		targetID,
		"payment_channel_asset",
		data,
	)

	respondCreated(c, data)
}
