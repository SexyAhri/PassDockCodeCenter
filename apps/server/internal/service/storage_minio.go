package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

const emptyPayloadSHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

func (s *Service) writeMinIOUploadedObject(
	ctx context.Context,
	objectKey string,
	contentType string,
	data []byte,
) error {
	objectURL, err := s.buildMinIOObjectURL(objectKey)
	if err != nil {
		return err
	}

	resp, err := executeRetriedHTTPRequest(
		defaultMinIORetryAttempts,
		func() (*http.Request, error) {
			return s.buildSignedMinIORequest(
				ctx,
				http.MethodPut,
				objectURL,
				bytes.NewReader(data),
				int64(len(data)),
				contentType,
				sha256HexBytes(data),
			)
		},
		http.DefaultClient.Do,
		shouldRetryTransientHTTPRequest,
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusOK && resp.StatusCode < http.StatusMultipleChoices {
		return nil
	}

	return s.readMinIOError(resp)
}

func (s *Service) openMinIOUploadedObject(ctx context.Context, objectKey string) (*UploadedObject, error) {
	objectURL, err := s.buildMinIOObjectURL(objectKey)
	if err != nil {
		return nil, err
	}

	resp, err := executeRetriedHTTPRequest(
		defaultMinIORetryAttempts,
		func() (*http.Request, error) {
			return s.buildSignedMinIORequest(
				ctx,
				http.MethodGet,
				objectURL,
				nil,
				0,
				"",
				emptyPayloadSHA256,
			)
		},
		http.DefaultClient.Do,
		func(response *http.Response, requestErr error) bool {
			if response != nil && response.StatusCode == http.StatusNotFound {
				return false
			}
			return shouldRetryTransientHTTPRequest(response, requestErr)
		},
	)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode == http.StatusNotFound {
		resp.Body.Close()
		return nil, ErrNotFound
	}

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		defer resp.Body.Close()
		return nil, s.readMinIOError(resp)
	}

	contentType := strings.TrimSpace(resp.Header.Get("Content-Type"))
	if contentType == "" {
		contentType = contentTypeFromExtension(objectKey)
	}

	return &UploadedObject{
		Reader:      resp.Body,
		ContentType: contentType,
		Size:        resp.ContentLength,
	}, nil
}

func (s *Service) buildMinIOObjectURL(objectKey string) (string, error) {
	normalizedKey, err := normalizeUploadedObjectKey(objectKey)
	if err != nil {
		return "", err
	}

	bucketURL, err := s.buildMinIOBucketURL()
	if err != nil {
		return "", err
	}

	return bucketURL + "/" + escapeMinIOPath(normalizedKey), nil
}

func (s *Service) buildMinIOBucketURL() (string, error) {
	endpoint := strings.Trim(strings.TrimSpace(s.cfg.MinIOEndpoint), "/")
	accessKey := strings.TrimSpace(s.cfg.MinIOAccessKey)
	secretKey := strings.TrimSpace(s.cfg.MinIOSecretKey)
	bucket := strings.Trim(strings.TrimSpace(s.cfg.MinIOBucket), "/")
	if endpoint == "" || accessKey == "" || secretKey == "" || bucket == "" {
		return "", fmt.Errorf("minio storage is not fully configured")
	}

	scheme := "http"
	if s.cfg.MinIOUseSSL {
		scheme = "https"
	}

	return fmt.Sprintf("%s://%s/%s", scheme, endpoint, escapeMinIOPath(bucket)), nil
}

func (s *Service) buildSignedMinIORequest(
	ctx context.Context,
	method string,
	rawURL string,
	body io.Reader,
	contentLength int64,
	contentType string,
	payloadHash string,
) (*http.Request, error) {
	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	dateStamp := now.Format("20060102")
	amzDate := now.Format("20060102T150405Z")
	region := strings.TrimSpace(s.cfg.MinIORegion)
	if region == "" {
		region = "us-east-1"
	}

	canonicalHeaderItems := []struct {
		key   string
		value string
	}{
		{key: "host", value: parsedURL.Host},
		{key: "x-amz-content-sha256", value: payloadHash},
		{key: "x-amz-date", value: amzDate},
	}

	if strings.TrimSpace(contentType) != "" {
		canonicalHeaderItems = append(canonicalHeaderItems, struct {
			key   string
			value string
		}{key: "content-type", value: strings.TrimSpace(contentType)})
	}

	canonicalHeaders := buildCanonicalMinIOHeaders(canonicalHeaderItems)
	signedHeaders := buildSignedMinIOHeaders(canonicalHeaderItems)
	canonicalRequest := strings.Join([]string{
		method,
		parsedURL.EscapedPath(),
		parsedURL.RawQuery,
		canonicalHeaders,
		signedHeaders,
		payloadHash,
	}, "\n")

	scope := fmt.Sprintf("%s/%s/s3/aws4_request", dateStamp, region)
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		scope,
		sha256HexBytes([]byte(canonicalRequest)),
	}, "\n")

	signingKey := deriveMinIOSigningKey(strings.TrimSpace(s.cfg.MinIOSecretKey), dateStamp, region)
	signature := hmacSHA256Hex(signingKey, stringToSign)
	authorization := fmt.Sprintf(
		"AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		strings.TrimSpace(s.cfg.MinIOAccessKey),
		scope,
		signedHeaders,
		signature,
	)

	req, err := http.NewRequestWithContext(ctx, method, rawURL, body)
	if err != nil {
		return nil, err
	}
	if body != nil {
		req.ContentLength = contentLength
	}
	if strings.TrimSpace(contentType) != "" {
		req.Header.Set("Content-Type", strings.TrimSpace(contentType))
	}
	req.Header.Set("Authorization", authorization)
	req.Header.Set("X-Amz-Content-Sha256", payloadHash)
	req.Header.Set("X-Amz-Date", amzDate)

	return req, nil
}

func (s *Service) readMinIOError(resp *http.Response) error {
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
	message := strings.TrimSpace(string(body))
	if message == "" {
		message = resp.Status
	}

	return fmt.Errorf("minio request failed: %s", message)
}

func (s *Service) ensureMinIOBucket(ctx context.Context) error {
	bucketURL, err := s.buildMinIOBucketURL()
	if err != nil {
		return err
	}

	headResp, err := executeRetriedHTTPRequest(
		defaultMinIORetryAttempts,
		func() (*http.Request, error) {
			return s.buildSignedMinIORequest(
				ctx,
				http.MethodHead,
				bucketURL,
				nil,
				0,
				"",
				emptyPayloadSHA256,
			)
		},
		http.DefaultClient.Do,
		func(response *http.Response, requestErr error) bool {
			if response != nil && response.StatusCode == http.StatusNotFound {
				return false
			}
			return shouldRetryTransientHTTPRequest(response, requestErr)
		},
	)
	if err != nil {
		return err
	}
	defer headResp.Body.Close()

	if headResp.StatusCode >= http.StatusOK && headResp.StatusCode < http.StatusMultipleChoices {
		return nil
	}
	if headResp.StatusCode != http.StatusNotFound {
		return s.readMinIOError(headResp)
	}

	createResp, err := executeRetriedHTTPRequest(
		defaultMinIORetryAttempts,
		func() (*http.Request, error) {
			return s.buildSignedMinIORequest(
				ctx,
				http.MethodPut,
				bucketURL,
				nil,
				0,
				"",
				emptyPayloadSHA256,
			)
		},
		http.DefaultClient.Do,
		func(response *http.Response, requestErr error) bool {
			if response != nil && response.StatusCode == http.StatusConflict {
				return false
			}
			return shouldRetryTransientHTTPRequest(response, requestErr)
		},
	)
	if err != nil {
		return err
	}
	defer createResp.Body.Close()

	if createResp.StatusCode >= http.StatusOK && createResp.StatusCode < http.StatusMultipleChoices {
		return nil
	}
	if createResp.StatusCode == http.StatusConflict {
		return nil
	}

	return s.readMinIOError(createResp)
}

func buildCanonicalMinIOHeaders(items []struct {
	key   string
	value string
}) string {
	sortedItems := append([]struct {
		key   string
		value string
	}{}, items...)
	sort.Slice(sortedItems, func(left int, right int) bool {
		return sortedItems[left].key < sortedItems[right].key
	})

	parts := make([]string, 0, len(items))
	for _, item := range sortedItems {
		parts = append(parts, item.key+":"+strings.TrimSpace(item.value))
	}

	return strings.Join(parts, "\n") + "\n"
}

func buildSignedMinIOHeaders(items []struct {
	key   string
	value string
}) string {
	sortedItems := append([]struct {
		key   string
		value string
	}{}, items...)
	sort.Slice(sortedItems, func(left int, right int) bool {
		return sortedItems[left].key < sortedItems[right].key
	})

	keys := make([]string, 0, len(items))
	for _, item := range sortedItems {
		keys = append(keys, item.key)
	}

	return strings.Join(keys, ";")
}

func deriveMinIOSigningKey(secretKey string, dateStamp string, region string) []byte {
	dateKey := hmacSHA256Bytes([]byte("AWS4"+secretKey), dateStamp)
	regionKey := hmacSHA256Bytes(dateKey, region)
	serviceKey := hmacSHA256Bytes(regionKey, "s3")
	return hmacSHA256Bytes(serviceKey, "aws4_request")
}

func hmacSHA256Bytes(key []byte, value string) []byte {
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write([]byte(value))
	return mac.Sum(nil)
}

func hmacSHA256Hex(key []byte, value string) string {
	return hex.EncodeToString(hmacSHA256Bytes(key, value))
}

func sha256HexBytes(value []byte) string {
	sum := sha256.Sum256(value)
	return hex.EncodeToString(sum[:])
}

func escapeMinIOPath(value string) string {
	parts := strings.Split(strings.Trim(strings.TrimSpace(value), "/"), "/")
	for index, part := range parts {
		parts[index] = url.PathEscape(part)
	}

	return strings.Join(parts, "/")
}
