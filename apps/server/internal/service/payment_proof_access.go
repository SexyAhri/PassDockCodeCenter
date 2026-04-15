package service

import (
	"context"
	"fmt"
	"net/url"
	"strings"

	"passdock/server/internal/model"
)

const storefrontOrderAccessTokenQueryKey = "access_token"

func IsProtectedUploadedObjectKey(objectKey string) bool {
	return isProtectedUploadedObjectKey(objectKey)
}

func (s *Service) OpenStorefrontPaymentProofObject(
	ctx context.Context,
	orderNo string,
	proofRouteID string,
	access StorefrontOrderAccessInput,
) (*UploadedObject, error) {
	order, err := s.resolveAuthorizedStorefrontOrder(ctx, orderNo, access)
	if err != nil {
		return nil, err
	}

	proof, err := s.resolvePaymentProofByRoute(ctx, proofRouteID)
	if err != nil {
		return nil, err
	}
	if proof.OrderID != order.ID {
		return nil, ErrNotFound
	}

	return s.OpenUploadedObject(ctx, proof.ObjectKey)
}

func (s *Service) OpenAdminPaymentProofObject(ctx context.Context, proofRouteID string) (*UploadedObject, error) {
	proof, err := s.resolvePaymentProofByRoute(ctx, proofRouteID)
	if err != nil {
		return nil, err
	}

	return s.OpenUploadedObject(ctx, proof.ObjectKey)
}

func (s *Service) OpenStorefrontUploadedPaymentProofObject(
	ctx context.Context,
	orderNo string,
	objectKey string,
	access StorefrontOrderAccessInput,
) (*UploadedObject, error) {
	order, err := s.resolveAuthorizedStorefrontOrder(ctx, orderNo, access)
	if err != nil {
		return nil, err
	}

	normalizedKey, err := normalizeUploadedObjectKey(objectKey)
	if err != nil {
		return nil, err
	}
	if !isOrderScopedPaymentProofObjectKey(order.OrderNo, normalizedKey) {
		return nil, ErrNotFound
	}

	return s.OpenUploadedObject(ctx, normalizedKey)
}

func (s *Service) buildStorefrontPaymentProofURL(order *model.Order, proof *model.PaymentProof) string {
	if order == nil || proof == nil || proof.ID == 0 {
		return ""
	}
	if !isProtectedUploadedObjectKey(proof.ObjectKey) {
		return strings.TrimSpace(proof.ObjectURL)
	}

	return s.buildStorefrontOrderScopedURL(
		fmt.Sprintf("/api/v1/orders/%s/payment-proofs/%d/file", url.PathEscape(strings.TrimSpace(order.OrderNo)), proof.ID),
		order,
	)
}

func (s *Service) buildStorefrontUploadedPaymentProofURL(order *model.Order, objectKey string) string {
	if order == nil {
		return ""
	}

	normalizedKey, err := normalizeUploadedObjectKey(objectKey)
	if err != nil {
		return ""
	}

	return s.buildStorefrontOrderScopedURL(
		fmt.Sprintf("/api/v1/orders/%s/payment-proof-uploads/%s", url.PathEscape(strings.TrimSpace(order.OrderNo)), normalizedKey),
		order,
	)
}

func (s *Service) buildAdminPaymentProofURL(proof *model.PaymentProof) string {
	if proof == nil || proof.ID == 0 {
		return ""
	}
	if !isProtectedUploadedObjectKey(proof.ObjectKey) {
		return strings.TrimSpace(proof.ObjectURL)
	}

	return s.buildAppURL(fmt.Sprintf("/api/v1/admin/payment-proofs/%d/file", proof.ID), nil)
}

func (s *Service) buildStorefrontOrderScopedURL(relativePath string, order *model.Order) string {
	query := url.Values{}
	if token := s.storefrontOrderAccessToken(order); token != "" {
		query.Set(storefrontOrderAccessTokenQueryKey, token)
	}

	return s.buildAppURL(relativePath, query)
}

func isProtectedUploadedObjectKey(objectKey string) bool {
	normalizedKey, err := normalizeUploadedObjectKey(objectKey)
	if err != nil {
		return false
	}

	return strings.HasPrefix(normalizedKey, "payment-proofs/")
}

func isOrderScopedPaymentProofObjectKey(orderNo string, objectKey string) bool {
	normalizedOrderNo := strings.TrimSpace(orderNo)
	if normalizedOrderNo == "" {
		return false
	}

	expectedPrefix := fmt.Sprintf("payment-proofs/orders/%s/", normalizedOrderNo)
	return strings.HasPrefix(strings.TrimSpace(objectKey), expectedPrefix)
}
