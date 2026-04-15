package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"passdock/server/internal/config"
	"passdock/server/internal/database"
	"passdock/server/internal/model"
)

func TestVerifyPaymentCallbackRequestStaticHeader(t *testing.T) {
	svc := newPaymentCallbackTestService(t)
	createTestPaymentChannel(t, svc, model.PaymentChannel{
		ChannelKey:     "wechat_qr_main",
		ChannelName:    "WeChat Main",
		ChannelType:    "wechat_qr",
		ProviderName:   "manual_qr",
		SettlementMode: "manual",
		Currency:       "RMB",
		Enabled:        true,
		ConfigJSON: jsonValue(paymentChannelConfig{
			CallbackAuthType:   "static_header",
			CallbackSecret:     "test-static-secret",
			CallbackHeaderName: "X-Callback-Token",
		}),
	})

	body := []byte(`{"order_no":"PD-TEST-1001"}`)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/callbacks/payments/wechat_qr_main", strings.NewReader(string(body)))
	request.Header.Set("X-Callback-Token", "test-static-secret")

	verification, err := svc.VerifyPaymentCallbackRequest(context.Background(), "wechat_qr_main", request, body)
	if err != nil {
		t.Fatalf("VerifyPaymentCallbackRequest returned error: %v", err)
	}
	if verification == nil || verification.Channel == nil {
		t.Fatalf("expected verification channel data")
	}
	if verification.Config.CallbackAuthType != "static_header" {
		t.Fatalf("expected callback auth type static_header, got %q", verification.Config.CallbackAuthType)
	}
}

func TestVerifyPaymentCallbackRequestHMACBody(t *testing.T) {
	svc := newPaymentCallbackTestService(t)
	createTestPaymentChannel(t, svc, model.PaymentChannel{
		ChannelKey:     "alipay_qr_main",
		ChannelName:    "Alipay Main",
		ChannelType:    "alipay_qr",
		ProviderName:   "manual_qr",
		SettlementMode: "manual",
		Currency:       "RMB",
		Enabled:        true,
		ConfigJSON: jsonValue(paymentChannelConfig{
			CallbackAuthType:   "hmac_sha256",
			CallbackSecret:     "test-hmac-secret",
			CallbackSignHeader: "X-Sign",
			CallbackSignSource: "body",
		}),
	})

	body := []byte(`{"order_no":"PD-TEST-1002","amount":"88.00"}`)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/callbacks/payments/alipay_qr_main", strings.NewReader(string(body)))
	request.Header.Set("X-Sign", hmacHex("test-hmac-secret", string(body)))

	if _, err := svc.VerifyPaymentCallbackRequest(context.Background(), "alipay_qr_main", request, body); err != nil {
		t.Fatalf("VerifyPaymentCallbackRequest returned error: %v", err)
	}
}

func TestVerifyPaymentCallbackRequestRejectsExpiredHMAC(t *testing.T) {
	svc := newPaymentCallbackTestService(t)
	createTestPaymentChannel(t, svc, model.PaymentChannel{
		ChannelKey:     "okx_usdt_watch",
		ChannelName:    "OKX Watch",
		ChannelType:    "okx_usdt",
		ProviderName:   "chain_watcher",
		SettlementMode: "auto",
		Currency:       "USDT",
		Enabled:        true,
		ConfigJSON: jsonValue(paymentChannelConfig{
			CallbackAuthType:        "hmac_sha256",
			CallbackSecret:          "test-okx-secret",
			CallbackKey:             "okx-prod",
			CallbackHeaderName:      "X-Key",
			CallbackSignHeader:      "X-Sign",
			CallbackTimestampHeader: "X-Timestamp",
			CallbackNonceHeader:     "X-Nonce",
			CallbackTTLSeconds:      60,
			CallbackSignSource:      "method_path_timestamp_nonce_body_sha256",
		}),
	})

	body := []byte(`{"order_no":"PD-TEST-1003","third_party_txn_no":"TX-1003"}`)
	timestamp := strconv.FormatInt(time.Now().Add(-10*time.Minute).Unix(), 10)
	nonce := "nonce-1003"
	request := httptest.NewRequest(http.MethodPost, "/api/v1/callbacks/payments/okx_usdt_watch", strings.NewReader(string(body)))
	request.Header.Set("X-Key", "okx-prod")
	request.Header.Set("X-Timestamp", timestamp)
	request.Header.Set("X-Nonce", nonce)
	request.Header.Set("X-Sign", hmacHex("test-okx-secret", strings.Join([]string{
		http.MethodPost,
		"/api/v1/callbacks/payments/okx_usdt_watch",
		timestamp,
		nonce,
		sha256Hex(body),
	}, "\n")))

	if _, err := svc.VerifyPaymentCallbackRequest(context.Background(), "okx_usdt_watch", request, body); err == nil {
		t.Fatalf("expected expired callback to be rejected")
	} else if err != ErrUnauthorized {
		t.Fatalf("expected ErrUnauthorized, got %v", err)
	}
}

func TestUpsertAdminPaymentChannelPreservesCallbackSecret(t *testing.T) {
	svc := newPaymentCallbackTestService(t)
	createTestPaymentChannel(t, svc, model.PaymentChannel{
		ChannelKey:     "wechat_qr_main",
		ChannelName:    "WeChat Main",
		ChannelType:    "wechat_qr",
		ProviderName:   "manual_qr",
		SettlementMode: "manual",
		Currency:       "RMB",
		Enabled:        true,
		ConfigJSON: jsonValue(paymentChannelConfig{
			QRContent:        "wechat://main",
			DisplayName:      "WeChat Main",
			Reference:        "WX-MAIN",
			CallbackAuthType: "hmac_sha256",
			CallbackSecret:   "keep-me",
		}),
	})

	err := svc.UpsertAdminPaymentChannel(context.Background(), "wechat_qr_main", PaymentChannelUpsertInput{
		ChannelKey:         "wechat_qr_main",
		ChannelName:        "WeChat Main",
		ChannelType:        "wechat_qr",
		ProviderName:       "manual_qr",
		Currency:           "RMB",
		SettlementMode:     "manual",
		Enabled:            true,
		QRValue:            "wechat://main",
		Reference:          "WX-MAIN",
		CallbackAuthType:   "hmac_sha256",
		CallbackSecret:     "",
		CallbackSignSource: "body",
	})
	if err != nil {
		t.Fatalf("UpsertAdminPaymentChannel returned error: %v", err)
	}

	channel, err := svc.resolvePaymentChannelByRoute(context.Background(), "wechat_qr_main")
	if err != nil {
		t.Fatalf("resolvePaymentChannelByRoute returned error: %v", err)
	}

	channelConfig := normalizePaymentChannelConfig(parseJSON[paymentChannelConfig](channel.ConfigJSON), channel.ChannelName)
	if channelConfig.CallbackSecret != "keep-me" {
		t.Fatalf("expected callback secret to be preserved, got %q", channelConfig.CallbackSecret)
	}
}

func TestNormalizePaymentCallbackInputUsesMappedJSONFields(t *testing.T) {
	svc := newPaymentCallbackTestService(t)
	createTestPaymentChannel(t, svc, model.PaymentChannel{
		ChannelKey:     "alipay_qr_main",
		ChannelName:    "Alipay Main",
		ChannelType:    "alipay_qr",
		ProviderName:   "manual_qr",
		SettlementMode: "manual",
		Currency:       "RMB",
		Enabled:        true,
		ConfigJSON: jsonValue(paymentChannelConfig{
			CallbackSuccessField: "trade_status",
			CallbackSuccessValues: []string{
				"TRADE_SUCCESS",
				"TRADE_FINISHED",
			},
			CallbackPayloadMapping: map[string]string{
				"order_no":           "out_trade_no",
				"amount":             "buyer_pay_amount",
				"third_party_txn_no": "trade_no",
				"payer_account":      "buyer_user_id",
			},
		}),
	})

	body := []byte(`{"trade_status":"TRADE_SUCCESS","out_trade_no":"PD-TEST-2001","buyer_pay_amount":"88.00","trade_no":"ALI-TXN-2001","buyer_user_id":"alipay-user-1"}`)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/callbacks/payments/alipay_qr_main", strings.NewReader(string(body)))
	request.Header.Set("Content-Type", "application/json")

	verification, err := svc.VerifyPaymentCallbackRequest(context.Background(), "alipay_qr_main", request, body)
	if err != nil {
		t.Fatalf("VerifyPaymentCallbackRequest returned error: %v", err)
	}

	input, err := svc.NormalizePaymentCallbackInput(request, body, verification)
	if err != nil {
		t.Fatalf("NormalizePaymentCallbackInput returned error: %v", err)
	}
	if input.OrderNo != "PD-TEST-2001" {
		t.Fatalf("expected mapped order no, got %q", input.OrderNo)
	}
	if input.PaymentMethod != "alipay_qr" {
		t.Fatalf("expected default payment method alipay_qr, got %q", input.PaymentMethod)
	}
	if input.Currency != "RMB" {
		t.Fatalf("expected default currency RMB, got %q", input.Currency)
	}
	if input.ThirdPartyTxnNo != "ALI-TXN-2001" {
		t.Fatalf("expected mapped transaction no, got %q", input.ThirdPartyTxnNo)
	}
}

func TestNormalizePaymentCallbackInputRejectsMappedFailureStatus(t *testing.T) {
	svc := newPaymentCallbackTestService(t)
	createTestPaymentChannel(t, svc, model.PaymentChannel{
		ChannelKey:     "wechat_qr_main",
		ChannelName:    "WeChat Main",
		ChannelType:    "wechat_qr",
		ProviderName:   "manual_qr",
		SettlementMode: "manual",
		Currency:       "RMB",
		Enabled:        true,
		ConfigJSON: jsonValue(paymentChannelConfig{
			CallbackSuccessField: "event.status",
			CallbackSuccessValues: []string{
				"SUCCESS",
			},
			CallbackPayloadMapping: map[string]string{
				"order_no": "event.order_no",
				"amount":   "event.amount",
			},
		}),
	})

	body := []byte(`{"event":{"status":"PENDING","order_no":"PD-TEST-2002","amount":"15.00"}}`)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/callbacks/payments/wechat_qr_main", strings.NewReader(string(body)))
	request.Header.Set("Content-Type", "application/json")

	verification, err := svc.VerifyPaymentCallbackRequest(context.Background(), "wechat_qr_main", request, body)
	if err != nil {
		t.Fatalf("VerifyPaymentCallbackRequest returned error: %v", err)
	}

	if _, err := svc.NormalizePaymentCallbackInput(request, body, verification); err == nil {
		t.Fatalf("expected unsuccessful mapped callback payload to be rejected")
	} else if err != ErrInvalidInput {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

func newPaymentCallbackTestService(t *testing.T) *Service {
	t.Helper()

	cfg := config.Config{
		DBDriver:           "sqlite",
		SQLitePath:         filepath.Join(t.TempDir(), "passdock-test.db"),
		SessionSecret:      "test-session-secret",
		InternalSignSecret: "test-internal-secret",
	}

	db, err := database.Open(cfg)
	if err != nil {
		t.Fatalf("database.Open returned error: %v", err)
	}
	if err := database.AutoMigrate(db); err != nil {
		t.Fatalf("database.AutoMigrate returned error: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("db.DB returned error: %v", err)
	}
	t.Cleanup(func() {
		_ = sqlDB.Close()
	})

	return New(cfg, db)
}

func createTestPaymentChannel(t *testing.T, svc *Service, channel model.PaymentChannel) {
	t.Helper()

	if err := svc.db.WithContext(context.Background()).Create(&channel).Error; err != nil {
		t.Fatalf("create payment channel returned error: %v", err)
	}
}

func hmacHex(secret string, source string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(source))
	return hex.EncodeToString(mac.Sum(nil))
}

func sha256Hex(body []byte) string {
	sum := sha256.Sum256(body)
	return hex.EncodeToString(sum[:])
}
