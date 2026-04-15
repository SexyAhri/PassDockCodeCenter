package service

import (
	"context"
	"strings"
	"testing"

	"passdock/server/internal/config"
)

func TestPreviewAdminFulfillmentStrategyRendersTemplates(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{})
	if err := svc.SeedDefaults(); err != nil {
		t.Fatalf("SeedDefaults returned error: %v", err)
	}

	result, err := svc.PreviewAdminFulfillmentStrategy(context.Background(), "recharge_code_standard")
	if err != nil {
		t.Fatalf("PreviewAdminFulfillmentStrategy returned error: %v", err)
	}

	if result["preview"] != "Strategy request and delivery templates rendered successfully." {
		t.Fatalf("expected real preview message, got %#v", result["preview"])
	}

	if strings.TrimSpace(stringValue(result["request_url"])) == "" {
		t.Fatalf("expected rendered request_url, got %#v", result["request_url"])
	}

	requestTemplate, ok := result["request_template"].(map[string]any)
	if !ok {
		t.Fatalf("expected request_template map, got %#v", result["request_template"])
	}
	if strings.TrimSpace(stringValue(requestTemplate["order_no"])) == "" {
		t.Fatalf("expected rendered order_no in request template, got %#v", requestTemplate["order_no"])
	}

	deliveryTemplate, ok := result["delivery_template"].(map[string]any)
	if !ok {
		t.Fatalf("expected delivery_template map, got %#v", result["delivery_template"])
	}
	if strings.Contains(stringValue(deliveryTemplate["content"]), "{{") {
		t.Fatalf("expected rendered delivery template content, got %#v", deliveryTemplate["content"])
	}
}

func TestAdminDeliveryStrategyTestRendersMessageTemplate(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{})
	if err := svc.SeedDefaults(); err != nil {
		t.Fatalf("SeedDefaults returned error: %v", err)
	}

	result, err := svc.TestAdminDeliveryStrategy(context.Background(), "telegram_and_web_default")
	if err != nil {
		t.Fatalf("TestAdminDeliveryStrategy returned error: %v", err)
	}

	if strings.TrimSpace(stringValue(result["message"])) == "" {
		t.Fatalf("expected rendered message, got %#v", result["message"])
	}
	if result["message"] == "Delivery strategy validated." {
		t.Fatalf("expected real rendered message, got placeholder %#v", result["message"])
	}

	renderedTemplate, ok := result["message_template"].(map[string]any)
	if !ok {
		t.Fatalf("expected message_template map, got %#v", result["message_template"])
	}
	if strings.Contains(stringValue(renderedTemplate["content"]), "{{") {
		t.Fatalf("expected rendered message template content, got %#v", renderedTemplate["content"])
	}

	if strings.TrimSpace(stringValue(result["delivery_target"])) == "" {
		t.Fatalf("expected resolved delivery target, got %#v", result["delivery_target"])
	}
}
