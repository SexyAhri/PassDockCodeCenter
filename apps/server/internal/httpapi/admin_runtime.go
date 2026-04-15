package httpapi

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"passdock/server/internal/service"
)

type runtimeSettingRequest struct {
	Module string `json:"module"`
	Name   string `json:"name"`
	Value  string `json:"value"`
	Scope  string `json:"scope"`
}

func (h *Handler) registerAdminRuntimeRoutes(admin *gin.RouterGroup) {
	admin.GET("/runtime-settings", h.listAdminRuntimeSettings)
	admin.POST("/runtime-settings", h.createAdminRuntimeSetting)
	admin.PUT("/runtime-settings/:settingName", h.updateAdminRuntimeSetting)
	admin.DELETE("/runtime-settings/:settingName", h.deleteAdminRuntimeSetting)
	admin.GET("/audit-logs", h.listAdminAuditLogs)
	admin.GET("/audit-logs/:logId", h.getAdminAuditLogDetail)
}

func (h *Handler) listAdminRuntimeSettings(c *gin.Context) {
	data, err := h.svc.ListAdminRuntimeSettings(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, map[string]any{"items": data})
}

func (h *Handler) createAdminRuntimeSetting(c *gin.Context) {
	h.upsertAdminRuntimeSetting(c, "")
}

func (h *Handler) updateAdminRuntimeSetting(c *gin.Context) {
	h.upsertAdminRuntimeSetting(c, c.Param("settingName"))
}

func (h *Handler) upsertAdminRuntimeSetting(c *gin.Context, routeID string) {
	var request runtimeSettingRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		respondError(c, service.ErrInvalidInput)
		return
	}

	if err := h.svc.UpsertAdminRuntimeSetting(c.Request.Context(), routeID, service.RuntimeSettingUpsertInput{
		Module: request.Module,
		Name:   request.Name,
		Value:  request.Value,
		Scope:  request.Scope,
	}); err != nil {
		respondError(c, err)
		return
	}

	action := "create_runtime_setting"
	target := request.Name
	if routeID != "" {
		action = "update_runtime_setting"
		target = routeID
	}
	h.svc.RecordAdminAction(c.Request.Context(), h.auditMeta(c), "runtime_settings", action, target, "runtime_setting", request)
	c.Status(http.StatusNoContent)
}

func (h *Handler) deleteAdminRuntimeSetting(c *gin.Context) {
	target := c.Param("settingName")
	if err := h.svc.DeleteAdminRuntimeSetting(c.Request.Context(), target); err != nil {
		respondError(c, err)
		return
	}

	h.svc.RecordAdminAction(c.Request.Context(), h.auditMeta(c), "runtime_settings", "delete_runtime_setting", target, "runtime_setting", nil)
	c.Status(http.StatusNoContent)
}

func (h *Handler) listAdminAuditLogs(c *gin.Context) {
	data, err := h.svc.ListAdminAuditLogs(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, map[string]any{"items": data})
}

func (h *Handler) getAdminAuditLogDetail(c *gin.Context) {
	data, err := h.svc.GetAdminAuditLogDetail(c.Request.Context(), c.Param("logId"))
	if err != nil {
		respondError(c, err)
		return
	}

	respondOK(c, data)
}
