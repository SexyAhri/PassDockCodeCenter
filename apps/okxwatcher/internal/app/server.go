package app

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

const usdtDecimals = 6

type Server struct {
	cfg    Config
	client *http.Client
}

type ScanRequest struct {
	PaymentMethod string          `json:"payment_method"`
	ChannelKey    string          `json:"channel_key"`
	Items         []ScanCandidate `json:"items"`
}

type ScanCandidate struct {
	OrderNo    string     `json:"order_no"`
	Amount     string     `json:"amount"`
	Currency   string     `json:"currency"`
	BuyerRef   string     `json:"buyer_ref,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	ExpireAt   *time.Time `json:"expire_at,omitempty"`
	ChannelKey string     `json:"channel_key,omitempty"`
}

type ScanResponse struct {
	Items []ScanMatch `json:"items"`
}

type ScanMatch struct {
	OrderNo         string `json:"order_no"`
	Status          string `json:"status"`
	Amount          string `json:"amount"`
	Currency        string `json:"currency"`
	ChainTxHash     string `json:"chain_tx_hash"`
	PayerAccount    string `json:"payer_account,omitempty"`
	ThirdPartyTxnNo string `json:"third_party_txn_no,omitempty"`
	Note            string `json:"note,omitempty"`
}

type tronTransfer struct {
	TransactionID string `json:"transaction_id"`
	BlockTimeMS   int64  `json:"block_timestamp"`
	From          string `json:"from"`
	To            string `json:"to"`
	Type          string `json:"type"`
	Value         string `json:"value"`
	TokenInfo     struct {
		Symbol   string `json:"symbol"`
		Address  string `json:"address"`
		Decimals int    `json:"decimals"`
		Name     string `json:"name"`
	} `json:"token_info"`
}

type tronTransferEnvelope struct {
	Data    []tronTransfer `json:"data"`
	Success bool           `json:"success"`
	Meta    struct {
		Links struct {
			Next string `json:"next"`
		} `json:"links"`
	} `json:"meta"`
}

type candidateMatch struct {
	CandidateIndex int
	TransferIndex  int
}

func NewServer(cfg Config) *Server {
	return &Server{
		cfg: cfg,
		client: &http.Client{
			Timeout: 12 * time.Second,
		},
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", s.handleHealthz)
	mux.HandleFunc("/readyz", s.handleReadyz)
	mux.HandleFunc("/api/scan", s.handleScan)
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

func (s *Server) handleScan(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
		return
	}
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "unauthorized"})
		return
	}

	var request ScanRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
		return
	}

	matches, err := s.scan(r.Context(), request)
	if err != nil {
		log.Printf("okxwatcher: scan failed: %v", err)
		writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, ScanResponse{Items: matches})
}

func (s *Server) authorized(r *http.Request) bool {
	authValue := strings.TrimSpace(r.Header.Get("Authorization"))
	expected := "Bearer " + s.cfg.AuthToken
	if authValue == "" || s.cfg.AuthToken == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(authValue), []byte(expected)) == 1
}

func (s *Server) scan(ctx context.Context, request ScanRequest) ([]ScanMatch, error) {
	if len(request.Items) == 0 {
		return nil, nil
	}

	transfers, err := s.fetchTransfers(ctx)
	if err != nil {
		return nil, err
	}

	return s.selectMatches(request.Items, transfers), nil
}

func (s *Server) fetchTransfers(ctx context.Context) ([]tronTransfer, error) {
	nextURL := fmt.Sprintf(
		"%s/v1/accounts/%s/transactions/trc20?limit=%d&only_confirmed=true&contract_address=%s",
		s.cfg.TronGridBaseURL,
		url.PathEscape(s.cfg.ReceiveAddress),
		s.cfg.ScanLimit,
		url.QueryEscape(s.cfg.TokenContract),
	)

	minTime := time.Now().Add(-time.Duration(s.cfg.LookbackMinutes) * time.Minute)
	items := make([]tronTransfer, 0, s.cfg.ScanLimit)

	for page := 0; page < s.cfg.MaxPages; page++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, nextURL, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("Accept", "application/json")
		req.Header.Set("TRON-PRO-API-KEY", s.cfg.TronGridAPIKey)

		resp, err := s.client.Do(req)
		if err != nil {
			return nil, err
		}

		var envelope tronTransferEnvelope
		err = json.NewDecoder(resp.Body).Decode(&envelope)
		resp.Body.Close()
		if err != nil {
			return nil, err
		}
		if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
			return nil, fmt.Errorf("trongrid returned status %d", resp.StatusCode)
		}

		stopPaging := false
		for _, item := range envelope.Data {
			if !s.isEligibleTransfer(item) {
				continue
			}
			if transferTime(item).Before(minTime) {
				stopPaging = true
				continue
			}
			items = append(items, item)
		}

		if stopPaging || strings.TrimSpace(envelope.Meta.Links.Next) == "" {
			break
		}
		nextURL = strings.TrimSpace(envelope.Meta.Links.Next)
	}

	sort.SliceStable(items, func(i, j int) bool {
		return transferTime(items[i]).Before(transferTime(items[j]))
	})

	return items, nil
}

func (s *Server) isEligibleTransfer(item tronTransfer) bool {
	if strings.TrimSpace(item.TransactionID) == "" {
		return false
	}
	if !strings.EqualFold(strings.TrimSpace(item.TokenInfo.Address), strings.TrimSpace(s.cfg.TokenContract)) {
		return false
	}
	if strings.TrimSpace(item.To) != strings.TrimSpace(s.cfg.ReceiveAddress) {
		return false
	}
	if strings.TrimSpace(item.Type) != "" && !strings.EqualFold(strings.TrimSpace(item.Type), "Transfer") {
		return false
	}
	if item.TokenInfo.Decimals != 0 && item.TokenInfo.Decimals != usdtDecimals {
		return false
	}
	return true
}

func (s *Server) selectMatches(candidates []ScanCandidate, transfers []tronTransfer) []ScanMatch {
	if len(candidates) == 0 || len(transfers) == 0 {
		return nil
	}

	sortedCandidates := append([]ScanCandidate(nil), candidates...)
	sort.SliceStable(sortedCandidates, func(i, j int) bool {
		return sortedCandidates[i].CreatedAt.Before(sortedCandidates[j].CreatedAt)
	})

	possibleByCandidate := make([][]int, len(sortedCandidates))
	possibleByTransfer := make(map[int][]int, len(transfers))

	for i, candidate := range sortedCandidates {
		candidateUnits, err := parseUnits(candidate.Amount, usdtDecimals)
		if err != nil {
			continue
		}
		for j, transfer := range transfers {
			transferUnits, err := strconv.ParseInt(strings.TrimSpace(transfer.Value), 10, 64)
			if err != nil {
				continue
			}
			if absInt64(transferUnits-candidateUnits) > s.cfg.AmountToleranceUnits() {
				continue
			}
			if !transferFitsCandidate(candidate, transfer, s.cfg.TimeSkewSeconds) {
				continue
			}

			possibleByCandidate[i] = append(possibleByCandidate[i], j)
			possibleByTransfer[j] = append(possibleByTransfer[j], i)
		}
	}

	usedTransfers := make(map[int]struct{}, len(transfers))
	result := make([]ScanMatch, 0, len(sortedCandidates))

	for i, candidate := range sortedCandidates {
		if len(possibleByCandidate[i]) == 0 {
			continue
		}

		selected := -1
		for _, transferIndex := range possibleByCandidate[i] {
			if _, used := usedTransfers[transferIndex]; used {
				continue
			}
			selected = transferIndex
			break
		}
		if selected < 0 {
			continue
		}

		transfer := transfers[selected]
		usedTransfers[selected] = struct{}{}

		status := "matched"
		note := "matched by bundled TRON USDT watcher"
		if len(possibleByCandidate[i]) > 1 || len(possibleByTransfer[selected]) > 1 {
			status = "manual_review"
			note = "ambiguous transfer match; manual review recommended"
		}

		result = append(result, ScanMatch{
			OrderNo:         candidate.OrderNo,
			Status:          status,
			Amount:          formatUnits(transfer.Value, usdtDecimals),
			Currency:        defaultString(strings.TrimSpace(candidate.Currency), "USDT"),
			ChainTxHash:     strings.TrimSpace(transfer.TransactionID),
			PayerAccount:    strings.TrimSpace(transfer.From),
			ThirdPartyTxnNo: strings.TrimSpace(transfer.TransactionID),
			Note:            note,
		})
	}

	return result
}

func transferFitsCandidate(candidate ScanCandidate, transfer tronTransfer, skewSeconds int) bool {
	txTime := transferTime(transfer)
	start := candidate.CreatedAt.Add(-time.Duration(skewSeconds) * time.Second)
	if txTime.Before(start) {
		return false
	}

	if candidate.ExpireAt == nil {
		return true
	}

	end := candidate.ExpireAt.Add(time.Duration(skewSeconds) * time.Second)
	return !txTime.After(end)
}

func transferTime(item tronTransfer) time.Time {
	return time.UnixMilli(item.BlockTimeMS).UTC()
}

func parseUnits(value string, decimals int) (int64, error) {
	text := strings.TrimSpace(value)
	if text == "" {
		return 0, fmt.Errorf("empty amount")
	}
	if strings.HasPrefix(text, "-") {
		return 0, fmt.Errorf("negative amount is not supported")
	}

	parts := strings.SplitN(text, ".", 2)
	whole := parts[0]
	fraction := ""
	if len(parts) == 2 {
		fraction = parts[1]
	}

	if whole == "" {
		whole = "0"
	}
	if _, err := strconv.ParseInt(whole, 10, 64); err != nil {
		return 0, fmt.Errorf("invalid whole amount %q", whole)
	}

	if len(fraction) > decimals {
		if strings.TrimRight(fraction[decimals:], "0") != "" {
			return 0, fmt.Errorf("too many decimal places in %q", text)
		}
		fraction = fraction[:decimals]
	}
	fraction = fraction + strings.Repeat("0", decimals-len(fraction))
	if fraction == "" {
		fraction = strings.Repeat("0", decimals)
	}

	scale := int64(1)
	for i := 0; i < decimals; i++ {
		scale *= 10
	}

	wholeValue, err := strconv.ParseInt(whole, 10, 64)
	if err != nil {
		return 0, err
	}
	fractionValue, err := strconv.ParseInt(fraction, 10, 64)
	if err != nil {
		return 0, err
	}

	return wholeValue*scale + fractionValue, nil
}

func formatUnits(value string, decimals int) string {
	units, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
	if err != nil {
		return strings.TrimSpace(value)
	}

	scale := int64(1)
	for i := 0; i < decimals; i++ {
		scale *= 10
	}

	whole := units / scale
	fraction := units % scale
	if fraction == 0 {
		return strconv.FormatInt(whole, 10)
	}

	fractionText := fmt.Sprintf("%0*d", decimals, fraction)
	fractionText = strings.TrimRight(fractionText, "0")
	return fmt.Sprintf("%d.%s", whole, fractionText)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func absInt64(value int64) int64 {
	if value < 0 {
		return -value
	}
	return value
}

func defaultString(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}
