package app

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestSelectMatchesMarksUniqueTransfersMatched(t *testing.T) {
	server := NewServer(Config{
		ReceiveAddress:   "TReceive",
		TokenContract:    defaultUSDTTRC20Contract,
		TimeSkewSeconds:  300,
		AmountTolerance:  "0.000001",
		amountToleranceU: 1,
	})

	now := time.Now().UTC()
	matches := server.selectMatches(
		[]ScanCandidate{
			{
				OrderNo:   "PD-1001",
				Amount:    "5.49",
				Currency:  "USDT",
				CreatedAt: now.Add(-2 * time.Minute),
				ExpireAt:  timePointer(now.Add(10 * time.Minute)),
			},
		},
		[]tronTransfer{
			{
				TransactionID: "tx-1",
				BlockTimeMS:   now.Add(-1 * time.Minute).UnixMilli(),
				From:          "TBuyer",
				To:            "TReceive",
				Type:          "Transfer",
				Value:         "5490000",
				TokenInfo: struct {
					Symbol   string "json:\"symbol\""
					Address  string "json:\"address\""
					Decimals int    "json:\"decimals\""
					Name     string "json:\"name\""
				}{
					Address:  defaultUSDTTRC20Contract,
					Decimals: 6,
				},
			},
		},
	)

	if len(matches) != 1 {
		t.Fatalf("expected 1 match, got %#v", matches)
	}
	if matches[0].Status != "matched" {
		t.Fatalf("expected matched status, got %#v", matches[0])
	}
	if matches[0].ChainTxHash != "tx-1" {
		t.Fatalf("expected tx-1, got %#v", matches[0])
	}
}

func TestSelectMatchesMarksAmbiguousTransfersManualReview(t *testing.T) {
	server := NewServer(Config{
		ReceiveAddress:   "TReceive",
		TokenContract:    defaultUSDTTRC20Contract,
		TimeSkewSeconds:  300,
		AmountTolerance:  "0.000001",
		amountToleranceU: 1,
	})

	now := time.Now().UTC()
	matches := server.selectMatches(
		[]ScanCandidate{
			{
				OrderNo:   "PD-1001",
				Amount:    "5.49",
				Currency:  "USDT",
				CreatedAt: now.Add(-3 * time.Minute),
				ExpireAt:  timePointer(now.Add(10 * time.Minute)),
			},
			{
				OrderNo:   "PD-1002",
				Amount:    "5.49",
				Currency:  "USDT",
				CreatedAt: now.Add(-2 * time.Minute),
				ExpireAt:  timePointer(now.Add(10 * time.Minute)),
			},
		},
		[]tronTransfer{
			{
				TransactionID: "tx-1",
				BlockTimeMS:   now.Add(-1 * time.Minute).UnixMilli(),
				From:          "TBuyer",
				To:            "TReceive",
				Type:          "Transfer",
				Value:         "5490000",
				TokenInfo: struct {
					Symbol   string "json:\"symbol\""
					Address  string "json:\"address\""
					Decimals int    "json:\"decimals\""
					Name     string "json:\"name\""
				}{
					Address:  defaultUSDTTRC20Contract,
					Decimals: 6,
				},
			},
		},
	)

	if len(matches) != 1 {
		t.Fatalf("expected a single emitted match, got %#v", matches)
	}
	if matches[0].Status != "manual_review" {
		t.Fatalf("expected manual_review, got %#v", matches[0])
	}
}

func TestHandleScanFetchesFromTronGrid(t *testing.T) {
	now := time.Now().UTC()
	var gotAuth string

	tronGrid := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("TRON-PRO-API-KEY")
		if !strings.Contains(r.URL.Path, "/transactions/trc20") {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(tronTransferEnvelope{
			Success: true,
			Data: []tronTransfer{
				{
					TransactionID: "tx-1",
					BlockTimeMS:   now.Add(-1 * time.Minute).UnixMilli(),
					From:          "TBuyer",
					To:            "TReceive",
					Type:          "Transfer",
					Value:         "5490000",
					TokenInfo: struct {
						Symbol   string "json:\"symbol\""
						Address  string "json:\"address\""
						Decimals int    "json:\"decimals\""
						Name     string "json:\"name\""
					}{
						Address:  defaultUSDTTRC20Contract,
						Decimals: 6,
					},
				},
			},
		})
	}))
	defer tronGrid.Close()

	server := NewServer(Config{
		AuthToken:        "secret",
		ReceiveAddress:   "TReceive",
		TokenContract:    defaultUSDTTRC20Contract,
		TronGridBaseURL:  tronGrid.URL,
		TronGridAPIKey:   "tg-key",
		ScanLimit:        10,
		MaxPages:         1,
		LookbackMinutes:  120,
		TimeSkewSeconds:  300,
		AmountTolerance:  "0.000001",
		amountToleranceU: 1,
	})

	body := `{"payment_method":"okx_usdt","channel_key":"okx_usdt_watch","items":[{"order_no":"PD-1001","amount":"5.49","currency":"USDT","created_at":"` + now.Add(-2*time.Minute).Format(time.RFC3339) + `","expire_at":"` + now.Add(10*time.Minute).Format(time.RFC3339) + `"}]}`
	request := httptest.NewRequest(http.MethodPost, "/api/scan", strings.NewReader(body))
	request.Header.Set("Authorization", "Bearer secret")
	recorder := httptest.NewRecorder()

	server.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if gotAuth != "tg-key" {
		t.Fatalf("expected TronGrid API key to be forwarded, got %q", gotAuth)
	}

	var response ScanResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if len(response.Items) != 1 {
		t.Fatalf("expected one match, got %#v", response.Items)
	}
	if response.Items[0].Status != "matched" {
		t.Fatalf("expected matched response, got %#v", response.Items[0])
	}
}

func TestParseUnits(t *testing.T) {
	value, err := parseUnits("5.49", 6)
	if err != nil {
		t.Fatalf("parseUnits returned error: %v", err)
	}
	if value != 5490000 {
		t.Fatalf("expected 5490000, got %d", value)
	}
}

func timePointer(value time.Time) *time.Time {
	return &value
}

func TestFetchTransfersRejectsInvalidToken(t *testing.T) {
	server := NewServer(Config{
		ReceiveAddress:   "TReceive",
		TokenContract:    defaultUSDTTRC20Contract,
		TronGridBaseURL:  "http://127.0.0.1:1",
		TronGridAPIKey:   "tg-key",
		ScanLimit:        10,
		MaxPages:         1,
		LookbackMinutes:  120,
		TimeSkewSeconds:  300,
		AmountTolerance:  "0.000001",
		amountToleranceU: 1,
	})

	_, err := server.fetchTransfers(context.Background())
	if err == nil {
		t.Fatalf("expected fetchTransfers error for invalid endpoint")
	}
}
