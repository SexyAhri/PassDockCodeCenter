import { requestJson, unwrapListData } from './http'
import { getStoredStorefrontAuthToken } from '../storefront/session'

export type StorefrontSupportTicket = {
  ticketNo: string
  subject: string
  content: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'open' | 'processing' | 'resolved' | 'closed'
  resolutionNote: string
  createdAt: string
  updatedAt: string
  resolvedAt: string
}

export type CreateStorefrontSupportTicketInput = {
  subject: string
  content: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
}

type StorefrontSupportTicketDto = {
  ticket_no?: string
  subject?: string
  content?: string
  priority?: string
  status?: string
  resolution_note?: string
  created_at?: string
  updated_at?: string
  resolved_at?: string
}

export async function listStorefrontOrderTickets(orderNo: string, orderAccessToken?: string) {
  const payload = await requestJson<unknown>(`/api/v1/orders/${encodeURIComponent(orderNo)}/tickets`, {
    includeAdminAuth: false,
    authToken: getStoredStorefrontAuthToken(),
    headers: buildStorefrontOrderHeaders(orderAccessToken),
  })

  return unwrapListData<StorefrontSupportTicketDto>(payload).map(mapStorefrontSupportTicket)
}

export async function createStorefrontOrderTicket(
  orderNo: string,
  input: CreateStorefrontSupportTicketInput,
  orderAccessToken?: string,
) {
  const payload = await requestJson<unknown>(`/api/v1/orders/${encodeURIComponent(orderNo)}/tickets`, {
    method: 'POST',
    includeAdminAuth: false,
    authToken: getStoredStorefrontAuthToken(),
    headers: buildStorefrontOrderHeaders(orderAccessToken),
    body: {
      subject: input.subject,
      content: input.content,
      priority: input.priority,
    },
  })

  const tickets = unwrapListData<StorefrontSupportTicketDto>(payload)
  if (tickets.length > 0) {
    return mapStorefrontSupportTicket(tickets[0])
  }

  const record = normalizeDetailPayload(payload)
  return mapStorefrontSupportTicket(record)
}

function mapStorefrontSupportTicket(
  value: StorefrontSupportTicketDto | Record<string, unknown>,
): StorefrontSupportTicket {
  const dto = value as StorefrontSupportTicketDto

  return {
    ticketNo: String(dto.ticket_no ?? ''),
    subject: String(dto.subject ?? ''),
    content: String(dto.content ?? ''),
    priority: normalizePriority(dto.priority),
    status: normalizeStatus(dto.status),
    resolutionNote: String(dto.resolution_note ?? ''),
    createdAt: String(dto.created_at ?? ''),
    updatedAt: String(dto.updated_at ?? ''),
    resolvedAt: String(dto.resolved_at ?? ''),
  }
}

function normalizePriority(value: unknown): StorefrontSupportTicket['priority'] {
  switch (value) {
    case 'low':
    case 'high':
    case 'urgent':
      return value
    default:
      return 'normal'
  }
}

function normalizeStatus(value: unknown): StorefrontSupportTicket['status'] {
  switch (value) {
    case 'processing':
    case 'resolved':
    case 'closed':
      return value
    default:
      return 'open'
  }
}

function normalizeDetailPayload(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function buildStorefrontOrderHeaders(orderAccessToken?: string) {
  const token = String(orderAccessToken ?? '').trim()
  if (!token) {
    return undefined
  }

  return {
    'X-PassDock-Order-Token': token,
  }
}
