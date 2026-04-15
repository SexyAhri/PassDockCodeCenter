package app

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

const defaultUSDTTRC20Contract = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"

type Config struct {
	Port             string
	AuthToken        string
	Chain            string
	ReceiveAddress   string
	TokenContract    string
	TronGridBaseURL  string
	TronGridAPIKey   string
	ScanLimit        int
	MaxPages         int
	LookbackMinutes  int
	TimeSkewSeconds  int
	AmountTolerance  string
	amountToleranceU int64
}

func LoadConfig() Config {
	cfg := Config{
		Port:            getEnv("OKX_ADAPTER_PORT", "8090"),
		AuthToken:       strings.TrimSpace(getEnv("OKX_WATCHER_API_TOKEN", "")),
		Chain:           strings.ToLower(strings.TrimSpace(getEnv("OKX_ADAPTER_CHAIN", "tron"))),
		ReceiveAddress:  strings.TrimSpace(getEnv("OKX_ADAPTER_RECEIVE_ADDRESS", "")),
		TokenContract:   strings.TrimSpace(getEnv("OKX_ADAPTER_TOKEN_CONTRACT", defaultUSDTTRC20Contract)),
		TronGridBaseURL: strings.TrimRight(strings.TrimSpace(getEnv("OKX_ADAPTER_TRONGRID_BASE_URL", "https://api.trongrid.io")), "/"),
		TronGridAPIKey:  strings.TrimSpace(getEnv("OKX_ADAPTER_TRONGRID_API_KEY", "")),
		ScanLimit:       getEnvInt("OKX_ADAPTER_SCAN_LIMIT", 200),
		MaxPages:        getEnvInt("OKX_ADAPTER_MAX_PAGES", 3),
		LookbackMinutes: getEnvInt("OKX_ADAPTER_LOOKBACK_MINUTES", 180),
		TimeSkewSeconds: getEnvInt("OKX_ADAPTER_TIME_SKEW_SECONDS", 300),
		AmountTolerance: strings.TrimSpace(getEnv("OKX_ADAPTER_AMOUNT_TOLERANCE", "0.000001")),
	}
	cfg.amountToleranceU, _ = parseUnits(cfg.AmountTolerance, 6)
	return cfg
}

func (c Config) Validate() error {
	switch c.Chain {
	case "tron":
	default:
		return fmt.Errorf("unsupported chain %q", c.Chain)
	}
	if c.Port == "" {
		return fmt.Errorf("OKX_ADAPTER_PORT is required")
	}
	if c.ReceiveAddress == "" {
		return fmt.Errorf("OKX_ADAPTER_RECEIVE_ADDRESS is required")
	}
	if c.AuthToken == "" {
		return fmt.Errorf("OKX_WATCHER_API_TOKEN is required")
	}
	if c.TokenContract == "" {
		return fmt.Errorf("OKX_ADAPTER_TOKEN_CONTRACT is required")
	}
	if c.TronGridBaseURL == "" {
		return fmt.Errorf("OKX_ADAPTER_TRONGRID_BASE_URL is required")
	}
	if c.TronGridAPIKey == "" {
		return fmt.Errorf("OKX_ADAPTER_TRONGRID_API_KEY is required")
	}
	if c.ScanLimit <= 0 {
		return fmt.Errorf("OKX_ADAPTER_SCAN_LIMIT must be positive")
	}
	if c.MaxPages <= 0 {
		return fmt.Errorf("OKX_ADAPTER_MAX_PAGES must be positive")
	}
	if c.LookbackMinutes <= 0 {
		return fmt.Errorf("OKX_ADAPTER_LOOKBACK_MINUTES must be positive")
	}
	if c.TimeSkewSeconds < 0 {
		return fmt.Errorf("OKX_ADAPTER_TIME_SKEW_SECONDS must be zero or positive")
	}
	if _, err := parseUnits(c.AmountTolerance, 6); err != nil {
		return fmt.Errorf("OKX_ADAPTER_AMOUNT_TOLERANCE: %w", err)
	}
	return nil
}

func (c Config) AmountToleranceUnits() int64 {
	return c.amountToleranceU
}

func getEnv(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func getEnvInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}
