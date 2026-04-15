package app

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestIssueRechargeUsesRedemptionEndpoint(t *testing.T) {
	var gotAuth string
	var gotPath string
	var gotBody map[string]any

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		gotPath = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		_ = json.NewEncoder(w).Encode(upstreamEnvelope[[]string]{
			Success: true,
			Data:    []string{"redeem-1"},
		})
	}))
	defer upstream.Close()

	store, err := NewStore(filepath.Join(t.TempDir(), "store.json"))
	if err != nil {
		t.Fatalf("NewStore returned error: %v", err)
	}
	server := NewServer(Config{
		ProdClient:           ClientCredential{KeyID: "prod", Secret: "prod-secret"},
		StagingClient:        ClientCredential{KeyID: "staging", Secret: "staging-secret"},
		UpstreamBaseURL:      upstream.URL,
		UpstreamAccessToken:  "access-token",
		UpstreamUserID:       "1",
		DefaultRechargeQuota: 500000,
	}, store)

	body := []byte(`{"order_no":"PD-1001","code_name":"credit","quota":"1000","count":"1"}`)
	request := signedRequest(t, http.MethodPost, "/api/internal/redemption/issue", body, "prod", "prod-secret")
	recorder := httptest.NewRecorder()

	server.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if gotAuth != "Bearer access-token" {
		t.Fatalf("expected bearer auth, got %q", gotAuth)
	}
	if gotPath != "/api/redemption/" {
		t.Fatalf("expected redemption path, got %q", gotPath)
	}
	if gotBody["quota"] != float64(1000) {
		t.Fatalf("expected quota 1000, got %#v", gotBody)
	}
}

func TestIssueSubscriptionUsesTokenEndpoint(t *testing.T) {
	var gotUser string
	var gotPath string
	var gotBody map[string]any

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotUser = r.Header.Get("New-Api-User")
		gotPath = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		_ = json.NewEncoder(w).Encode(upstreamEnvelope[map[string]any]{Success: true})
	}))
	defer upstream.Close()

	store, err := NewStore(filepath.Join(t.TempDir(), "store.json"))
	if err != nil {
		t.Fatalf("NewStore returned error: %v", err)
	}
	server := NewServer(Config{
		ProdClient:                 ClientCredential{KeyID: "prod", Secret: "prod-secret"},
		StagingClient:              ClientCredential{KeyID: "staging", Secret: "staging-secret"},
		UpstreamBaseURL:            upstream.URL,
		UpstreamAccessToken:        "access-token",
		UpstreamUserID:             "1",
		DefaultSubscriptionGroup:   "default",
		SubscriptionUnlimitedQuota: true,
		SubscriptionModelLimits:    []string{"gpt-4o-mini"},
	}, store)

	body := []byte(`{"order_no":"PD-1002","code_name":"sub","duration_unit":"month","duration_value":"1","available_group":"vip","count":"1"}`)
	request := signedRequest(t, http.MethodPost, "/api/internal/subscription_code/issue", body, "prod", "prod-secret")
	recorder := httptest.NewRecorder()

	server.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if gotUser != "1" {
		t.Fatalf("expected New-Api-User=1, got %q", gotUser)
	}
	if gotPath != "/api/token/" {
		t.Fatalf("expected token path, got %q", gotPath)
	}
	key, _ := gotBody["key"].(string)
	if !strings.HasPrefix(key, "sk-") {
		t.Fatalf("expected generated sk- key, got %#v", gotBody)
	}
	if gotBody["group"] != "vip" {
		t.Fatalf("expected vip group, got %#v", gotBody)
	}
}

func TestQueryIssueReturnsStoredRecord(t *testing.T) {
	store, err := NewStore(filepath.Join(t.TempDir(), "store.json"))
	if err != nil {
		t.Fatalf("NewStore returned error: %v", err)
	}
	if err := store.Upsert(IssueRecord{
		OrderNo:       "PD-1003",
		Kind:          "recharge",
		ExpectedCount: 1,
		Codes:         []string{"code-1"},
		Status:        "issued",
		Message:       "ok",
	}); err != nil {
		t.Fatalf("Upsert returned error: %v", err)
	}

	server := NewServer(Config{
		ProdClient:          ClientCredential{KeyID: "prod", Secret: "prod-secret"},
		StagingClient:       ClientCredential{KeyID: "staging", Secret: "staging-secret"},
		UpstreamBaseURL:     "https://example.com",
		UpstreamAccessToken: "token",
		UpstreamUserID:      "1",
	}, store)

	request := httptest.NewRequest(http.MethodGet, "/api/internal/code_issue/PD-1003", nil)
	recorder := httptest.NewRecorder()
	server.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}

	var response issueResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !response.Success || len(response.Data.Codes) != 1 || response.Data.Codes[0] != "code-1" {
		t.Fatalf("unexpected response %#v", response)
	}
}

func TestStoreRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "store.json")
	store, err := NewStore(path)
	if err != nil {
		t.Fatalf("NewStore returned error: %v", err)
	}

	record := IssueRecord{
		OrderNo:       "PD-1004",
		Kind:          "subscription",
		ExpectedCount: 1,
		Codes:         []string{"sk-abc"},
		Status:        "issued",
		Message:       "ok",
	}
	if err := store.Upsert(record); err != nil {
		t.Fatalf("Upsert returned error: %v", err)
	}

	loaded, err := NewStore(path)
	if err != nil {
		t.Fatalf("reload store returned error: %v", err)
	}
	item, exists := loaded.Get("PD-1004")
	if !exists || len(item.Codes) != 1 || item.Codes[0] != "sk-abc" {
		t.Fatalf("unexpected loaded item %#v exists=%v", item, exists)
	}
}

func TestDoUpstreamJSONRejectsFailureStatus(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "bad gateway", http.StatusBadGateway)
	}))
	defer upstream.Close()

	store, err := NewStore(filepath.Join(t.TempDir(), "store.json"))
	if err != nil {
		t.Fatalf("NewStore returned error: %v", err)
	}
	server := NewServer(Config{
		ProdClient:          ClientCredential{KeyID: "prod", Secret: "prod-secret"},
		StagingClient:       ClientCredential{KeyID: "staging", Secret: "staging-secret"},
		UpstreamBaseURL:     upstream.URL,
		UpstreamAccessToken: "token",
		UpstreamUserID:      "1",
	}, store)

	err = server.doUpstreamJSON(context.Background(), http.MethodPost, "/api/redemption/", map[string]any{}, false, &upstreamEnvelope[[]string]{})
	if err == nil {
		t.Fatalf("expected upstream error")
	}
}

func signedRequest(t *testing.T, method string, path string, body []byte, keyID string, secret string) *http.Request {
	t.Helper()

	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	nonce := "nonce-1234"
	bodyHash := sha256.Sum256(body)
	source := strings.Join([]string{
		method,
		path,
		timestamp,
		nonce,
		hex.EncodeToString(bodyHash[:]),
	}, "\n")
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(source))
	signature := hex.EncodeToString(mac.Sum(nil))

	request := httptest.NewRequest(method, path, bytes.NewReader(body))
	request.Header.Set("X-PassDock-Key", keyID)
	request.Header.Set("X-PassDock-Timestamp", timestamp)
	request.Header.Set("X-PassDock-Nonce", nonce)
	request.Header.Set("X-PassDock-Sign", signature)
	return request
}
