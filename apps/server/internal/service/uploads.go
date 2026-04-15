package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"
)

type SaveUploadedObjectInput struct {
	Namespace string
	File      *multipart.FileHeader
}

type SaveUploadedBytesInput struct {
	Namespace    string
	OriginalName string
	ContentType  string
	Data         []byte
}

type UploadedObject struct {
	Reader      io.ReadCloser
	ContentType string
	Size        int64
}

func (s *Service) PrepareStorage(ctx context.Context) error {
	switch normalizeUploadStorageType(s.cfg.StorageType) {
	case "local":
		return os.MkdirAll(strings.TrimSpace(s.cfg.StorageLocalPath), 0o755)
	case "minio":
		return s.ensureMinIOBucket(ctx)
	default:
		return fmt.Errorf("storage type %q is not supported", s.cfg.StorageType)
	}
}

func (s *Service) SaveUploadedObject(ctx context.Context, input SaveUploadedObjectInput) (map[string]any, error) {
	if input.File == nil {
		return nil, ErrInvalidInput
	}
	src, err := input.File.Open()
	if err != nil {
		return nil, err
	}
	defer src.Close()

	data, err := io.ReadAll(src)
	if err != nil {
		return nil, err
	}

	return s.SaveUploadedBytes(ctx, SaveUploadedBytesInput{
		Namespace:    input.Namespace,
		OriginalName: input.File.Filename,
		Data:         data,
	})
}

func (s *Service) SavePublicPaymentProofObject(
	ctx context.Context,
	orderNo string,
	access StorefrontOrderAccessInput,
	input SaveUploadedObjectInput,
) (map[string]any, error) {
	order, err := s.resolveAuthorizedStorefrontOrder(ctx, orderNo, access)
	if err != nil {
		return nil, err
	}

	saved, err := s.SaveUploadedObject(ctx, SaveUploadedObjectInput{
		Namespace: filepath.ToSlash(filepath.Join("payment-proofs", "orders", order.OrderNo)),
		File:      input.File,
	})
	if err != nil {
		return nil, err
	}

	saved["object_url"] = s.buildStorefrontUploadedPaymentProofURL(order, stringValue(saved["object_key"]))
	return saved, nil
}

func (s *Service) SaveUploadedBytes(ctx context.Context, input SaveUploadedBytesInput) (map[string]any, error) {
	if len(input.Data) == 0 {
		return nil, ErrInvalidInput
	}
	maxBytes := int64(s.cfg.UploadMaxFileSizeMB) * 1024 * 1024
	if maxBytes > 0 && int64(len(input.Data)) > maxBytes {
		return nil, ErrInvalidInput
	}
	sniffLimit := 512
	if len(input.Data) < sniffLimit {
		sniffLimit = len(input.Data)
	}

	contentType := strings.TrimSpace(input.ContentType)
	detectedType := http.DetectContentType(input.Data[:sniffLimit])
	if !isAllowedUploadContentType(contentType) {
		contentType = detectedType
	}
	if !isAllowedUploadContentType(contentType) {
		return nil, ErrInvalidInput
	}

	ext := strings.ToLower(filepath.Ext(strings.TrimSpace(input.OriginalName)))
	if ext == "" || !isAllowedUploadExtension(ext) {
		ext = defaultExtensionForContentType(contentType)
	}

	objectKey := s.buildUploadObjectKey(defaultString(input.Namespace, "uploads"), ext)
	switch normalizeUploadStorageType(s.cfg.StorageType) {
	case "local":
		if err := s.writeLocalUploadedObject(objectKey, input.Data); err != nil {
			return nil, err
		}
	case "minio":
		if err := s.writeMinIOUploadedObject(ctx, objectKey, contentType, input.Data); err != nil {
			return nil, err
		}
	default:
		return nil, fmt.Errorf("storage type %q is not supported", s.cfg.StorageType)
	}

	return map[string]any{
		"object_key":    objectKey,
		"object_url":    s.buildObjectURL(objectKey),
		"content_type":  contentType,
		"original_name": strings.TrimSpace(input.OriginalName),
		"size":          len(input.Data),
	}, nil
}

func (s *Service) OpenUploadedObject(ctx context.Context, objectKey string) (*UploadedObject, error) {
	switch normalizeUploadStorageType(s.cfg.StorageType) {
	case "local":
		return s.openLocalUploadedObject(objectKey)
	case "minio":
		return s.openMinIOUploadedObject(ctx, objectKey)
	default:
		return nil, fmt.Errorf("storage type %q is not supported", s.cfg.StorageType)
	}
}

func (s *Service) buildUploadObjectKey(namespace string, extension string) string {
	now := time.Now()
	token, err := generateOpaqueToken()
	if err != nil {
		token = fmt.Sprintf("%d", now.UnixNano())
	}

	objectKey := filepath.ToSlash(filepath.Join(
		strings.Trim(strings.TrimSpace(namespace), "/"),
		now.Format("2006"),
		now.Format("01"),
		now.Format("02"),
		fmt.Sprintf("%s%s", strings.Trim(token, "."), extension),
	))

	return objectKey
}

func (s *Service) buildObjectURL(objectKey string) string {
	publicPath := strings.TrimRight(s.cfg.StoragePublicPath, "/")
	normalizedKey := strings.TrimLeft(filepath.ToSlash(objectKey), "/")
	relativePath := publicPath + "/" + normalizedKey

	return s.buildAppURL(relativePath, nil)
}

func (s *Service) buildAppURL(relativePath string, query url.Values) string {
	normalizedPath := "/" + strings.TrimLeft(strings.TrimSpace(relativePath), "/")
	if encodedQuery := query.Encode(); encodedQuery != "" {
		normalizedPath += "?" + encodedQuery
	}

	baseURL := strings.TrimRight(strings.TrimSpace(s.cfg.AppBaseURL), "/")
	if baseURL == "" {
		return normalizedPath
	}

	return baseURL + normalizedPath
}

func (s *Service) writeLocalUploadedObject(objectKey string, data []byte) error {
	absolutePath, err := s.buildLocalUploadPath(objectKey)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(absolutePath), 0o755); err != nil {
		return err
	}

	dst, err := os.Create(absolutePath)
	if err != nil {
		return err
	}
	defer dst.Close()

	if _, err := io.Copy(dst, bytes.NewReader(data)); err != nil {
		return err
	}

	return nil
}

func (s *Service) openLocalUploadedObject(objectKey string) (*UploadedObject, error) {
	absolutePath, err := s.buildLocalUploadPath(objectKey)
	if err != nil {
		return nil, err
	}

	file, err := os.Open(absolutePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	info, err := file.Stat()
	if err != nil {
		file.Close()
		return nil, err
	}

	contentType, err := detectUploadedObjectContentType(file, objectKey)
	if err != nil {
		file.Close()
		return nil, err
	}

	return &UploadedObject{
		Reader:      file,
		ContentType: contentType,
		Size:        info.Size(),
	}, nil
}

func (s *Service) buildLocalUploadPath(objectKey string) (string, error) {
	normalizedKey, err := normalizeUploadedObjectKey(objectKey)
	if err != nil {
		return "", err
	}

	return filepath.Join(strings.TrimSpace(s.cfg.StorageLocalPath), filepath.FromSlash(normalizedKey)), nil
}

func normalizeUploadStorageType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", "local":
		return "local"
	case "minio":
		return "minio"
	default:
		return strings.ToLower(strings.TrimSpace(value))
	}
}

func normalizeUploadedObjectKey(value string) (string, error) {
	trimmed := strings.TrimLeft(filepath.ToSlash(strings.TrimSpace(value)), "/")
	if trimmed == "" {
		return "", ErrInvalidInput
	}

	cleaned := strings.TrimLeft(path.Clean("/"+trimmed), "/")
	if cleaned == "" || cleaned == "." {
		return "", ErrInvalidInput
	}

	return cleaned, nil
}

func detectUploadedObjectContentType(file *os.File, objectKey string) (string, error) {
	buffer := make([]byte, 512)
	size, err := file.Read(buffer)
	if err != nil && err != io.EOF {
		return "", err
	}

	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return "", err
	}

	if size > 0 {
		detected := http.DetectContentType(buffer[:size])
		if detected != "" && detected != "application/octet-stream" {
			return detected, nil
		}
	}

	return contentTypeFromExtension(objectKey), nil
}

func contentTypeFromExtension(objectKey string) string {
	contentType := mime.TypeByExtension(strings.ToLower(filepath.Ext(objectKey)))
	if contentType != "" {
		return contentType
	}

	return "application/octet-stream"
}

func isAllowedUploadContentType(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "image/jpeg", "image/png", "image/webp", "application/pdf":
		return true
	default:
		return false
	}
}

func isAllowedUploadExtension(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case ".jpg", ".jpeg", ".png", ".webp", ".pdf":
		return true
	default:
		return false
	}
}

func defaultExtensionForContentType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "application/pdf":
		return ".pdf"
	default:
		return ".bin"
	}
}
