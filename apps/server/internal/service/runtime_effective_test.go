package service

import (
	"context"
	"testing"
	"time"

	"passdock/server/internal/config"
)

func TestCreateOrderUsesRuntimeSettingOverride(t *testing.T) {
	t.Setenv("ORDER_EXPIRE_MINUTES", "")

	svc := newSystemSecurityTestService(t, config.Config{})
	if err := svc.SeedDefaults(); err != nil {
		t.Fatalf("SeedDefaults returned error: %v", err)
	}

	if err := svc.UpsertAdminRuntimeSetting(context.Background(), "ORDER_EXPIRE_MINUTES", RuntimeSettingUpsertInput{
		Module: "orders",
		Name:   "ORDER_EXPIRE_MINUTES",
		Value:  "5",
		Scope:  "db",
	}); err != nil {
		t.Fatalf("UpsertAdminRuntimeSetting returned error: %v", err)
	}

	productIDs, err := svc.seedProductLookup(context.Background())
	if err != nil {
		t.Fatalf("seedProductLookup returned error: %v", err)
	}

	data, err := svc.CreateOrder(context.Background(), CreateOrderInput{
		ProductID:     productIDs["starter-monthly"],
		PaymentMethod: "wechat_qr",
		SourceChannel: "web",
		BuyerRef:      "web:runtime-test",
		Quantity:      1,
		Currency:      "RMB",
	})
	if err != nil {
		t.Fatalf("CreateOrder returned error: %v", err)
	}

	if got := intValue(data["order_expire_minutes"]); got != 5 {
		t.Fatalf("expected order_expire_minutes=5, got %d", got)
	}

	orderNo := stringValue(data["order_no"])
	order, err := svc.resolveOrderByNo(context.Background(), orderNo)
	if err != nil {
		t.Fatalf("resolveOrderByNo returned error: %v", err)
	}
	if order.ExpireAt == nil {
		t.Fatalf("expected order expire time")
	}

	remaining := time.Until(*order.ExpireAt)
	if remaining < 4*time.Minute || remaining > 6*time.Minute {
		t.Fatalf("expected expire_at near 5 minutes, got %s", remaining)
	}
}

func TestListAdminRuntimeSettingsReportsEffectiveSourceAndLiveFlag(t *testing.T) {
	t.Setenv("ORDER_EXPIRE_MINUTES", "21")

	svc := newSystemSecurityTestService(t, config.Config{})
	if err := svc.UpsertAdminRuntimeSetting(context.Background(), "", RuntimeSettingUpsertInput{
		Module: "orders",
		Name:   "ORDER_EXPIRE_MINUTES",
		Value:  "12",
		Scope:  "db",
	}); err != nil {
		t.Fatalf("UpsertAdminRuntimeSetting ORDER_EXPIRE_MINUTES returned error: %v", err)
	}
	if err := svc.UpsertAdminRuntimeSetting(context.Background(), "", RuntimeSettingUpsertInput{
		Module: "queue",
		Name:   "ASYNC_CONCURRENCY",
		Value:  "4",
		Scope:  "db",
	}); err != nil {
		t.Fatalf("UpsertAdminRuntimeSetting ASYNC_CONCURRENCY returned error: %v", err)
	}

	items, err := svc.ListAdminRuntimeSettings(context.Background())
	if err != nil {
		t.Fatalf("ListAdminRuntimeSettings returned error: %v", err)
	}

	orderSetting := findRuntimeSetting(items, "ORDER_EXPIRE_MINUTES")
	if orderSetting == nil {
		t.Fatalf("expected ORDER_EXPIRE_MINUTES in runtime settings")
	}
	if orderSetting["effective_value"] != "21" {
		t.Fatalf("expected ORDER_EXPIRE_MINUTES effective_value=21, got %#v", orderSetting["effective_value"])
	}
	if orderSetting["value_source"] != "env" {
		t.Fatalf("expected ORDER_EXPIRE_MINUTES value_source=env, got %#v", orderSetting["value_source"])
	}
	if orderSetting["applies_live"] != true {
		t.Fatalf("expected ORDER_EXPIRE_MINUTES applies_live=true, got %#v", orderSetting["applies_live"])
	}

	asyncSetting := findRuntimeSetting(items, "ASYNC_CONCURRENCY")
	if asyncSetting == nil {
		t.Fatalf("expected ASYNC_CONCURRENCY in runtime settings")
	}
	if asyncSetting["effective_value"] != "4" {
		t.Fatalf("expected ASYNC_CONCURRENCY effective_value=4, got %#v", asyncSetting["effective_value"])
	}
	if asyncSetting["value_source"] != "db" {
		t.Fatalf("expected ASYNC_CONCURRENCY value_source=db, got %#v", asyncSetting["value_source"])
	}
	if asyncSetting["applies_live"] != true {
		t.Fatalf("expected ASYNC_CONCURRENCY applies_live=true, got %#v", asyncSetting["applies_live"])
	}
}

func findRuntimeSetting(items []map[string]any, name string) map[string]any {
	for _, item := range items {
		if item["name"] == name {
			return item
		}
	}

	return nil
}
