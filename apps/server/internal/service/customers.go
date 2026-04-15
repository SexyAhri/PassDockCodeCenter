package service

import (
	"context"
	"sort"
	"strconv"
	"strings"
	"time"

	"passdock/server/internal/model"
)

type AdminCustomerListFilters struct {
	Keyword      string
	Region       string
	Tier         string
	TicketStatus string
	AssignedTo   string
}

type adminCustomerAggregate struct {
	RawKey              string
	Key                 string
	UserID              *uint
	Name                string
	Region              string
	Orders              int
	SpendValue          float64
	Tier                string
	LastOrderAt         *time.Time
	LastActivityAt      *time.Time
	OpenTickets         int
	UrgentTickets       int
	ResolvedTickets     int
	PendingReviewOrders int
	BuyerRefs           map[string]struct{}
	OrderNos            map[string]struct{}
	TicketNos           map[string]struct{}
	AssignedTo          map[string]struct{}
	TicketStatuses      map[string]struct{}
	LatestOrderNo       string
	LatestTicketNo      string
	PaymentMethodCounts map[string]int
	SourceChannelCounts map[string]int
	Email               string
	Locale              string
	UserRole            string
	UserStatus          string
	LastLoginAt         *time.Time
	TelegramUserID      string
	TelegramUsername    string
	OrderHistory        []map[string]any
	TicketHistory       []map[string]any
	TelegramBindings    []map[string]any
}

func (s *Service) ListAdminCustomers(ctx context.Context, filters AdminCustomerListFilters) (map[string]any, error) {
	aggregates, err := s.buildAdminCustomerAggregates(ctx)
	if err != nil {
		return nil, err
	}

	items := make([]map[string]any, 0, len(aggregates))
	for _, aggregate := range aggregates {
		if !matchesAdminCustomerAggregate(aggregate, filters) {
			continue
		}
		items = append(items, s.mapAdminCustomerAggregate(aggregate))
	}

	return map[string]any{"items": items}, nil
}

func (s *Service) GetAdminCustomerDetail(ctx context.Context, customerID string) (map[string]any, error) {
	aggregates, err := s.buildAdminCustomerAggregates(ctx)
	if err != nil {
		return nil, err
	}

	for _, aggregate := range aggregates {
		if aggregate.Key != customerID {
			continue
		}

		payload := s.mapAdminCustomerAggregate(aggregate)
		payload["email"] = aggregate.Email
		payload["locale"] = aggregate.Locale
		payload["user_role"] = aggregate.UserRole
		payload["user_status"] = aggregate.UserStatus
		payload["last_login_at"] = aggregate.LastLoginAt
		payload["telegram_user_id"] = aggregate.TelegramUserID
		payload["telegram_username"] = aggregate.TelegramUsername
		payload["telegram_bindings"] = aggregate.TelegramBindings
		payload["order_history"] = aggregate.OrderHistory
		payload["ticket_history"] = aggregate.TicketHistory
		return payload, nil
	}

	return nil, ErrNotFound
}

func (s *Service) buildAdminCustomerAggregates(ctx context.Context) ([]*adminCustomerAggregate, error) {
	var users []model.User
	if err := s.db.WithContext(ctx).Order("id ASC").Find(&users).Error; err != nil {
		return nil, err
	}

	var bindings []model.TelegramBinding
	if err := s.db.WithContext(ctx).Order("bound_at DESC, id DESC").Find(&bindings).Error; err != nil {
		return nil, err
	}

	var orders []model.Order
	if err := s.db.WithContext(ctx).
		Preload("OrderItems").
		Order("created_at DESC, id DESC").
		Find(&orders).Error; err != nil {
		return nil, err
	}

	var tickets []model.SupportTicket
	if err := s.db.WithContext(ctx).Order("created_at DESC, id DESC").Find(&tickets).Error; err != nil {
		return nil, err
	}

	userMap := make(map[uint]*model.User, len(users))
	for index := range users {
		user := users[index]
		userMap[user.ID] = &user
	}

	orderMap := make(map[uint]*model.Order, len(orders))
	for index := range orders {
		order := orders[index]
		orderMap[order.ID] = &order
	}

	profiles := make(map[string]*adminCustomerAggregate)

	for _, user := range users {
		if user.Role == "admin" || user.Role == "operator" {
			continue
		}

		rawKey := customerRawKeyFromUser(user)
		profiles[rawKey] = newAdminCustomerAggregate(rawKey, defaultString(user.DisplayName, "Unnamed customer"))
		s.applyUserProfile(profiles[rawKey], &user)
	}

	for _, order := range orders {
		profile := s.aggregateForOrder(profiles, userMap, &order)
		profile.Orders++
		profile.SpendValue += order.PayAmount
		profile.OrderNos[order.OrderNo] = struct{}{}
		if strings.TrimSpace(order.BuyerRef) != "" {
			profile.BuyerRefs[order.BuyerRef] = struct{}{}
		}
		if profile.LastOrderAt == nil || profile.LastOrderAt.Before(order.CreatedAt) {
			timeValue := order.CreatedAt
			profile.LastOrderAt = &timeValue
			profile.LatestOrderNo = order.OrderNo
		}
		if profile.LastActivityAt == nil || profile.LastActivityAt.Before(order.CreatedAt) {
			timeValue := order.CreatedAt
			profile.LastActivityAt = &timeValue
		}
		if order.PaymentStatus == "pending_review" || order.Status == "paid_pending_review" {
			profile.PendingReviewOrders++
		}
		bumpAggregateCount(profile.PaymentMethodCounts, order.PaymentMethod)
		bumpAggregateCount(profile.SourceChannelCounts, order.SourceChannel)
		profile.OrderHistory = append(profile.OrderHistory, map[string]any{
			"order_no":        order.OrderNo,
			"product_name":    s.orderProductName(order),
			"amount":          formatAmount(order.PayAmount),
			"currency":        order.Currency,
			"payment_method":  order.PaymentMethod,
			"payment_status":  order.PaymentStatus,
			"order_status":    order.Status,
			"delivery_status": order.DeliveryStatus,
			"buyer_ref":       order.BuyerRef,
			"created_at":      order.CreatedAt,
		})
	}

	for _, ticket := range tickets {
		profile := s.aggregateForTicket(profiles, userMap, orderMap, &ticket)
		profile.TicketNos[ticket.TicketNo] = struct{}{}
		profile.TicketStatuses[ticket.Status] = struct{}{}
		if ticket.Status == "open" || ticket.Status == "processing" {
			profile.OpenTickets++
		}
		if ticket.Status == "resolved" || ticket.Status == "closed" {
			profile.ResolvedTickets++
		}
		if ticket.Priority == "high" || ticket.Priority == "urgent" {
			profile.UrgentTickets++
		}
		if profile.LastActivityAt == nil || profile.LastActivityAt.Before(ticket.CreatedAt) {
			timeValue := ticket.CreatedAt
			profile.LastActivityAt = &timeValue
			profile.LatestTicketNo = ticket.TicketNo
		}
		if profile.LatestTicketNo == "" {
			profile.LatestTicketNo = ticket.TicketNo
		}

		assignedTo := ""
		if ticket.AssignedTo != nil {
			if user := userMap[*ticket.AssignedTo]; user != nil {
				assignedTo = user.DisplayName
				profile.AssignedTo[assignedTo] = struct{}{}
			}
		}

		customerName := profile.Name
		orderNo := ""
		if ticket.OrderID != nil {
			if order := orderMap[*ticket.OrderID]; order != nil {
				customerName = s.customerDisplayNameFromOrder(userMap, order)
				orderNo = order.OrderNo
			}
		}

		profile.TicketHistory = append(profile.TicketHistory, map[string]any{
			"ticket_no":     ticket.TicketNo,
			"subject":       ticket.Subject,
			"status":        ticket.Status,
			"priority":      ticket.Priority,
			"assigned_to":   assignedTo,
			"order_no":      orderNo,
			"customer":      customerName,
			"created_at":    ticket.CreatedAt,
			"updated_at":    ticket.UpdatedAt,
			"resolved_note": ticket.ResolutionNote,
		})
	}

	for _, binding := range bindings {
		rawKey := customerRawKeyByUserID(binding.UserID)
		profile, ok := profiles[rawKey]
		if !ok {
			if user := userMap[binding.UserID]; user != nil && user.Role != "admin" && user.Role != "operator" {
				profile = newAdminCustomerAggregate(rawKey, defaultString(user.DisplayName, "Unnamed customer"))
				s.applyUserProfile(profile, user)
				profiles[rawKey] = profile
			} else {
				continue
			}
		}

		if profile.TelegramUserID == "" {
			profile.TelegramUserID = binding.TelegramUserID
		}
		if profile.TelegramUsername == "" {
			profile.TelegramUsername = binding.TelegramUsername
		}
		profile.TelegramBindings = append(profile.TelegramBindings, map[string]any{
			"bot_key":           binding.BotKey,
			"telegram_user_id":  binding.TelegramUserID,
			"telegram_username": binding.TelegramUsername,
			"chat_id":           binding.ChatID,
			"bound_at":          binding.BoundAt,
		})
	}

	result := make([]*adminCustomerAggregate, 0, len(profiles))
	for _, profile := range profiles {
		profile.Tier = customerTier(profile.Orders, profile.SpendValue)
		if profile.LastActivityAt == nil && profile.LastLoginAt != nil {
			timeValue := *profile.LastLoginAt
			profile.LastActivityAt = &timeValue
		}
		result = append(result, profile)
	}

	sort.Slice(result, func(left, right int) bool {
		leftValue := adminCustomerSortValue(result[left].LastActivityAt)
		rightValue := adminCustomerSortValue(result[right].LastActivityAt)
		if leftValue != rightValue {
			return rightValue < leftValue
		}
		if result[left].SpendValue != result[right].SpendValue {
			return result[left].SpendValue > result[right].SpendValue
		}
		return result[left].Orders > result[right].Orders
	})

	return result, nil
}

func (s *Service) aggregateForOrder(
	profiles map[string]*adminCustomerAggregate,
	userMap map[uint]*model.User,
	order *model.Order,
) *adminCustomerAggregate {
	rawKey := s.customerRawKeyFromOrder(userMap, order)
	profile, ok := profiles[rawKey]
	if !ok {
		profile = newAdminCustomerAggregate(rawKey, s.customerDisplayNameFromOrder(userMap, order))
		profiles[rawKey] = profile
	}

	if order.UserID != nil {
		if user := userMap[*order.UserID]; user != nil {
			s.applyUserProfile(profile, user)
		}
	}

	if profile.Name == "" {
		profile.Name = s.customerDisplayNameFromOrder(userMap, order)
	}

	return profile
}

func (s *Service) aggregateForTicket(
	profiles map[string]*adminCustomerAggregate,
	userMap map[uint]*model.User,
	orderMap map[uint]*model.Order,
	ticket *model.SupportTicket,
) *adminCustomerAggregate {
	rawKey := s.customerRawKeyFromTicket(userMap, orderMap, ticket)
	profile, ok := profiles[rawKey]
	if !ok {
		profile = newAdminCustomerAggregate(rawKey, s.customerDisplayNameFromTicket(userMap, orderMap, ticket))
		profiles[rawKey] = profile
	}

	if ticket.UserID != nil {
		if user := userMap[*ticket.UserID]; user != nil {
			s.applyUserProfile(profile, user)
		}
	}

	if profile.Name == "" {
		profile.Name = s.customerDisplayNameFromTicket(userMap, orderMap, ticket)
	}

	return profile
}

func (s *Service) applyUserProfile(profile *adminCustomerAggregate, user *model.User) {
	if profile == nil || user == nil {
		return
	}

	profile.UserID = &user.ID
	if user.Email != nil {
		profile.Email = *user.Email
	}
	profile.Locale = user.Locale
	profile.Region = defaultString(user.Locale, profile.Region)
	profile.UserRole = user.Role
	profile.UserStatus = user.Status
	profile.LastLoginAt = user.LastLoginAt
	if user.DisplayName != "" {
		profile.Name = user.DisplayName
	}
	if user.TelegramUserID != nil {
		profile.TelegramUserID = *user.TelegramUserID
	}
}

func (s *Service) mapAdminCustomerAggregate(profile *adminCustomerAggregate) map[string]any {
	lastOrder := ""
	if profile.LastOrderAt != nil {
		lastOrder = profile.LastOrderAt.Format("2006-01-02")
	}
	lastActivity := ""
	if profile.LastActivityAt != nil {
		lastActivity = profile.LastActivityAt.Format("2006-01-02 15:04")
	}

	return map[string]any{
		"id":                    profile.Key,
		"customer_id":           profile.Key,
		"name":                  profile.Name,
		"region":                defaultString(profile.Region, "Pending"),
		"orders":                profile.Orders,
		"spend":                 formatAmount(profile.SpendValue) + " MIXED",
		"spend_value":           profile.SpendValue,
		"tier":                  profile.Tier,
		"last_order":            lastOrder,
		"last_activity":         lastActivity,
		"open_tickets":          profile.OpenTickets,
		"urgent_tickets":        profile.UrgentTickets,
		"resolved_tickets":      profile.ResolvedTickets,
		"pending_review_orders": profile.PendingReviewOrders,
		"buyer_refs":            sortedKeys(profile.BuyerRefs),
		"order_nos":             sortedKeys(profile.OrderNos),
		"ticket_nos":            sortedKeys(profile.TicketNos),
		"assigned_to":           sortedKeys(profile.AssignedTo),
		"ticket_statuses":       sortedKeys(profile.TicketStatuses),
		"latest_order_no":       profile.LatestOrderNo,
		"latest_ticket_no":      profile.LatestTicketNo,
		"top_payment_method":    topAggregateKey(profile.PaymentMethodCounts),
		"top_source_channel":    topAggregateKey(profile.SourceChannelCounts),
	}
}

func matchesAdminCustomerAggregate(profile *adminCustomerAggregate, filters AdminCustomerListFilters) bool {
	keyword := strings.ToLower(strings.TrimSpace(filters.Keyword))
	if keyword != "" {
		values := []string{
			profile.Name,
			profile.Region,
			profile.LatestOrderNo,
			profile.LatestTicketNo,
			profile.Email,
			profile.TelegramUserID,
			profile.TelegramUsername,
		}
		values = append(values, sortedKeys(profile.BuyerRefs)...)
		values = append(values, sortedKeys(profile.OrderNos)...)
		values = append(values, sortedKeys(profile.TicketNos)...)

		matched := false
		for _, value := range values {
			if strings.Contains(strings.ToLower(value), keyword) {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	if filters.Region != "" && !strings.Contains(strings.ToLower(profile.Region), strings.ToLower(filters.Region)) {
		return false
	}

	if filters.Tier != "" && profile.Tier != filters.Tier {
		return false
	}

	if filters.TicketStatus != "" {
		if _, ok := profile.TicketStatuses[filters.TicketStatus]; !ok {
			return false
		}
	}

	if filters.AssignedTo != "" {
		matched := false
		for assignedTo := range profile.AssignedTo {
			if strings.Contains(strings.ToLower(assignedTo), strings.ToLower(filters.AssignedTo)) {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	return true
}

func newAdminCustomerAggregate(rawKey, name string) *adminCustomerAggregate {
	return &adminCustomerAggregate{
		RawKey:              rawKey,
		Key:                 customerRouteKey(rawKey),
		Name:                name,
		Region:              "Pending",
		Tier:                "active",
		BuyerRefs:           map[string]struct{}{},
		OrderNos:            map[string]struct{}{},
		TicketNos:           map[string]struct{}{},
		AssignedTo:          map[string]struct{}{},
		TicketStatuses:      map[string]struct{}{},
		PaymentMethodCounts: map[string]int{},
		SourceChannelCounts: map[string]int{},
		OrderHistory:        []map[string]any{},
		TicketHistory:       []map[string]any{},
		TelegramBindings:    []map[string]any{},
	}
}

func customerRawKeyFromUser(user model.User) string {
	return customerRawKeyByUserID(user.ID)
}

func customerRawKeyByUserID(userID uint) string {
	return "user:" + strings.TrimSpace(formatUint(userID))
}

func customerRouteKey(rawKey string) string {
	return "cust_" + hashToken(rawKey)[:12]
}

func (s *Service) customerRawKeyFromOrder(userMap map[uint]*model.User, order *model.Order) string {
	if order.UserID != nil {
		if user := userMap[*order.UserID]; user != nil {
			return customerRawKeyFromUser(*user)
		}
		return customerRawKeyByUserID(*order.UserID)
	}
	if strings.TrimSpace(order.BuyerRef) != "" {
		return "buyer:" + strings.ToLower(strings.TrimSpace(order.BuyerRef))
	}
	return "order:" + order.OrderNo
}

func (s *Service) customerDisplayNameFromOrder(userMap map[uint]*model.User, order *model.Order) string {
	if order.UserID != nil {
		if user := userMap[*order.UserID]; user != nil && strings.TrimSpace(user.DisplayName) != "" {
			return user.DisplayName
		}
	}
	return buildCustomerName(*order)
}

func (s *Service) customerRawKeyFromTicket(
	userMap map[uint]*model.User,
	orderMap map[uint]*model.Order,
	ticket *model.SupportTicket,
) string {
	if ticket.UserID != nil {
		if user := userMap[*ticket.UserID]; user != nil {
			return customerRawKeyFromUser(*user)
		}
		return customerRawKeyByUserID(*ticket.UserID)
	}
	if ticket.OrderID != nil {
		if order := orderMap[*ticket.OrderID]; order != nil {
			return s.customerRawKeyFromOrder(userMap, order)
		}
	}
	return "ticket:" + ticket.TicketNo
}

func (s *Service) customerDisplayNameFromTicket(
	userMap map[uint]*model.User,
	orderMap map[uint]*model.Order,
	ticket *model.SupportTicket,
) string {
	if ticket.UserID != nil {
		if user := userMap[*ticket.UserID]; user != nil && strings.TrimSpace(user.DisplayName) != "" {
			return user.DisplayName
		}
	}
	if ticket.OrderID != nil {
		if order := orderMap[*ticket.OrderID]; order != nil {
			return s.customerDisplayNameFromOrder(userMap, order)
		}
	}
	return "Ticket " + ticket.TicketNo
}

func sortedKeys(values map[string]struct{}) []string {
	result := make([]string, 0, len(values))
	for key := range values {
		if strings.TrimSpace(key) == "" {
			continue
		}
		result = append(result, key)
	}
	sort.Strings(result)
	return result
}

func customerTier(orders int, spendValue float64) string {
	if orders >= 5 || spendValue >= 500 {
		return "vip"
	}
	return "active"
}

func bumpAggregateCount(values map[string]int, key string) {
	if strings.TrimSpace(key) == "" {
		return
	}
	values[key]++
}

func topAggregateKey(values map[string]int) string {
	bestKey := ""
	bestValue := -1
	for key, value := range values {
		if value > bestValue {
			bestKey = key
			bestValue = value
		}
	}
	return bestKey
}

func adminCustomerSortValue(value *time.Time) string {
	if value == nil {
		return ""
	}
	return value.Format(time.RFC3339Nano)
}

func formatUint(value uint) string {
	return strconv.FormatUint(uint64(value), 10)
}
