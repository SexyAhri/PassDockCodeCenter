import type { AdminCustomerRecord } from '../admin/customers/aggregate'
import { requestJson, unwrapListData } from './http'

type CustomerDto = {
  id?: string | number
  customer_id?: string | number
  name?: string
  region?: string
  orders?: number
  spend?: string
  spend_value?: number
  tier?: string
  last_order?: string
  last_activity?: string
  open_tickets?: number
  urgent_tickets?: number
  resolved_tickets?: number
  pending_review_orders?: number
  buyer_refs?: string[]
  order_nos?: string[]
  ticket_nos?: string[]
  assigned_to?: string[]
  ticket_statuses?: string[]
  latest_order_no?: string
  latest_ticket_no?: string
  top_payment_method?: string
  top_source_channel?: string
}

export async function loadAdminCustomersRemoteList() {
  const payload = await requestJson<unknown>('/api/v1/admin/customers')
  return unwrapListData<CustomerDto>(payload).map(mapCustomerDto)
}

export async function getAdminCustomerDetail(customerId: string) {
  const payload = await requestJson<unknown>(
    `/api/v1/admin/customers/${encodeURIComponent(customerId)}`,
  )
  return normalizeDetailPayload(payload)
}

function mapCustomerDto(dto: CustomerDto): AdminCustomerRecord {
  return {
    key: String(dto.id ?? dto.customer_id ?? ''),
    name: String(dto.name ?? ''),
    region: String(dto.region ?? ''),
    orders: Number(dto.orders ?? 0),
    spend: String(dto.spend ?? '0.00 MIXED'),
    spendValue: Number(dto.spend_value ?? 0),
    tier: normalizeUserTier(dto.tier),
    lastOrder: String(dto.last_order ?? ''),
    lastActivity: String(dto.last_activity ?? ''),
    openTickets: Number(dto.open_tickets ?? 0),
    urgentTickets: Number(dto.urgent_tickets ?? 0),
    resolvedTickets: Number(dto.resolved_tickets ?? 0),
    pendingReviewOrders: Number(dto.pending_review_orders ?? 0),
    buyerRefs: normalizeStringArray(dto.buyer_refs),
    orderNos: normalizeStringArray(dto.order_nos),
    ticketNos: normalizeStringArray(dto.ticket_nos),
    assignedTo: normalizeStringArray(dto.assigned_to),
    ticketStatuses: normalizeTicketStatuses(dto.ticket_statuses),
    latestOrderNo: String(dto.latest_order_no ?? ''),
    latestTicketNo: String(dto.latest_ticket_no ?? ''),
    topPaymentMethod: String(dto.top_payment_method ?? ''),
    topSourceChannel: String(dto.top_source_channel ?? ''),
  }
}

function normalizeUserTier(value: unknown): AdminCustomerRecord['tier'] {
  switch (value) {
    case 'vip':
      return 'vip'
    default:
      return 'active'
  }
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
}

function normalizeTicketStatuses(value: unknown): AdminCustomerRecord['ticketStatuses'] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      switch (item) {
        case 'processing':
        case 'resolved':
        case 'closed':
          return item
        default:
          return 'open'
      }
    })
}

function normalizeDetailPayload(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value == null ? null : { value }
  }

  return value as Record<string, unknown>
}
