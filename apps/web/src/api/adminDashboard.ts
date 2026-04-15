import type { DashboardChannelRevenueRow } from '../admin/dashboard/metrics'
import type { AdminIntegrationProvider } from '../data/admin'
import type { Locale } from '../i18n/copy'
import type { AdminOrderRecord } from './adminOrders'
import type { AdminTicketRecord } from './adminSupport'
import { requestJson } from './http'

type DashboardSummaryDto = {
  revenue_today?: string | number
  currency?: string
  review_queue_size?: number
  total_orders?: number
  urgent_ticket_size?: number
  total_tickets?: number
  healthy_provider_count?: number
  total_provider_count?: number
}

type DashboardSnapshotDto = {
  summary?: DashboardSummaryDto
  recent_orders?: OrderDto[]
  review_queue?: OrderDto[]
  urgent_tickets?: TicketDto[]
  providers?: ProviderDto[]
  channel_revenue?: ChannelRevenueDto[]
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
  source_channel?: string
  buyer_ref?: string
  created_at?: string
  paid_at?: string
}

type TicketDto = {
  id?: string | number
  ticket_id?: string | number
  ticket_no?: string
  subject?: string
  customer_name?: string
  customer?: string
  priority?: string
  status?: string
  assigned_to?: string
  created_at?: string
}

type ProviderDto = {
  id?: string | number
  provider_key?: string
  provider_name?: string
  base_url?: string
  auth_type?: AdminIntegrationProvider['authType']
  retry_times?: number
  timeout_ms?: number
  health?: AdminIntegrationProvider['health']
  enabled?: boolean
  last_checked_at?: string
}

type ChannelRevenueDto = {
  payment_method?: string
  amount?: string | number
  currency?: string
  share_percent?: number
}

export type AdminDashboardSummary = {
  revenueToday: number
  currency: string
  reviewQueueSize: number
  totalOrders: number
  urgentTicketSize: number
  totalTickets: number
  healthyProviderCount: number
  totalProviderCount: number
}

export type AdminDashboardSnapshot = {
  summary: AdminDashboardSummary
  recentOrders: AdminOrderRecord[]
  reviewQueue: AdminOrderRecord[]
  urgentTickets: AdminTicketRecord[]
  providers: AdminIntegrationProvider[]
  channelRevenue: DashboardChannelRevenueRow[]
}

export async function loadAdminDashboardRemoteSnapshot(locale: Locale) {
  const payload = await requestJson<DashboardSnapshotDto>('/api/v1/admin/dashboard')

  return {
    summary: mapDashboardSummaryDto(payload.summary),
    recentOrders: Array.isArray(payload.recent_orders) ? payload.recent_orders.map(mapOrderDto) : [],
    reviewQueue: Array.isArray(payload.review_queue) ? payload.review_queue.map(mapOrderDto) : [],
    urgentTickets: Array.isArray(payload.urgent_tickets) ? payload.urgent_tickets.map(mapTicketDto) : [],
    providers: Array.isArray(payload.providers) ? payload.providers.map(mapProviderDto) : [],
    channelRevenue: Array.isArray(payload.channel_revenue)
      ? payload.channel_revenue.map((item) => mapChannelRevenueDto(item, locale))
      : [],
  } satisfies AdminDashboardSnapshot
}

function mapDashboardSummaryDto(dto: DashboardSummaryDto | undefined): AdminDashboardSummary {
  return {
    revenueToday: Number(dto?.revenue_today ?? 0),
    currency: String(dto?.currency ?? 'RMB'),
    reviewQueueSize: Number(dto?.review_queue_size ?? 0),
    totalOrders: Number(dto?.total_orders ?? 0),
    urgentTicketSize: Number(dto?.urgent_ticket_size ?? 0),
    totalTickets: Number(dto?.total_tickets ?? 0),
    healthyProviderCount: Number(dto?.healthy_provider_count ?? 0),
    totalProviderCount: Number(dto?.total_provider_count ?? 0),
  }
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
    sourceChannel: normalizeSourceChannel(dto.source_channel),
    buyerRef: String(dto.buyer_ref ?? ''),
    createdAt: String(dto.created_at ?? ''),
    paidAt: String(dto.paid_at ?? ''),
  }
}

function mapTicketDto(dto: TicketDto): AdminTicketRecord {
  return {
    key: String(dto.id ?? dto.ticket_id ?? dto.ticket_no ?? ''),
    ticketNo: String(dto.ticket_no ?? ''),
    subject: String(dto.subject ?? ''),
    customer: String(dto.customer_name ?? dto.customer ?? ''),
    priority: normalizeTicketPriority(dto.priority),
    status: normalizeTicketStatus(dto.status),
    assignedTo: String(dto.assigned_to ?? ''),
    createdAt: String(dto.created_at ?? ''),
  }
}

function mapProviderDto(dto: ProviderDto): AdminIntegrationProvider {
  const providerKey = String(dto.provider_key ?? dto.id ?? '')

  return {
    key: providerKey,
    providerKey,
    providerName: String(dto.provider_name ?? providerKey),
    baseUrl: String(dto.base_url ?? ''),
    authType: normalizeAuthType(dto.auth_type),
    authConfig: {},
    retryTimes: Number(dto.retry_times ?? 0),
    timeoutMs: Number(dto.timeout_ms ?? 10000),
    health: normalizeProviderHealth(dto.health),
    enabled: dto.enabled !== false,
    lastCheckedAt: String(dto.last_checked_at ?? ''),
  }
}

function mapChannelRevenueDto(dto: ChannelRevenueDto, locale: Locale): DashboardChannelRevenueRow {
  const paymentMethod = String(dto.payment_method ?? '')
  const amount = normalizeAmount(dto.amount)
  const currency = String(dto.currency ?? 'RMB')
  const sharePercent = Number(dto.share_percent ?? 0)

  return {
    key: paymentMethod,
    label: getPaymentMethodLabel(paymentMethod, locale),
    value: `${amount} ${currency}`.trim(),
    trend: `${sharePercent}%`,
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

function normalizePaymentMethod(value: unknown): AdminOrderRecord['paymentMethod'] {
  switch (value) {
    case 'alipay_qr':
    case 'okx_usdt':
      return value
    default:
      return 'wechat_qr'
  }
}

function normalizePaymentStatus(value: unknown): AdminOrderRecord['paymentStatus'] {
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

function normalizeOrderStatus(value: unknown): AdminOrderRecord['orderStatus'] {
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

function normalizeDeliveryStatus(value: unknown): AdminOrderRecord['deliveryStatus'] {
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

function normalizeSourceChannel(value: unknown): AdminOrderRecord['sourceChannel'] {
  switch (value) {
    case 'telegram':
    case 'admin':
    case 'api':
      return value
    default:
      return 'web'
  }
}

function normalizeTicketPriority(value: unknown): AdminTicketRecord['priority'] {
  switch (value) {
    case 'low':
    case 'high':
    case 'urgent':
      return value
    default:
      return 'normal'
  }
}

function normalizeTicketStatus(value: unknown): AdminTicketRecord['status'] {
  switch (value) {
    case 'processing':
    case 'resolved':
    case 'closed':
      return value
    default:
      return 'open'
  }
}

function normalizeAuthType(value: unknown): AdminIntegrationProvider['authType'] {
  switch (value) {
    case 'bearer_token':
    case 'static_header':
    case 'hmac_sha256':
    case 'query_signature':
      return value
    default:
      return 'none'
  }
}

function normalizeProviderHealth(value: unknown): AdminIntegrationProvider['health'] {
  switch (value) {
    case 'healthy':
    case 'degraded':
    case 'failed':
      return value
    default:
      return 'unknown'
  }
}

function getPaymentMethodLabel(paymentMethod: string, locale: Locale) {
  const zhMap = {
    wechat_qr: '微信扫码',
    alipay_qr: '支付宝扫码',
    okx_usdt: 'OKX USDT',
  } as const
  const enMap = {
    wechat_qr: 'WeChat QR',
    alipay_qr: 'Alipay QR',
    okx_usdt: 'OKX USDT',
  } as const
  const labelMap = locale === 'zh-CN' ? zhMap : enMap

  switch (paymentMethod) {
    case 'alipay_qr':
      return labelMap.alipay_qr
    case 'okx_usdt':
      return labelMap.okx_usdt
    default:
      return labelMap.wechat_qr
  }
}
