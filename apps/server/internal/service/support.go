package service

import (
	"context"
	"time"

	"gorm.io/gorm"

	"passdock/server/internal/model"
)

type CreateSupportTicketInput struct {
	OrderNo      string
	CustomerName string
	Subject      string
	Content      string
	Priority     string
}

func (s *Service) ListStorefrontOrderTickets(ctx context.Context, orderNo string) (map[string]any, error) {
	order, err := s.resolveOrderByNo(ctx, orderNo)
	if err != nil {
		return nil, err
	}

	var tickets []model.SupportTicket
	if err := s.db.WithContext(ctx).
		Where("order_id = ?", order.ID).
		Order("created_at DESC, id DESC").
		Find(&tickets).Error; err != nil {
		return nil, err
	}

	items := make([]map[string]any, 0, len(tickets))
	for _, ticket := range tickets {
		items = append(items, map[string]any{
			"ticket_no":       ticket.TicketNo,
			"subject":         ticket.Subject,
			"content":         ticket.Content,
			"priority":        ticket.Priority,
			"status":          ticket.Status,
			"resolution_note": ticket.ResolutionNote,
			"created_at":      ticket.CreatedAt,
			"updated_at":      ticket.UpdatedAt,
			"resolved_at":     ticket.UpdatedAt,
			"order_no":        order.OrderNo,
			"customer_name":   buildCustomerName(*order),
			"buyer_ref":       order.BuyerRef,
			"payment_status":  order.PaymentStatus,
			"delivery_status": order.DeliveryStatus,
			"order_status":    order.Status,
		})
	}

	return map[string]any{"items": items}, nil
}

func (s *Service) ListPublicStorefrontOrderTickets(
	ctx context.Context,
	orderNo string,
	access StorefrontOrderAccessInput,
) (map[string]any, error) {
	if _, err := s.resolveAuthorizedStorefrontOrder(ctx, orderNo, access); err != nil {
		return nil, err
	}

	return s.ListStorefrontOrderTickets(ctx, orderNo)
}

func (s *Service) CreateStorefrontOrderTicket(
	ctx context.Context,
	orderNo string,
	input CreateSupportTicketInput,
) (map[string]any, error) {
	order, err := s.resolveOrderByNo(ctx, orderNo)
	if err != nil {
		return nil, err
	}

	result, err := s.CreateSupportTicket(ctx, CreateSupportTicketInput{
		OrderNo:      order.OrderNo,
		CustomerName: buildCustomerName(*order),
		Subject:      input.Subject,
		Content:      input.Content,
		Priority:     input.Priority,
	})
	if err != nil {
		return nil, err
	}

	if order.UserID != nil {
		ticketNo := stringValue(result["ticket_no"])
		record, resolveErr := s.resolveTicketByNo(ctx, ticketNo)
		if resolveErr != nil {
			return nil, resolveErr
		}
		record.UserID = order.UserID
		if saveErr := s.db.WithContext(ctx).Save(record).Error; saveErr != nil {
			return nil, saveErr
		}
	}

	return result, nil
}

func (s *Service) CreatePublicStorefrontOrderTicket(
	ctx context.Context,
	orderNo string,
	access StorefrontOrderAccessInput,
	input CreateSupportTicketInput,
) (map[string]any, error) {
	if _, err := s.resolveAuthorizedStorefrontOrder(ctx, orderNo, access); err != nil {
		return nil, err
	}

	return s.CreateStorefrontOrderTicket(ctx, orderNo, input)
}

func (s *Service) ListAdminTickets(ctx context.Context) (map[string]any, error) {
	var tickets []model.SupportTicket
	if err := s.db.WithContext(ctx).
		Order("created_at DESC, id DESC").
		Find(&tickets).Error; err != nil {
		return nil, err
	}

	items := make([]map[string]any, 0, len(tickets))
	for _, ticket := range tickets {
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

		items = append(items, map[string]any{
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
		})
	}

	return map[string]any{"items": items}, nil
}

func (s *Service) GetAdminTicketDetail(ctx context.Context, ticketNo string) (map[string]any, error) {
	ticket, err := s.resolveTicketByNo(ctx, ticketNo)
	if err != nil {
		return nil, err
	}

	customerName := ""
	orderNo := ""
	if ticket.OrderID != nil {
		var order model.Order
		if err := s.db.WithContext(ctx).Where("id = ?", *ticket.OrderID).First(&order).Error; err == nil {
			customerName = buildCustomerName(order)
			orderNo = order.OrderNo
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
		"content":       ticket.Content,
		"customer":      customerName,
		"customer_name": customerName,
		"order_no":      orderNo,
		"priority":      ticket.Priority,
		"status":        ticket.Status,
		"assigned_to":   assignedTo,
		"created_at":    ticket.CreatedAt,
		"updated_at":    ticket.UpdatedAt,
		"resolved_at":   ticket.UpdatedAt,
		"note":          ticket.ResolutionNote,
	}, nil
}

func (s *Service) CreateSupportTicket(ctx context.Context, input CreateSupportTicketInput) (map[string]any, error) {
	if input.Subject == "" || input.Content == "" {
		return nil, ErrInvalidInput
	}

	var orderID *uint
	if input.OrderNo != "" {
		order, err := s.resolveOrderByNo(ctx, input.OrderNo)
		if err != nil {
			return nil, err
		}
		orderID = &order.ID
	}

	ticket := model.SupportTicket{
		TicketNo: ticketNo(),
		OrderID:  orderID,
		Subject:  input.Subject,
		Content:  input.Content,
		Status:   "open",
		Priority: defaultString(input.Priority, "normal"),
	}
	if err := s.db.WithContext(ctx).Create(&ticket).Error; err != nil {
		return nil, err
	}

	return s.GetAdminTicketDetail(ctx, ticket.TicketNo)
}

func (s *Service) createOrUpdateOrderFailureTicketTx(
	ctx context.Context,
	tx *gorm.DB,
	order *model.Order,
	subject string,
	content string,
) (*model.SupportTicket, error) {
	if tx == nil || order == nil {
		return nil, nil
	}
	if subject == "" || content == "" {
		return nil, nil
	}

	var ticket model.SupportTicket
	err := tx.WithContext(ctx).
		Where("order_id = ? AND subject = ? AND status IN ?", order.ID, subject, []string{"open", "processing"}).
		Order("updated_at DESC, id DESC").
		First(&ticket).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		return nil, err
	}

	now := time.Now()
	if ticket.ID == 0 {
		orderID := order.ID
		ticket = model.SupportTicket{
			TicketNo: ticketNo(),
			UserID:   order.UserID,
			OrderID:  &orderID,
			Subject:  subject,
			Content:  content,
			Status:   "open",
			Priority: "high",
		}
		if err := tx.Create(&ticket).Error; err != nil {
			return nil, err
		}
		return &ticket, nil
	}

	ticket.Content = content
	if ticket.Priority == "" || ticket.Priority == "low" || ticket.Priority == "normal" {
		ticket.Priority = "high"
	}
	ticket.UpdatedAt = now
	if err := tx.Save(&ticket).Error; err != nil {
		return nil, err
	}

	return &ticket, nil
}

func (s *Service) AssignAdminTicket(ctx context.Context, ticketNo, assignee string, meta AuditMeta) error {
	if assignee == "" {
		return ErrInvalidInput
	}

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		ticket, err := s.resolveTicketByNo(ctx, ticketNo)
		if err != nil {
			return err
		}

		user, err := s.resolveUserByDisplayName(ctx, assignee)
		if err != nil {
			return err
		}

		ticket.AssignedTo = &user.ID
		ticket.Status = "processing"
		ticket.UpdatedAt = time.Now()
		if err := tx.Save(ticket).Error; err != nil {
			return err
		}

		s.logAdminAction(ctx, tx, meta, "support", "assign_ticket", ticket.TicketNo, "ticket", map[string]any{
			"assigned_to": assignee,
		})
		return nil
	})
}

func (s *Service) ResolveAdminTicket(ctx context.Context, ticketNo, note string, meta AuditMeta) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		ticket, err := s.resolveTicketByNo(ctx, ticketNo)
		if err != nil {
			return err
		}
		if ticket.Status == "resolved" || ticket.Status == "closed" {
			return ErrInvalidState
		}

		ticket.Status = "resolved"
		ticket.ResolutionNote = note
		ticket.UpdatedAt = time.Now()
		if err := tx.Save(ticket).Error; err != nil {
			return err
		}

		s.logAdminAction(ctx, tx, meta, "support", "resolve_ticket", ticket.TicketNo, "ticket", map[string]any{
			"note": note,
		})
		return nil
	})
}
