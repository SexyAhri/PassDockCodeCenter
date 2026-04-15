package service

import (
	"context"
	"testing"

	"passdock/server/internal/config"
	"passdock/server/internal/model"
)

func TestHandleOnchainConfirmationCompletesOKXOrder(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{})
	if err := svc.SeedDefaults(); err != nil {
		t.Fatalf("SeedDefaults returned error: %v", err)
	}

	productIDs, err := svc.seedProductLookup(context.Background())
	if err != nil {
		t.Fatalf("seedProductLookup returned error: %v", err)
	}

	orderData, err := svc.CreateOrder(context.Background(), CreateOrderInput{
		ProductID:     productIDs["pro-monthly"],
		PaymentMethod: "okx_usdt",
		SourceChannel: "web",
		BuyerRef:      "web:okx-auto-confirm",
		Quantity:      1,
		Currency:      "USDT",
	})
	if err != nil {
		t.Fatalf("CreateOrder returned error: %v", err)
	}

	orderNo := stringValue(orderData["order_no"])
	if err := svc.MarkStorefrontOrderPaid(context.Background(), orderNo); err != nil {
		t.Fatalf("MarkStorefrontOrderPaid returned error: %v", err)
	}

	result, err := svc.HandleOnchainConfirmation(context.Background(), OnchainConfirmationInput{
		OrderNo:       orderNo,
		PaymentMethod: "okx_usdt",
		Amount:        "5.49",
		Currency:      "USDT",
		ChainTxHash:   "0x-okx-auto-confirm-1001",
		PayerAccount:  "0x-wallet-1001",
	}, AuditMeta{})
	if err != nil {
		t.Fatalf("HandleOnchainConfirmation returned error: %v", err)
	}

	if result["status"] != "matched" {
		t.Fatalf("expected matched status, got %#v", result["status"])
	}
	if result["auto_fulfill"] != true {
		t.Fatalf("expected auto_fulfill=true, got %#v", result["auto_fulfill"])
	}
	if result["auto_deliver"] != true {
		t.Fatalf("expected auto_deliver=true, got %#v", result["auto_deliver"])
	}

	order, err := svc.resolveOrderByNo(context.Background(), orderNo)
	if err != nil {
		t.Fatalf("resolveOrderByNo returned error: %v", err)
	}
	if order.PaymentStatus != "paid" {
		t.Fatalf("expected payment status paid, got %q", order.PaymentStatus)
	}
	if order.Status != "completed" {
		t.Fatalf("expected order status completed, got %q", order.Status)
	}
	if order.DeliveryStatus != "sent" {
		t.Fatalf("expected delivery status sent, got %q", order.DeliveryStatus)
	}

	var watcher model.PaymentWatcherRecord
	if err := svc.db.WithContext(context.Background()).
		Where("order_no = ?", orderNo).
		Order("id DESC").
		First(&watcher).Error; err != nil {
		t.Fatalf("load watcher record returned error: %v", err)
	}
	if watcher.ChannelKey != "okx_usdt_watch" {
		t.Fatalf("expected watcher channel okx_usdt_watch, got %q", watcher.ChannelKey)
	}
	if watcher.Status != "matched" {
		t.Fatalf("expected watcher status matched, got %q", watcher.Status)
	}

	var payment model.PaymentRecord
	if err := svc.db.WithContext(context.Background()).
		Where("order_id = ?", order.ID).
		Order("id DESC").
		First(&payment).Error; err != nil {
		t.Fatalf("load payment record returned error: %v", err)
	}
	if payment.ChainTxHash != "0x-okx-auto-confirm-1001" {
		t.Fatalf("expected chain tx hash to be recorded, got %q", payment.ChainTxHash)
	}
}

func TestHandleOnchainConfirmationRoutesAmountMismatchToManualReview(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{})
	if err := svc.SeedDefaults(); err != nil {
		t.Fatalf("SeedDefaults returned error: %v", err)
	}

	productIDs, err := svc.seedProductLookup(context.Background())
	if err != nil {
		t.Fatalf("seedProductLookup returned error: %v", err)
	}

	orderData, err := svc.CreateOrder(context.Background(), CreateOrderInput{
		ProductID:     productIDs["pro-monthly"],
		PaymentMethod: "okx_usdt",
		SourceChannel: "web",
		BuyerRef:      "web:okx-mismatch-review",
		Quantity:      1,
		Currency:      "USDT",
	})
	if err != nil {
		t.Fatalf("CreateOrder returned error: %v", err)
	}

	orderNo := stringValue(orderData["order_no"])
	result, err := svc.HandleOnchainConfirmation(context.Background(), OnchainConfirmationInput{
		OrderNo:       orderNo,
		PaymentMethod: "okx_usdt",
		Amount:        "5.00",
		Currency:      "USDT",
		ChainTxHash:   "0x-okx-manual-review-1002",
		PayerAccount:  "0x-wallet-1002",
	}, AuditMeta{})
	if err != nil {
		t.Fatalf("HandleOnchainConfirmation returned error: %v", err)
	}

	if result["status"] != "manual_review" {
		t.Fatalf("expected manual_review status, got %#v", result["status"])
	}

	order, err := svc.resolveOrderByNo(context.Background(), orderNo)
	if err != nil {
		t.Fatalf("resolveOrderByNo returned error: %v", err)
	}
	if order.PaymentStatus == "paid" {
		t.Fatalf("expected mismatch order to remain unpaid/pending review, got %q", order.PaymentStatus)
	}
	if order.Status == "completed" {
		t.Fatalf("expected mismatch order not to complete")
	}

	var watcher model.PaymentWatcherRecord
	if err := svc.db.WithContext(context.Background()).
		Where("order_no = ?", orderNo).
		Order("id DESC").
		First(&watcher).Error; err != nil {
		t.Fatalf("load watcher record returned error: %v", err)
	}
	if watcher.Status != "manual_review" {
		t.Fatalf("expected watcher status manual_review, got %q", watcher.Status)
	}

	var callbackLog model.PaymentCallbackLog
	if err := svc.db.WithContext(context.Background()).
		Where("order_no = ?", orderNo).
		Order("id DESC").
		First(&callbackLog).Error; err != nil {
		t.Fatalf("load callback log returned error: %v", err)
	}
	if callbackLog.SourceType != "onchain_watcher" {
		t.Fatalf("expected onchain_watcher callback log, got %q", callbackLog.SourceType)
	}
	if callbackLog.Status != "error" {
		t.Fatalf("expected error callback log for mismatch, got %q", callbackLog.Status)
	}
}
