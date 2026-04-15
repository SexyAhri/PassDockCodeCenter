package service

import (
	"context"
	"fmt"
	"path/filepath"
	"regexp"
	"strings"

	"passdock/server/internal/model"
)

var telegramOrderNoPattern = regexp.MustCompile(`PD[0-9A-Z]{10,}`)

func (s *Service) handleTelegramProofCommand(
	ctx context.Context,
	botCtx telegramWebhookContext,
	command telegramCommand,
) (telegramReply, error) {
	orderNo := ""
	if len(command.Args) > 0 {
		orderNo = strings.TrimSpace(command.Args[0])
	}
	if orderNo == "" {
		order, err := s.resolveTelegramProofTargetOrder(ctx, botCtx)
		if err != nil {
			return s.telegramProofTargetErrorReply(err), nil
		}
		orderNo = order.OrderNo
	}

	return s.buildTelegramProofPromptReply(ctx, botCtx, orderNo)
}

func (s *Service) buildTelegramProofPromptReply(
	ctx context.Context,
	botCtx telegramWebhookContext,
	orderNo string,
) (telegramReply, error) {
	order, err := s.resolveTelegramAccessibleOrder(ctx, botCtx, orderNo)
	if err != nil {
		return telegramReply{}, err
	}
	if !telegramOrderAcceptsProof(*order) {
		return telegramReply{}, ErrInvalidState
	}

	lines := []string{
		"Payment proof upload",
		"Order: " + order.OrderNo,
		"Reply to this message with a screenshot, photo, or PDF receipt.",
		"You can also send a file with caption: /proof " + order.OrderNo,
	}

	return telegramReply{
		Text: strings.Join(lines, "\n"),
		ReplyMarkup: map[string]any{
			"force_reply": true,
		},
		DisableWebPagePreview: true,
		Meta: map[string]any{
			"order_no": order.OrderNo,
		},
	}, nil
}

func (s *Service) handleTelegramProofUpload(
	ctx context.Context,
	botCtx telegramWebhookContext,
) (telegramReply, error) {
	if botCtx.Media == nil {
		return telegramReply{Text: "Please send a screenshot, photo, or PDF receipt."}, nil
	}

	order, err := s.resolveTelegramProofTargetOrder(ctx, botCtx)
	if err != nil {
		return s.telegramProofTargetErrorReply(err), nil
	}
	if !telegramOrderAcceptsProof(*order) {
		return telegramReply{
			Text: fmt.Sprintf("Order %s cannot accept payment proof in its current state.", order.OrderNo),
		}, nil
	}

	fileRef, err := s.getTelegramFile(ctx, botCtx.BotKey, botCtx.Media.FileID)
	if err != nil {
		return telegramReply{}, err
	}

	raw, err := s.downloadTelegramFile(ctx, botCtx.BotKey, fileRef.FilePath)
	if err != nil {
		return telegramReply{}, err
	}

	saved, err := s.SaveUploadedBytes(ctx, SaveUploadedBytesInput{
		Namespace:    "payment-proofs/telegram",
		OriginalName: telegramMediaOriginalName(order.OrderNo, botCtx.Media, fileRef.FilePath),
		ContentType:  botCtx.Media.ContentType,
		Data:         raw,
	})
	if err != nil {
		if err == ErrInvalidInput {
			return telegramReply{
				Text: "Only JPG, PNG, WEBP, or PDF receipts are supported.",
			}, nil
		}
		return telegramReply{}, err
	}

	note := fmt.Sprintf(
		"Uploaded via Telegram by %s (%s)",
		botCtx.display(),
		firstNonEmpty(botCtx.TelegramUserID, botCtx.Username, botCtx.ChatID),
	)
	if err := s.UploadPaymentProof(ctx, order.OrderNo, UploadPaymentProofInput{
		ProofType: telegramProofType(botCtx.Media),
		ObjectKey: stringValue(saved["object_key"]),
		ObjectURL: stringValue(saved["object_url"]),
		Note:      note,
	}); err != nil {
		return telegramReply{}, err
	}

	autoMarkedPaid := false
	if order.PaymentStatus == "unpaid" && order.Status != "cancelled" && order.Status != "expired" && order.Status != "refunded" {
		if markErr := s.MarkStorefrontOrderPaid(ctx, order.OrderNo); markErr == nil {
			autoMarkedPaid = true
		} else if markErr != ErrInvalidState {
			return telegramReply{}, markErr
		}
	}

	updatedOrder, refreshErr := s.resolveTelegramAccessibleOrder(ctx, botCtx, order.OrderNo)
	if refreshErr != nil && refreshErr != ErrNotFound {
		return telegramReply{}, refreshErr
	}
	if updatedOrder == nil {
		updatedOrder = order
	}

	lines := []string{
		"Payment proof received.",
		"Order: " + updatedOrder.OrderNo,
		fmt.Sprintf("Review: pending (%s)", stringValue(saved["object_key"])),
	}
	if autoMarkedPaid || updatedOrder.PaymentStatus == "pending_review" {
		lines = append(lines, "Status: paid_pending_review / pending_review")
		lines = append(lines, "Our operator can now review your transfer in the admin panel.")
	}

	return telegramReply{
		Text:                  strings.Join(lines, "\n"),
		ReplyMarkup:           s.buildTelegramOrderActionKeyboard(*updatedOrder),
		DisableWebPagePreview: true,
		Meta: map[string]any{
			"order_no":    updatedOrder.OrderNo,
			"object_key":  stringValue(saved["object_key"]),
			"object_url":  stringValue(saved["object_url"]),
			"proof_type":  telegramProofType(botCtx.Media),
			"auto_marked": autoMarkedPaid,
		},
	}, nil
}

func (s *Service) resolveTelegramProofTargetOrder(
	ctx context.Context,
	botCtx telegramWebhookContext,
) (*model.Order, error) {
	if orderNo := extractTelegramOrderNoFromTexts(botCtx.MessageText, botCtx.ReplyToMessage); orderNo != "" {
		return s.resolveTelegramAccessibleOrder(ctx, botCtx, orderNo)
	}

	orders, err := s.listTelegramAccessibleOrders(ctx, botCtx, 10)
	if err != nil {
		return nil, err
	}

	candidates := make([]model.Order, 0, len(orders))
	for _, order := range orders {
		if telegramOrderAcceptsProof(order) {
			candidates = append(candidates, order)
		}
	}

	switch len(candidates) {
	case 0:
		return nil, ErrNotFound
	case 1:
		return &candidates[0], nil
	default:
		return nil, ErrInvalidInput
	}
}

func (s *Service) telegramProofTargetErrorReply(err error) telegramReply {
	switch err {
	case ErrNotFound:
		return telegramReply{
			Text:                  "No matching order was found for this proof. Send it with caption /proof <order_no> or use the Upload Proof button from the order message.",
			ReplyMarkup:           s.buildTelegramHomeKeyboard(),
			DisableWebPagePreview: true,
		}
	case ErrInvalidInput:
		return telegramReply{
			Text:                  "Multiple open orders were found. Please upload again with caption /proof <order_no> so the receipt can be attached to the correct order.",
			ReplyMarkup:           s.buildTelegramHomeKeyboard(),
			DisableWebPagePreview: true,
		}
	default:
		return telegramReply{
			Text:                  "Unable to resolve the target order for this proof.",
			DisableWebPagePreview: true,
		}
	}
}

func (s *Service) isTelegramSupportReply(botCtx telegramWebhookContext) bool {
	return botCtx.Media == nil &&
		strings.TrimSpace(botCtx.MessageText) != "" &&
		parseTelegramCommand(botCtx.MessageText).Name == "" &&
		isTelegramSupportPrompt(botCtx.ReplyToMessage)
}

func (s *Service) handleTelegramSupportReply(
	ctx context.Context,
	botCtx telegramWebhookContext,
) (telegramReply, error) {
	content := strings.TrimSpace(botCtx.MessageText)
	if content == "" {
		return telegramReply{Text: "Support message cannot be empty."}, nil
	}

	orderNo := extractTelegramOrderNoFromTexts(botCtx.ReplyToMessage)
	result, resolvedOrderNo, err := s.submitTelegramSupportTicket(ctx, botCtx, orderNo, content)
	if err != nil {
		if businessText, ok := telegramBusinessErrorText(err); ok {
			return telegramReply{Text: businessText}, nil
		}
		return telegramReply{}, err
	}

	ticketNo := stringValue(result["ticket_no"])
	if ticketNo == "" {
		ticketNo = stringValue(result["id"])
	}

	lines := []string{
		"Support ticket created.",
		"Ticket: " + defaultString(ticketNo, "created"),
	}
	if resolvedOrderNo != "" {
		lines = append(lines, "Order: "+resolvedOrderNo)
	}
	lines = append(lines, "Our team can now follow up from the support center.")

	return telegramReply{
		Text:                  strings.Join(lines, "\n"),
		ReplyMarkup:           s.buildTelegramHomeKeyboard(),
		DisableWebPagePreview: true,
		Meta: map[string]any{
			"ticket_no": ticketNo,
			"order_no":  resolvedOrderNo,
		},
	}, nil
}

func (s *Service) submitTelegramSupportTicket(
	ctx context.Context,
	botCtx telegramWebhookContext,
	orderNo string,
	content string,
) (map[string]any, string, error) {
	resolvedOrderNo := strings.TrimSpace(orderNo)
	subject := "Telegram support request"
	if resolvedOrderNo != "" {
		subject = "Telegram support request for " + resolvedOrderNo
	}

	if resolvedOrderNo != "" {
		order, err := s.resolveTelegramAccessibleOrder(ctx, botCtx, resolvedOrderNo)
		if err != nil {
			return nil, "", err
		}
		result, err := s.CreateStorefrontOrderTicket(ctx, order.OrderNo, CreateSupportTicketInput{
			Subject:  subject,
			Content:  content,
			Priority: "normal",
		})
		return result, order.OrderNo, err
	}

	if botCtx.User != nil {
		result, err := s.CreateMyTicket(ctx, botCtx.User.ID, CreateSupportTicketInput{
			Subject:  subject,
			Content:  content,
			Priority: "normal",
		})
		return result, "", err
	}

	result, err := s.CreateSupportTicket(ctx, CreateSupportTicketInput{
		CustomerName: botCtx.display(),
		Subject:      subject,
		Content: fmt.Sprintf(
			"Requester: %s\nTelegram user: %s\nChat: %s\n\n%s",
			botCtx.display(),
			defaultString(botCtx.TelegramUserID, defaultString(botCtx.Username, "-")),
			defaultString(botCtx.ChatID, "-"),
			content,
		),
		Priority: "normal",
	})
	return result, "", err
}

func extractTelegramOrderNoFromTexts(texts ...string) string {
	for _, text := range texts {
		candidate := strings.ToUpper(strings.TrimSpace(text))
		if candidate == "" {
			continue
		}
		if match := telegramOrderNoPattern.FindString(candidate); match != "" {
			return strings.TrimSpace(match)
		}
	}
	return ""
}

func isTelegramSupportPrompt(text string) bool {
	lower := strings.ToLower(strings.TrimSpace(text))
	return strings.Contains(lower, "support ticket")
}

func telegramProofType(media *telegramMediaAttachment) string {
	if media == nil {
		return "screenshot"
	}
	switch media.Kind {
	case "document":
		return "receipt_file"
	default:
		return "screenshot"
	}
}

func telegramMediaOriginalName(orderNo string, media *telegramMediaAttachment, filePath string) string {
	if media != nil && strings.TrimSpace(media.FileName) != "" {
		return strings.TrimSpace(media.FileName)
	}

	extension := ""
	if media != nil && strings.TrimSpace(media.ContentType) != "" {
		extension = defaultExtensionForContentType(media.ContentType)
	}
	if extension == "" || extension == ".bin" {
		extension = strings.ToLower(filepath.Ext(strings.TrimSpace(filePath)))
	}
	if extension == "" {
		extension = ".jpg"
	}

	return strings.TrimSpace(orderNo) + "-telegram-proof" + extension
}

func telegramOrderAcceptsProof(order model.Order) bool {
	switch order.Status {
	case "cancelled", "expired", "refunded":
		return false
	default:
		return true
	}
}
