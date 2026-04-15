package httpapi

import (
	"fmt"
	"runtime/debug"
	"strings"

	"github.com/gin-gonic/gin"

	"passdock/server/internal/service"
)

func recoveryWithErrorReporter(svc *service.Service) gin.HandlerFunc {
	return gin.CustomRecoveryWithWriter(gin.DefaultErrorWriter, func(c *gin.Context, recovered any) {
		if svc != nil {
			svc.ReportError(c.Request.Context(), service.ErrorEvent{
				Source:   "httpapi",
				Category: "panic",
				Message:  strings.TrimSpace(fmt.Sprint(recovered)),
				Stack:    string(debug.Stack()),
				Tags: map[string]string{
					"method": c.Request.Method,
					"route":  normalizeMetricRoute(c.FullPath()),
				},
				Fields: map[string]any{
					"path":      c.Request.URL.Path,
					"client_ip": c.ClientIP(),
				},
			})
		}

		c.AbortWithStatus(500)
	})
}
