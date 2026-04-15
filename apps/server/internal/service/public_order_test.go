package service

import (
	"context"
	"testing"

	"passdock/server/internal/config"
)

func TestCreateOrderPrefersPaymentMethodPriceTemplateForManualChannels(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{})
	if err := svc.SeedDefaults(); err != nil {
		t.Fatalf("SeedDefaults returned error: %v", err)
	}

	productIDs, err := svc.seedProductLookup(context.Background())
	if err != nil {
		t.Fatalf("seedProductLookup returned error: %v", err)
	}

	data, err := svc.CreateOrder(context.Background(), CreateOrderInput{
		ProductID:     productIDs["starter-monthly"],
		PaymentMethod: "wechat_qr",
		SourceChannel: "web",
		BuyerRef:      "web:method-price-template",
		Quantity:      1,
		Currency:      "USDT",
	})
	if err != nil {
		t.Fatalf("CreateOrder returned error: %v", err)
	}

	orderNo := stringValue(data["order_no"])
	order, err := svc.resolveOrderByNo(context.Background(), orderNo)
	if err != nil {
		t.Fatalf("resolveOrderByNo returned error: %v", err)
	}

	if order.Currency != "RMB" {
		t.Fatalf("expected order currency RMB, got %q", order.Currency)
	}
	if order.PayAmount != 15.00 {
		t.Fatalf("expected order pay amount 15.00, got %#v", order.PayAmount)
	}
	if stringValue(data["currency"]) != "RMB" {
		t.Fatalf("expected storefront currency RMB, got %#v", data["currency"])
	}
	if stringValue(data["display_amount"]) != "15.00" {
		t.Fatalf("expected storefront amount 15.00, got %#v", data["display_amount"])
	}
}
