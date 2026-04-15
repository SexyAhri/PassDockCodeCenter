package service

import (
	"context"

	"gorm.io/gorm"

	"passdock/server/internal/model"
)

type PaymentPostConfirmAutomationResult struct {
	ChannelKey           string
	PaymentMethod        string
	ConfigAutoFulfill    bool
	ConfigAutoDeliver    bool
	RequestedAutoFulfill bool
	RequestedAutoDeliver bool
	EffectiveAutoFulfill bool
	EffectiveAutoDeliver bool
}

func (s *Service) ApplyPaymentPostConfirmAutomation(
	ctx context.Context,
	orderNo string,
	requestedAutoFulfill bool,
	requestedAutoDeliver bool,
	meta AuditMeta,
) (PaymentPostConfirmAutomationResult, error) {
	result := PaymentPostConfirmAutomationResult{
		RequestedAutoFulfill: requestedAutoFulfill,
		RequestedAutoDeliver: requestedAutoDeliver,
	}

	order, err := s.resolveOrderByNo(ctx, orderNo)
	if err != nil {
		return result, err
	}

	result.PaymentMethod = order.PaymentMethod

	channel, config, err := s.resolvePaymentChannelConfigByType(ctx, order.PaymentMethod)
	if err != nil && err != ErrNotFound {
		return result, err
	}
	if channel != nil {
		result.ChannelKey = channel.ChannelKey
	}
	result.ConfigAutoFulfill = config.AutoFulfill
	result.ConfigAutoDeliver = config.AutoDeliver
	result.EffectiveAutoDeliver = requestedAutoDeliver || config.AutoDeliver
	result.EffectiveAutoFulfill = requestedAutoFulfill || requestedAutoDeliver || config.AutoFulfill || config.AutoDeliver

	if !result.EffectiveAutoFulfill && !result.EffectiveAutoDeliver {
		return result, nil
	}

	if result.EffectiveAutoFulfill {
		if err := s.FulfillAdminOrder(ctx, order.OrderNo, meta); err != nil {
			return result, err
		}
	}
	if result.EffectiveAutoDeliver {
		if err := s.DeliverAdminOrder(ctx, order.OrderNo, meta); err != nil {
			return result, err
		}
	}

	return result, nil
}

func (s *Service) resolvePaymentChannelConfigByType(
	ctx context.Context,
	paymentMethod string,
) (*model.PaymentChannel, paymentChannelConfig, error) {
	var channel model.PaymentChannel
	if err := s.db.WithContext(ctx).
		Where("channel_type = ?", paymentMethod).
		Order("sort_order ASC, id ASC").
		First(&channel).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, paymentChannelConfig{}, ErrNotFound
		}
		return nil, paymentChannelConfig{}, err
	}

	return &channel, normalizePaymentChannelConfig(parseJSON[paymentChannelConfig](channel.ConfigJSON), channel.ChannelName), nil
}
