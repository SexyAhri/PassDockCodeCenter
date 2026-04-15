import type { AdminTicketRecord } from '../../api/adminSupport'
import type { TicketStatusKey } from '../../data/admin'

export function assignAdminTicketLocal(
  tickets: AdminTicketRecord[],
  ticketNo: string,
  assignedTo: string,
): AdminTicketRecord[] {
  return tickets.map((ticket) =>
    ticket.ticketNo === ticketNo
      ? {
          ...ticket,
          assignedTo,
          status: (ticket.status === 'open' ? 'processing' : ticket.status) as TicketStatusKey,
        }
      : ticket,
  )
}

export function resolveAdminTicketLocal(
  tickets: AdminTicketRecord[],
  ticketNo: string,
  _note = '',
): AdminTicketRecord[] {
  return tickets.map((ticket) =>
    ticket.ticketNo === ticketNo
      ? {
          ...ticket,
          status: 'resolved' as TicketStatusKey,
        }
      : ticket,
  )
}
