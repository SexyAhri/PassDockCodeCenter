package httpapi

import "github.com/gin-gonic/gin"

func (h *Handler) registerAdminDashboardRoutes(admin *gin.RouterGroup) {
	admin.GET("/dashboard", h.getAdminDashboard)
}

func (h *Handler) getAdminDashboard(c *gin.Context) {
	data, err := h.svc.GetAdminDashboard(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}
