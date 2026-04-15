package httpapi

import (
	"crypto/subtle"
	"strings"

	"github.com/gin-gonic/gin"

	"passdock/server/internal/service"
)

type telegramBindRequest struct {
	Email            string `json:"email"`
	DisplayName      string `json:"display_name"`
	TelegramUserID   string `json:"telegram_user_id"`
	TelegramUsername string `json:"telegram_username"`
	ChatID           string `json:"chat_id"`
}

type telegramTestSendRequest struct {
	ChatID   string `json:"chat_id"`
	Message  string `json:"message"`
	Operator string `json:"operator"`
}

type telegramWebhookSimulationRequest struct {
	ChatID         string `json:"chat_id"`
	Text           string `json:"text"`
	TelegramUserID string `json:"telegram_user_id"`
	Username       string `json:"username"`
	Operator       string `json:"operator"`
}

func (h *Handler) registerBotRoutes(api *gin.RouterGroup) {
	bots := api.Group("/bots/:botKey/telegram")
	bots.POST("/webhook", h.handleTelegramWebhook)
	bots.POST("/bind", h.bindTelegramUser)
}

func (h *Handler) registerAdminBotRoutes(admin *gin.RouterGroup) {
	bots := admin.Group("/bots/:botKey/telegram")
	bots.GET("/bindings", h.listAdminTelegramBindings)
	bots.GET("/deliveries", h.listAdminTelegramDeliveries)
	bots.POST("/deliveries/:deliveryRecordId/retry", h.retryTelegramDelivery)
	bots.POST("/test-send", h.testTelegramSend)
	bots.POST("/simulate-webhook", h.simulateTelegramWebhook)
}

func (h *Handler) listAdminTelegramBindings(c *gin.Context) {
	data, err := h.svc.ListAdminTelegramBindings(c.Request.Context(), c.Param("botKey"))
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, map[string]any{"items": data})
}

func (h *Handler) listAdminTelegramDeliveries(c *gin.Context) {
	data, err := h.svc.ListAdminTelegramDeliveryRecords(c.Request.Context(), c.Param("botKey"))
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, map[string]any{"items": data})
}

func (h *Handler) handleTelegramWebhook(c *gin.Context) {
	config, err := h.svc.ResolveTelegramBotConfig(c.Request.Context(), c.Param("botKey"))
	if err != nil {
		respondError(c, err)
		return
	}

	secret := strings.TrimSpace(config.WebhookSecret)
	if secret != "" {
		headerValue := strings.TrimSpace(c.GetHeader("X-Telegram-Bot-Api-Secret-Token"))
		if subtle.ConstantTimeCompare([]byte(headerValue), []byte(secret)) != 1 {
			c.AbortWithStatusJSON(403, apiEnvelope{
				Success: false,
				Message: "forbidden",
			})
			return
		}
	}

	var payload map[string]any
	if err := c.ShouldBindJSON(&payload); err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}

	data, err := h.svc.HandleTelegramWebhook(c.Request.Context(), c.Param("botKey"), payload)
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}

func (h *Handler) bindTelegramUser(c *gin.Context) {
	var request telegramBindRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}

	data, err := h.svc.BindTelegramUser(c.Request.Context(), c.Param("botKey"), service.TelegramBindInput{
		Email:            request.Email,
		DisplayName:      request.DisplayName,
		TelegramUserID:   request.TelegramUserID,
		TelegramUsername: request.TelegramUsername,
		ChatID:           request.ChatID,
	})
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}

func (h *Handler) retryTelegramDelivery(c *gin.Context) {
	data, err := h.svc.RetryTelegramDelivery(c.Request.Context(), c.Param("botKey"), c.Param("deliveryRecordId"), h.auditMeta(c))
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}

func (h *Handler) testTelegramSend(c *gin.Context) {
	var request telegramTestSendRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}

	data, err := h.svc.TestTelegramSend(c.Request.Context(), c.Param("botKey"), service.TelegramTestSendInput{
		ChatID:   request.ChatID,
		Message:  request.Message,
		Operator: request.Operator,
	}, h.auditMeta(c))
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}

func (h *Handler) simulateTelegramWebhook(c *gin.Context) {
	var request telegramWebhookSimulationRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}

	data, err := h.svc.SimulateTelegramWebhook(
		c.Request.Context(),
		c.Param("botKey"),
		service.TelegramWebhookSimulationInput{
			ChatID:         request.ChatID,
			Text:           request.Text,
			TelegramUserID: request.TelegramUserID,
			Username:       request.Username,
			Operator:       request.Operator,
		},
		h.auditMeta(c),
	)
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}
