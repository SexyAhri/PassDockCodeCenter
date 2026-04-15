package service

import (
	"context"
	"fmt"
	"strings"

	"passdock/server/internal/model"
)

type telegramReply struct {
	Text                  string
	ReplyMarkup           any
	ReplyToMessageID      string
	DisableWebPagePreview bool
	CallbackText          string
	CallbackShowAlert     bool
	Meta                  map[string]any
}

func (s *Service) handleTelegramCommandReply(
	ctx context.Context,
	botCtx telegramWebhookContext,
	command telegramCommand,
) (telegramReply, error) {
	if command.Name == "" && strings.TrimSpace(botCtx.ReplyToMessage) != "" && botCtx.Media == nil {
		if strings.Contains(strings.ToLower(botCtx.ReplyToMessage), "payment proof upload") {
			return telegramReply{
				Text: "Please reply with a screenshot, photo, or PDF receipt for the order.",
			}, nil
		}
	}
	if command.Name == "proof" {
		reply, err := s.handleTelegramProofCommand(ctx, botCtx, command)
		if err != nil {
			if businessText, ok := telegramBusinessErrorText(err); ok {
				return telegramReply{
					Text:                  businessText,
					DisableWebPagePreview: true,
				}, nil
			}
			return telegramReply{}, err
		}
		return reply, nil
	}

	text, err := s.handleTelegramCommand(ctx, botCtx, command)
	if err != nil {
		return telegramReply{}, err
	}

	reply := telegramReply{
		Text:                  text,
		DisableWebPagePreview: true,
	}
	if markup, markupErr := s.buildTelegramReplyMarkup(ctx, botCtx, command, text); markupErr == nil {
		reply.ReplyMarkup = markup
	}

	return reply, nil
}

func (s *Service) handleTelegramCallback(
	ctx context.Context,
	botCtx telegramWebhookContext,
	callbackData string,
) (telegramReply, error) {
	trimmed := strings.TrimSpace(callbackData)
	if trimmed == "" {
		return telegramReply{
			CallbackText:      "Action unavailable",
			CallbackShowAlert: true,
		}, nil
	}

	switch {
	case trimmed == "home:shop":
		return s.handleTelegramCommandReply(ctx, botCtx, telegramCommand{Name: "shop"})
	case trimmed == "home:orders":
		return s.handleTelegramCommandReply(ctx, botCtx, telegramCommand{Name: "orders"})
	case trimmed == "home:support":
		reply := s.buildTelegramSupportPromptReply("")
		reply.CallbackText = "Reply with your issue"
		return reply, nil
	case strings.HasPrefix(trimmed, "buy:"):
		sku := strings.TrimSpace(strings.TrimPrefix(trimmed, "buy:"))
		if sku == "" {
			return telegramReply{CallbackText: "Product unavailable", CallbackShowAlert: true}, nil
		}
		return s.handleTelegramCommandReply(ctx, botCtx, telegramCommand{
			Name:    "buy",
			Args:    []string{sku},
			RawArgs: sku,
		})
	case strings.HasPrefix(trimmed, "pay:"):
		return s.handleTelegramPaymentCallback(ctx, botCtx, trimmed)
	case strings.HasPrefix(trimmed, "check:"):
		orderNo := strings.TrimSpace(strings.TrimPrefix(trimmed, "check:"))
		return s.handleTelegramCommandReply(ctx, botCtx, telegramCommand{
			Name:    "check",
			Args:    []string{orderNo},
			RawArgs: orderNo,
		})
	case strings.HasPrefix(trimmed, "code:"):
		orderNo := strings.TrimSpace(strings.TrimPrefix(trimmed, "code:"))
		return s.handleTelegramCommandReply(ctx, botCtx, telegramCommand{
			Name:    "code",
			Args:    []string{orderNo},
			RawArgs: orderNo,
		})
	case strings.HasPrefix(trimmed, "support:"):
		orderNo := strings.TrimSpace(strings.TrimPrefix(trimmed, "support:"))
		reply := s.buildTelegramSupportPromptReply(orderNo)
		reply.CallbackText = "Reply with your message"
		return reply, nil
	default:
		return telegramReply{
			CallbackText:      "Action unavailable",
			CallbackShowAlert: true,
		}, nil
	}
}

func (s *Service) handleTelegramPaymentCallback(
	ctx context.Context,
	botCtx telegramWebhookContext,
	callbackData string,
) (telegramReply, error) {
	parts := strings.Split(strings.TrimSpace(callbackData), ":")
	if len(parts) < 3 {
		return telegramReply{CallbackText: "Action unavailable", CallbackShowAlert: true}, nil
	}

	orderNo := strings.TrimSpace(parts[1])
	action := strings.ToLower(strings.TrimSpace(parts[2]))
	switch action {
	case "guide":
		return s.handleTelegramCommandReply(ctx, botCtx, telegramCommand{
			Name:    "pay",
			Args:    []string{orderNo},
			RawArgs: orderNo,
		})
	case "paid":
		return s.handleTelegramCommandReply(ctx, botCtx, telegramCommand{
			Name:    "pay",
			Args:    []string{orderNo, "paid"},
			RawArgs: orderNo + " paid",
		})
	case "cancel":
		return s.handleTelegramCommandReply(ctx, botCtx, telegramCommand{
			Name:    "pay",
			Args:    []string{orderNo, "cancel"},
			RawArgs: orderNo + " cancel",
		})
	case "proof":
		reply, err := s.buildTelegramProofPromptReply(ctx, botCtx, orderNo)
		if err != nil {
			if businessText, ok := telegramBusinessErrorText(err); ok {
				return telegramReply{CallbackText: businessText, CallbackShowAlert: true}, nil
			}
			return telegramReply{}, err
		}
		reply.CallbackText = "Send screenshot or PDF"
		return reply, nil
	default:
		return telegramReply{CallbackText: "Action unavailable", CallbackShowAlert: true}, nil
	}
}

func (s *Service) buildTelegramReplyMarkup(
	ctx context.Context,
	botCtx telegramWebhookContext,
	command telegramCommand,
	text string,
) (any, error) {
	switch command.Name {
	case "", "help", "start":
		return s.buildTelegramHomeKeyboard(), nil
	case "shop":
		return s.buildTelegramShopKeyboard(ctx)
	case "orders":
		orders, err := s.listTelegramAccessibleOrders(ctx, botCtx, 5)
		if err != nil {
			return nil, err
		}
		return s.buildTelegramOrdersKeyboard(orders), nil
	case "buy", "pay", "check", "code":
		orderNo := extractTelegramOrderNoFromTexts(strings.TrimSpace(text), strings.TrimSpace(command.RawArgs))
		if orderNo == "" {
			return s.buildTelegramHomeKeyboard(), nil
		}

		order, err := s.resolveTelegramAccessibleOrder(ctx, botCtx, orderNo)
		if err != nil {
			if err == ErrNotFound {
				return s.buildTelegramHomeKeyboard(), nil
			}
			return nil, err
		}
		return s.buildTelegramOrderActionKeyboard(*order), nil
	case "support":
		return s.buildTelegramHomeKeyboard(), nil
	default:
		return s.buildTelegramHomeKeyboard(), nil
	}
}

func (s *Service) buildTelegramHomeKeyboard() any {
	rows := [][]map[string]any{
		{
			telegramCallbackButton("Shop", "home:shop"),
			telegramCallbackButton("My Orders", "home:orders"),
		},
		{
			telegramCallbackButton("Support", "home:support"),
		},
	}
	if shopURL := s.telegramShopURL(); shopURL != "" {
		rows = append(rows, []map[string]any{telegramURLButton("Open Website", shopURL)})
	}
	return telegramInlineKeyboard(rows...)
}

func (s *Service) buildTelegramShopKeyboard(ctx context.Context) (any, error) {
	products, err := s.listTelegramShopProducts(ctx)
	if err != nil {
		return nil, err
	}

	rows := make([][]map[string]any, 0, len(products)+2)
	for _, item := range products {
		rows = append(rows, []map[string]any{
			telegramCallbackButton(fmt.Sprintf("Buy %s", item.Product.Name), "buy:"+item.Product.SKU),
		})
	}
	rows = append(rows, []map[string]any{
		telegramCallbackButton("My Orders", "home:orders"),
		telegramCallbackButton("Support", "home:support"),
	})
	if shopURL := s.telegramShopURL(); shopURL != "" {
		rows = append(rows, []map[string]any{telegramURLButton("Open Website", shopURL)})
	}

	return telegramInlineKeyboard(rows...), nil
}

func (s *Service) buildTelegramOrdersKeyboard(orders []model.Order) any {
	rows := make([][]map[string]any, 0, len(orders)+2)
	for _, order := range orders {
		buttons := []map[string]any{
			telegramCallbackButton("Check "+shortTelegramOrderNo(order.OrderNo), "check:"+order.OrderNo),
		}
		if order.DeliveryStatus == "sent" || order.Status == "completed" || order.Status == "delivered" {
			buttons = append(buttons, telegramCallbackButton("Code", "code:"+order.OrderNo))
		} else if order.PaymentStatus != "paid" && order.Status != "cancelled" && order.Status != "expired" {
			buttons = append(buttons, telegramCallbackButton("Pay", "pay:"+order.OrderNo+":guide"))
		}
		rows = append(rows, buttons)
	}
	rows = append(rows, []map[string]any{
		telegramCallbackButton("Shop", "home:shop"),
		telegramCallbackButton("Support", "home:support"),
	})
	return telegramInlineKeyboard(rows...)
}

func (s *Service) buildTelegramOrderActionKeyboard(order model.Order) any {
	rows := make([][]map[string]any, 0, 4)

	switch {
	case order.Status == "cancelled" || order.Status == "expired" || order.Status == "refunded":
		rows = append(rows, []map[string]any{
			telegramCallbackButton("Shop", "home:shop"),
			telegramCallbackButton("Support", "home:support"),
		})
	case order.PaymentStatus != "paid" && order.Status != "cancelled" && order.Status != "expired" && order.Status != "refunded":
		rows = append(rows, []map[string]any{
			telegramCallbackButton("I Have Paid", "pay:"+order.OrderNo+":paid"),
			telegramCallbackButton("Upload Proof", "pay:"+order.OrderNo+":proof"),
		})
		rows = append(rows, []map[string]any{
			telegramCallbackButton("Refresh Status", "check:"+order.OrderNo),
			telegramCallbackButton("Cancel Order", "pay:"+order.OrderNo+":cancel"),
		})
	case order.DeliveryStatus == "sent" || order.Status == "completed" || order.Status == "delivered":
		rows = append(rows, []map[string]any{
			telegramCallbackButton("View Code", "code:"+order.OrderNo),
			telegramCallbackButton("Refresh Status", "check:"+order.OrderNo),
		})
		rows = append(rows, []map[string]any{
			telegramCallbackButton("Contact Support", "support:"+order.OrderNo),
		})
	default:
		rows = append(rows, []map[string]any{
			telegramCallbackButton("Refresh Status", "check:"+order.OrderNo),
		})
		if order.PaymentStatus == "pending_review" {
			rows = append(rows, []map[string]any{
				telegramCallbackButton("Upload Proof", "pay:"+order.OrderNo+":proof"),
				telegramCallbackButton("Contact Support", "support:"+order.OrderNo),
			})
		} else {
			rows = append(rows, []map[string]any{
				telegramCallbackButton("View Code", "code:"+order.OrderNo),
				telegramCallbackButton("Contact Support", "support:"+order.OrderNo),
			})
		}
	}

	if orderURL := s.telegramOrderURL(order.OrderNo); orderURL != "" {
		rows = append(rows, []map[string]any{
			telegramURLButton("Open Website", orderURL),
		})
	}

	return telegramInlineKeyboard(rows...)
}

func (s *Service) buildTelegramSupportPromptReply(orderNo string) telegramReply {
	lines := []string{"Support ticket"}
	if strings.TrimSpace(orderNo) != "" {
		lines = append(lines, "Order: "+strings.TrimSpace(orderNo))
	}
	lines = append(lines, "Reply to this message with your issue and our team will receive it in the support center.")

	return telegramReply{
		Text: strings.Join(lines, "\n"),
		ReplyMarkup: map[string]any{
			"force_reply": true,
		},
		DisableWebPagePreview: true,
		Meta: map[string]any{
			"order_no": strings.TrimSpace(orderNo),
		},
	}
}

func telegramInlineKeyboard(rows ...[]map[string]any) any {
	inlineRows := make([]any, 0, len(rows))
	for _, row := range rows {
		buttons := make([]any, 0, len(row))
		for _, button := range row {
			if len(button) == 0 {
				continue
			}
			buttons = append(buttons, button)
		}
		if len(buttons) == 0 {
			continue
		}
		inlineRows = append(inlineRows, buttons)
	}
	if len(inlineRows) == 0 {
		return nil
	}
	return map[string]any{"inline_keyboard": inlineRows}
}

func telegramCallbackButton(text string, callbackData string) map[string]any {
	return map[string]any{
		"text":          strings.TrimSpace(text),
		"callback_data": strings.TrimSpace(callbackData),
	}
}

func telegramURLButton(text string, url string) map[string]any {
	return map[string]any{
		"text": strings.TrimSpace(text),
		"url":  strings.TrimSpace(url),
	}
}

func shortTelegramOrderNo(orderNo string) string {
	trimmed := strings.TrimSpace(orderNo)
	if len(trimmed) <= 8 {
		return trimmed
	}
	return trimmed[len(trimmed)-8:]
}
