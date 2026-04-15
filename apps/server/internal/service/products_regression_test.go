package service

import (
	"context"
	"testing"

	"passdock/server/internal/config"
)

func TestUpsertAdminProductPersistsDisabledState(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{})
	if err := svc.SeedDefaults(); err != nil {
		t.Fatalf("SeedDefaults returned error: %v", err)
	}

	product, err := svc.resolveProductByRoute(context.Background(), "starter-monthly")
	if err != nil {
		t.Fatalf("resolveProductByRoute returned error: %v", err)
	}

	meta := parseJSON[productMetadata](product.MetadataJSON)
	if err := svc.UpsertAdminProduct(context.Background(), product.SKU, ProductUpsertInput{
		ProductType:            product.ProductType,
		SKU:                    product.SKU,
		Name:                   product.Name,
		Description:            product.Description,
		DisplayPrice:           formatAmount(product.DisplayPrice),
		Currency:               product.Currency,
		Enabled:                false,
		SortOrder:              product.SortOrder,
		FulfillmentStrategyKey: product.FulfillmentStrategyKey,
		DeliveryStrategyKey:    product.DeliveryStrategyKey,
		Metadata: map[string]any{
			"name_zh":           meta.NameZH,
			"name_en":           meta.NameEN,
			"badge_zh":          meta.BadgeZH,
			"badge_en":          meta.BadgeEN,
			"cycle_label_zh":    meta.CycleLabelZH,
			"cycle_label_en":    meta.CycleLabelEN,
			"delivery_label_zh": meta.DeliveryLabelZH,
			"delivery_label_en": meta.DeliveryLabelEN,
			"stock_label_zh":    meta.StockLabelZH,
			"stock_label_en":    meta.StockLabelEN,
			"status_label_zh":   meta.StatusLabelZH,
			"status_label_en":   meta.StatusLabelEN,
			"original_price":    meta.OriginalPrice,
			"billing_cycle":     meta.BillingCycle,
			"inventory":         meta.Inventory,
			"payment_methods":   meta.PaymentMethods,
			"tags_zh":           meta.TagsZH,
			"tags_en":           meta.TagsEN,
			"checkout_notes_zh": meta.CheckoutNotesZH,
			"checkout_notes_en": meta.CheckoutNotesEN,
			"art_variant":       meta.ArtVariant,
		},
		PaymentMethods: meta.PaymentMethods,
	}); err != nil {
		t.Fatalf("UpsertAdminProduct returned error: %v", err)
	}

	updated, err := svc.resolveProductByRoute(context.Background(), product.SKU)
	if err != nil {
		t.Fatalf("resolveProductByRoute after update returned error: %v", err)
	}
	if updated.Enabled {
		t.Fatalf("expected product to stay disabled after update")
	}

	items, err := svc.ListPublicProducts(context.Background())
	if err != nil {
		t.Fatalf("ListPublicProducts returned error: %v", err)
	}
	for _, item := range items {
		if stringValue(item["sku"]) == product.SKU {
			t.Fatalf("expected disabled product %q to be hidden from storefront", product.SKU)
		}
	}
}

func TestStorefrontOKXQRUsesReceiveAddressFallback(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{
		OKXAdapterReceiveAddress: "TQgzWq9ExPtnYmHc6JNb28mLJ1PZTXCN8u",
	})
	if err := svc.SeedDefaults(); err != nil {
		t.Fatalf("SeedDefaults returned error: %v", err)
	}

	channels, err := svc.ListPublicPaymentChannels(context.Background())
	if err != nil {
		t.Fatalf("ListPublicPaymentChannels returned error: %v", err)
	}

	foundChannel := false
	for _, item := range channels {
		if stringValue(item["channel_type"]) != "okx_usdt" {
			continue
		}
		foundChannel = true
		if stringValue(item["qr_value"]) != svc.cfg.OKXAdapterReceiveAddress {
			t.Fatalf("expected storefront OKX qr_value fallback to receive address, got %#v", item["qr_value"])
		}
	}
	if !foundChannel {
		t.Fatalf("expected seeded okx_usdt channel to exist")
	}

	productIDs, err := svc.seedProductLookup(context.Background())
	if err != nil {
		t.Fatalf("seedProductLookup returned error: %v", err)
	}

	orderData, err := svc.CreateOrder(context.Background(), CreateOrderInput{
		ProductID:     productIDs["pro-monthly"],
		PaymentMethod: "okx_usdt",
		SourceChannel: "web",
		BuyerRef:      "web:okx-qr-fallback",
		Quantity:      1,
		Currency:      "USDT",
	})
	if err != nil {
		t.Fatalf("CreateOrder returned error: %v", err)
	}

	instruction, ok := orderData["payment_instruction"].(map[string]any)
	if !ok {
		t.Fatalf("expected payment_instruction payload, got %#v", orderData["payment_instruction"])
	}
	if stringValue(instruction["qr_content"]) != svc.cfg.OKXAdapterReceiveAddress {
		t.Fatalf("expected order qr_content fallback to receive address, got %#v", instruction["qr_content"])
	}
}
