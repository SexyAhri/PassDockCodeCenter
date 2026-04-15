package app

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Server struct {
	cfg    Config
	store  *Store
	client *http.Client
	nonces *nonceCache
}

type issueRechargeRequest struct {
	OrderNo     string `json:"order_no"`
	ProductName string `json:"product_name"`
	CodeName    string `json:"code_name"`
	Quota       string `json:"quota"`
	Count       string `json:"count"`
	ExpiredTime string `json:"expired_time"`
}

type issueSubscriptionRequest struct {
	OrderNo        string `json:"order_no"`
	ProductName    string `json:"product_name"`
	CodeName       string `json:"code_name"`
	Count          string `json:"count"`
	DurationUnit   string `json:"duration_unit"`
	DurationValue  string `json:"duration_value"`
	CustomSeconds  string `json:"custom_seconds"`
	AvailableGroup string `json:"available_group"`
	ExpiredTime    string `json:"expired_time"`
}

type issueResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		OrderNo string   `json:"order_no"`
		Codes   []string `json:"codes"`
	} `json:"data"`
}

type upstreamEnvelope[T any] struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    T      `json:"data"`
}

type nonceCache struct {
	mu    sync.Mutex
	items map[string]time.Time
}

func NewServer(cfg Config, store *Store) *Server {
	return &Server{
		cfg:   cfg,
		store: store,
		client: &http.Client{
			Timeout: 20 * time.Second,
		},
		nonces: &nonceCache{items: map[string]time.Time{}},
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", s.handleHealthz)
	mux.HandleFunc("/readyz", s.handleReadyz)
	mux.HandleFunc("/api/internal/redemption/issue", s.handleIssueRecharge)
	mux.HandleFunc("/api/internal/subscription_code/issue", s.handleIssueSubscription)
	mux.HandleFunc("/api/internal/code_issue/", s.handleQueryIssue)
	return mux
}

func (s *Server) handleHealthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleReadyz(w http.ResponseWriter, _ *http.Request) {
	if err := s.cfg.Validate(); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleIssueRecharge(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"success": false, "message": "method not allowed"})
		return
	}

	body, err := s.authenticate(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"success": false, "message": err.Error()})
		return
	}

	var request issueRechargeRequest
	if err := json.Unmarshal(body, &request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"success": false, "message": "invalid json body"})
		return
	}
	record, err := s.issueRecharge(r, request)
	if err != nil {
		log.Printf("newapiadapter: recharge issue failed order=%s err=%v", request.OrderNo, err)
		writeJSON(w, http.StatusBadGateway, map[string]any{"success": false, "message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, buildIssueResponse(record))
}

func (s *Server) handleIssueSubscription(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"success": false, "message": "method not allowed"})
		return
	}

	body, err := s.authenticate(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"success": false, "message": err.Error()})
		return
	}

	var request issueSubscriptionRequest
	if err := json.Unmarshal(body, &request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"success": false, "message": "invalid json body"})
		return
	}
	record, err := s.issueSubscription(r, request)
	if err != nil {
		log.Printf("newapiadapter: subscription issue failed order=%s err=%v", request.OrderNo, err)
		writeJSON(w, http.StatusBadGateway, map[string]any{"success": false, "message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, buildIssueResponse(record))
}

func (s *Server) handleQueryIssue(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"success": false, "message": "method not allowed"})
		return
	}

	orderNo := strings.TrimSpace(strings.TrimPrefix(r.URL.Path, "/api/internal/code_issue/"))
	if orderNo == "" || strings.HasSuffix(r.URL.Path, "/api/internal/code_issue/") {
		writeJSON(w, http.StatusBadRequest, map[string]any{"success": false, "message": "order_no is required"})
		return
	}

	record, exists := s.store.Get(orderNo)
	if !exists {
		writeJSON(w, http.StatusOK, map[string]any{"success": false, "message": "issue record not found"})
		return
	}

	writeJSON(w, http.StatusOK, buildIssueResponse(record))
}

func (s *Server) authenticate(r *http.Request) ([]byte, error) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, err
	}

	clientKey := strings.TrimSpace(r.Header.Get("X-PassDock-Key"))
	timestamp := strings.TrimSpace(r.Header.Get("X-PassDock-Timestamp"))
	nonce := strings.TrimSpace(r.Header.Get("X-PassDock-Nonce"))
	signature := strings.ToLower(strings.TrimSpace(r.Header.Get("X-PassDock-Sign")))
	if clientKey == "" || timestamp == "" || nonce == "" || signature == "" {
		return nil, errors.New("missing signature headers")
	}

	credential, ok := s.cfg.FindClient(clientKey)
	if !ok {
		return nil, errors.New("unknown client key")
	}

	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return nil, errors.New("invalid timestamp")
	}
	now := time.Now().Unix()
	if now-ts > 300 || ts-now > 300 {
		return nil, errors.New("timestamp out of range")
	}
	if !s.consumeNonce(clientKey, nonce, time.Now()) {
		return nil, errors.New("nonce already used")
	}

	bodyHash := sha256.Sum256(body)
	source := strings.Join([]string{
		strings.ToUpper(defaultString(strings.TrimSpace(r.Method), http.MethodPost)),
		r.URL.Path,
		timestamp,
		nonce,
		hex.EncodeToString(bodyHash[:]),
	}, "\n")
	mac := hmac.New(sha256.New, []byte(credential.Secret))
	_, _ = mac.Write([]byte(source))
	expected := hex.EncodeToString(mac.Sum(nil))
	if subtle.ConstantTimeCompare([]byte(signature), []byte(expected)) != 1 {
		return nil, errors.New("invalid signature")
	}

	return body, nil
}

func (s *Server) issueRecharge(r *http.Request, request issueRechargeRequest) (IssueRecord, error) {
	if strings.TrimSpace(request.OrderNo) == "" {
		return IssueRecord{}, errors.New("order_no is required")
	}
	if existing, exists := s.store.Get(request.OrderNo); exists && len(existing.Codes) > 0 {
		return existing, nil
	}

	count := maxInt(parseIntDefault(request.Count, 1), 1)
	if count > 100 {
		count = 100
	}
	quota := parseInt64Default(request.Quota, s.cfg.DefaultRechargeQuota)
	body := map[string]any{
		"name":         trimToLength(buildRedemptionName(request.OrderNo, request.CodeName, request.ProductName), 20),
		"count":        count,
		"quota":        quota,
		"expired_time": parseIssueExpiry(request.ExpiredTime),
	}

	var envelope upstreamEnvelope[[]string]
	if err := s.doUpstreamJSON(r.Context(), http.MethodPost, "/api/redemption/", body, false, &envelope); err != nil {
		return IssueRecord{}, err
	}
	if !envelope.Success {
		return IssueRecord{}, errors.New(defaultString(strings.TrimSpace(envelope.Message), "upstream redemption issue failed"))
	}

	record := IssueRecord{
		OrderNo:       request.OrderNo,
		Kind:          "recharge",
		ExpectedCount: count,
		Codes:         append([]string{}, envelope.Data...),
		Status:        "issued",
		Message:       defaultString(strings.TrimSpace(envelope.Message), "issued redemption codes"),
	}
	if err := s.store.Upsert(record); err != nil {
		return IssueRecord{}, err
	}
	return record, nil
}

func (s *Server) issueSubscription(r *http.Request, request issueSubscriptionRequest) (IssueRecord, error) {
	if strings.TrimSpace(request.OrderNo) == "" {
		return IssueRecord{}, errors.New("order_no is required")
	}

	count := maxInt(parseIntDefault(request.Count, 1), 1)
	record, exists := s.store.Get(request.OrderNo)
	if exists && len(record.Codes) >= count {
		return record, nil
	}
	if !exists {
		record = IssueRecord{
			OrderNo:       request.OrderNo,
			Kind:          "subscription",
			ExpectedCount: count,
			Status:        "pending",
			Message:       "preparing subscription token issuance",
		}
	}
	record.ExpectedCount = count

	group := defaultString(strings.TrimSpace(request.AvailableGroup), s.cfg.DefaultSubscriptionGroup)
	expiredAt := parseSubscriptionExpiry(request)
	modelLimits := append([]string{}, s.cfg.SubscriptionModelLimits...)
	modelLimitsEnabled := len(modelLimits) > 0

	for len(record.Codes) < count {
		index := len(record.Codes) + 1
		tokenKey, err := generateAPIKey()
		if err != nil {
			return IssueRecord{}, err
		}

		body := map[string]any{
			"name":                 trimToLength(buildTokenName(request.OrderNo, request.CodeName, request.ProductName, index), 30),
			"key":                  tokenKey,
			"expired_time":         expiredAt,
			"remain_quota":         0,
			"unlimited_quota":      s.cfg.SubscriptionUnlimitedQuota,
			"group":                group,
			"model_limits":         modelLimits,
			"model_limits_enabled": modelLimitsEnabled,
		}
		if !s.cfg.SubscriptionUnlimitedQuota {
			body["remain_quota"] = s.cfg.DefaultRechargeQuota
		}

		var envelope upstreamEnvelope[map[string]any]
		if err := s.doUpstreamJSON(r.Context(), http.MethodPost, "/api/token/", body, true, &envelope); err != nil {
			record.Status = "partial"
			record.Message = err.Error()
			_ = s.store.Upsert(record)
			return IssueRecord{}, err
		}
		if !envelope.Success {
			err := errors.New(defaultString(strings.TrimSpace(envelope.Message), "upstream token issue failed"))
			record.Status = "partial"
			record.Message = err.Error()
			_ = s.store.Upsert(record)
			return IssueRecord{}, err
		}

		record.Codes = append(record.Codes, tokenKey)
		record.Status = "issued"
		record.Message = "issued subscription tokens"
		if err := s.store.Upsert(record); err != nil {
			return IssueRecord{}, err
		}
	}

	return record, nil
}

func (s *Server) doUpstreamJSON(ctx context.Context, method string, path string, payload any, includeUserHeader bool, target any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	request, err := http.NewRequestWithContext(ctx, method, s.cfg.UpstreamBaseURL+path, strings.NewReader(string(body)))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+s.cfg.UpstreamAccessToken)
	if includeUserHeader {
		request.Header.Set("New-Api-User", s.cfg.UpstreamUserID)
	}

	response, err := s.client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		payload, _ := io.ReadAll(response.Body)
		return fmt.Errorf("upstream returned status %d: %s", response.StatusCode, strings.TrimSpace(string(payload)))
	}
	if target == nil {
		return nil
	}
	return json.NewDecoder(response.Body).Decode(target)
}

func buildIssueResponse(record IssueRecord) issueResponse {
	response := issueResponse{
		Success: true,
		Message: defaultString(strings.TrimSpace(record.Message), "ok"),
	}
	response.Data.OrderNo = record.OrderNo
	response.Data.Codes = append([]string{}, record.Codes...)
	return response
}

func parseIssueExpiry(value string) int64 {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return 0
	}
	if ts, err := strconv.ParseInt(trimmed, 10, 64); err == nil {
		return ts
	}
	if parsed, err := time.Parse(time.RFC3339, trimmed); err == nil {
		return parsed.UTC().Unix()
	}
	return 0
}

func parseSubscriptionExpiry(request issueSubscriptionRequest) int64 {
	if seconds := parseIntDefault(request.CustomSeconds, 0); seconds > 0 {
		return time.Now().Add(time.Duration(seconds) * time.Second).UTC().Unix()
	}
	unit := strings.ToLower(strings.TrimSpace(request.DurationUnit))
	value := parseIntDefault(request.DurationValue, 0)
	if value > 0 {
		now := time.Now().UTC()
		switch unit {
		case "minute", "minutes":
			return now.Add(time.Duration(value) * time.Minute).Unix()
		case "hour", "hours":
			return now.Add(time.Duration(value) * time.Hour).Unix()
		case "day", "days":
			return now.AddDate(0, 0, value).Unix()
		case "month", "months":
			return now.AddDate(0, value, 0).Unix()
		case "quarter", "quarters":
			return now.AddDate(0, value*3, 0).Unix()
		case "year", "years":
			return now.AddDate(value, 0, 0).Unix()
		}
	}
	if expiry := parseIssueExpiry(request.ExpiredTime); expiry > 0 {
		return expiry
	}
	return -1
}

func buildRedemptionName(orderNo string, codeName string, productName string) string {
	base := trimToLength(defaultString(strings.TrimSpace(codeName), strings.TrimSpace(productName)), 12)
	if base == "" {
		base = "passdock"
	}
	return orderNoSuffix(orderNo, 7) + "-" + base
}

func buildTokenName(orderNo string, codeName string, productName string, index int) string {
	base := trimToLength(defaultString(strings.TrimSpace(codeName), strings.TrimSpace(productName)), 18)
	if base == "" {
		base = "subscription"
	}
	if index <= 1 {
		return orderNoSuffix(orderNo, 8) + "-" + base
	}
	return fmt.Sprintf("%s-%s-%d", orderNoSuffix(orderNo, 8), trimToLength(base, 14), index)
}

func orderNoSuffix(orderNo string, max int) string {
	trimmed := strings.TrimSpace(orderNo)
	if len(trimmed) <= max {
		return trimmed
	}
	return trimmed[len(trimmed)-max:]
}

func trimToLength(value string, max int) string {
	trimmed := strings.TrimSpace(value)
	if max <= 0 || len(trimmed) <= max {
		return trimmed
	}
	return trimmed[:max]
}

func parseIntDefault(value string, fallback int) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil {
		return fallback
	}
	return parsed
}

func parseInt64Default(value string, fallback int64) int64 {
	parsed, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
	if err != nil {
		return fallback
	}
	return parsed
}

func generateAPIKey() (string, error) {
	buffer := make([]byte, 24)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return "sk-" + hex.EncodeToString(buffer), nil
}

func defaultString(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func maxInt(value int, floor int) int {
	if value < floor {
		return floor
	}
	return value
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func (s *Server) consumeNonce(clientKey string, nonce string, now time.Time) bool {
	cacheKey := strings.TrimSpace(clientKey) + ":" + strings.TrimSpace(nonce)
	if cacheKey == ":" {
		return false
	}

	cutoff := now.Add(-10 * time.Minute)
	s.nonces.mu.Lock()
	defer s.nonces.mu.Unlock()
	for key, seenAt := range s.nonces.items {
		if seenAt.Before(cutoff) {
			delete(s.nonces.items, key)
		}
	}
	if seenAt, exists := s.nonces.items[cacheKey]; exists && seenAt.After(cutoff) {
		return false
	}
	s.nonces.items[cacheKey] = now
	return true
}
