package model

type SupportTicket struct {
	BaseModel
	TicketNo       string `gorm:"not null;uniqueIndex:uk_support_tickets_ticket_no" json:"ticket_no"`
	UserID         *uint  `gorm:"index:idx_support_tickets_user_id" json:"user_id,omitempty"`
	OrderID        *uint  `gorm:"index:idx_support_tickets_order_id" json:"order_id,omitempty"`
	Subject        string `gorm:"not null" json:"subject"`
	Content        string `gorm:"not null" json:"content"`
	Status         string `gorm:"not null;default:open;index:idx_support_tickets_status_priority,priority:1" json:"status"`
	Priority       string `gorm:"not null;default:normal;index:idx_support_tickets_status_priority,priority:2" json:"priority"`
	AssignedTo     *uint  `gorm:"index:idx_support_tickets_assigned_to" json:"assigned_to,omitempty"`
	ResolutionNote string `json:"resolution_note"`
}
