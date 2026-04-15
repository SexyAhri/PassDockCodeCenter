package service

import (
	"context"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"passdock/server/internal/model"
)

type RegisterInput struct {
	Email       string
	Password    string
	DisplayName string
	Locale      string
}

type LoginInput struct {
	Email    string
	Password string
	Scope    string
}

type MyOrderFilters struct {
	Status         string
	PaymentStatus  string
	DeliveryStatus string
	Page           int
	PageSize       int
}

type SessionInfo struct {
	Token     string
	UserID    uint
	Email     string
	Name      string
	Role      string
	Scope     string
	ExpiresAt time.Time
}

func HashPassword(password string) (string, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}

	return string(hashed), nil
}

func (s *Service) Register(ctx context.Context, input RegisterInput, userAgent, ip string) (map[string]any, error) {
	email := strings.ToLower(strings.TrimSpace(input.Email))
	password := strings.TrimSpace(input.Password)
	if email == "" || password == "" {
		return nil, ErrInvalidInput
	}

	if _, err := s.resolveUserByEmail(ctx, email); err == nil {
		return nil, ErrInvalidState
	}

	passwordHash, err := HashPassword(password)
	if err != nil {
		return nil, err
	}

	displayName := strings.TrimSpace(input.DisplayName)
	if displayName == "" {
		displayName = strings.Split(email, "@")[0]
	}

	user := model.User{
		Email:        &email,
		PasswordHash: &passwordHash,
		DisplayName:  displayName,
		Role:         "user",
		Status:       "active",
		Locale:       defaultString(input.Locale, "en-US"),
	}
	if err := s.db.WithContext(ctx).Create(&user).Error; err != nil {
		return nil, err
	}

	session, err := s.createSession(ctx, &user, "user", userAgent, ip)
	if err != nil {
		return nil, err
	}

	return sessionEnvelope(*session), nil
}

func (s *Service) Login(ctx context.Context, input LoginInput, userAgent, ip string) (map[string]any, error) {
	user, err := s.resolveUserByEmail(ctx, input.Email)
	if err != nil {
		return nil, err
	}
	if user.PasswordHash == nil || bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(input.Password)) != nil {
		return nil, ErrInvalidInput
	}
	if user.Status != "active" {
		return nil, ErrInvalidState
	}

	scope := defaultString(input.Scope, "user")
	if scope == "admin" && user.Role != "admin" && user.Role != "operator" {
		return nil, ErrInvalidState
	}

	now := time.Now()
	user.LastLoginAt = &now
	if err := s.db.WithContext(ctx).Save(user).Error; err != nil {
		return nil, err
	}

	session, err := s.createSession(ctx, user, scope, userAgent, ip)
	if err != nil {
		return nil, err
	}

	return sessionEnvelope(*session), nil
}

func (s *Service) Logout(ctx context.Context, token string) error {
	if strings.TrimSpace(token) == "" {
		return nil
	}

	return s.db.WithContext(ctx).
		Model(&model.UserSession{}).
		Where("token_hash = ? AND status = ?", hashToken(token), "active").
		Updates(map[string]any{"status": "revoked"}).Error
}

func (s *Service) AuthenticateToken(ctx context.Context, token string) (*model.User, *model.UserSession, error) {
	if strings.TrimSpace(token) == "" {
		return nil, nil, ErrNotFound
	}

	var session model.UserSession
	if err := s.db.WithContext(ctx).
		Where("token_hash = ? AND status = ?", hashToken(token), "active").
		First(&session).Error; err != nil {
		return nil, nil, ErrNotFound
	}

	if session.ExpiresAt.Before(time.Now()) {
		_ = s.db.WithContext(ctx).Model(&session).Update("status", "expired").Error
		return nil, nil, ErrInvalidState
	}

	user, err := s.resolveUserByID(ctx, session.UserID)
	if err != nil {
		return nil, nil, err
	}
	if user.Status != "active" {
		return nil, nil, ErrInvalidState
	}

	now := time.Now()
	session.LastUsedAt = &now
	_ = s.db.WithContext(ctx).Model(&session).Update("last_used_at", now).Error

	return user, &session, nil
}

func (s *Service) GetMe(ctx context.Context, userID uint) (map[string]any, error) {
	user, err := s.resolveUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"id":               user.ID,
		"email":            user.Email,
		"display_name":     user.DisplayName,
		"role":             user.Role,
		"status":           user.Status,
		"locale":           user.Locale,
		"telegram_user_id": user.TelegramUserID,
		"last_login_at":    user.LastLoginAt,
	}, nil
}

func (s *Service) ListMyOrders(ctx context.Context, userID uint, filters MyOrderFilters) (map[string]any, error) {
	page := filters.Page
	if page <= 0 {
		page = 1
	}
	pageSize := filters.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}

	query := s.db.WithContext(ctx).Model(&model.Order{}).Where("user_id = ?", userID)
	if filters.Status != "" {
		query = query.Where("status = ?", filters.Status)
	}
	if filters.PaymentStatus != "" {
		query = query.Where("payment_status = ?", filters.PaymentStatus)
	}
	if filters.DeliveryStatus != "" {
		query = query.Where("delivery_status = ?", filters.DeliveryStatus)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	var orders []model.Order
	if err := query.Order("created_at DESC, id DESC").Limit(pageSize).Offset((page - 1) * pageSize).Find(&orders).Error; err != nil {
		return nil, err
	}

	items := make([]map[string]any, 0, len(orders))
	for _, order := range orders {
		productSnapshot := parseJSON[map[string]any](order.ProductSnapshot)
		metadata := parseJSON[map[string]any](order.MetadataJSON)
		items = append(items, map[string]any{
			"order_no":        order.OrderNo,
			"order_status":    order.Status,
			"payment_status":  order.PaymentStatus,
			"delivery_status": order.DeliveryStatus,
			"product_name":    stringValue(productSnapshot["name"]),
			"product_sku":     stringValue(productSnapshot["sku"]),
			"template_name":   stringValue(metadata["selected_template_name"]),
			"billing_cycle":   stringValue(metadata["selected_billing_cycle"]),
			"payment_method":  order.PaymentMethod,
			"currency":        order.Currency,
			"display_amount":  formatAmount(order.PayAmount),
			"bot_key":         orderBotKey(order),
			"buyer_ref":       order.BuyerRef,
			"created_at":      order.CreatedAt,
			"paid_at":         order.PaidAt,
			"updated_at":      order.UpdatedAt,
		})
	}

	return map[string]any{
		"items":     items,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	}, nil
}

func (s *Service) GetMyOrderDetail(ctx context.Context, userID uint, orderNo string) (map[string]any, error) {
	order, err := s.resolveOrderByNo(ctx, orderNo)
	if err != nil {
		return nil, err
	}
	if order.UserID == nil || *order.UserID != userID {
		return nil, ErrNotFound
	}

	return s.GetStorefrontOrder(ctx, orderNo)
}

func (s *Service) ListMyTickets(ctx context.Context, userID uint) (map[string]any, error) {
	var tickets []model.SupportTicket
	if err := s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC, id DESC").
		Find(&tickets).Error; err != nil {
		return nil, err
	}

	items := make([]map[string]any, 0, len(tickets))
	for _, ticket := range tickets {
		orderNo := ""
		if ticket.OrderID != nil {
			var order model.Order
			if err := s.db.WithContext(ctx).Select("order_no").Where("id = ?", *ticket.OrderID).First(&order).Error; err == nil {
				orderNo = order.OrderNo
			}
		}

		items = append(items, map[string]any{
			"ticket_no":       ticket.TicketNo,
			"order_no":        orderNo,
			"subject":         ticket.Subject,
			"content":         ticket.Content,
			"priority":        ticket.Priority,
			"status":          ticket.Status,
			"resolution_note": ticket.ResolutionNote,
			"created_at":      ticket.CreatedAt,
			"updated_at":      ticket.UpdatedAt,
		})
	}

	return map[string]any{"items": items}, nil
}

func (s *Service) CreateMyTicket(ctx context.Context, userID uint, input CreateSupportTicketInput) (map[string]any, error) {
	result, err := s.CreateSupportTicket(ctx, input)
	if err != nil {
		return nil, err
	}

	ticketNo := stringValue(result["ticket_no"])
	record, err := s.resolveTicketByNo(ctx, ticketNo)
	if err != nil {
		return nil, err
	}
	record.UserID = &userID
	if err := s.db.WithContext(ctx).Save(record).Error; err != nil {
		return nil, err
	}

	return s.GetAdminTicketDetail(ctx, ticketNo)
}

func (s *Service) createSession(ctx context.Context, user *model.User, scope, userAgent, ip string) (*SessionInfo, error) {
	token, err := generateOpaqueToken()
	if err != nil {
		return nil, err
	}

	expiresAt := time.Now().Add(72 * time.Hour)
	session := model.UserSession{
		UserID:    user.ID,
		TokenHash: hashToken(token),
		Scope:     scope,
		Status:    "active",
		ExpiresAt: expiresAt,
		UserAgent: userAgent,
		IPAddress: ip,
	}
	if err := s.db.WithContext(ctx).Create(&session).Error; err != nil {
		return nil, err
	}

	return &SessionInfo{
		Token:     token,
		UserID:    user.ID,
		Email:     derefEmail(user.Email),
		Name:      user.DisplayName,
		Role:      user.Role,
		Scope:     scope,
		ExpiresAt: expiresAt,
	}, nil
}

func sessionEnvelope(session SessionInfo) map[string]any {
	return map[string]any{
		"token":      session.Token,
		"user_id":    session.UserID,
		"email":      session.Email,
		"name":       session.Name,
		"role":       session.Role,
		"scope":      session.Scope,
		"expires_at": session.ExpiresAt,
	}
}

func derefEmail(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
