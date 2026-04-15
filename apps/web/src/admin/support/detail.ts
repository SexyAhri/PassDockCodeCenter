import type { AdminTicketRecord } from '../../api/adminSupport'
import { getAdminConsoleText } from '../../i18n/adminConsole'
import type { Locale } from '../../i18n/copy'

export function buildLocalTicketDetail(ticket: AdminTicketRecord, locale: Locale) {
  const text = getAdminConsoleText(locale)

  return {
    ticketNo: ticket.ticketNo,
    subject: ticket.subject,
    customer: ticket.customer,
    priority: text.enums.ticketPriority[ticket.priority] ?? ticket.priority,
    status: text.enums.ticketStatus[ticket.status] ?? ticket.status,
    assignedTo: ticket.assignedTo,
    createdAt: ticket.createdAt,
  }
}

export function getTicketDetailLabels(locale: Locale) {
  const text = getAdminConsoleText(locale)

  return {
    ticketNo: text.table.ticketNo,
    ticket_no: text.table.ticketNo,
    subject: text.table.subject,
    content: locale === 'zh-CN' ? '工单内容' : 'Content',
    customer: text.table.customer,
    customer_name: text.table.customer,
    orderNo: text.table.orderNo,
    order_no: text.table.orderNo,
    priority: text.table.priority,
    status: text.table.status,
    assignedTo: text.table.assignedTo,
    assigned_to: text.table.assignedTo,
    createdAt: text.table.createdAt,
    created_at: text.table.createdAt,
    updated_at: locale === 'zh-CN' ? '更新时间' : 'Updated at',
    resolved_at: locale === 'zh-CN' ? '解决时间' : 'Resolved at',
    note: locale === 'zh-CN' ? '备注' : 'Note',
  }
}

export function getTicketDetailPreferredKeys() {
  return [
    'ticketNo',
    'ticket_no',
    'subject',
    'content',
    'customer',
    'customer_name',
    'orderNo',
    'order_no',
    'priority',
    'status',
    'assignedTo',
    'assigned_to',
    'createdAt',
    'created_at',
    'updated_at',
    'resolved_at',
    'note',
  ]
}
