package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"passdock/server/internal/config"
	"passdock/server/internal/model"
)

func TestRunOKXWatcherSweepConfirmsMatchedOrders(t *testing.T) {
	var receivedAuthorization string
	var receivedBody okxWatcherRequest
	var targetOrderNo string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST request, got %s", r.Method)
		}

		receivedAuthorization = r.Header.Get("Authorization")
		if err := json.NewDecoder(r.Body).Decode(&receivedBody); err != nil {
			t.Fatalf("decode watcher body: %v", err)
		}

		if err := json.NewEncoder(w).Encode(okxWatcherResponse{
			Items: []okxWatcherMatch{
				{
					OrderNo:       targetOrderNo,
					Status:        "matched",
					Amount:        "5.49",
					Currency:      "USDT",
					ChainTxHash:   "0x-okx-watcher-2001",
					PayerAccount:  "0x-watcher-wallet",
					Note:          "watcher match",
				},
			},
		}); err != nil {
			t.Fatalf("encode watcher response: %v", err)
		}
	}))
	defer server.Close()

	svc := newSystemSecurityTestService(t, config.Config{
		OKXWatcherEnabled:         true,
		OKXWatcherAPIURL:          server.URL,
		OKXWatcherAPIToken:        "watcher-token",
		OKXWatcherTimeoutMS:       5000,
		OKXWatcherIntervalSeconds: 60,
		OKXWatcherBatchSize:       10,
	})
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
		BuyerRef:      "web:okx-watcher",
		Quantity:      1,
		Currency:      "USDT",
	})
	if err != nil {
		t.Fatalf("CreateOrder returned error: %v", err)
	}

	orderNo := stringValue(orderData["order_no"])
	targetOrderNo = orderNo
	if err := svc.MarkStorefrontOrderPaid(context.Background(), orderNo); err != nil {
		t.Fatalf("MarkStorefrontOrderPaid returned error: %v", err)
	}

	result, err := svc.RunOKXWatcherSweep(context.Background())
	if err != nil {
		t.Fatalf("RunOKXWatcherSweep returned error: %v", err)
	}

	if result.CheckedOrders < 1 {
		t.Fatalf("expected at least 1 checked order, got %#v", result)
	}
	if result.MatchedOrders != 1 {
		t.Fatalf("expected 1 matched order, got %#v", result)
	}
	if receivedAuthorization != "Bearer watcher-token" {
		t.Fatalf("expected bearer token to be forwarded, got %q", receivedAuthorization)
	}
	if receivedBody.PaymentMethod != "okx_usdt" {
		t.Fatalf("expected okx_usdt payment method, got %#v", receivedBody.PaymentMethod)
	}
	var foundOrder bool
	for _, item := range receivedBody.Items {
		if item.OrderNo == orderNo {
			foundOrder = true
			break
		}
	}
	if !foundOrder {
		t.Fatalf("expected order %s in watcher request, got %#v", orderNo, receivedBody.Items)
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
	if watcher.Status != "matched" {
		t.Fatalf("expected watcher status matched, got %q", watcher.Status)
	}
	if !strings.Contains(watcher.ChainTxHash, "0x-okx-watcher-2001") {
		t.Fatalf("expected watcher chain tx hash to be stored, got %q", watcher.ChainTxHash)
	}
}
