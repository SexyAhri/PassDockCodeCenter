package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"passdock/server/internal/model"
)

type OKXWatcherSweepResult struct {
	CheckedOrders      int `json:"checked_orders"`
	MatchedOrders      int `json:"matched_orders"`
	ManualReviewOrders int `json:"manual_review_orders"`
	DuplicateMatches   int `json:"duplicate_matches"`
}

type okxWatcherOrderCandidate struct {
	OrderNo    string     `json:"order_no"`
	Amount     string     `json:"amount"`
	Currency   string     `json:"currency"`
	BuyerRef   string     `json:"buyer_ref,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	ExpireAt   *time.Time `json:"expire_at,omitempty"`
	ChannelKey string     `json:"channel_key"`
}

type okxWatcherRequest struct {
	PaymentMethod string                    `json:"payment_method"`
	ChannelKey    string                    `json:"channel_key"`
	Items         []okxWatcherOrderCandidate `json:"items"`
}

type okxWatcherResponse struct {
	Items []okxWatcherMatch `json:"items"`
}

type okxWatcherMatch struct {
	OrderNo         string `json:"order_no"`
	Status          string `json:"status"`
	Matched         bool   `json:"matched"`
	Amount          string `json:"amount"`
	Currency        string `json:"currency"`
	ChainTxHash     string `json:"chain_tx_hash"`
	PayerAccount    string `json:"payer_account"`
	ThirdPartyTxnNo string `json:"third_party_txn_no"`
	Note            string `json:"note"`
}

func (s *Service) runOKXWatcher(ctx context.Context) {
	if ctx == nil {
		ctx = context.Background()
	}

	s.executeOKXWatcherSweep(ctx)

	for {
		interval := time.Duration(maxInt(s.okxWatcherIntervalSeconds(ctx), 30)) * time.Second
		timer := time.NewTimer(interval)

		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
			s.executeOKXWatcherSweep(ctx)
		}
	}
}

func (s *Service) executeOKXWatcherSweep(ctx context.Context) {
	result, err := s.RunOKXWatcherSweep(ctx)
	if err != nil {
		log.Printf("passdock: okx watcher sweep failed: %v", err)
		return
	}

	if result.MatchedOrders == 0 && result.ManualReviewOrders == 0 && result.DuplicateMatches == 0 {
		return
	}

	log.Printf(
		"passdock: okx watcher sweep checked=%d matched=%d manual_review=%d duplicates=%d",
		result.CheckedOrders,
		result.MatchedOrders,
		result.ManualReviewOrders,
		result.DuplicateMatches,
	)
}

func (s *Service) RunOKXWatcherSweep(ctx context.Context) (OKXWatcherSweepResult, error) {
	result := OKXWatcherSweepResult{}
	if !s.okxWatcherEnabled(ctx) {
		return result, nil
	}

	apiURL := strings.TrimSpace(s.cfg.OKXWatcherAPIURL)
	if apiURL == "" {
		return result, nil
	}

	channelKey := s.channelKeyForPaymentMethod(ctx, "okx_usdt")
	candidates, err := s.listPendingOKXWatcherOrders(ctx, channelKey)
	if err != nil {
		return result, err
	}

	result.CheckedOrders = len(candidates)
	if len(candidates) == 0 {
		return result, nil
	}

	matches, err := s.fetchOKXWatcherMatches(ctx, apiURL, channelKey, candidates)
	if err != nil {
		return result, err
	}

	candidateByOrderNo := make(map[string]okxWatcherOrderCandidate, len(candidates))
	for _, candidate := range candidates {
		candidateByOrderNo[candidate.OrderNo] = candidate
	}

	for _, match := range matches {
		orderNo := strings.TrimSpace(match.OrderNo)
		if orderNo == "" {
			continue
		}

		candidate, ok := candidateByOrderNo[orderNo]
		if !ok {
			continue
		}

		status := normalizeOKXWatcherMatchStatus(match.Status, match.Matched)
		if status == "" {
			continue
		}

		chainTxHash := strings.TrimSpace(match.ChainTxHash)
		if chainTxHash == "" {
			continue
		}

		amount := strings.TrimSpace(match.Amount)
		if amount == "" {
			amount = candidate.Amount
		}

		currency := strings.TrimSpace(match.Currency)
		if currency == "" {
			currency = candidate.Currency
		}

		payload, err := s.HandleOnchainConfirmation(ctx, OnchainConfirmationInput{
			OrderNo:         orderNo,
			PaymentMethod:   "okx_usdt",
			Amount:          amount,
			Currency:        currency,
			ChainTxHash:     chainTxHash,
			PayerAccount:    strings.TrimSpace(match.PayerAccount),
			ThirdPartyTxnNo: strings.TrimSpace(match.ThirdPartyTxnNo),
			Note:            strings.TrimSpace(match.Note),
		}, AuditMeta{})
		if err != nil {
			if err == ErrInvalidState || err == ErrNotFound {
				continue
			}
			return result, err
		}

		if duplicate, _ := payload["duplicate"].(bool); duplicate {
			result.DuplicateMatches++
			continue
		}

		switch stringValue(payload["status"]) {
		case "matched":
			result.MatchedOrders++
		case "manual_review":
			result.ManualReviewOrders++
		case status:
			if status == "matched" {
				result.MatchedOrders++
			} else if status == "manual_review" {
				result.ManualReviewOrders++
			}
		}
	}

	return result, nil
}

func (s *Service) listPendingOKXWatcherOrders(ctx context.Context, channelKey string) ([]okxWatcherOrderCandidate, error) {
	limit := maxInt(s.okxWatcherBatchSize(ctx), 1)
	terminalStatuses := []string{"cancelled", "expired", "refunded", "failed", "completed"}

	var orders []model.Order
	if err := s.db.WithContext(ctx).
		Model(&model.Order{}).
		Where("payment_method = ?", "okx_usdt").
		Where("payment_status <> ?", "paid").
		Where("status NOT IN ?", terminalStatuses).
		Order("created_at ASC, id ASC").
		Limit(limit).
		Find(&orders).Error; err != nil {
		return nil, err
	}

	items := make([]okxWatcherOrderCandidate, 0, len(orders))
	for _, order := range orders {
		items = append(items, okxWatcherOrderCandidate{
			OrderNo:    order.OrderNo,
			Amount:     formatAmount(order.PayAmount),
			Currency:   defaultString(order.Currency, "USDT"),
			BuyerRef:   order.BuyerRef,
			CreatedAt:  order.CreatedAt,
			ExpireAt:   order.ExpireAt,
			ChannelKey: channelKey,
		})
	}

	return items, nil
}

func (s *Service) fetchOKXWatcherMatches(
	ctx context.Context,
	apiURL string,
	channelKey string,
	candidates []okxWatcherOrderCandidate,
) ([]okxWatcherMatch, error) {
	body, err := json.Marshal(okxWatcherRequest{
		PaymentMethod: "okx_usdt",
		ChannelKey:    channelKey,
		Items:         candidates,
	})
	if err != nil {
		return nil, err
	}

	timeout := time.Duration(maxInt(s.cfg.OKXWatcherTimeoutMS, 1000)) * time.Millisecond
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json")
	if token := strings.TrimSpace(s.cfg.OKXWatcherAPIToken); token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}

	response, err := (&http.Client{Timeout: timeout}).Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("okx watcher adapter returned status %d", response.StatusCode)
	}

	var payload okxWatcherResponse
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return nil, err
	}

	return payload.Items, nil
}

func normalizeOKXWatcherMatchStatus(value string, matched bool) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "matched", "confirmed", "paid":
		return "matched"
	case "manual_review", "review":
		return "manual_review"
	}

	if matched {
		return "matched"
	}

	return ""
}
