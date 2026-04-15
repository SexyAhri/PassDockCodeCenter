package httpapi

import (
	"bytes"
	"errors"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"

	"passdock/server/internal/service"
)

const internalClientContextKey = "passdock.internal.client"

func (h *Handler) requireInternalClientScope(requiredScope string) gin.HandlerFunc {
	return func(c *gin.Context) {
		body, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, apiEnvelope{
				Success: false,
				Message: "unauthorized",
			})
			return
		}
		c.Request.Body = io.NopCloser(bytes.NewReader(body))

		client, authErr := h.svc.AuthenticateInternalClientRequest(
			c.Request.Context(),
			c.Request,
			c.ClientIP(),
			body,
			requiredScope,
		)
		if authErr != nil {
			status := http.StatusUnauthorized
			if errors.Is(authErr, service.ErrInvalidState) {
				status = http.StatusForbidden
			}
			c.AbortWithStatusJSON(status, apiEnvelope{
				Success: false,
				Message: "unauthorized",
			})
			return
		}

		c.Set(internalClientContextKey, client)
		c.Next()
	}
}
