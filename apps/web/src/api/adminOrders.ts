import type {
  AdminOrder,
  DeliveryChannelKey,
  DeliveryStatusKey,
  OrderStatusKey,
  PaymentProofReviewStatusKey,
  PaymentStatusKey,
  SourceChannelKey,
} from '../data/admin'
import type { PaymentMethodKey } from '../i18n/copy'
import { createIdempotencyKey, requestJson, unwrapListData } from './http'

export type AdminOrderRecord = AdminOrder & {
  currency: string
}

export type AdminOrderRefundResult = {
  refund_id?: string | number
  refund_no?: string
  refund_type?: string
  status?: string
  receipt_no?: string
  provider_key?: string
  action_key?: string
  amount?: string | number
  currency?: string
  attempt_no?: string | number
  message?: string
  refunded?: boolean
}

type OrderDto = {
  id?: string | number
  order_id?: string | number
  order_no?: string
  product_name?: string
  product_title?: string
  customer_name?: string
  buyer_name?: string
  amount?: string | number
  display_amount?: string | number
  total_amount?: string | number
  currency?: string
  payment_method?: string
  payment_status?: string
  order_status?: string
  status?: string
  delivery_status?: string
  delivery_channel?: string
  delivery_record_id?: string | number
  source_channel?: string
  buyer_ref?: string
  created_at?: string
  paid_at?: string
}

type ConfirmPaymentInput = {
  paymentMethod: PaymentMethodKey
  amount: string
  currency: string
  note?: string
}

export type AdminOrderListFilters = {
  orderNo?: string
  orderStatus?: OrderStatusKey | ''
  paymentStatus?: PaymentStatusKey | ''
  reviewStatus?: PaymentProofReviewStatusKey | ''
  deliveryStatus?: DeliveryStatusKey | ''
  paymentMethod?: PaymentMethodKey | ''
  sourceChannel?: SourceChannelKey | ''
  page?: number
  pageSize?: number
}

export async function loadAdminOrdersRemoteList(filters: AdminOrderListFilters = {}) {
  const payload = await requestJson<unknown>('/api/v1/admin/orders', {
    query: {
      order_no: filters.orderNo,
      status: filters.orderStatus,
      payment_status: filters.paymentStatus,
      delivery_status: filters.deliveryStatus,
      payment_method: filters.paymentMethod,
      source_channel: filters.sourceChannel,
      page: filters.page,
      page_size: filters.pageSize,
    },
  })

  return unwrapListData<OrderDto>(payload).map(mapOrderDto)
}

export async function getAdminOrderDetail(orderNo: string) {
  const payload = await requestJson<unknown>(`/api/v1/admin/orders/${encodeURIComponent(orderNo)}`)
  return normalizeDetailPayload(payload)
}

export async function confirmAdminOrderPayment(orderNo: string, input: ConfirmPaymentInput) {
  await requestJson(`/api/v1/admin/orders/${encodeURIComponent(orderNo)}/confirm-payment`, {
    method: 'POST',
    idempotencyKey: createIdempotencyKey('confirm_payment'),
    body: {
      payment_method: input.paymentMethod,
      amount: input.amount,
      currency: input.currency,
      note: input.note ?? '',
    },
  })
}

export async function rejectAdminOrderPayment(orderNo: string, note = '') {
  await requestJson(`/api/v1/admin/orders/${encodeURIComponent(orderNo)}/reject-payment`, {
    method: 'POST',
    body: {
      note,
    },
  })
}

export async function triggerAdminOrderFulfillment(orderNo: string) {
  await requestJson(`/api/v1/admin/orders/${encodeURIComponent(orderNo)}/fulfill`, {
    method: 'POST',
    idempotencyKey: createIdempotencyKey('fulfill_order'),
  })
}

export async function retryAdminOrderFulfillment(orderNo: string) {
  await requestJson(`/api/v1/admin/orders/${encodeURIComponent(orderNo)}/retry-fulfillment`, {
    method: 'POST',
    idempotencyKey: createIdempotencyKey('retry_fulfillment'),
  })
}

export async function triggerAdminOrderDelivery(orderNo: string) {
  await requestJson(`/api/v1/admin/orders/${encodeURIComponent(orderNo)}/deliver`, {
    method: 'POST',
    idempotencyKey: createIdempotencyKey('deliver_order'),
  })
}

export async function retryAdminOrderDelivery(orderNo: string) {
  await requestJson(`/api/v1/admin/orders/${encodeURIComponent(orderNo)}/retry-delivery`, {
    method: 'POST',
    idempotencyKey: createIdempotencyKey('retry_delivery'),
  })
}

export async function completeAdminOrderDelivery(orderNo: string, note = '') {
  await requestJson(`/api/v1/admin/orders/${encodeURIComponent(orderNo)}/complete-delivery`, {
    method: 'POST',
    body: {
      note,
    },
  })
}

export async function cancelAdminOrder(orderNo: string, note = '') {
  await requestJson(`/api/v1/admin/orders/${encodeURIComponent(orderNo)}/cancel`, {
    method: 'POST',
    body: {
      note,
    },
  })
}

export async function refundAdminOrder(orderNo: string, note = '') {
  return markAdminOrderRefund(orderNo, note)
}

export async function markAdminOrderRefund(orderNo: string, note = '') {
  return requestJson<AdminOrderRefundResult>(
    `/api/v1/admin/orders/${encodeURIComponent(orderNo)}/refund/mark`,
    {
      method: 'POST',
      idempotencyKey: createIdempotencyKey('refund_order_mark'),
      body: {
        note,
      },
    },
  )
}

export async function requestAdminOrderOriginalRefund(orderNo: string, note = '') {
  return requestJson<AdminOrderRefundResult>(
    `/api/v1/admin/orders/${encodeURIComponent(orderNo)}/refund/original`,
    {
      method: 'POST',
      idempotencyKey: createIdempotencyKey('refund_order_original'),
      body: {
        note,
      },
    },
  )
}

export async function resendAdminOrderDelivery(orderNo: string) {
  await requestJson(`/api/v1/admin/orders/${encodeURIComponent(orderNo)}/resend`, {
    method: 'POST',
  })
}

function mapOrderDto(dto: OrderDto): AdminOrderRecord {
  const amountValue = dto.amount ?? dto.display_amount ?? dto.total_amount ?? ''

  return {
    key: String(dto.id ?? dto.order_id ?? dto.order_no ?? ''),
    orderNo: String(dto.order_no ?? ''),
    product: String(dto.product_name ?? dto.product_title ?? ''),
    customer: String(dto.customer_name ?? dto.buyer_name ?? dto.buyer_ref ?? ''),
    amount: normalizeAmount(amountValue),
    currency: normalizeCurrency(dto.currency, amountValue),
    paymentMethod: normalizePaymentMethod(dto.payment_method),
    paymentStatus: normalizePaymentStatus(dto.payment_status),
    orderStatus: normalizeOrderStatus(dto.order_status ?? dto.status),
    deliveryStatus: normalizeDeliveryStatus(dto.delivery_status),
    deliveryChannel: normalizeDeliveryChannel(dto.delivery_channel),
    deliveryRecordId: normalizeDeliveryRecordId(dto.delivery_record_id),
    sourceChannel: normalizeSourceChannel(dto.source_channel),
    buyerRef: String(dto.buyer_ref ?? ''),
    createdAt: String(dto.created_at ?? ''),
    paidAt: String(dto.paid_at ?? ''),
  }
}

function normalizeAmount(value: unknown) {
  const text = String(value ?? '').trim()

  if (!text) {
    return ''
  }

  const match = text.match(/^([0-9]+(?:\.[0-9]+)?)/)
  return match?.[1] ?? text
}

function normalizeCurrency(currency: unknown, amountValue: unknown) {
  const directCurrency = String(currency ?? '').trim()

  if (directCurrency) {
    return directCurrency
  }

  const amountText = String(amountValue ?? '').trim()
  const parts = amountText.split(/\s+/)

  return parts.length > 1 ? parts[parts.length - 1] : 'RMB'
}

function normalizePaymentMethod(value: unknown): PaymentMethodKey {
  switch (value) {
    case 'alipay_qr':
    case 'okx_usdt':
      return value
    default:
      return 'wechat_qr'
  }
}

function normalizePaymentStatus(value: unknown): PaymentStatusKey {
  switch (value) {
    case 'pending_review':
    case 'paid':
    case 'failed':
    case 'refunded':
      return value
    default:
      return 'unpaid'
  }
}

function normalizeOrderStatus(value: unknown): OrderStatusKey {
  switch (value) {
    case 'created':
    case 'paid_pending_review':
    case 'payment_confirmed':
    case 'issuing':
    case 'issued':
    case 'delivery_pending':
    case 'delivered':
    case 'completed':
    case 'cancelled':
    case 'expired':
    case 'failed':
    case 'refunded':
      return value
    default:
      return 'awaiting_payment'
  }
}

function normalizeDeliveryStatus(value: unknown): DeliveryStatusKey {
  switch (value) {
    case 'sending':
    case 'sent':
    case 'failed':
    case 'cancelled':
      return value
    default:
      return 'pending'
  }
}

function normalizeSourceChannel(value: unknown): SourceChannelKey {
  switch (value) {
    case 'telegram':
    case 'admin':
    case 'api':
      return value
    default:
      return 'web'
  }
}

function normalizeDeliveryChannel(value: unknown): DeliveryChannelKey | undefined {
  switch (value) {
    case 'telegram':
    case 'email':
    case 'manual':
    case 'web':
      return value
    default:
      return undefined
  }
}

function normalizeDeliveryRecordId(value: unknown) {
  const recordId = String(value ?? '').trim()
  return recordId || undefined
}

function normalizeDetailPayload(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value == null ? null : { value }
  }

  return value as Record<string, unknown>
}
