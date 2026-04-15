package service

import (
	"context"
	"encoding/json"
	"strings"

	"passdock/server/internal/model"
)

type RuntimeSettingUpsertInput struct {
	Module string
	Name   string
	Value  string
	Scope  string
}

func (s *Service) ListAdminRuntimeSettings(ctx context.Context) ([]map[string]any, error) {
	var items []model.RuntimeSetting
	if err := s.db.WithContext(ctx).Order("module ASC, name ASC").Find(&items).Error; err != nil {
		return nil, err
	}

	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		resolved := s.resolveRuntimeSetting(ctx, item.Name, item.Value)
		result = append(result, map[string]any{
			"id":              item.ID,
			"key":             item.Name,
			"module":          item.Module,
			"name":            item.Name,
			"value":           item.Value,
			"scope":           item.Scope,
			"description":     firstNonEmpty(item.Description, resolved.Description),
			"effective_value": resolved.EffectiveValue,
			"value_source":    resolved.ValueSource,
			"applies_live":    resolved.AppliesLive,
			"env_key":         resolved.EnvKey,
		})
	}

	return result, nil
}

func (s *Service) UpsertAdminRuntimeSetting(ctx context.Context, routeID string, input RuntimeSettingUpsertInput) error {
	record := model.RuntimeSetting{
		Module: input.Module,
		Name:   input.Name,
		Value:  input.Value,
		Scope:  defaultString(input.Scope, "db"),
	}

	if routeID == "" {
		return s.db.WithContext(ctx).Create(&record).Error
	}

	existing, err := s.resolveRuntimeSettingByName(ctx, routeID)
	if err != nil {
		return err
	}

	return s.db.WithContext(ctx).Model(existing).Updates(record).Error
}

func (s *Service) DeleteAdminRuntimeSetting(ctx context.Context, routeID string) error {
	record, err := s.resolveRuntimeSettingByName(ctx, routeID)
	if err != nil {
		return err
	}

	return s.db.WithContext(ctx).Delete(record).Error
}

func (s *Service) ListAdminAuditLogs(ctx context.Context) ([]map[string]any, error) {
	var items []model.AdminOperationLog
	if err := s.db.WithContext(ctx).Order("created_at DESC, id DESC").Find(&items).Error; err != nil {
		return nil, err
	}

	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		operator := ""
		if item.AdminUserID != nil {
			if user, err := s.resolveUserByID(ctx, *item.AdminUserID); err == nil {
				operator = user.DisplayName
			}
		}
		payload := parseAdminAuditPayload(item.RequestPayload)

		result = append(result, map[string]any{
			"id":              item.ID,
			"key":             item.ID,
			"admin_user_id":   item.AdminUserID,
			"operator":        operator,
			"module":          item.Module,
			"action":          item.Action,
			"target_id":       item.TargetID,
			"targetId":        item.TargetID,
			"target_type":     item.TargetType,
			"request_ip":      item.RequestIP,
			"payload":         payload,
			"request_payload": payload,
			"created_at":      item.CreatedAt,
			"createdAt":       item.CreatedAt,
		})
	}

	return result, nil
}

func (s *Service) GetAdminAuditLogDetail(ctx context.Context, routeID string) (map[string]any, error) {
	record, err := s.resolveAdminOperationLogByRoute(ctx, routeID)
	if err != nil {
		return nil, err
	}

	operator := ""
	operatorEmail := ""
	operatorRole := ""
	if record.AdminUserID != nil {
		if user, userErr := s.resolveUserByID(ctx, *record.AdminUserID); userErr == nil {
			operator = user.DisplayName
			if user.Email != nil {
				operatorEmail = *user.Email
			}
			operatorRole = user.Role
		}
	}

	return map[string]any{
		"id":              record.ID,
		"log_id":          record.ID,
		"admin_user_id":   record.AdminUserID,
		"operator":        operator,
		"operator_email":  operatorEmail,
		"operator_role":   operatorRole,
		"module":          record.Module,
		"action":          record.Action,
		"target_id":       record.TargetID,
		"target_type":     record.TargetType,
		"request_ip":      record.RequestIP,
		"request_payload": parseAdminAuditPayload(record.RequestPayload),
		"created_at":      record.CreatedAt,
	}, nil
}

func parseAdminAuditPayload(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}

	var payload any
	if err := json.Unmarshal([]byte(trimmed), &payload); err == nil {
		return payload
	}

	return trimmed
}
