package httpapi

import (
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"passdock/server/internal/service"

	"github.com/gin-gonic/gin"
)

func (h *Handler) registerUploadRoutes(group *gin.RouterGroup) {
	uploads := group.Group("/uploads")
	uploads.POST("/payment-proofs", h.uploadPaymentProofObject)
}

func (h *Handler) uploadPaymentProofObject(c *gin.Context) {
	orderNo := strings.TrimSpace(c.PostForm("order_no"))
	if orderNo == "" {
		respondError(c, service.ErrInvalidInput)
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}

	data, err := h.svc.SavePublicPaymentProofObject(
		c.Request.Context(),
		orderNo,
		h.storefrontOrderAccessInput(c),
		service.SaveUploadedObjectInput{
			File: fileHeader,
		},
	)
	if err != nil {
		respondError(c, err)
		return
	}

	respondCreated(c, data)
}

func (h *Handler) serveUploadedObject(c *gin.Context) {
	objectKey := strings.TrimLeft(strings.TrimSpace(c.Param("objectKey")), "/")
	if objectKey == "" {
		c.Status(http.StatusNotFound)
		return
	}
	if service.IsProtectedUploadedObjectKey(objectKey) {
		c.Status(http.StatusNotFound)
		return
	}

	object, err := h.svc.OpenUploadedObject(c.Request.Context(), objectKey)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrNotFound):
			c.Status(http.StatusNotFound)
		case errors.Is(err, service.ErrInvalidInput):
			c.Status(http.StatusBadRequest)
		default:
			c.Status(http.StatusInternalServerError)
		}
		return
	}
	defer object.Reader.Close()

	streamUploadedObject(c, object)
}

func streamUploadedObject(c *gin.Context, object *service.UploadedObject) {
	if object == nil || object.Reader == nil {
		c.Status(http.StatusNotFound)
		return
	}
	if object.ContentType != "" {
		c.Header("Content-Type", object.ContentType)
	}
	if object.Size >= 0 {
		c.Header("Content-Length", strconv.FormatInt(object.Size, 10))
	}
	c.Header("Cache-Control", "private, max-age=300")
	c.Status(http.StatusOK)
	_, _ = io.Copy(c.Writer, object.Reader)
}
