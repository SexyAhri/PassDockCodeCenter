package service

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"gorm.io/gorm"

	"passdock/server/internal/model"
)

type telegramShopProduct struct {
	Product         model.Product
	PreviewPrice    float64
	PreviewCurrency string
	PaymentMethods  []string
}

type telegramPurchaseSelection struct {
	Product       *model.Product
	PriceID       string
	PaymentMethod string
	Currency      string
}

func (s *Service) handleTelegramCommand(
	ctx context.Context,
	botCtx telegramWebhookContext,
	command telegramCommand,
) (string, error) {
	var (
		text string
		err  error
	)

	switch command.Name {
	case "", "help":
		text = s.telegramHelpText(botCtx)
	case "start":
		text, err = s.handleTelegramStart(ctx, botCtx, command)
	case "bind":
		text, err = s.handleTelegramBind(ctx, botCtx, command)
	case "shop":
		text, err = s.handleTelegramShop(ctx)
	case "buy":
		text, err = s.handleTelegramBuy(ctx, botCtx, command)
	case "orders":
		text, err = s.handleTelegramOrders(ctx, botCtx, command)
	case "pay":
		text, err = s.handleTelegramPay(ctx, botCtx, command)
	case "check":
		text, err = s.handleTelegramCheck(ctx, botCtx, command)
	case "code":
		text, err = s.handleTelegramCode(ctx, botCtx, command)
	case "support":
		text, err = s.handleTelegramSupport(ctx, botCtx, command)
	default:
		text = s.telegramHelpText(botCtx)
	}

	if err != nil {
		if businessText, ok := telegramBusinessErrorText(err); ok {
			return businessText, nil
		}
		return "", err
	}

	return strings.TrimSpace(text), nil
}

func (s *Service) handleTelegramStart(
	ctx context.Context,
	botCtx telegramWebhookContext,
	command telegramCommand,
) (string, error) {
	if email := parseTelegramBindEmail(command.Args); email != "" {
		return s.bindTelegramAccount(ctx, botCtx, email)
	}

	lines := []string{
		fmt.Sprintf("Welcome to PassDock, %s.", botCtx.display()),
	}
	if botCtx.Binding != nil {
		lines = append(lines, fmt.Sprintf("Telegram is already bound to %s.", s.telegramBoundIdentity(botCtx)))
	} else {
		lines = append(lines, "Telegram is not bound yet.")
		lines = append(lines, "Bind your account with /bind your@email.com")
	}
	lines = append(lines, "Commands: /shop /buy /orders /pay /proof /check /code /support")
	if shopURL := s.telegramShopURL(); shopURL != "" {
		lines = append(lines, "Website: "+shopURL)
	}

	return strings.Join(lines, "\n"), nil
}

func (s *Service) handleTelegramBind(
	ctx context.Context,
	botCtx telegramWebhookContext,
	command telegramCommand,
) (string, error) {
	if email := parseTelegramBindEmail(command.Args); email != "" {
		return s.bindTelegramAccount(ctx, botCtx, email)
	}

	if botCtx.Binding != nil {
		return fmt.Sprintf("Telegram is already bound to %s.", s.telegramBoundIdentity(botCtx)), nil
	}

	return "Usage: /bind your@email.com", nil
}

func (s *Service) bindTelegramAccount(
	ctx context.Context,
	botCtx telegramWebhookContext,
	email string,
) (string, error) {
	result, err := s.BindTelegramUser(ctx, botCtx.BotKey, TelegramBindInput{
		Email:            email,
		DisplayName:      botCtx.display(),
		TelegramUserID:   botCtx.TelegramUserID,
		TelegramUsername: botCtx.Username,
		ChatID:           botCtx.ChatID,
	})
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return "No PassDock account was found for that email.", nil
		}
		return "", err
	}

	displayName := stringValue(result["display_name"])
	if displayName == "" {
		displayName = botCtx.display()
	}

	return fmt.Sprintf(
		"Telegram binding saved.\nAccount: %s\nBot key: %s\nUse /shop or /orders to continue.",
		displayName,
		stringValue(result["bot_key"]),
	), nil
}

func (s *Service) handleTelegramShop(ctx context.Context) (string, error) {
	products, err := s.listTelegramShopProducts(ctx)
	if err != nil {
		return "", err
	}
	if len(products) == 0 {
		return "No products are available right now.", nil
	}

	lines := []string{"Available products:"}
	for _, item := range products {
		lines = append(lines, fmt.Sprintf(
			"%s | %s | %s %s",
			item.Product.SKU,
			item.Product.Name,
			formatAmount(item.PreviewPrice),
			defaultString(item.PreviewCurrency, item.Product.Currency),
		))
		if len(item.PaymentMethods) > 0 {
			lines = append(lines, "Methods: "+strings.Join(mapTelegramPaymentLabels(item.PaymentMethods), ", "))
		}
	}
	lines = append(lines, "Buy: /buy <sku> [okx_usdt|wechat_qr|alipay_qr] [qty]")
	if shopURL := s.telegramShopURL(); shopURL != "" {
		lines = append(lines, "Website: "+shopURL)
	}

	return strings.Join(lines, "\n"), nil
}

func (s *Service) handleTelegramBuy(
	ctx context.Context,
	botCtx telegramWebhookContext,
	command telegramCommand,
) (string, error) {
	if len(command.Args) == 0 {
		shopText, err := s.handleTelegramShop(ctx)
		if err != nil {
			return "", err
		}
		return "Usage: /buy <sku> [payment_method] [qty]\n" + shopText, nil
	}

	quantity := 1
	if len(command.Args) >= 3 {
		parsed, err := strconv.Atoi(strings.TrimSpace(command.Args[2]))
		if err != nil || parsed <= 0 {
			return "Quantity must be a positive integer. Example: /buy pro-monthly okx_usdt 1", nil
		}
		quantity = parsed
	}

	selection, err := s.resolveTelegramPurchaseSelection(ctx, command.Args[0], firstCommandArg(command.Args, 1))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return "Product not found. Use /shop to view the available SKUs.", nil
		}
		if errors.Is(err, ErrInvalidInput) {
			return "This product does not support the selected payment method.", nil
		}
		return "", err
	}

	orderData, err := s.CreateOrder(ctx, CreateOrderInput{
		UserID:        botCtx.userID(),
		ProductID:     selection.Product.ID,
		PriceID:       selection.PriceID,
		PaymentMethod: selection.PaymentMethod,
		SourceChannel: "telegram",
		BotKey:        botCtx.BotKey,
		BuyerRef:      botCtx.buyerRef(),
		Quantity:      quantity,
		Currency:      selection.Currency,
	})
	if err != nil {
		switch {
		case errors.Is(err, ErrInsufficientInventory):
			return "This product is out of stock right now.", nil
		case errors.Is(err, ErrInvalidInput):
			return "The order request is invalid. Use /shop to review product and payment method options.", nil
		default:
			return "", err
		}
	}

	orderNo := stringValue(orderData["order_no"])
	productName := selection.Product.Name
	lines := []string{
		"Order created.",
		fmt.Sprintf("Order: %s", orderNo),
		fmt.Sprintf("Product: %s", productName),
	}
	lines = append(lines, s.telegramPaymentGuideLines(orderNo, productName, orderData)...)

	return strings.Join(lines, "\n"), nil
}

func (s *Service) handleTelegramOrders(
	ctx context.Context,
	botCtx telegramWebhookContext,
	command telegramCommand,
) (string, error) {
	limit := 5
	if len(command.Args) > 0 {
		if parsed, err := strconv.Atoi(strings.TrimSpace(command.Args[0])); err == nil && parsed > 0 {
			if parsed > 10 {
				parsed = 10
			}
			limit = parsed
		}
	}

	orders, err := s.listTelegramAccessibleOrders(ctx, botCtx, limit)
	if err != nil {
		return "", err
	}
	if len(orders) == 0 {
		return "No orders found. Use /shop or /buy to create your first order.", nil
	}

	lines := []string{"Recent orders:"}
	for _, order := range orders {
		lines = append(lines, fmt.Sprintf(
			"%s | %s | %s %s",
			order.OrderNo,
			defaultString(s.orderProductName(order), "Product"),
			formatAmount(order.PayAmount),
			order.Currency,
		))
		lines = append(lines, fmt.Sprintf(
			"Status: %s / %s / %s",
			order.Status,
			order.PaymentStatus,
			order.DeliveryStatus,
		))
	}
	lines = append(lines, "Check one order: /check <order_no>")

	return strings.Join(lines, "\n"), nil
}

func (s *Service) handleTelegramPay(
	ctx context.Context,
	botCtx telegramWebhookContext,
	command telegramCommand,
) (string, error) {
	if len(command.Args) == 0 {
		orders, err := s.listTelegramAccessibleOrders(ctx, botCtx, 8)
		if err != nil {
			return "", err
		}

		lines := []string{"Pending payment orders:"}
		count := 0
		for _, order := range orders {
			if order.PaymentStatus == "paid" || order.Status == "completed" || order.Status == "cancelled" || order.Status == "expired" || order.Status == "refunded" {
				continue
			}
			lines = append(lines, fmt.Sprintf(
				"%s | %s | %s %s | %s",
				order.OrderNo,
				defaultString(s.orderProductName(order), "Product"),
				formatAmount(order.PayAmount),
				order.Currency,
				paymentMethodLabel(order.PaymentMethod),
			))
			count++
		}
		if count == 0 {
			return "No payment-pending orders were found. Use /orders to review your full history.", nil
		}
		lines = append(lines, "Show payment guide: /pay <order_no>")
		lines = append(lines, "After payment: /pay <order_no> paid")
		lines = append(lines, "Cancel order: /pay <order_no> cancel")
		return strings.Join(lines, "\n"), nil
	}

	order, err := s.resolveTelegramAccessibleOrder(ctx, botCtx, command.Args[0])
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return "Order not found or not accessible from this Telegram account.", nil
		}
		return "", err
	}

	action := strings.ToLower(strings.TrimSpace(firstCommandArg(command.Args, 1)))
	switch action {
	case "", "show", "guide":
		orderData, err := s.GetStorefrontOrder(ctx, order.OrderNo)
		if err != nil {
			return "", err
		}
		return strings.Join(s.telegramPaymentGuideLines(order.OrderNo, s.orderProductName(*order), orderData), "\n"), nil
	case "paid", "mark", "done", "confirm":
		switch order.PaymentStatus {
		case "paid":
			return fmt.Sprintf("Order %s is already confirmed as paid. Use /code %s to open the delivery result.", order.OrderNo, order.OrderNo), nil
		case "pending_review":
			return fmt.Sprintf("Order %s is already waiting for manual review. Use /check %s for the latest status.", order.OrderNo, order.OrderNo), nil
		}

		if err := s.MarkStorefrontOrderPaid(ctx, order.OrderNo); err != nil {
			if errors.Is(err, ErrInvalidState) {
				return fmt.Sprintf("Order %s can no longer be marked as paid.", order.OrderNo), nil
			}
			return "", err
		}

		return fmt.Sprintf(
			"Payment submitted for review.\nOrder: %s\nStatus: paid_pending_review / pending_review\nUse /check %s to refresh the status.",
			order.OrderNo,
			order.OrderNo,
		), nil
	case "cancel":
		if err := s.CancelStorefrontOrder(ctx, order.OrderNo); err != nil {
			if errors.Is(err, ErrInvalidState) {
				return fmt.Sprintf("Order %s cannot be cancelled in the current state.", order.OrderNo), nil
			}
			return "", err
		}

		return fmt.Sprintf("Order %s has been cancelled.", order.OrderNo), nil
	default:
		return "Usage: /pay <order_no> [paid|cancel]", nil
	}
}

func (s *Service) handleTelegramCheck(
	ctx context.Context,
	botCtx telegramWebhookContext,
	command telegramCommand,
) (string, error) {
	var (
		order *model.Order
		err   error
	)

	if len(command.Args) > 0 {
		order, err = s.resolveTelegramAccessibleOrder(ctx, botCtx, command.Args[0])
	} else {
		var orders []model.Order
		orders, err = s.listTelegramAccessibleOrders(ctx, botCtx, 1)
		if err == nil && len(orders) > 0 {
			order = &orders[0]
		}
		if err == nil && order == nil {
			return "No orders found. Use /shop or /buy to create one first.", nil
		}
	}
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return "Order not found or not accessible from this Telegram account.", nil
		}
		return "", err
	}

	lines := []string{
		fmt.Sprintf("Order: %s", order.OrderNo),
		fmt.Sprintf("Product: %s", defaultString(s.orderProductName(*order), "Product")),
		fmt.Sprintf("Amount: %s %s", formatAmount(order.PayAmount), order.Currency),
		fmt.Sprintf("Order status: %s", order.Status),
		fmt.Sprintf("Payment: %s", order.PaymentStatus),
		fmt.Sprintf("Delivery: %s", order.DeliveryStatus),
		fmt.Sprintf("Created: %s", formatTelegramTime(&order.CreatedAt)),
	}
	if order.PaidAt != nil {
		lines = append(lines, fmt.Sprintf("Paid: %s", formatTelegramTime(order.PaidAt)))
	}
	if order.DeliveredAt != nil {
		lines = append(lines, fmt.Sprintf("Delivered: %s", formatTelegramTime(order.DeliveredAt)))
	}
	if next := s.telegramNextAction(*order); next != "" {
		lines = append(lines, "Next: "+next)
	}
	if orderURL := s.telegramOrderURL(order.OrderNo); orderURL != "" {
		lines = append(lines, "Website: "+orderURL)
	}

	return strings.Join(lines, "\n"), nil
}

func (s *Service) handleTelegramCode(
	ctx context.Context,
	botCtx telegramWebhookContext,
	command telegramCommand,
) (string, error) {
	var (
		order *model.Order
		err   error
	)

	if len(command.Args) > 0 {
		order, err = s.resolveTelegramAccessibleOrder(ctx, botCtx, command.Args[0])
	} else {
		orders, listErr := s.listTelegramAccessibleOrders(ctx, botCtx, 10)
		if listErr != nil {
			return "", listErr
		}
		for index := range orders {
			if orders[index].PaymentStatus == "paid" || orders[index].DeliveryStatus == "sent" || orders[index].Status == "completed" || orders[index].Status == "delivery_pending" {
				order = &orders[index]
				break
			}
		}
		if order == nil && len(orders) > 0 {
			order = &orders[0]
		}
		if order == nil {
			return "No orders found. Use /orders to review your history.", nil
		}
	}
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return "Order not found or not accessible from this Telegram account.", nil
		}
		return "", err
	}

	view, err := s.getTelegramOrderDeliveryView(ctx, order)
	if err != nil {
		return "", err
	}

	if len(view.Codes) == 0 && strings.TrimSpace(view.PlainContent) == "" {
		switch {
		case order.PaymentStatus != "paid":
			return fmt.Sprintf("Order %s is not confirmed as paid yet. Use /pay %s or /check %s first.", order.OrderNo, order.OrderNo, order.OrderNo), nil
		case order.Status == "payment_confirmed" || order.Status == "issuing" || order.Status == "delivery_pending":
			return fmt.Sprintf("Order %s is still being fulfilled. Use /check %s again shortly.", order.OrderNo, order.OrderNo), nil
		case order.DeliveryStatus == "failed" || order.Status == "failed":
			return fmt.Sprintf("Order %s encountered a delivery problem. Contact support with /support %s <message>.", order.OrderNo, order.OrderNo), nil
		default:
			return fmt.Sprintf("No delivery content is available for %s yet. Use /check %s for the latest status.", order.OrderNo, order.OrderNo), nil
		}
	}

	lines := []string{
		fmt.Sprintf("Delivery result for %s", order.OrderNo),
		fmt.Sprintf("Product: %s", defaultString(s.orderProductName(*order), "Product")),
	}
	if view.DeliveredAt != nil {
		lines = append(lines, fmt.Sprintf("Delivered at: %s", formatTelegramTime(view.DeliveredAt)))
	}
	if len(view.Codes) > 0 {
		lines = append(lines, "Codes:")
		lines = append(lines, view.Codes...)
	} else if strings.TrimSpace(view.PlainContent) != "" {
		lines = append(lines, "Content:")
		lines = append(lines, view.PlainContent)
	}

	return strings.Join(lines, "\n"), nil
}

func (s *Service) handleTelegramSupport(
	ctx context.Context,
	botCtx telegramWebhookContext,
	command telegramCommand,
) (string, error) {
	if strings.TrimSpace(command.RawArgs) == "" {
		return "Usage: /support <order_no> <message>\nOr: /support <message>", nil
	}

	var (
		orderNo string
		content string
	)
	if len(command.Args) > 1 && looksLikeOrderNo(command.Args[0]) {
		orderNo = strings.TrimSpace(command.Args[0])
		content = strings.TrimSpace(strings.Join(command.Args[1:], " "))
	} else {
		content = strings.TrimSpace(command.RawArgs)
	}
	if content == "" {
		return "Support message cannot be empty.", nil
	}

	result, resolvedOrderNo, err := s.submitTelegramSupportTicket(ctx, botCtx, orderNo, content)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return "Order not found or not accessible from this Telegram account.", nil
		}
		return "", err
	}

	ticketNo := stringValue(result["ticket_no"])
	if ticketNo == "" {
		ticketNo = stringValue(result["id"])
	}

	lines := []string{
		"Support ticket created.",
		fmt.Sprintf("Ticket: %s", defaultString(ticketNo, "created")),
	}
	if resolvedOrderNo != "" {
		lines = append(lines, "Order: "+resolvedOrderNo)
	}
	lines = append(lines, "Our team can now follow up from the support center.")

	return strings.Join(lines, "\n"), nil
}

func (s *Service) listTelegramShopProducts(ctx context.Context) ([]telegramShopProduct, error) {
	var products []model.Product
	if err := s.db.WithContext(ctx).
		Preload("ProductPrices", func(db *gorm.DB) *gorm.DB {
			return db.Where("enabled = ?", true).Order("sort_order ASC, id ASC")
		}).
		Where("enabled = ?", true).
		Order("sort_order ASC, id ASC").
		Find(&products).Error; err != nil {
		return nil, err
	}

	result := make([]telegramShopProduct, 0, len(products))
	for _, product := range products {
		meta := parseJSON[productMetadata](product.MetadataJSON)
		methods := normalizeStringList(meta.PaymentMethods, nil)
		previewPrice := product.DisplayPrice
		previewCurrency := product.Currency
		if len(product.ProductPrices) > 0 {
			previewPrice = product.ProductPrices[0].Amount
			previewCurrency = defaultString(product.ProductPrices[0].Currency, product.Currency)
			if len(methods) == 0 {
				methods = []string{product.ProductPrices[0].PaymentMethod}
			}
		}

		result = append(result, telegramShopProduct{
			Product:         product,
			PreviewPrice:    previewPrice,
			PreviewCurrency: previewCurrency,
			PaymentMethods:  methods,
		})
	}

	return result, nil
}

func (s *Service) resolveTelegramPurchaseSelection(
	ctx context.Context,
	productRoute string,
	requestedMethod string,
) (telegramPurchaseSelection, error) {
	product, err := s.resolveProductByRoute(ctx, strings.TrimSpace(productRoute))
	if err != nil {
		return telegramPurchaseSelection{}, err
	}
	if !product.Enabled {
		return telegramPurchaseSelection{}, ErrNotFound
	}

	var prices []model.ProductPrice
	if err := s.db.WithContext(ctx).
		Where("product_id = ? AND enabled = ?", product.ID, true).
		Order("sort_order ASC, id ASC").
		Find(&prices).Error; err != nil {
		return telegramPurchaseSelection{}, err
	}

	meta := parseJSON[productMetadata](product.MetadataJSON)
	method := normalizeTelegramPaymentMethod(requestedMethod)
	if method == "" {
		if len(prices) > 0 {
			method = prices[0].PaymentMethod
		} else {
			method = firstPaymentMethod(meta.PaymentMethods)
		}
	}
	if len(meta.PaymentMethods) > 0 && !stringListContains(meta.PaymentMethods, method) {
		return telegramPurchaseSelection{}, ErrInvalidInput
	}

	selection := telegramPurchaseSelection{
		Product:       product,
		PaymentMethod: method,
		Currency:      product.Currency,
	}
	for _, price := range prices {
		if strings.TrimSpace(price.PaymentMethod) != method {
			continue
		}
		selection.PriceID = fmt.Sprintf("%d", price.ID)
		selection.Currency = defaultString(price.Currency, product.Currency)
		break
	}

	return selection, nil
}

func (s *Service) telegramHelpText(botCtx telegramWebhookContext) string {
	lines := []string{
		fmt.Sprintf("PassDock bot ready for %s.", botCtx.display()),
		"/shop list products",
		"/buy <sku> [payment_method] [qty] create an order",
		"/orders [count] view recent orders",
		"/pay <order_no> show payment guide",
		"/pay <order_no> paid mark a payment as submitted",
		"/proof <order_no> upload a receipt by replying with a screenshot or PDF",
		"/check <order_no> view order status",
		"/code <order_no> reopen the delivery result",
		"/support <order_no> <message> create a support ticket",
	}
	if botCtx.Binding == nil {
		lines = append(lines, "/bind your@email.com bind a PassDock account")
	}

	return strings.Join(lines, "\n")
}

func telegramBusinessErrorText(err error) (string, bool) {
	switch {
	case errors.Is(err, ErrNotFound):
		return "The requested resource was not found.", true
	case errors.Is(err, ErrInvalidInput):
		return "The command arguments are invalid. Use /help to review the supported commands.", true
	case errors.Is(err, ErrInvalidState):
		return "This action is not available for the current order state.", true
	case errors.Is(err, ErrInsufficientInventory):
		return "This product is out of stock right now.", true
	default:
		return "", false
	}
}

func parseTelegramBindEmail(args []string) string {
	if len(args) == 0 {
		return ""
	}

	candidate := strings.TrimSpace(args[0])
	candidate = strings.TrimPrefix(candidate, "bind=")
	candidate = strings.TrimPrefix(candidate, "email=")
	if !looksLikeEmail(candidate) {
		return ""
	}

	return candidate
}

func looksLikeEmail(value string) bool {
	trimmed := strings.TrimSpace(value)
	at := strings.Index(trimmed, "@")
	dot := strings.LastIndex(trimmed, ".")
	return at > 0 && dot > at+1 && dot < len(trimmed)-1
}

func looksLikeOrderNo(value string) bool {
	trimmed := strings.ToUpper(strings.TrimSpace(value))
	return strings.HasPrefix(trimmed, "PD") && len(trimmed) >= 10
}

func firstCommandArg(args []string, index int) string {
	if index < 0 || index >= len(args) {
		return ""
	}
	return strings.TrimSpace(args[index])
}

func normalizeTelegramPaymentMethod(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", "auto":
		return ""
	case "wechat", "wx", "wechat_qr", "wechat-qr":
		return "wechat_qr"
	case "alipay", "ali", "alipay_qr", "alipay-qr":
		return "alipay_qr"
	case "okx", "okx_usdt", "okx-usdt":
		return "okx_usdt"
	default:
		return strings.TrimSpace(value)
	}
}

func paymentMethodLabel(method string) string {
	switch strings.TrimSpace(method) {
	case "alipay_qr":
		return "Alipay QR"
	case "okx_usdt":
		return "OKX USDT"
	default:
		return "WeChat QR"
	}
}

func mapTelegramPaymentLabels(methods []string) []string {
	result := make([]string, 0, len(methods))
	for _, method := range methods {
		result = append(result, paymentMethodLabel(method))
	}
	return result
}

func (s *Service) telegramPaymentGuideLines(orderNo, productName string, orderData map[string]any) []string {
	instruction, _ := orderData["payment_instruction"].(map[string]any)
	amount := stringValue(orderData["display_amount"])
	currency := defaultString(stringValue(orderData["currency"]), stringValue(instruction["currency"]))
	channel := paymentMethodLabel(stringValue(orderData["payment_method"]))
	reference := stringValue(instruction["reference"])
	qrContent := stringValue(instruction["qr_content"])

	lines := []string{
		fmt.Sprintf("Payment for %s", orderNo),
		fmt.Sprintf("Product: %s", defaultString(productName, "Product")),
		fmt.Sprintf("Amount: %s %s", amount, currency),
		fmt.Sprintf("Channel: %s", channel),
	}
	if reference != "" {
		lines = append(lines, "Reference: "+reference)
	}
	if qrContent != "" {
		lines = append(lines, "Pay value: "+qrContent)
	}
	if stringValue(orderData["payment_method"]) == "okx_usdt" {
		lines = append(lines, "OKX watcher will auto-confirm matched on-chain payment.")
		lines = append(lines, "If the watcher is delayed, you can still submit proof: /proof "+orderNo)
	} else {
		lines = append(lines, "After payment: /pay "+orderNo+" paid")
		lines = append(lines, "Upload proof: /proof "+orderNo)
		lines = append(lines, "WeChat and Alipay stay on manual review until an API channel is connected.")
	}
	lines = append(lines, "Check status: /check "+orderNo)
	if orderURL := s.telegramOrderURL(orderNo); orderURL != "" {
		lines = append(lines, "Website: "+orderURL)
	}

	return lines
}

func (s *Service) telegramNextAction(order model.Order) string {
	switch {
	case order.Status == "awaiting_payment" && order.PaymentStatus == "unpaid":
		if order.PaymentMethod == "okx_usdt" {
			return fmt.Sprintf("Pay with /pay %s and wait for the OKX watcher to confirm the transfer", order.OrderNo)
		}
		return fmt.Sprintf("Pay with /pay %s and submit after transfer with /pay %s paid", order.OrderNo, order.OrderNo)
	case order.PaymentStatus == "pending_review":
		return "Waiting for manual payment review"
	case order.Status == "payment_confirmed" || order.Status == "issuing" || order.Status == "delivery_pending":
		return "Fulfillment is in progress"
	case order.DeliveryStatus == "sent" || order.Status == "completed":
		return fmt.Sprintf("Open the delivery result with /code %s", order.OrderNo)
	case order.DeliveryStatus == "failed" || order.Status == "failed":
		return fmt.Sprintf("Create a support ticket with /support %s <message>", order.OrderNo)
	case order.Status == "cancelled":
		return "This order has been cancelled"
	case order.Status == "expired":
		return "This order expired before payment was confirmed"
	case order.Status == "refunded":
		return "This order has been refunded"
	default:
		return ""
	}
}

func (s *Service) telegramBoundIdentity(botCtx telegramWebhookContext) string {
	if botCtx.User != nil && botCtx.User.Email != nil && strings.TrimSpace(*botCtx.User.Email) != "" {
		return fmt.Sprintf("%s <%s>", botCtx.User.DisplayName, *botCtx.User.Email)
	}
	if botCtx.User != nil && strings.TrimSpace(botCtx.User.DisplayName) != "" {
		return botCtx.User.DisplayName
	}
	if botCtx.Binding != nil && strings.TrimSpace(botCtx.Binding.TelegramUsername) != "" {
		return "@" + normalizeTelegramUsername(botCtx.Binding.TelegramUsername)
	}
	return botCtx.display()
}

func (s *Service) telegramShopURL() string {
	base := strings.TrimRight(strings.TrimSpace(s.cfg.AppBaseURL), "/")
	if base == "" {
		return ""
	}
	return base + "/shop"
}

func (s *Service) telegramOrderURL(orderNo string) string {
	base := strings.TrimRight(strings.TrimSpace(s.cfg.AppBaseURL), "/")
	if base == "" || strings.TrimSpace(orderNo) == "" {
		return ""
	}
	return base + "/orders/" + strings.TrimSpace(orderNo)
}
