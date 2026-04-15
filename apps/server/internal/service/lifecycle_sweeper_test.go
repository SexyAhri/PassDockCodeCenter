package service

import (
	"context"
	"testing"
	"time"

	"passdock/server/internal/config"
	"passdock/server/internal/model"
)

func TestRunOrderLifecycleSweepExpiresAwaitingPaymentOrders(t *testing.T) {
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
		BuyerRef:      "web:expire-test",
		Quantity:      1,
		Currency:      "RMB",
	})
	if err != nil {
		t.Fatalf("CreateOrder returned error: %v", err)
	}

	orderNo := stringValue(data["order_no"])
	if err := svc.db.WithContext(context.Background()).
		Model(&model.Order{}).
		Where("order_no = ?", orderNo).
		Update("expire_at", time.Now().Add(-2*time.Minute)).Error; err != nil {
		t.Fatalf("update expire_at returned error: %v", err)
	}

	result, err := svc.RunOrderLifecycleSweep(context.Background())
	if err != nil {
		t.Fatalf("RunOrderLifecycleSweep returned error: %v", err)
	}
	if result.ExpiredOrders != 1 {
		t.Fatalf("expected 1 expired order, got %#v", result)
	}

	order, err := svc.resolveOrderByNo(context.Background(), orderNo)
	if err != nil {
		t.Fatalf("resolveOrderByNo returned error: %v", err)
	}
	if order.Status != "expired" {
		t.Fatalf("expected order status expired, got %q", order.Status)
	}
	if order.PaymentStatus != "unpaid" {
		t.Fatalf("expected payment status unpaid, got %q", order.PaymentStatus)
	}

	var event model.OrderEvent
	if err := svc.db.WithContext(context.Background()).
		Where("order_id = ? AND event_type = ?", order.ID, "order_expired").
		Order("id DESC").
		First(&event).Error; err != nil {
		t.Fatalf("load order_expired event returned error: %v", err)
	}
}

func TestRunOrderLifecycleSweepFailsOverduePaymentReviews(t *testing.T) {
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
		BuyerRef:      "web:review-timeout-test",
		Quantity:      1,
		Currency:      "RMB",
	})
	if err != nil {
		t.Fatalf("CreateOrder returned error: %v", err)
	}

	orderNo := stringValue(data["order_no"])
	if err := svc.UploadPaymentProof(context.Background(), orderNo, UploadPaymentProofInput{
		ProofType: "screenshot",
		ObjectKey: "payment-proofs/test-timeout.png",
		ObjectURL: "/uploads/payment-proofs/test-timeout.png",
		Note:      "timeout test",
	}); err != nil {
		t.Fatalf("UploadPaymentProof returned error: %v", err)
	}
	if err := svc.MarkStorefrontOrderPaid(context.Background(), orderNo); err != nil {
		t.Fatalf("MarkStorefrontOrderPaid returned error: %v", err)
	}

	paidAt := time.Now().Add(-2 * time.Hour)
	if err := svc.db.WithContext(context.Background()).
		Model(&model.Order{}).
		Where("order_no = ?", orderNo).
		Updates(map[string]any{
			"paid_at":    paidAt,
			"updated_at": paidAt,
		}).Error; err != nil {
		t.Fatalf("update paid_at returned error: %v", err)
	}

	result, err := svc.RunOrderLifecycleSweep(context.Background())
	if err != nil {
		t.Fatalf("RunOrderLifecycleSweep returned error: %v", err)
	}
	if result.FailedPaymentReviews != 1 {
		t.Fatalf("expected 1 failed payment review, got %#v", result)
	}

	order, err := svc.resolveOrderByNo(context.Background(), orderNo)
	if err != nil {
		t.Fatalf("resolveOrderByNo returned error: %v", err)
	}
	if order.Status != "failed" {
		t.Fatalf("expected order status failed, got %q", order.Status)
	}
	if order.PaymentStatus != "failed" {
		t.Fatalf("expected payment status failed, got %q", order.PaymentStatus)
	}

	var proof model.PaymentProof
	if err := svc.db.WithContext(context.Background()).
		Where("order_id = ?", order.ID).
		Order("id DESC").
		First(&proof).Error; err != nil {
		t.Fatalf("load payment proof returned error: %v", err)
	}
	if proof.ReviewStatus != "rejected" {
		t.Fatalf("expected proof review_status rejected, got %q", proof.ReviewStatus)
	}

	var payment model.PaymentRecord
	if err := svc.db.WithContext(context.Background()).
		Where("order_id = ?", order.ID).
		Order("id DESC").
		First(&payment).Error; err != nil {
		t.Fatalf("load payment record returned error: %v", err)
	}
	if payment.Status != "failed" {
		t.Fatalf("expected payment record status failed, got %q", payment.Status)
	}

	var event model.OrderEvent
	if err := svc.db.WithContext(context.Background()).
		Where("order_id = ? AND event_type = ?", order.ID, "payment_review_timeout").
		Order("id DESC").
		First(&event).Error; err != nil {
		t.Fatalf("load payment_review_timeout event returned error: %v", err)
	}
}
