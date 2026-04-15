package httpapi

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"passdock/server/internal/service"
)

type apiEnvelope struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
	Data    any    `json:"data,omitempty"`
}

func respondOK(c *gin.Context, data any) {
	c.JSON(http.StatusOK, apiEnvelope{
		Success: true,
		Data:    data,
	})
}

func respondCreated(c *gin.Context, data any) {
	c.JSON(http.StatusCreated, apiEnvelope{
		Success: true,
		Data:    data,
	})
}

func respondError(c *gin.Context, err error) {
	status := http.StatusInternalServerError
	message := "internal server error"

	switch {
	case errors.Is(err, service.ErrNotFound):
		status = http.StatusNotFound
		message = "resource not found"
	case errors.Is(err, service.ErrUnauthorized):
		status = http.StatusUnauthorized
		message = "unauthorized"
	case errors.Is(err, service.ErrInvalidInput):
		status = http.StatusBadRequest
		message = "invalid input"
	case errors.Is(err, service.ErrInvalidState):
		status = http.StatusConflict
		message = "invalid state"
	case errors.Is(err, service.ErrInsufficientInventory):
		status = http.StatusConflict
		message = "insufficient inventory"
	default:
		if err != nil {
			message = err.Error()
		}
	}

	c.JSON(status, apiEnvelope{
		Success: false,
		Message: message,
	})
}
