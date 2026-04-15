package service

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"passdock/server/internal/config"
	"passdock/server/internal/model"
)

func TestFulfillmentFailureSchedulesAsyncRetryAndSweepRecovers(t *testing.T) {
	var issueCalls atomic.Int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/api/internal/redemption/issue"):
			call := issueCalls.Add(1)
			if call == 1 {
				http.Error(w, `{"success":false,"message":"temporary upstream failure"}`, http.StatusBadGateway)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"success":true,"message":"ok","data":{"codes":["PD-ASYNC-RETRY-001"]}}`))
		case r.Method == http.MethodGet && strings.Contains(r.URL.Path, "/api/internal/code_issue/"):
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"success":false,"message":"not_found","data":{"codes":[]}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	svc := newSystemSecurityTestService(t, config.Config{
		AsyncConcurrency:         1,
		AsyncPollIntervalSeconds: 1,
	})
	if err := svc.SeedDefaults(); err != nil {
		t.Fatalf("SeedDefaults returned error: %v", err)
	}
	if err := svc.UpsertAdminProvider(context.Background(), "new_api_prod", ProviderUpsertInput{
		ProviderKey:  "new_api_prod",
		ProviderName: "new-api prod",
		BaseURL:      server.URL,
		AuthType:     "none",
		RetryTimes:   0,
		TimeoutMS:    3000,
		Enabled:      true,
		Health:       "healthy",
		AuthConfig:   map[string]any{},
	}); err != nil {
		t.Fatalf("UpsertAdminProvider returned error: %v", err)
	}
	if err := svc.UpsertAdminFulfillmentStrategy(context.Background(), "recharge_code_standard", FulfillmentStrategyUpsertInput{
		StrategyKey:      "recharge_code_standard",
		StrategyName:     "Recharge code standard",
		FulfillmentType:  "issue_code",
		ProviderKey:      "new_api_prod",
		ActionKey:        "issue_recharge_code",
		Enabled:          true,
		RequestTemplate:  map[string]any{"order_no": "{{order_no}}", "buyer_ref": "{{buyer_ref}}"},
		ResultSchema:     map[string]any{"codes": []string{}},
		DeliveryTemplate: map[string]any{"title": "Recharge code"},
		RetryPolicy:      map[string]any{"max_retries": 1, "backoff_seconds": []int{0}},
	}); err != nil {
		t.Fatalf("UpsertAdminFulfillmentStrategy returned error: %v", err)
	}

	productIDs, err := svc.seedProductLookup(context.Background())
	if err != nil {
		t.Fatalf("seedProductLookup returned error: %v", err)
	}

	orderData, err := svc.CreateOrder(context.Background(), CreateOrderInput{
		ProductID:     productIDs["credit-trial"],
		PaymentMethod: "wechat_qr",
		SourceChannel: "web",
		BuyerRef:      "web:async-fulfillment",
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
		Note:          "async fulfillment retry",
		SourceType:    "admin_confirm_payment",
		CallbackKey:   fmt.Sprintf("cb-%s", orderNo),
	}, AuditMeta{}); err != nil {
		t.Fatalf("ConfirmAdminOrderPayment returned error: %v", err)
	}

	if err := svc.FulfillAdminOrder(context.Background(), orderNo, AuditMeta{}); err == nil {
		t.Fatalf("expected initial FulfillAdminOrder to fail")
	}

	var pendingJobs []model.AsyncJob
	if err := svc.db.WithContext(context.Background()).
		Where("order_no = ? AND job_type = ? AND status = ?", orderNo, asyncJobTypeFulfillmentRetry, asyncJobStatusPending).
		Find(&pendingJobs).Error; err != nil {
		t.Fatalf("load pending async jobs returned error: %v", err)
	}
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 pending fulfillment retry job, got %d", len(pendingJobs))
	}
	if err := svc.db.WithContext(context.Background()).
		Model(&model.AsyncJob{}).
		Where("id = ?", pendingJobs[0].ID).
		Update("run_at", pendingJobs[0].RunAt.Add(-2*time.Second)).Error; err != nil {
		t.Fatalf("move fulfillment async job run_at returned error: %v", err)
	}

	sweep, err := svc.RunAsyncJobSweep(context.Background())
	if err != nil {
		t.Fatalf("RunAsyncJobSweep returned error: %v", err)
	}
	if sweep.Succeeded != 1 {
		t.Fatalf("expected async sweep to succeed once, got %#v", sweep)
	}

	order, err := svc.resolveOrderByNo(context.Background(), orderNo)
	if err != nil {
		t.Fatalf("resolveOrderByNo returned error: %v", err)
	}
	if order.Status != "delivery_pending" {
		t.Fatalf("expected order status delivery_pending after async recovery, got %q", order.Status)
	}
	if issueCalls.Load() != 2 {
		t.Fatalf("expected 2 issue attempts, got %d", issueCalls.Load())
	}

	var jobs []model.AsyncJob
	if err := svc.db.WithContext(context.Background()).
		Where("order_no = ? AND job_type = ?", orderNo, asyncJobTypeFulfillmentRetry).
		Order("id ASC").
		Find(&jobs).Error; err != nil {
		t.Fatalf("load async jobs returned error: %v", err)
	}
	if len(jobs) != 1 {
		t.Fatalf("expected 1 fulfillment async job row, got %d", len(jobs))
	}
	if jobs[0].Status != asyncJobStatusSucceeded {
		t.Fatalf("expected fulfillment async job succeeded, got %q", jobs[0].Status)
	}
}

func TestDeliveryFailureSchedulesAsyncRetryAndSweepReplaysUpdatedStrategy(t *testing.T) {
	svc := newSystemSecurityTestService(t, config.Config{
		AsyncConcurrency:          1,
		AsyncPollIntervalSeconds:  1,
		DeliveryRetryMaxRetries:   1,
		DeliveryRetryDelaySeconds: 0,
	})
	if err := svc.SeedDefaults(); err != nil {
		t.Fatalf("SeedDefaults returned error: %v", err)
	}

	user := model.User{
		DisplayName: "Async Delivery User",
		Role:        "user",
		Status:      "active",
		Locale:      "zh-CN",
	}
	if err := svc.db.WithContext(context.Background()).Create(&user).Error; err != nil {
		t.Fatalf("create user returned error: %v", err)
	}
	binding := model.TelegramBinding{
		UserID:           user.ID,
		BotKey:           "default",
		TelegramUserID:   "900001",
		TelegramUsername: "async_delivery_user",
		ChatID:           "900001",
		BoundAt:          user.CreatedAt,
	}
	if err := svc.db.WithContext(context.Background()).Create(&binding).Error; err != nil {
		t.Fatalf("create telegram binding returned error: %v", err)
	}

	productIDs, err := svc.seedProductLookup(context.Background())
	if err != nil {
		t.Fatalf("seedProductLookup returned error: %v", err)
	}

	orderData, err := svc.CreateOrder(context.Background(), CreateOrderInput{
		UserID:        &user.ID,
		ProductID:     productIDs["pro-monthly"],
		PaymentMethod: "wechat_qr",
		SourceChannel: "web",
		BuyerRef:      "tg:900001",
		Quantity:      1,
		Currency:      "RMB",
	})
	if err != nil {
		t.Fatalf("CreateOrder returned error: %v", err)
	}

	orderNo := stringValue(orderData["order_no"])
	if err := svc.ConfirmAdminOrderPayment(context.Background(), orderNo, ConfirmPaymentInput{
		PaymentMethod: "wechat_qr",
		Amount:        "39.00",
		Currency:      "RMB",
		Note:          "async delivery retry",
		SourceType:    "admin_confirm_payment",
		CallbackKey:   fmt.Sprintf("delivery-%s", orderNo),
	}, AuditMeta{}); err != nil {
		t.Fatalf("ConfirmAdminOrderPayment returned error: %v", err)
	}
	if err := svc.FulfillAdminOrder(context.Background(), orderNo, AuditMeta{}); err != nil {
		t.Fatalf("FulfillAdminOrder returned error: %v", err)
	}

	if err := svc.DeliverAdminOrder(context.Background(), orderNo, AuditMeta{}); err == nil {
		t.Fatalf("expected initial DeliverAdminOrder to fail without telegram runtime credentials")
	}

	var pendingJobs []model.AsyncJob
	if err := svc.db.WithContext(context.Background()).
		Where("order_no = ? AND job_type = ? AND status = ?", orderNo, asyncJobTypeDeliveryRetry, asyncJobStatusPending).
		Find(&pendingJobs).Error; err != nil {
		t.Fatalf("load pending delivery async jobs returned error: %v", err)
	}
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 pending delivery retry job, got %d", len(pendingJobs))
	}
	if err := svc.db.WithContext(context.Background()).
		Model(&model.AsyncJob{}).
		Where("id = ?", pendingJobs[0].ID).
		Update("run_at", pendingJobs[0].RunAt.Add(-2*time.Second)).Error; err != nil {
		t.Fatalf("move delivery async job run_at returned error: %v", err)
	}

	if err := svc.UpsertAdminDeliveryStrategy(context.Background(), "telegram_and_web_default", DeliveryStrategyUpsertInput{
		StrategyKey:     "telegram_and_web_default",
		StrategyName:    "Telegram and web default",
		ChannelType:     "web",
		MaskPolicy:      "show_last_6",
		ResendAllowed:   true,
		Enabled:         true,
		MessageTemplate: map[string]any{"title": "Web delivery"},
	}); err != nil {
		t.Fatalf("UpsertAdminDeliveryStrategy returned error: %v", err)
	}

	sweep, err := svc.RunAsyncJobSweep(context.Background())
	if err != nil {
		t.Fatalf("RunAsyncJobSweep returned error: %v", err)
	}
	if sweep.Succeeded != 1 {
		t.Fatalf("expected delivery async sweep to succeed once, got %#v", sweep)
	}

	order, err := svc.resolveOrderByNo(context.Background(), orderNo)
	if err != nil {
		t.Fatalf("resolveOrderByNo returned error: %v", err)
	}
	if order.Status != "completed" {
		t.Fatalf("expected order completed after async delivery retry, got %q", order.Status)
	}
	if order.DeliveryStatus != "sent" {
		t.Fatalf("expected delivery status sent after async delivery retry, got %q", order.DeliveryStatus)
	}

	var jobs []model.AsyncJob
	if err := svc.db.WithContext(context.Background()).
		Where("order_no = ? AND job_type = ?", orderNo, asyncJobTypeDeliveryRetry).
		Order("id ASC").
		Find(&jobs).Error; err != nil {
		t.Fatalf("load delivery async jobs returned error: %v", err)
	}
	if len(jobs) != 1 {
		t.Fatalf("expected 1 delivery async job row, got %d", len(jobs))
	}
	if jobs[0].Status != asyncJobStatusSucceeded {
		t.Fatalf("expected delivery async job succeeded, got %q", jobs[0].Status)
	}
}
