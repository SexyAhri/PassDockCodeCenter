package service

import (
	"context"
	"strings"

	"gorm.io/gorm"

	"passdock/server/internal/model"
)

func (s *Service) ResolveIdempotencyRecord(ctx context.Context, scope string) (*model.IdempotencyRecord, error) {
	trimmedScope := strings.TrimSpace(scope)
	if trimmedScope == "" {
		return nil, ErrNotFound
	}

	var record model.IdempotencyRecord
	if err := s.db.WithContext(ctx).Where("scope = ?", trimmedScope).First(&record).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &record, nil
}

func (s *Service) AcquireIdempotencyRecord(
	ctx context.Context,
	scope string,
	requestHash string,
) (*model.IdempotencyRecord, bool, error) {
	record := model.IdempotencyRecord{
		Scope:       strings.TrimSpace(scope),
		RequestHash: strings.TrimSpace(requestHash),
		StatusCode:  0,
	}

	if err := s.db.WithContext(ctx).Create(&record).Error; err == nil {
		return &record, true, nil
	} else if !isUniqueConstraintError(err) {
		return nil, false, err
	}

	existing, err := s.ResolveIdempotencyRecord(ctx, scope)
	if err != nil {
		return nil, false, err
	}

	return existing, false, nil
}

func (s *Service) FinalizeIdempotencyRecord(
	ctx context.Context,
	scope string,
	statusCode int,
	responseBody string,
) error {
	return s.db.WithContext(ctx).
		Model(&model.IdempotencyRecord{}).
		Where("scope = ?", strings.TrimSpace(scope)).
		Updates(map[string]any{
			"status_code":   statusCode,
			"response_body": responseBody,
		}).Error
}

func (s *Service) DeleteIdempotencyRecord(ctx context.Context, scope string) error {
	return s.db.WithContext(ctx).Where("scope = ?", strings.TrimSpace(scope)).Delete(&model.IdempotencyRecord{}).Error
}

func Sha256HexForHTTP(parts ...string) string {
	return sha256HexStrings(parts...)
}

func IsUniqueConstraintErrorForHTTP(err error) bool {
	return isUniqueConstraintError(err)
}
