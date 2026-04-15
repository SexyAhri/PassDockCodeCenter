package httpapi

import (
	"github.com/gin-gonic/gin"

	"passdock/server/internal/service"
)

func (h *Handler) registerAdminCustomerRoutes(admin *gin.RouterGroup) {
	admin.GET("/customers", h.listAdminCustomers)
	admin.GET("/customers/:customerId", h.getAdminCustomerDetail)
}

func (h *Handler) listAdminCustomers(c *gin.Context) {
	data, err := h.svc.ListAdminCustomers(c.Request.Context(), service.AdminCustomerListFilters{
		Keyword:      c.Query("keyword"),
		Region:       c.Query("region"),
		Tier:         c.Query("tier"),
		TicketStatus: c.Query("ticket_status"),
		AssignedTo:   c.Query("assigned_to"),
	})
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}

func (h *Handler) getAdminCustomerDetail(c *gin.Context) {
	data, err := h.svc.GetAdminCustomerDetail(c.Request.Context(), c.Param("customerId"))
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}
