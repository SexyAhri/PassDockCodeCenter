package httpapi

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"passdock/server/internal/service"
)

type telegramConfigRequest struct {
	BotKey             string   `json:"bot_key"`
	BotToken           string   `json:"bot_token"`
	WebhookSecret      string   `json:"webhook_secret"`
	WebhookURL         string   `json:"webhook_url"`
	WebhookIP          string   `json:"webhook_ip"`
	AllowedUpdates     []string `json:"allowed_updates"`
	MaxConnections     int      `json:"max_connections"`
	DropPendingUpdates bool     `json:"drop_pending_updates"`
	BotUsername        string   `json:"bot_username"`
	Enabled            bool     `json:"enabled"`
}

type internalClientKeyRequest struct {
	ClientKey    string `json:"client_key"`
	ClientName   string `json:"client_name"`
	ClientSecret string `json:"client_secret"`
	Scopes       string `json:"scopes"`
	AllowedIPs   string `json:"allowed_ips"`
	Status       string `json:"status"`
}

type telegramWebhookDeleteRequest struct {
	DropPendingUpdates bool `json:"drop_pending_updates"`
}

func (h *Handler) registerAdminSystemSecurityRoutes(admin *gin.RouterGroup) {
	admin.GET("/telegram-configs", h.listAdminTelegramConfigs)
	admin.POST("/telegram-configs", h.createAdminTelegramConfig)
	admin.PUT("/telegram-configs/:botKey", h.updateAdminTelegramConfig)
	admin.DELETE("/telegram-configs/:botKey", h.deleteAdminTelegramConfig)
	admin.GET("/telegram-configs/:botKey/webhook", h.getAdminTelegramWebhookSetup)
	admin.GET("/telegram-configs/:botKey/webhook-info", h.getAdminTelegramWebhookInfo)
	admin.POST("/telegram-configs/:botKey/webhook-sync", h.syncAdminTelegramWebhook)
	admin.DELETE("/telegram-configs/:botKey/webhook-sync", h.deleteAdminTelegramWebhook)

	admin.GET("/internal-client-keys", h.listAdminInternalClientKeys)
	admin.POST("/internal-client-keys", h.createAdminInternalClientKey)
	admin.PUT("/internal-client-keys/:clientKey", h.updateAdminInternalClientKey)
	admin.DELETE("/internal-client-keys/:clientKey", h.deleteAdminInternalClientKey)
}

func (h *Handler) listAdminTelegramConfigs(c *gin.Context) {
	data, err := h.svc.ListAdminTelegramConfigs(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, map[string]any{"items": data})
}

func (h *Handler) createAdminTelegramConfig(c *gin.Context) {
	h.upsertAdminTelegramConfig(c, "")
}

func (h *Handler) updateAdminTelegramConfig(c *gin.Context) {
	h.upsertAdminTelegramConfig(c, c.Param("botKey"))
}

func (h *Handler) upsertAdminTelegramConfig(c *gin.Context, routeID string) {
	var request telegramConfigRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}

	if err := h.svc.UpsertAdminTelegramConfig(c.Request.Context(), routeID, service.TelegramBotConfigUpsertInput{
		BotKey:             request.BotKey,
		BotToken:           request.BotToken,
		WebhookSecret:      request.WebhookSecret,
		WebhookURL:         request.WebhookURL,
		WebhookIP:          request.WebhookIP,
		AllowedUpdates:     request.AllowedUpdates,
		MaxConnections:     request.MaxConnections,
		DropPendingUpdates: request.DropPendingUpdates,
		BotUsername:        request.BotUsername,
		Enabled:            request.Enabled,
	}); err != nil {
		respondError(c, err)
		return
	}

	action := "create_telegram_config"
	target := request.BotKey
	if routeID != "" {
		action = "update_telegram_config"
		target = routeID
	}
	h.svc.RecordAdminAction(c.Request.Context(), h.auditMeta(c), "telegram_bot_configs", action, target, "telegram_config", request)
	c.Status(http.StatusNoContent)
}

func (h *Handler) deleteAdminTelegramConfig(c *gin.Context) {
	target := c.Param("botKey")
	if err := h.svc.DeleteAdminTelegramConfig(c.Request.Context(), target); err != nil {
		respondError(c, err)
		return
	}

	h.svc.RecordAdminAction(c.Request.Context(), h.auditMeta(c), "telegram_bot_configs", "delete_telegram_config", target, "telegram_config", nil)
	c.Status(http.StatusNoContent)
}

func (h *Handler) getAdminTelegramWebhookSetup(c *gin.Context) {
	data, err := h.svc.GetAdminTelegramWebhookSetup(c.Request.Context(), c.Param("botKey"))
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}

func (h *Handler) getAdminTelegramWebhookInfo(c *gin.Context) {
	data, err := h.svc.GetAdminTelegramWebhookInfo(c.Request.Context(), c.Param("botKey"))
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}

func (h *Handler) syncAdminTelegramWebhook(c *gin.Context) {
	data, err := h.svc.SyncAdminTelegramWebhook(c.Request.Context(), c.Param("botKey"))
	if err != nil {
		respondError(c, err)
		return
	}

	h.svc.RecordAdminAction(c.Request.Context(), h.auditMeta(c), "telegram_bot_configs", "sync_telegram_webhook", c.Param("botKey"), "telegram_config", data)
	respondOK(c, data)
}

func (h *Handler) deleteAdminTelegramWebhook(c *gin.Context) {
	var request telegramWebhookDeleteRequest
	_ = c.ShouldBindJSON(&request)

	data, err := h.svc.DeleteAdminTelegramWebhook(c.Request.Context(), c.Param("botKey"), request.DropPendingUpdates)
	if err != nil {
		respondError(c, err)
		return
	}

	h.svc.RecordAdminAction(c.Request.Context(), h.auditMeta(c), "telegram_bot_configs", "delete_telegram_webhook", c.Param("botKey"), "telegram_config", data)
	respondOK(c, data)
}

func (h *Handler) listAdminInternalClientKeys(c *gin.Context) {
	data, err := h.svc.ListAdminInternalClientKeys(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, map[string]any{"items": data})
}

func (h *Handler) createAdminInternalClientKey(c *gin.Context) {
	h.upsertAdminInternalClientKey(c, "")
}

func (h *Handler) updateAdminInternalClientKey(c *gin.Context) {
	h.upsertAdminInternalClientKey(c, c.Param("clientKey"))
}

func (h *Handler) upsertAdminInternalClientKey(c *gin.Context, routeID string) {
	var request internalClientKeyRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}

	if err := h.svc.UpsertAdminInternalClientKey(c.Request.Context(), routeID, service.InternalClientKeyUpsertInput{
		ClientKey:    request.ClientKey,
		ClientName:   request.ClientName,
		ClientSecret: request.ClientSecret,
		Scopes:       request.Scopes,
		AllowedIPs:   request.AllowedIPs,
		Status:       request.Status,
	}); err != nil {
		respondError(c, err)
		return
	}

	action := "create_internal_client_key"
	target := request.ClientKey
	if routeID != "" {
		action = "update_internal_client_key"
		target = routeID
	}
	h.svc.RecordAdminAction(c.Request.Context(), h.auditMeta(c), "internal_client_keys", action, target, "internal_client_key", map[string]any{
		"client_key":  request.ClientKey,
		"client_name": request.ClientName,
		"scopes":      request.Scopes,
		"allowed_ips": request.AllowedIPs,
		"status":      request.Status,
	})
	c.Status(http.StatusNoContent)
}

func (h *Handler) deleteAdminInternalClientKey(c *gin.Context) {
	target := c.Param("clientKey")
	if err := h.svc.DeleteAdminInternalClientKey(c.Request.Context(), target); err != nil {
		respondError(c, err)
		return
	}

	h.svc.RecordAdminAction(c.Request.Context(), h.auditMeta(c), "internal_client_keys", "delete_internal_client_key", target, "internal_client_key", nil)
	c.Status(http.StatusNoContent)
}
