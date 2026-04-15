package service

import (
	"context"
	"testing"

	"passdock/server/internal/config"
	"passdock/server/internal/model"
)

func TestHandlePaymentCallbackAppliesChannelAutomation(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{})
	if err := svc.SeedDefaults(); err != nil {
		t.Fatalf("SeedDefaults returned error: %v", err)
	}

	productIDs, err := svc.seedProductLookup(context.Background())
	if err != nil {
		t.Fatalf("seedProductLookup returned error: %v", err)
	}

	orderData, err := svc.CreateOrder(context.Background(), CreateOrderInput{
		ProductID:     productIDs["starter-monthly"],
		PaymentMethod: "wechat_qr",
		SourceChannel: "web",
		BuyerRef:      "web:auto-callback",
		Quantity:      1,
		Currency:      "RMB",
	})
	if err != nil {
		t.Fatalf("CreateOrder returned error: %v", err)
	}

	orderNo := stringValue(orderData["order_no"])
	result, err := svc.HandlePaymentCallback(context.Background(), "wechat_qr_main", PaymentCallbackInput{
		OrderNo:       orderNo,
		PaymentMethod: "wechat_qr",
		Amount:        "15.00",
		Currency:      "RMB",
		Note:          "callback automation test",
	}, AuditMeta{})
	if err != nil {
		t.Fatalf("HandlePaymentCallback returned error: %v", err)
	}

	if result["auto_fulfill"] != true {
		t.Fatalf("expected auto_fulfill true, got %#v", result["auto_fulfill"])
	}
	if result["auto_deliver"] != true {
		t.Fatalf("expected auto_deliver true, got %#v", result["auto_deliver"])
	}

	order, err := svc.resolveOrderByNo(context.Background(), orderNo)
	if err != nil {
		t.Fatalf("resolveOrderByNo returned error: %v", err)
	}
	if order.Status != "completed" {
		t.Fatalf("expected order status completed, got %q", order.Status)
	}
	if order.PaymentStatus != "paid" {
		t.Fatalf("expected payment status paid, got %q", order.PaymentStatus)
	}
	if order.DeliveryStatus != "sent" {
		t.Fatalf("expected delivery status sent, got %q", order.DeliveryStatus)
	}
}

func TestApplyPaymentPostConfirmAutomationCompletesManualReviewOrders(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{})
	if err := svc.SeedDefaults(); err != nil {
		t.Fatalf("SeedDefaults returned error: %v", err)
	}

	productIDs, err := svc.seedProductLookup(context.Background())
	if err != nil {
		t.Fatalf("seedProductLookup returned error: %v", err)
	}

	orderData, err := svc.CreateOrder(context.Background(), CreateOrderInput{
		ProductID:     productIDs["starter-monthly"],
		PaymentMethod: "alipay_qr",
		SourceChannel: "web",
		BuyerRef:      "web:manual-automation",
		Quantity:      1,
		Currency:      "RMB",
	})
	if err != nil {
		t.Fatalf("CreateOrder returned error: %v", err)
	}

	orderNo := stringValue(orderData["order_no"])
	if err := svc.UploadPaymentProof(context.Background(), orderNo, UploadPaymentProofInput{
		ProofType: "screenshot",
		ObjectKey: "payment-proofs/manual-automation.png",
		ObjectURL: "/uploads/payment-proofs/manual-automation.png",
		Note:      "manual automation",
	}); err != nil {
		t.Fatalf("UploadPaymentProof returned error: %v", err)
	}
	if err := svc.MarkStorefrontOrderPaid(context.Background(), orderNo); err != nil {
		t.Fatalf("MarkStorefrontOrderPaid returned error: %v", err)
	}
	if err := svc.ConfirmAdminOrderPayment(context.Background(), orderNo, ConfirmPaymentInput{
		PaymentMethod: "alipay_qr",
		Amount:        "15.00",
		Currency:      "RMB",
		Note:          "manual confirm",
		SourceType:    "admin_confirm_payment",
	}, AuditMeta{}); err != nil {
		t.Fatalf("ConfirmAdminOrderPayment returned error: %v", err)
	}

	automation, err := svc.ApplyPaymentPostConfirmAutomation(context.Background(), orderNo, false, false, AuditMeta{})
	if err != nil {
		t.Fatalf("ApplyPaymentPostConfirmAutomation returned error: %v", err)
	}
	if !automation.EffectiveAutoFulfill || !automation.EffectiveAutoDeliver {
		t.Fatalf("expected automation to enable fulfill and deliver, got %#v", automation)
	}

	order, err := svc.resolveOrderByNo(context.Background(), orderNo)
	if err != nil {
		t.Fatalf("resolveOrderByNo returned error: %v", err)
	}
	if order.Status != "completed" {
		t.Fatalf("expected order status completed, got %q", order.Status)
	}
	if order.DeliveryStatus != "sent" {
		t.Fatalf("expected delivery status sent, got %q", order.DeliveryStatus)
	}
}

func TestApplyPaymentPostConfirmAutomationQueuesManualEnterpriseDelivery(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{})
	if err := svc.SeedDefaults(); err != nil {
		t.Fatalf("SeedDefaults returned error: %v", err)
	}

	productIDs, err := svc.seedProductLookup(context.Background())
	if err != nil {
		t.Fatalf("seedProductLookup returned error: %v", err)
	}

	orderData, err := svc.CreateOrder(context.Background(), CreateOrderInput{
		ProductID:     productIDs["enterprise-yearly"],
		PaymentMethod: "wechat_qr",
		SourceChannel: "web",
		BuyerRef:      "web:enterprise-manual-queue",
		Quantity:      1,
		Currency:      "RMB",
	})
	if err != nil {
		t.Fatalf("CreateOrder returned error: %v", err)
	}

	orderNo := stringValue(orderData["order_no"])
	if err := svc.UploadPaymentProof(context.Background(), orderNo, UploadPaymentProofInput{
		ProofType: "screenshot",
		ObjectKey: "payment-proofs/enterprise-manual-queue.png",
		ObjectURL: "/uploads/payment-proofs/enterprise-manual-queue.png",
		Note:      "enterprise manual queue",
	}); err != nil {
		t.Fatalf("UploadPaymentProof returned error: %v", err)
	}
	if err := svc.MarkStorefrontOrderPaid(context.Background(), orderNo); err != nil {
		t.Fatalf("MarkStorefrontOrderPaid returned error: %v", err)
	}
	if err := svc.ConfirmAdminOrderPayment(context.Background(), orderNo, ConfirmPaymentInput{
		PaymentMethod: "wechat_qr",
		Amount:        "168.00",
		Currency:      "RMB",
		Note:          "manual confirm enterprise",
		SourceType:    "admin_confirm_payment",
	}, AuditMeta{}); err != nil {
		t.Fatalf("ConfirmAdminOrderPayment returned error: %v", err)
	}

	automation, err := svc.ApplyPaymentPostConfirmAutomation(context.Background(), orderNo, false, false, AuditMeta{})
	if err != nil {
		t.Fatalf("ApplyPaymentPostConfirmAutomation returned error: %v", err)
	}
	if !automation.EffectiveAutoFulfill || !automation.EffectiveAutoDeliver {
		t.Fatalf("expected automation to keep fulfill and deliver enabled, got %#v", automation)
	}

	order, err := svc.resolveOrderByNo(context.Background(), orderNo)
	if err != nil {
		t.Fatalf("resolveOrderByNo returned error: %v", err)
	}
	if order.Status != "delivery_pending" {
		t.Fatalf("expected order status delivery_pending, got %q", order.Status)
	}
	if order.DeliveryStatus != "pending" {
		t.Fatalf("expected delivery status pending, got %q", order.DeliveryStatus)
	}
	if order.CompletedAt != nil {
		t.Fatalf("expected completed_at to remain nil")
	}

	var record model.DeliveryRecord
	if err := svc.db.WithContext(context.Background()).
		Where("order_id = ?", order.ID).
		Order("id DESC").
		First(&record).Error; err != nil {
		t.Fatalf("load delivery record returned error: %v", err)
	}
	if record.DeliveryChannel != "manual" {
		t.Fatalf("expected manual delivery channel, got %q", record.DeliveryChannel)
	}
	if record.DeliveryStatus != "pending" {
		t.Fatalf("expected pending delivery record, got %q", record.DeliveryStatus)
	}
	if record.DeliveredAt != nil {
		t.Fatalf("expected queued manual delivery record to remain undelivered")
	}
}

func TestCompleteAdminOrderDeliveryCompletesQueuedManualDelivery(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{})
	if err := svc.SeedDefaults(); err != nil {
		t.Fatalf("SeedDefaults returned error: %v", err)
	}

	productIDs, err := svc.seedProductLookup(context.Background())
	if err != nil {
		t.Fatalf("seedProductLookup returned error: %v", err)
	}

	orderData, err := svc.CreateOrder(context.Background(), CreateOrderInput{
		ProductID:     productIDs["enterprise-yearly"],
		PaymentMethod: "wechat_qr",
		SourceChannel: "web",
		BuyerRef:      "web:enterprise-manual-complete",
		Quantity:      1,
		Currency:      "RMB",
	})
	if err != nil {
		t.Fatalf("CreateOrder returned error: %v", err)
	}

	orderNo := stringValue(orderData["order_no"])
	if err := svc.UploadPaymentProof(context.Background(), orderNo, UploadPaymentProofInput{
		ProofType: "screenshot",
		ObjectKey: "payment-proofs/enterprise-manual-complete.png",
		ObjectURL: "/uploads/payment-proofs/enterprise-manual-complete.png",
		Note:      "enterprise manual complete",
	}); err != nil {
		t.Fatalf("UploadPaymentProof returned error: %v", err)
	}
	if err := svc.MarkStorefrontOrderPaid(context.Background(), orderNo); err != nil {
		t.Fatalf("MarkStorefrontOrderPaid returned error: %v", err)
	}
	if err := svc.ConfirmAdminOrderPayment(context.Background(), orderNo, ConfirmPaymentInput{
		PaymentMethod: "wechat_qr",
		Amount:        "168.00",
		Currency:      "RMB",
		Note:          "manual confirm enterprise complete",
		SourceType:    "admin_confirm_payment",
	}, AuditMeta{}); err != nil {
		t.Fatalf("ConfirmAdminOrderPayment returned error: %v", err)
	}
	if _, err := svc.ApplyPaymentPostConfirmAutomation(context.Background(), orderNo, false, false, AuditMeta{}); err != nil {
		t.Fatalf("ApplyPaymentPostConfirmAutomation returned error: %v", err)
	}

	if err := svc.CompleteAdminOrderDelivery(context.Background(), orderNo, "sent by operator email", AuditMeta{}); err != nil {
		t.Fatalf("CompleteAdminOrderDelivery returned error: %v", err)
	}

	order, err := svc.resolveOrderByNo(context.Background(), orderNo)
	if err != nil {
		t.Fatalf("resolveOrderByNo returned error: %v", err)
	}
	if order.Status != "completed" {
		t.Fatalf("expected order status completed, got %q", order.Status)
	}
	if order.DeliveryStatus != "sent" {
		t.Fatalf("expected delivery status sent, got %q", order.DeliveryStatus)
	}
	if order.CompletedAt == nil {
		t.Fatalf("expected completed_at to be filled")
	}

	var record model.DeliveryRecord
	if err := svc.db.WithContext(context.Background()).
		Where("order_id = ?", order.ID).
		Order("id DESC").
		First(&record).Error; err != nil {
		t.Fatalf("load delivery record returned error: %v", err)
	}
	if record.DeliveryChannel != "manual" {
		t.Fatalf("expected manual delivery channel, got %q", record.DeliveryChannel)
	}
	if record.DeliveryStatus != "sent" {
		t.Fatalf("expected sent delivery record, got %q", record.DeliveryStatus)
	}
	if record.DeliveredAt == nil {
		t.Fatalf("expected delivered_at on manual completion")
	}
}
