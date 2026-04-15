import type { Locale } from '../../i18n/copy'

export function formatStorefrontOrderStatus(value: string, locale: Locale) {
  const zhLabels: Record<string, string> = {
    awaiting_payment: '待支付',
    paid_pending_review: '待人工审核',
    payment_confirmed: '已确认支付',
    issuing: '履约中',
    issued: '已履约',
    delivery_pending: '待交付',
    delivered: '已交付',
    completed: '已完成',
    cancelled: '已取消',
    refunded: '已退款',
    failed: '失败',
  }
  const enLabels: Record<string, string> = {
    awaiting_payment: 'Awaiting payment',
    paid_pending_review: 'Pending review',
    payment_confirmed: 'Payment confirmed',
    issuing: 'Issuing',
    issued: 'Issued',
    delivery_pending: 'Delivery pending',
    delivered: 'Delivered',
    completed: 'Completed',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
    failed: 'Failed',
  }

  return (locale === 'zh-CN' ? zhLabels : enLabels)[value] ?? value
}

export function formatStorefrontPaymentStatus(value: string, locale: Locale) {
  const zhLabels: Record<string, string> = {
    unpaid: '未支付',
    pending_review: '待审核',
    paid: '已支付',
    failed: '失败',
    refunded: '已退款',
  }
  const enLabels: Record<string, string> = {
    unpaid: 'Unpaid',
    pending_review: 'Pending review',
    paid: 'Paid',
    failed: 'Failed',
    refunded: 'Refunded',
  }

  return (locale === 'zh-CN' ? zhLabels : enLabels)[value] ?? value
}

export function formatStorefrontDeliveryStatus(value: string, locale: Locale) {
  const zhLabels: Record<string, string> = {
    pending: '待处理',
    sending: '发送中',
    sent: '已发送',
    failed: '发送失败',
    cancelled: '已取消',
  }
  const enLabels: Record<string, string> = {
    pending: 'Pending',
    sending: 'Sending',
    sent: 'Sent',
    failed: 'Failed',
    cancelled: 'Cancelled',
  }

  return (locale === 'zh-CN' ? zhLabels : enLabels)[value] ?? value
}

export function formatStorefrontDateTime(value: string, locale: Locale) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString(locale === 'zh-CN' ? 'zh-CN' : 'en-US', {
    hour12: false,
  })
}

export function getStorefrontDeliveryResultFieldLabels(locale: Locale) {
  return {
    status: locale === 'zh-CN' ? '状态' : 'Status',
    delivery_status: locale === 'zh-CN' ? '交付状态' : 'Delivery status',
    delivery_channel: locale === 'zh-CN' ? '交付渠道' : 'Delivery channel',
    channel_type: locale === 'zh-CN' ? '交付渠道' : 'Delivery channel',
    target: locale === 'zh-CN' ? '交付目标' : 'Target',
    content: locale === 'zh-CN' ? '交付内容' : 'Content',
    masked_content: locale === 'zh-CN' ? '脱敏内容' : 'Masked content',
    delivered_at: locale === 'zh-CN' ? '交付时间' : 'Delivered at',
    created_at: locale === 'zh-CN' ? '创建时间' : 'Created at',
    updated_at: locale === 'zh-CN' ? '更新时间' : 'Updated at',
    order_no: locale === 'zh-CN' ? '订单号' : 'Order no.',
  }
}

export function getStorefrontDeliveryResultPreferredKeys() {
  return [
    'order_no',
    'status',
    'delivery_status',
    'delivery_channel',
    'channel_type',
    'target',
    'content',
    'masked_content',
    'delivered_at',
    'created_at',
    'updated_at',
  ]
}
