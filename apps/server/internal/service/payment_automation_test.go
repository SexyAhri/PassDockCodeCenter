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

	storefrontOrder, err := svc.GetStorefrontOrder(context.Background(), orderNo)
	if err != nil {
		t.Fatalf("GetStorefrontOrder returned error: %v", err)
	}

	deliveryResult, ok := storefrontOrder["delivery_result"].(map[string]any)
	if !ok || len(deliveryResult) == 0 {
		t.Fatalf("expected embedded delivery result, got %#v", storefrontOrder["delivery_result"])
	}

	codes, ok := deliveryResult["codes"].([]string)
	if !ok || len(codes) == 0 {
		t.Fatalf("expected issued codes in embedded delivery result, got %#v", deliveryResult["codes"])
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

	storefrontOrder, err := svc.GetStorefrontOrder(context.Background(), orderNo)
	if err != nil {
		t.Fatalf("GetStorefrontOrder returned error: %v", err)
	}

	deliveryResult, ok := storefrontOrder["delivery_result"].(map[string]any)
	if !ok || len(deliveryResult) == 0 {
		t.Fatalf("expected embedded delivery result after manual approval, got %#v", storefrontOrder["delivery_result"])
	}
}

func TestStorefrontOrderDoesNotExposeCodesBeforeManualReviewApproval(t *testing.T) {
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
		BuyerRef:      "web:pending-manual-review",
		Quantity:      1,
		Currency:      "RMB",
	})
	if err != nil {
		t.Fatalf("CreateOrder returned error: %v", err)
	}

	orderNo := stringValue(orderData["order_no"])
	if err := svc.UploadPaymentProof(context.Background(), orderNo, UploadPaymentProofInput{
		ProofType: "screenshot",
		ObjectKey: "payment-proofs/pending-manual-review.png",
		ObjectURL: "/uploads/payment-proofs/pending-manual-review.png",
		Note:      "awaiting manual review",
	}); err != nil {
		t.Fatalf("UploadPaymentProof returned error: %v", err)
	}
	if err := svc.MarkStorefrontOrderPaid(context.Background(), orderNo); err != nil {
		t.Fatalf("MarkStorefrontOrderPaid returned error: %v", err)
	}

	storefrontOrder, err := svc.GetStorefrontOrder(context.Background(), orderNo)
	if err != nil {
		t.Fatalf("GetStorefrontOrder returned error: %v", err)
	}
	if storefrontOrder["delivery_result"] != nil {
		t.Fatalf("expected delivery_result to stay hidden before approval, got %#v", storefrontOrder["delivery_result"])
	}

	deliveryResult, err := svc.GetStorefrontOrderDelivery(context.Background(), orderNo)
	if err != nil {
		t.Fatalf("GetStorefrontOrderDelivery returned error: %v", err)
	}
	if deliveryResult != nil {
		t.Fatalf("expected delivery endpoint to stay hidden before approval, got %#v", deliveryResult)
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

func TestConfirmAdminOrderPaymentAllowsRetryAfterFulfillmentFailure(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{})
	if err := svc.SeedDefaults(); err != nil {
		t.Fatalf("SeedDefaults returned error: %v", err)
	}

	action, err := svc.resolveActionByRoute(context.Background(), "issue_recharge_code")
	if err != nil {
		t.Fatalf("resolveActionByRoute returned error: %v", err)
	}
	if err := svc.UpsertAdminAction(context.Background(), action.ActionKey, ActionUpsertInput{
		ProviderKey:    "new_api_prod",
		ActionKey:      action.ActionKey,
		HTTPMethod:     action.HTTPMethod,
		PathTemplate:   action.PathTemplate,
		SuccessPath:    action.SuccessPath,
		MessagePath:    action.MessagePath,
		CodeListPath:   action.CodeListPath,
		Enabled:        false,
		HeaderTemplate: parseJSON[map[string]any](action.HeaderTemplateJSON),
		QueryTemplate:  parseJSON[map[string]any](action.QueryTemplateJSON),
		BodyTemplate:   parseJSON[map[string]any](action.BodyTemplateJSON),
	}); err != nil {
		t.Fatalf("UpsertAdminAction disable returned error: %v", err)
	}

	productIDs, err := svc.seedProductLookup(context.Background())
	if err != nil {
		t.Fatalf("seedProductLookup returned error: %v", err)
	}

	orderData, err := svc.CreateOrder(context.Background(), CreateOrderInput{
		ProductID:     productIDs["credit-trial"],
		PaymentMethod: "wechat_qr",
		SourceChannel: "web",
		BuyerRef:      "web:retry-after-failure",
		Quantity:      1,
		Currency:      "RMB",
	})
	if err != nil {
		t.Fatalf("CreateOrder returned error: %v", err)
	}

	orderNo := stringValue(orderData["order_no"])
	if err := svc.ConfirmAdminOrderPayment(context.Background(), orderNo, ConfirmPaymentInput{
		PaymentMethod: "wechat_qr",
		Amount:        "0.99",
		Currency:      "RMB",
		Note:          "first confirm",
		SourceType:    "admin_confirm_payment",
	}, AuditMeta{}); err != nil {
		t.Fatalf("first ConfirmAdminOrderPayment returned error: %v", err)
	}

	if _, err := svc.ApplyPaymentPostConfirmAutomation(context.Background(), orderNo, false, false, AuditMeta{}); err == nil {
		t.Fatalf("expected automation to fail while action is disabled")
	}

	order, err := svc.resolveOrderByNo(context.Background(), orderNo)
	if err != nil {
		t.Fatalf("resolveOrderByNo after failed automation returned error: %v", err)
	}
	if order.PaymentStatus != "paid" || order.Status != "failed" {
		t.Fatalf("expected paid failed order after fulfillment error, got status=%q payment=%q", order.Status, order.PaymentStatus)
	}

	if err := svc.UpsertAdminAction(context.Background(), action.ActionKey, ActionUpsertInput{
		ProviderKey:    "new_api_prod",
		ActionKey:      action.ActionKey,
		HTTPMethod:     action.HTTPMethod,
		PathTemplate:   action.PathTemplate,
		SuccessPath:    action.SuccessPath,
		MessagePath:    action.MessagePath,
		CodeListPath:   action.CodeListPath,
		Enabled:        true,
		HeaderTemplate: parseJSON[map[string]any](action.HeaderTemplateJSON),
		QueryTemplate:  parseJSON[map[string]any](action.QueryTemplateJSON),
		BodyTemplate:   parseJSON[map[string]any](action.BodyTemplateJSON),
	}); err != nil {
		t.Fatalf("UpsertAdminAction enable returned error: %v", err)
	}

	if err := svc.ConfirmAdminOrderPayment(context.Background(), orderNo, ConfirmPaymentInput{
		PaymentMethod: "wechat_qr",
		Amount:        "0.99",
		Currency:      "RMB",
		Note:          "retry confirm",
		SourceType:    "admin_confirm_payment",
	}, AuditMeta{}); err != nil {
		t.Fatalf("retry ConfirmAdminOrderPayment returned error: %v", err)
	}

	if _, err := svc.ApplyPaymentPostConfirmAutomation(context.Background(), orderNo, false, false, AuditMeta{}); err != nil {
		t.Fatalf("retry ApplyPaymentPostConfirmAutomation returned error: %v", err)
	}

	order, err = svc.resolveOrderByNo(context.Background(), orderNo)
	if err != nil {
		t.Fatalf("resolveOrderByNo after retry returned error: %v", err)
	}
	if order.Status != "completed" || order.DeliveryStatus != "sent" {
		t.Fatalf("expected completed sent order after retry, got status=%q delivery=%q", order.Status, order.DeliveryStatus)
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
