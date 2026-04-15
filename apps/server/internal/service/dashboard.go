package service

import (
	"context"
	"sort"
	"strings"
	"time"

	"passdock/server/internal/model"
)

func (s *Service) GetAdminDashboard(ctx context.Context) (map[string]any, error) {
	recentOrders, err := s.listDashboardOrders(ctx, dashboardOrderQueryOptions{
		limit: 8,
	})
	if err != nil {
		return nil, err
	}

	reviewQueue, err := s.listDashboardOrders(ctx, dashboardOrderQueryOptions{
		limit:             8,
		includeReviewOnly: true,
	})
	if err != nil {
		return nil, err
	}

	urgentTickets, err := s.listDashboardTickets(ctx, dashboardTicketQueryOptions{
		limit:             8,
		includeUrgentOnly: true,
	})
	if err != nil {
		return nil, err
	}

	providers, healthyProviderCount, err := s.listDashboardProviders(ctx)
	if err != nil {
		return nil, err
	}

	channelRevenue, err := s.listDashboardChannelRevenue(ctx)
	if err != nil {
		return nil, err
	}

	totalOrders, err := s.countDashboardOrders(ctx)
	if err != nil {
		return nil, err
	}

	reviewQueueSize, err := s.countDashboardReviewQueue(ctx)
	if err != nil {
		return nil, err
	}

	totalTickets, err := s.countDashboardTickets(ctx)
	if err != nil {
		return nil, err
	}

	urgentTicketSize, err := s.countDashboardUrgentTickets(ctx)
	if err != nil {
		return nil, err
	}

	revenueToday, err := s.sumDashboardRevenueToday(ctx)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"summary": map[string]any{
			"revenue_today":          formatAmount(revenueToday),
			"currency":               "MIXED",
			"review_queue_size":      reviewQueueSize,
			"total_orders":           totalOrders,
			"urgent_ticket_size":     urgentTicketSize,
			"total_tickets":          totalTickets,
			"healthy_provider_count": healthyProviderCount,
			"total_provider_count":   len(providers),
		},
		"recent_orders":   recentOrders,
		"review_queue":    reviewQueue,
		"urgent_tickets":  urgentTickets,
		"providers":       providers,
		"channel_revenue": channelRevenue,
	}, nil
}

type dashboardOrderQueryOptions struct {
	limit             int
	includeReviewOnly bool
}

type dashboardTicketQueryOptions struct {
	limit             int
	includeUrgentOnly bool
}

func (s *Service) listDashboardOrders(ctx context.Context, options dashboardOrderQueryOptions) ([]map[string]any, error) {
	query := s.db.WithContext(ctx).
		Model(&model.Order{}).
		Preload("OrderItems")

	if options.includeReviewOnly {
		query = query.Where("payment_status = ? OR status = ?", "pending_review", "paid_pending_review")
	}

	var orders []model.Order
	if err := query.
		Order("created_at DESC, id DESC").
		Limit(defaultDashboardLimit(options.limit, 8)).
		Find(&orders).Error; err != nil {
		return nil, err
	}

	items := make([]map[string]any, 0, len(orders))
	reviewTimeoutMinutes := s.paymentReviewTimeoutMinutes(ctx)
	for _, order := range orders {
		reviewDueAt, reviewOverdue := paymentReviewDeadlineWithTimeout(&order, reviewTimeoutMinutes)
		items = append(items, mapDashboardOrder(order, s.orderProductName(order), reviewDueAt, reviewOverdue))
	}

	return items, nil
}

func (s *Service) listDashboardTickets(ctx context.Context, options dashboardTicketQueryOptions) ([]map[string]any, error) {
	query := s.db.WithContext(ctx).Model(&model.SupportTicket{})
	if options.includeUrgentOnly {
		query = query.Where("priority IN ?", []string{"urgent", "high"})
	}

	var tickets []model.SupportTicket
	if err := query.
		Order("created_at DESC, id DESC").
		Limit(defaultDashboardLimit(options.limit, 8)).
		Find(&tickets).Error; err != nil {
		return nil, err
	}

	items := make([]map[string]any, 0, len(tickets))
	for _, ticket := range tickets {
		items = append(items, s.mapDashboardTicket(ctx, ticket))
	}

	return items, nil
}

func (s *Service) listDashboardProviders(ctx context.Context) ([]map[string]any, int64, error) {
	var providers []model.IntegrationProvider
	if err := s.db.WithContext(ctx).
		Order("provider_name ASC, id ASC").
		Find(&providers).Error; err != nil {
		return nil, 0, err
	}

	var healthyProviderCount int64
	for _, provider := range providers {
		if provider.HealthStatus == "healthy" {
			healthyProviderCount++
		}
	}

	items := make([]map[string]any, 0, len(providers))
	for _, provider := range providers {
		items = append(items, map[string]any{
			"id":              provider.ID,
			"provider_key":    provider.ProviderKey,
			"provider_name":   provider.ProviderName,
			"base_url":        provider.BaseURL,
			"auth_type":       provider.AuthType,
			"retry_times":     provider.RetryTimes,
			"timeout_ms":      provider.TimeoutMS,
			"health":          provider.HealthStatus,
			"enabled":         provider.Enabled,
			"last_checked_at": provider.LastCheckedAt,
		})
	}

	return items, healthyProviderCount, nil
}

func (s *Service) listDashboardChannelRevenue(ctx context.Context) ([]map[string]any, error) {
	var orders []model.Order
	if err := s.db.WithContext(ctx).
		Where("payment_status = ?", "paid").
		Order("paid_at DESC, id DESC").
		Find(&orders).Error; err != nil {
		return nil, err
	}

	total := 0.0
	grouped := make(map[string]float64)
	for _, order := range orders {
		total += order.PayAmount
		grouped[defaultString(order.PaymentMethod, "wechat_qr")] += order.PayAmount
	}

	type revenueRow struct {
		PaymentMethod string
		Amount        float64
	}

	rows := make([]revenueRow, 0, len(grouped))
	for paymentMethod, amount := range grouped {
		rows = append(rows, revenueRow{
			PaymentMethod: paymentMethod,
			Amount:        amount,
		})
	}

	sort.SliceStable(rows, func(left int, right int) bool {
		return rows[left].Amount > rows[right].Amount
	})

	items := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		share := 0
		if total > 0 {
			share = int((row.Amount / total) * 100)
		}

		items = append(items, map[string]any{
			"payment_method": row.PaymentMethod,
			"amount":         formatAmount(row.Amount),
			"currency":       dashboardPaymentMethodCurrency(row.PaymentMethod),
			"share_percent":  share,
		})
	}

	return items, nil
}

func dashboardPaymentMethodCurrency(paymentMethod string) string {
	switch strings.TrimSpace(paymentMethod) {
	case "okx_usdt":
		return "USDT"
	default:
		return "RMB"
	}
}

func (s *Service) countDashboardOrders(ctx context.Context) (int64, error) {
	var total int64
	err := s.db.WithContext(ctx).Model(&model.Order{}).Count(&total).Error
	return total, err
}

func (s *Service) countDashboardReviewQueue(ctx context.Context) (int64, error) {
	var total int64
	err := s.db.WithContext(ctx).
		Model(&model.Order{}).
		Where("payment_status = ? OR status = ?", "pending_review", "paid_pending_review").
		Count(&total).Error
	return total, err
}

func (s *Service) countDashboardTickets(ctx context.Context) (int64, error) {
	var total int64
	err := s.db.WithContext(ctx).Model(&model.SupportTicket{}).Count(&total).Error
	return total, err
}

func (s *Service) countDashboardUrgentTickets(ctx context.Context) (int64, error) {
	var total int64
	err := s.db.WithContext(ctx).
		Model(&model.SupportTicket{}).
		Where("priority IN ?", []string{"urgent", "high"}).
		Count(&total).Error
	return total, err
}

func (s *Service) sumDashboardRevenueToday(ctx context.Context) (float64, error) {
	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	type revenueResult struct {
		Total float64
	}

	var result revenueResult
	err := s.db.WithContext(ctx).
		Model(&model.Order{}).
		Select("COALESCE(SUM(pay_amount), 0) AS total").
		Where("payment_status = ? AND paid_at IS NOT NULL AND paid_at >= ?", "paid", startOfDay).
		Scan(&result).Error

	return result.Total, err
}

func mapDashboardOrder(order model.Order, productName string, reviewDueAt *time.Time, reviewOverdue bool) map[string]any {
	return map[string]any{
		"id":                     order.ID,
		"order_id":               order.ID,
		"order_no":               order.OrderNo,
		"product_name":           productName,
		"product_title":          productName,
		"customer_name":          buildCustomerName(order),
		"buyer_name":             buildCustomerName(order),
		"amount":                 formatAmount(order.PayAmount),
		"display_amount":         formatAmount(order.PayAmount),
		"total_amount":           formatAmount(order.PayAmount),
		"currency":               order.Currency,
		"payment_method":         order.PaymentMethod,
		"payment_status":         order.PaymentStatus,
		"order_status":           order.Status,
		"status":                 order.Status,
		"delivery_status":        order.DeliveryStatus,
		"source_channel":         order.SourceChannel,
		"buyer_ref":              order.BuyerRef,
		"created_at":             order.CreatedAt,
		"paid_at":                order.PaidAt,
		"payment_review_due_at":  reviewDueAt,
		"payment_review_overdue": reviewOverdue,
	}
}

func (s *Service) mapDashboardTicket(ctx context.Context, ticket model.SupportTicket) map[string]any {
	customerName := ""
	if ticket.OrderID != nil {
		var order model.Order
		if err := s.db.WithContext(ctx).Where("id = ?", *ticket.OrderID).First(&order).Error; err == nil {
			customerName = buildCustomerName(order)
		}
	}

	assignedTo := ""
	if ticket.AssignedTo != nil {
		var user model.User
		if err := s.db.WithContext(ctx).Where("id = ?", *ticket.AssignedTo).First(&user).Error; err == nil {
			assignedTo = user.DisplayName
		}
	}

	return map[string]any{
		"id":            ticket.ID,
		"ticket_id":     ticket.ID,
		"ticket_no":     ticket.TicketNo,
		"subject":       ticket.Subject,
		"customer":      customerName,
		"customer_name": customerName,
		"priority":      ticket.Priority,
		"status":        ticket.Status,
		"assigned_to":   assignedTo,
		"created_at":    ticket.CreatedAt,
	}
}

func defaultDashboardLimit(value int, fallback int) int {
	if value > 0 {
		return value
	}

	return fallback
}
