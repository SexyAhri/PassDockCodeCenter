package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path"
	"strings"
	"sync"
	"testing"

	"passdock/server/internal/config"
	"passdock/server/internal/model"
)

type fulfillmentRecoveryUpstream struct {
	mu         sync.Mutex
	codes      map[string][]string
	issueCalls int
	queryCalls int
	queryReady bool
}

func newFulfillmentRecoveryUpstream() *fulfillmentRecoveryUpstream {
	return &fulfillmentRecoveryUpstream{
		codes:      map[string][]string{},
		queryReady: true,
	}
}

func (u *fulfillmentRecoveryUpstream) prepareCodes(orderNo string, codes []string) {
	u.mu.Lock()
	defer u.mu.Unlock()

	u.codes[orderNo] = append([]string(nil), codes...)
}

func (u *fulfillmentRecoveryUpstream) issueCodes(orderNo string) ([]string, bool) {
	u.mu.Lock()
	defer u.mu.Unlock()

	codes, ok := u.codes[orderNo]
	if !ok {
		return nil, false
	}

	u.issueCalls++
	return append([]string(nil), codes...), true
}

func (u *fulfillmentRecoveryUpstream) lookupCodes(orderNo string) ([]string, bool) {
	u.mu.Lock()
	defer u.mu.Unlock()

	u.queryCalls++
	if !u.queryReady {
		return nil, false
	}

	codes, ok := u.codes[orderNo]
	if !ok {
		return nil, false
	}

	return append([]string(nil), codes...), true
}

func (u *fulfillmentRecoveryUpstream) setQueryReady(ready bool) {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.queryReady = ready
}

func (u *fulfillmentRecoveryUpstream) stats() (int, int) {
	u.mu.Lock()
	defer u.mu.Unlock()
	return u.issueCalls, u.queryCalls
}

func TestFulfillAdminOrderRecoversIssuedCodesAfterIssueError(t *testing.T) {
	ctx := context.Background()
	upstream := newFulfillmentRecoveryUpstream()
	server := newFulfillmentRecoveryTestServer(t, upstream)
	defer server.Close()

	svc := newSystemSecurityTestService(t, config.Config{
		NewAPIProdBaseURL:    server.URL,
		NewAPIProdKeyID:      "passdock-prod",
		NewAPIProdSecret:     "prod-secret",
		NewAPIProdTimeoutMS:  3000,
		NewAPIProdRetryTimes: 1,
	})
	if err := svc.seedReferenceData(ctx); err != nil {
		t.Fatalf("seedReferenceData returned error: %v", err)
	}

	orderNo := createPaidFulfillmentRecoveryOrder(t, svc, "web:recover-after-issue-error")
	expectedCode := "RCV-RECOVER-0001"

	upstream.prepareCodes(orderNo, []string{expectedCode})
	if err := svc.FulfillAdminOrder(ctx, orderNo, AuditMeta{}); err != nil {
		t.Fatalf("FulfillAdminOrder returned error: %v", err)
	}

	order, err := svc.resolveOrderByNo(ctx, orderNo)
	if err != nil {
		t.Fatalf("resolveOrderByNo returned error: %v", err)
	}
	if order.Status != "delivery_pending" {
		t.Fatalf("expected order status delivery_pending, got %q", order.Status)
	}
	if order.DeliveryStatus != "pending" {
		t.Fatalf("expected delivery status pending, got %q", order.DeliveryStatus)
	}

	issue, record := assertRecoveredFulfillmentState(t, svc, order.ID, orderNo, expectedCode)
	if issue.ActionKey != "issue_recharge_code" {
		t.Fatalf("expected issue action issue_recharge_code, got %q", issue.ActionKey)
	}

	payload := parseJSON[map[string]any](record.ResponsePayloadJSON)
	if stringValue(payload["recovery_mode"]) != "query_issue_result" {
		t.Fatalf("expected recovery_mode query_issue_result, got %#v", payload["recovery_mode"])
	}
	if stringValue(payload["recovery_stage"]) != "after_issue_error" {
		t.Fatalf("expected recovery_stage after_issue_error, got %#v", payload["recovery_stage"])
	}
	if payload["recovered"] != true {
		t.Fatalf("expected recovered=true, got %#v", payload["recovered"])
	}

	requestPayload := parseJSON[map[string]any](record.RequestPayloadJSON)
	if stringValue(requestPayload["recovery_action"]) != "query_issue_result" {
		t.Fatalf("expected recovery request payload to record query_issue_result, got %#v", requestPayload["recovery_action"])
	}

	issueCalls, queryCalls := upstream.stats()
	if issueCalls != 1 {
		t.Fatalf("expected 1 issue request, got %d", issueCalls)
	}
	if queryCalls == 0 {
		t.Fatalf("expected recovery query request to be executed")
	}
}

func TestRetryAdminOrderFulfillmentRecoversIssuedCodesBeforeReissue(t *testing.T) {
	ctx := context.Background()
	upstream := newFulfillmentRecoveryUpstream()
	upstream.setQueryReady(false)

	server := newFulfillmentRecoveryTestServer(t, upstream)
	defer server.Close()

	svc := newSystemSecurityTestService(t, config.Config{
		NewAPIProdBaseURL:    server.URL,
		NewAPIProdKeyID:      "passdock-prod",
		NewAPIProdSecret:     "prod-secret",
		NewAPIProdTimeoutMS:  3000,
		NewAPIProdRetryTimes: 1,
	})
	if err := svc.seedReferenceData(ctx); err != nil {
		t.Fatalf("seedReferenceData returned error: %v", err)
	}

	orderNo := createPaidFulfillmentRecoveryOrder(t, svc, "web:recover-before-retry")
	expectedCode := "RCV-RETRY-0001"
	upstream.prepareCodes(orderNo, []string{expectedCode})

	err := svc.FulfillAdminOrder(ctx, orderNo, AuditMeta{})
	if err == nil {
		t.Fatalf("expected initial FulfillAdminOrder to fail before recovery becomes available")
	}

	order, err := svc.resolveOrderByNo(ctx, orderNo)
	if err != nil {
		t.Fatalf("resolveOrderByNo returned error: %v", err)
	}
	if order.Status != "failed" {
		t.Fatalf("expected order status failed after initial attempt, got %q", order.Status)
	}

	var failedIssue model.CodeIssueRecord
	if err := svc.db.WithContext(ctx).
		Where("order_no = ?", orderNo).
		First(&failedIssue).Error; err != nil {
		t.Fatalf("load failed issue record returned error: %v", err)
	}
	if failedIssue.IssueStatus != "failed" {
		t.Fatalf("expected failed issue status before retry, got %q", failedIssue.IssueStatus)
	}

	upstream.setQueryReady(true)
	if err := svc.RetryAdminOrderFulfillment(ctx, orderNo, AuditMeta{}); err != nil {
		t.Fatalf("RetryAdminOrderFulfillment returned error: %v", err)
	}

	order, err = svc.resolveOrderByNo(ctx, orderNo)
	if err != nil {
		t.Fatalf("resolveOrderByNo returned error: %v", err)
	}
	if order.Status != "delivery_pending" {
		t.Fatalf("expected order status delivery_pending after retry recovery, got %q", order.Status)
	}
	if order.DeliveryStatus != "pending" {
		t.Fatalf("expected delivery status pending after retry recovery, got %q", order.DeliveryStatus)
	}

	_, record := assertRecoveredFulfillmentState(t, svc, order.ID, orderNo, expectedCode)
	payload := parseJSON[map[string]any](record.ResponsePayloadJSON)
	if stringValue(payload["recovery_stage"]) != "before_retry_issue" {
		t.Fatalf("expected recovery_stage before_retry_issue, got %#v", payload["recovery_stage"])
	}

	issueCalls, _ := upstream.stats()
	if issueCalls != 1 {
		t.Fatalf("expected retry path to avoid duplicate issue requests, got %d", issueCalls)
	}
}

func createPaidFulfillmentRecoveryOrder(t *testing.T, svc *Service, buyerRef string) string {
	t.Helper()

	ctx := context.Background()
	productIDs, err := svc.seedProductLookup(ctx)
	if err != nil {
		t.Fatalf("seedProductLookup returned error: %v", err)
	}

	data, err := svc.CreateOrder(ctx, CreateOrderInput{
		ProductID:     productIDs["credit-trial"],
		PaymentMethod: "wechat_qr",
		SourceChannel: "web",
		BuyerRef:      buyerRef,
		Quantity:      1,
		Currency:      "RMB",
	})
	if err != nil {
		t.Fatalf("CreateOrder returned error: %v", err)
	}

	orderNo := stringValue(data["order_no"])
	if err := svc.ConfirmAdminOrderPayment(ctx, orderNo, ConfirmPaymentInput{
		PaymentMethod: "wechat_qr",
		Amount:        "0.99",
		Currency:      "RMB",
		SourceType:    "admin_confirm_payment",
		Note:          "fulfillment recovery test",
	}, AuditMeta{}); err != nil {
		t.Fatalf("ConfirmAdminOrderPayment returned error: %v", err)
	}

	return orderNo
}

func assertRecoveredFulfillmentState(
	t *testing.T,
	svc *Service,
	orderID uint,
	orderNo string,
	expectedCode string,
) (model.CodeIssueRecord, model.FulfillmentRecord) {
	t.Helper()

	ctx := context.Background()

	var issue model.CodeIssueRecord
	if err := svc.db.WithContext(ctx).
		Where("order_no = ?", orderNo).
		First(&issue).Error; err != nil {
		t.Fatalf("load code issue record returned error: %v", err)
	}
	if issue.IssueStatus != "success" {
		t.Fatalf("expected code issue status success, got %q", issue.IssueStatus)
	}
	if issue.IssuedCount != 1 {
		t.Fatalf("expected issued_count 1, got %d", issue.IssuedCount)
	}

	codes, err := svc.loadIssueCodes(issue)
	if err != nil {
		t.Fatalf("loadIssueCodes returned error: %v", err)
	}
	if len(codes) != 1 || codes[0] != expectedCode {
		t.Fatalf("expected recovered code %q, got %#v", expectedCode, codes)
	}

	var record model.FulfillmentRecord
	if err := svc.db.WithContext(ctx).
		Where("order_id = ?", orderID).
		Order("id DESC").
		First(&record).Error; err != nil {
		t.Fatalf("load latest fulfillment record returned error: %v", err)
	}
	if record.Status != "success" {
		t.Fatalf("expected fulfillment record success, got %q", record.Status)
	}
	if record.ActionKey != "issue_recharge_code" {
		t.Fatalf("expected fulfillment action issue_recharge_code, got %q", record.ActionKey)
	}

	return issue, record
}

func newFulfillmentRecoveryTestServer(t *testing.T, upstream *fulfillmentRecoveryUpstream) *httptest.Server {
	t.Helper()

	return httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch {
		case request.Method == http.MethodPost && request.URL.Path == "/api/internal/redemption/issue":
			var payload map[string]any
			if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
				http.Error(writer, err.Error(), http.StatusBadRequest)
				return
			}

			orderNo := stringValue(payload["order_no"])
			if orderNo == "" {
				http.Error(writer, "order_no is required", http.StatusBadRequest)
				return
			}

			codes, ok := upstream.issueCodes(orderNo)
			if !ok || len(codes) == 0 {
				http.Error(writer, "codes not prepared", http.StatusBadRequest)
				return
			}

			writer.Header().Set("Content-Type", "application/json")
			writer.WriteHeader(http.StatusGatewayTimeout)
			_ = json.NewEncoder(writer).Encode(map[string]any{
				"success": false,
				"message": "upstream timeout after issuing codes",
			})
		case request.Method == http.MethodGet && strings.HasPrefix(request.URL.Path, "/api/internal/code_issue/"):
			orderNo := path.Base(request.URL.Path)
			codes, ok := upstream.lookupCodes(orderNo)

			writer.Header().Set("Content-Type", "application/json")
			if !ok || len(codes) == 0 {
				_ = json.NewEncoder(writer).Encode(map[string]any{
					"success": false,
					"message": "issue result not ready",
				})
				return
			}

			_ = json.NewEncoder(writer).Encode(map[string]any{
				"success": true,
				"message": "issue result loaded",
				"data": map[string]any{
					"order_no": orderNo,
					"codes":    codes,
				},
			})
		default:
			http.NotFound(writer, request)
		}
	}))
}
