package httpapi

import (
	"bytes"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"passdock/server/internal/service"
)

func (h *Handler) handleIdempotency() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !isIdempotentWriteMethod(c.Request.Method) {
			c.Next()
			return
		}

		idempotencyKey := strings.TrimSpace(c.GetHeader("X-Idempotency-Key"))
		if idempotencyKey == "" {
			c.Next()
			return
		}

		body, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, apiEnvelope{
				Success: false,
				Message: "invalid input",
			})
			return
		}
		c.Request.Body = io.NopCloser(bytes.NewReader(body))

		scope := buildIdempotencyScope(c.Request.Method, c.Request.URL.Path, idempotencyKey)
		requestHash := serviceHashIdempotencyRequest(c.Request.Method, c.Request.URL.Path, c.Request.URL.RawQuery, body)

		record, acquired, acquireErr := h.svc.AcquireIdempotencyRecord(c.Request.Context(), scope, requestHash)
		if acquireErr != nil {
			respondError(c, acquireErr)
			c.Abort()
			return
		}
		if !acquired && record != nil {
			if record.RequestHash != requestHash {
				c.AbortWithStatusJSON(http.StatusConflict, apiEnvelope{
					Success: false,
					Message: "idempotency conflict",
				})
				return
			}
			if record.StatusCode == 0 {
				c.AbortWithStatusJSON(http.StatusConflict, apiEnvelope{
					Success: false,
					Message: "idempotent request in progress",
				})
				return
			}

			if strings.TrimSpace(record.ResponseBody) == "" {
				c.Status(record.StatusCode)
			} else {
				c.Data(record.StatusCode, "application/json; charset=utf-8", []byte(record.ResponseBody))
			}
			c.Abort()
			return
		}

		writer := &idempotencyResponseWriter{
			ResponseWriter: c.Writer,
			statusCode:     http.StatusOK,
			body:           &bytes.Buffer{},
		}
		c.Writer = writer
		c.Request.Body = io.NopCloser(bytes.NewReader(body))
		c.Next()

		if writer.statusCode >= http.StatusInternalServerError {
			_ = h.svc.DeleteIdempotencyRecord(c.Request.Context(), scope)
			return
		}

		if finalizeErr := h.svc.FinalizeIdempotencyRecord(
			c.Request.Context(),
			scope,
			writer.statusCode,
			writer.body.String(),
		); finalizeErr != nil {
			c.Error(finalizeErr)
		}
	}
}

type idempotencyResponseWriter struct {
	gin.ResponseWriter
	statusCode int
	body       *bytes.Buffer
}

func (w *idempotencyResponseWriter) WriteHeader(statusCode int) {
	w.statusCode = statusCode
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *idempotencyResponseWriter) Write(data []byte) (int, error) {
	if w.body != nil {
		_, _ = w.body.Write(data)
	}
	return w.ResponseWriter.Write(data)
}

func buildIdempotencyScope(method string, path string, key string) string {
	return strings.ToUpper(strings.TrimSpace(method)) + ":" + strings.TrimSpace(path) + ":" + strings.TrimSpace(key)
}

func serviceHashIdempotencyRequest(method string, path string, query string, body []byte) string {
	return serviceHashStrings("http_idempotency", strings.ToUpper(strings.TrimSpace(method)), strings.TrimSpace(path), strings.TrimSpace(query), string(body))
}

func serviceHashStrings(parts ...string) string {
	return service.Sha256HexForHTTP(parts...)
}

func isIdempotentWriteMethod(method string) bool {
	switch strings.ToUpper(strings.TrimSpace(method)) {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	default:
		return false
	}
}
