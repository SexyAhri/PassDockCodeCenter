package httpapi

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"passdock/server/internal/service"
)

type registerRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"display_name"`
	Locale      string `json:"locale"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Scope    string `json:"scope"`
}

type myTicketRequest struct {
	OrderNo  string `json:"order_no"`
	Subject  string `json:"subject"`
	Content  string `json:"content"`
	Priority string `json:"priority"`
}

func (h *Handler) registerAuthRoutes(api *gin.RouterGroup) {
	auth := api.Group("/auth")
	auth.POST("/register", h.registerUser)
	auth.POST("/login", h.loginUser)
	auth.POST("/logout", h.logoutUser)
}

func (h *Handler) registerMeRoutes(me *gin.RouterGroup) {
	me.GET("", h.getMe)
	me.GET("/orders", h.listMyOrders)
	me.GET("/orders/:orderNo", h.getMyOrder)
	me.GET("/tickets", h.listMyTickets)
	me.POST("/tickets", h.createMyTicket)
}

func (h *Handler) registerUser(c *gin.Context) {
	var request registerRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}

	data, err := h.svc.Register(c.Request.Context(), service.RegisterInput{
		Email:       request.Email,
		Password:    request.Password,
		DisplayName: request.DisplayName,
		Locale:      request.Locale,
	}, c.Request.UserAgent(), c.ClientIP())
	if err != nil {
		respondError(c, err)
		return
	}

	respondCreated(c, data)
}

func (h *Handler) loginUser(c *gin.Context) {
	var request loginRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}

	data, err := h.svc.Login(c.Request.Context(), service.LoginInput{
		Email:    request.Email,
		Password: request.Password,
		Scope:    request.Scope,
	}, c.Request.UserAgent(), c.ClientIP())
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}

func (h *Handler) logoutUser(c *gin.Context) {
	if err := h.svc.Logout(c.Request.Context(), extractBearerToken(c.GetHeader("Authorization"))); err != nil {
		respondError(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *Handler) getMe(c *gin.Context) {
	user := currentUserFromContext(c)
	if user == nil {
		respondError(c, service.ErrNotFound)
		return
	}

	data, err := h.svc.GetMe(c.Request.Context(), user.ID)
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}

func (h *Handler) listMyOrders(c *gin.Context) {
	user := currentUserFromContext(c)
	if user == nil {
		respondError(c, service.ErrNotFound)
		return
	}

	data, err := h.svc.ListMyOrders(c.Request.Context(), user.ID, service.MyOrderFilters{
		Status:         c.Query("status"),
		PaymentStatus:  c.Query("payment_status"),
		DeliveryStatus: c.Query("delivery_status"),
		Page:           parseInt(c.Query("page")),
		PageSize:       parseInt(c.Query("page_size")),
	})
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}

func (h *Handler) getMyOrder(c *gin.Context) {
	user := currentUserFromContext(c)
	if user == nil {
		respondError(c, service.ErrNotFound)
		return
	}

	data, err := h.svc.GetMyOrderDetail(c.Request.Context(), user.ID, c.Param("orderNo"))
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}

func (h *Handler) listMyTickets(c *gin.Context) {
	user := currentUserFromContext(c)
	if user == nil {
		respondError(c, service.ErrNotFound)
		return
	}

	data, err := h.svc.ListMyTickets(c.Request.Context(), user.ID)
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}

func (h *Handler) createMyTicket(c *gin.Context) {
	user := currentUserFromContext(c)
	if user == nil {
		respondError(c, service.ErrNotFound)
		return
	}

	var request myTicketRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}

	data, err := h.svc.CreateMyTicket(c.Request.Context(), user.ID, service.CreateSupportTicketInput{
		OrderNo:      request.OrderNo,
		CustomerName: user.Name,
		Subject:      request.Subject,
		Content:      request.Content,
		Priority:     request.Priority,
	})
	if err != nil {
		respondError(c, err)
		return
	}

	respondCreated(c, data)
}
