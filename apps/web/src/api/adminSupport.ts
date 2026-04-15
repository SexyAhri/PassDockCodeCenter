import type { AdminTicket, TicketPriorityKey, TicketStatusKey } from '../data/admin'
import { requestJson, unwrapListData } from './http'

export type AdminTicketRecord = AdminTicket

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

export async function loadAdminTicketsRemoteList() {
  const payload = await requestJson<unknown>('/api/v1/admin/tickets')

  return unwrapListData<TicketDto>(payload).map(mapTicketDto)
}

export async function getAdminTicketDetail(ticketNo: string) {
  const payload = await requestJson<unknown>(`/api/v1/admin/tickets/${encodeURIComponent(ticketNo)}`)
  return normalizeDetailPayload(payload)
}

export async function assignAdminTicket(ticketNo: string, assignedTo: string) {
  await requestJson(`/api/v1/admin/tickets/${encodeURIComponent(ticketNo)}/assign`, {
    method: 'POST',
    body: {
      assigned_to: assignedTo,
    },
  })
}

export async function resolveAdminTicket(ticketNo: string, note = '') {
  await requestJson(`/api/v1/admin/tickets/${encodeURIComponent(ticketNo)}/resolve`, {
    method: 'POST',
    body: {
      note,
    },
  })
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

function normalizeTicketPriority(value: unknown): TicketPriorityKey {
  switch (value) {
    case 'low':
    case 'high':
    case 'urgent':
      return value
    default:
      return 'normal'
  }
}

function normalizeTicketStatus(value: unknown): TicketStatusKey {
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
    return value == null ? null : { value }
  }

  return value as Record<string, unknown>
}
