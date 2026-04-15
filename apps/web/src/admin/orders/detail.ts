import type { AdminOrderRecord } from '../../api/adminOrders'
import { getAdminConsoleText } from '../../i18n/adminConsole'
import type { Locale } from '../../i18n/copy'

export function buildLocalOrderDetail(order: AdminOrderRecord, locale: Locale) {
  const text = getAdminConsoleText(locale)

  return {
    orderNo: order.orderNo,
    product: order.product,
    customer: order.customer,
    amount: order.amount,
    currency: order.currency,
    paymentMethod: text.enums.paymentMethod[order.paymentMethod] ?? order.paymentMethod,
    paymentStatus: text.enums.paymentStatus[order.paymentStatus] ?? order.paymentStatus,
    orderStatus: text.enums.orderStatus[order.orderStatus] ?? order.orderStatus,
    deliveryStatus: text.enums.deliveryStatus[order.deliveryStatus] ?? order.deliveryStatus,
    deliveryChannel:
      order.deliveryChannel == null
        ? ''
        : (text.enums.deliveryChannel[order.deliveryChannel] ?? order.deliveryChannel),
    delivery_channel:
      order.deliveryChannel == null
        ? ''
        : (text.enums.deliveryChannel[order.deliveryChannel] ?? order.deliveryChannel),
    deliveryRecordId: order.deliveryRecordId ?? '',
    delivery_record_id: order.deliveryRecordId ?? '',
    sourceChannel: text.enums.sourceChannel[order.sourceChannel] ?? order.sourceChannel,
    buyerRef: order.buyerRef,
    buyer_ref: order.buyerRef,
    createdAt: order.createdAt,
    created_at: order.createdAt,
    paidAt: order.paidAt,
    paid_at: order.paidAt,
  }
}

export function getOrderDetailLabels(locale: Locale) {
  const text = getAdminConsoleText(locale)

  return {
    id: locale === 'zh-CN' ? '订单 ID' : 'Order ID',
    order_id: locale === 'zh-CN' ? '订单 ID' : 'Order ID',
    orderNo: text.table.orderNo,
    order_no: text.table.orderNo,
    product: text.table.product,
    product_name: text.table.product,
    product_title: text.table.product,
    customer: text.table.customer,
    customer_name: text.table.customer,
    buyer_name: text.table.customer,
    amount: text.table.amount,
    display_amount: text.table.amount,
    total_amount: text.table.amount,
    currency: text.table.currency,
    paymentMethod: text.table.paymentMethod,
    payment_method: text.table.paymentMethod,
    paymentStatus: text.table.paymentStatus,
    payment_status: text.table.paymentStatus,
    orderStatus: text.table.orderStatus,
    order_status: text.table.orderStatus,
    status: text.table.orderStatus,
    deliveryStatus: text.table.deliveryStatus,
    delivery_status: text.table.deliveryStatus,
    deliveryChannel: text.table.deliveryChannel,
    delivery_channel: text.table.deliveryChannel,
    deliveryRecordId: locale === 'zh-CN' ? '交付记录 ID' : 'Delivery record ID',
    delivery_record_id: locale === 'zh-CN' ? '交付记录 ID' : 'Delivery record ID',
    sourceChannel: text.table.sourceChannel,
    source_channel: text.table.sourceChannel,
    bot_key: locale === 'zh-CN' ? '机器人标识' : 'Bot key',
    buyerRef: text.table.buyerRef,
    buyer_ref: text.table.buyerRef,
    createdAt: text.table.createdAt,
    created_at: text.table.createdAt,
    paidAt: text.table.paidAt,
    paid_at: text.table.paidAt,
    updated_at: locale === 'zh-CN' ? '更新时间' : 'Updated at',
    expire_at: locale === 'zh-CN' ? '到期时间' : 'Expire at',
    payment_review_due_at: locale === 'zh-CN' ? '审核截止时间' : 'Payment review due at',
    payment_review_overdue: locale === 'zh-CN' ? '审核是否超时' : 'Payment review overdue',
    payment_review_timeout_minutes: locale === 'zh-CN' ? '审核超时分钟数' : 'Payment review timeout minutes',
    delivered_at: locale === 'zh-CN' ? '交付完成时间' : 'Delivered at',
    cancelled_at: locale === 'zh-CN' ? '取消时间' : 'Cancelled at',
    completed_at: locale === 'zh-CN' ? '完成时间' : 'Completed at',
    note: locale === 'zh-CN' ? '备注' : 'Note',
  }
}

export function getOrderDetailPreferredKeys() {
  return [
    'id',
    'order_id',
    'orderNo',
    'order_no',
    'product',
    'product_name',
    'product_title',
    'customer',
    'customer_name',
    'buyer_name',
    'amount',
    'display_amount',
    'total_amount',
    'currency',
    'paymentMethod',
    'payment_method',
    'paymentStatus',
    'payment_status',
    'orderStatus',
    'order_status',
    'status',
    'deliveryStatus',
    'delivery_status',
    'deliveryChannel',
    'delivery_channel',
    'deliveryRecordId',
    'delivery_record_id',
    'sourceChannel',
    'source_channel',
    'bot_key',
    'buyerRef',
    'buyer_ref',
    'createdAt',
    'created_at',
    'paidAt',
    'paid_at',
    'updated_at',
    'expire_at',
    'payment_review_due_at',
    'payment_review_overdue',
    'payment_review_timeout_minutes',
    'delivered_at',
    'cancelled_at',
    'completed_at',
    'note',
  ]
}
