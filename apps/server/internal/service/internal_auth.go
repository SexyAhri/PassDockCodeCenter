package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type InternalClientIdentity struct {
	ClientKey  string
	ClientName string
	Scopes     []string
}

type internalClientCredential struct {
	ClientKey  string
	ClientName string
	Secret     string
	Scopes     []string
	AllowedIPs string
	Status     string
}

func (s *Service) AuthenticateInternalClientRequest(
	ctx context.Context,
	request *http.Request,
	clientIP string,
	body []byte,
	requiredScope string,
) (*InternalClientIdentity, error) {
	if request == nil {
		return nil, ErrInvalidInput
	}

	clientKey := strings.TrimSpace(request.Header.Get("X-PassDock-Key"))
	timestamp := strings.TrimSpace(request.Header.Get("X-PassDock-Timestamp"))
	nonce := strings.TrimSpace(request.Header.Get("X-PassDock-Nonce"))
	signature := strings.ToLower(strings.TrimSpace(request.Header.Get("X-PassDock-Sign")))
	if clientKey == "" || timestamp == "" || nonce == "" || signature == "" {
		return nil, ErrInvalidInput
	}

	credential, err := s.resolveInternalClientCredential(ctx, clientKey)
	if err != nil {
		return nil, err
	}
	if normalizeInternalClientStatus(credential.Status) != "active" {
		return nil, ErrInvalidState
	}
	if strings.TrimSpace(credential.Secret) == "" {
		return nil, ErrInvalidState
	}

	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return nil, ErrInvalidInput
	}
	now := time.Now().Unix()
	if now-ts > 300 || ts-now > 300 {
		return nil, ErrInvalidState
	}

	bodyHash := sha256.Sum256(body)
	source := strings.Join([]string{
		strings.ToUpper(defaultString(request.Method, http.MethodPost)),
		request.URL.Path,
		timestamp,
		nonce,
		hex.EncodeToString(bodyHash[:]),
	}, "\n")

	mac := hmac.New(sha256.New, []byte(credential.Secret))
	_, _ = mac.Write([]byte(source))
	expectedSignature := hex.EncodeToString(mac.Sum(nil))
	if subtle.ConstantTimeCompare([]byte(signature), []byte(expectedSignature)) != 1 {
		return nil, ErrInvalidInput
	}

	if !s.consumeInternalNonce(clientKey, nonce, time.Now()) {
		return nil, ErrInvalidState
	}

	if !internalClientAllowsIP(credential.AllowedIPs, clientIP) {
		return nil, ErrInvalidState
	}

	if !internalClientAllowsScope(credential.Scopes, requiredScope) {
		return nil, ErrInvalidState
	}

	return &InternalClientIdentity{
		ClientKey:  credential.ClientKey,
		ClientName: credential.ClientName,
		Scopes:     credential.Scopes,
	}, nil
}

func (s *Service) resolveInternalClientCredential(ctx context.Context, clientKey string) (*internalClientCredential, error) {
	record, err := s.resolveInternalClientKeyByRoute(ctx, clientKey)
	if err == nil {
		secret, decryptErr := s.decryptString(record.ClientSecretEncrypted)
		if decryptErr != nil {
			return nil, decryptErr
		}

		return &internalClientCredential{
			ClientKey:  record.ClientKey,
			ClientName: record.ClientName,
			Secret:     secret,
			Scopes:     parseInternalClientValues(record.Scopes),
			AllowedIPs: record.AllowedIPs,
			Status:     record.Status,
		}, nil
	}
	if err != ErrNotFound {
		return nil, err
	}

	bootstrap := s.bootstrapInternalClientCredential(clientKey)
	if bootstrap == nil {
		return nil, ErrNotFound
	}

	return bootstrap, nil
}

func (s *Service) bootstrapInternalClientCredential(clientKey string) *internalClientCredential {
	configuredKey := strings.TrimSpace(s.cfg.InternalSignKey)
	configuredSecret := strings.TrimSpace(s.cfg.InternalSignSecret)
	if configuredKey == "" || configuredSecret == "" {
		return nil
	}

	if strings.TrimSpace(clientKey) != configuredKey {
		return nil
	}

	return &internalClientCredential{
		ClientKey:  configuredKey,
		ClientName: "PassDock bootstrap internal client",
		Secret:     configuredSecret,
		Scopes: []string{
			"orders.fulfillment",
			"orders.delivery",
			"orders.expire",
			"orders.read",
			"integrations.execute",
			"payments.confirm",
		},
		Status: "active",
	}
}

func (s *Service) consumeInternalNonce(clientKey string, nonce string, now time.Time) bool {
	cacheKey := strings.TrimSpace(clientKey) + ":" + strings.TrimSpace(nonce)
	if cacheKey == ":" {
		return false
	}

	cutoff := now.Add(-10 * time.Minute)

	s.nonceMu.Lock()
	defer s.nonceMu.Unlock()

	for key, seenAt := range s.nonceSeen {
		if seenAt.Before(cutoff) {
			delete(s.nonceSeen, key)
		}
	}

	if seenAt, exists := s.nonceSeen[cacheKey]; exists && seenAt.After(cutoff) {
		return false
	}

	s.nonceSeen[cacheKey] = now
	return true
}

func internalClientAllowsScope(scopes []string, requiredScope string) bool {
	required := strings.TrimSpace(requiredScope)
	if required == "" {
		return true
	}

	if len(scopes) == 0 {
		return true
	}

	for _, scope := range scopes {
		switch strings.TrimSpace(scope) {
		case "*", required:
			return true
		}
	}

	return false
}

func internalClientAllowsIP(allowedIPs string, clientIP string) bool {
	values := parseInternalClientValues(allowedIPs)
	if len(values) == 0 {
		return true
	}

	ip := net.ParseIP(strings.TrimSpace(clientIP))
	if ip == nil {
		return false
	}

	for _, value := range values {
		if strings.Contains(value, "/") {
			if _, network, err := net.ParseCIDR(value); err == nil && network.Contains(ip) {
				return true
			}
			continue
		}

		if candidate := net.ParseIP(value); candidate != nil && candidate.Equal(ip) {
			return true
		}
	}

	return false
}

func parseInternalClientValues(value string) []string {
	normalized := normalizeDelimitedText(value)
	if normalized == "" {
		return nil
	}

	parts := strings.Split(normalized, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimSpace(part)
		if item != "" {
			result = append(result, item)
		}
	}
	return result
}

func (i *InternalClientIdentity) String() string {
	if i == nil {
		return ""
	}
	if strings.TrimSpace(i.ClientName) != "" {
		return fmt.Sprintf("%s(%s)", i.ClientName, i.ClientKey)
	}
	return i.ClientKey
}
