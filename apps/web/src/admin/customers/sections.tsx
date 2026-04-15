import type { ReactNode } from 'react'

import type { TableColumnsType } from 'antd'

import type { AdminTicketRecord } from '../../api/adminSupport'
import type { AdminWorkbenchSection } from '../../components/admin/AdminTabbedWorkbench'
import { StatusTag } from '../../components/admin/StatusTag'
import { ActionButtons } from '../../components/common/ActionButtons'
import type { AdminConsoleText } from '../../i18n/adminConsole-types'
import type { Locale } from '../../i18n/copy'
import { getTicketPriorityTone, getTicketStatusTone } from '../status'
import type { AdminCustomerRecord } from './aggregate'

type CustomerSectionHandlers = {
  onOpenCustomerDetail: (customer: AdminCustomerRecord) => void
  onOpenTicketDetail: (ticket: AdminTicketRecord) => void
  onOpenOrder: (orderNo: string) => void
  onOpenSupport: (ticketNo: string) => void
}

type CustomerSectionLabels = {
  details: string
  ordersPage: string
  supportPage: string
  attentionAccounts: string
  recentTickets: string
  lastActivity: string
  pendingReviews: string
  openTickets: string
  urgentTickets: string
  customersDescription: string
  attentionDescription: string
  ticketsDescription: string
}

type CustomerSectionParams = {
  locale: Locale
  text: AdminConsoleText
  filteredCustomers: AdminCustomerRecord[]
  attentionCustomers: AdminCustomerRecord[]
  customerTickets: AdminTicketRecord[]
  customerFiltersToolbar: ReactNode
  labels: CustomerSectionLabels
  actions: CustomerSectionHandlers
}

export function getCustomerSections(
  params: CustomerSectionParams,
): AdminWorkbenchSection[] {
  const {
    locale,
    text,
    filteredCustomers,
    attentionCustomers,
    customerTickets,
    customerFiltersToolbar,
    labels,
    actions,
  } = params

  const customerColumns: TableColumnsType<Record<string, unknown>> = [
    {
      title: text.table.customer,
      dataIndex: 'name',
      width: 220,
      render: (_value, record) => {
        const customer = record as AdminCustomerRecord

        return (
          <div className="admin-row-title">
            <strong>{customer.name}</strong>
            <small>{customer.buyerRefs[0] ?? customer.latestOrderNo ?? '-'}</small>
          </div>
        )
      },
    },
    { title: text.table.region, dataIndex: 'region', width: 140 },
    { title: text.table.orders, dataIndex: 'orders', width: 100 },
    { title: text.table.spend, dataIndex: 'spend', width: 136 },
    { title: labels.pendingReviews, dataIndex: 'pendingReviewOrders', width: 124 },
    { title: labels.openTickets, dataIndex: 'openTickets', width: 118 },
    {
      title: text.table.tier,
      dataIndex: 'tier',
      width: 130,
      render: (value: string) => (
        <StatusTag
          label={text.enums.userTier[value] ?? value}
          tone={value === 'vip' ? 'warning' : 'processing'}
        />
      ),
    },
    { title: labels.lastActivity, dataIndex: 'lastActivity', width: 156 },
    {
      title: locale === 'zh-CN' ? '操作' : 'Actions',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_value, record) =>
        renderCustomerActions(record as AdminCustomerRecord),
    },
  ]

  const attentionColumns: TableColumnsType<Record<string, unknown>> = [
    {
      title: text.table.customer,
      dataIndex: 'name',
      width: 220,
      render: (_value, record) => {
        const customer = record as AdminCustomerRecord

        return (
          <div className="admin-row-title">
            <strong>{customer.name}</strong>
            <small>{customer.latestTicketNo || customer.latestOrderNo || '-'}</small>
          </div>
        )
      },
    },
    { title: labels.pendingReviews, dataIndex: 'pendingReviewOrders', width: 124 },
    { title: labels.openTickets, dataIndex: 'openTickets', width: 118 },
    { title: labels.urgentTickets, dataIndex: 'urgentTickets', width: 118 },
    {
      title: text.table.assignedTo,
      dataIndex: 'assignedTo',
      width: 180,
      render: (value: string[]) => value.join(', ') || '-',
    },
    { title: labels.lastActivity, dataIndex: 'lastActivity', width: 156 },
    {
      title: locale === 'zh-CN' ? '操作' : 'Actions',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_value, record) =>
        renderCustomerActions(record as AdminCustomerRecord),
    },
  ]

  const ticketColumns: TableColumnsType<Record<string, unknown>> = [
    {
      title: text.table.ticketNo,
      dataIndex: 'ticketNo',
      width: 172,
      render: (_value, record) => {
        const ticket = record as AdminTicketRecord

        return (
          <div className="admin-row-title">
            <strong>{ticket.ticketNo}</strong>
            <small>{ticket.subject}</small>
          </div>
        )
      },
    },
    { title: text.table.customer, dataIndex: 'customer', width: 176 },
    {
      title: text.table.priority,
      dataIndex: 'priority',
      width: 112,
      render: (value: string) => (
        <StatusTag
          label={text.enums.ticketPriority[value] ?? value}
          tone={getTicketPriorityTone(value as never)}
        />
      ),
    },
    {
      title: text.table.status,
      dataIndex: 'status',
      width: 132,
      render: (value: string) => (
        <StatusTag
          label={text.enums.ticketStatus[value] ?? value}
          tone={getTicketStatusTone(value as never)}
        />
      ),
    },
    { title: text.table.assignedTo, dataIndex: 'assignedTo', width: 132 },
    { title: text.table.createdAt, dataIndex: 'createdAt', width: 156 },
    {
      title: locale === 'zh-CN' ? '操作' : 'Actions',
      key: 'actions',
      width: 176,
      fixed: 'right',
      render: (_value, record) => {
        const ticket = record as AdminTicketRecord

        return (
          <ActionButtons
            actions={[
              {
                key: 'detail',
                label: labels.details,
                onClick: () => actions.onOpenTicketDetail(ticket),
              },
              {
                key: 'support',
                label: labels.supportPage,
                onClick: () => actions.onOpenSupport(ticket.ticketNo),
              },
            ]}
          />
        )
      },
    },
  ]

  return [
    {
      key: 'customers',
      label: text.pages.customers.title,
      title: text.pages.customers.title,
      description: labels.customersDescription,
      dataSource: filteredCustomers,
      columns: customerColumns,
      scrollX: 1480,
      toolbarExtra: customerFiltersToolbar,
    },
    {
      key: 'attention_accounts',
      label: labels.attentionAccounts,
      title: labels.attentionAccounts,
      description: labels.attentionDescription,
      dataSource: attentionCustomers,
      columns: attentionColumns,
      scrollX: 1360,
      showPagination: false,
      toolbarExtra: customerFiltersToolbar,
    },
    {
      key: 'recent_tickets',
      label: labels.recentTickets,
      title: labels.recentTickets,
      description: labels.ticketsDescription,
      dataSource: customerTickets,
      columns: ticketColumns,
      scrollX: 1260,
      toolbarExtra: customerFiltersToolbar,
    },
  ]

  function renderCustomerActions(customer: AdminCustomerRecord) {
    return (
      <ActionButtons
        actions={[
          {
            key: 'detail',
            label: labels.details,
            onClick: () => actions.onOpenCustomerDetail(customer),
          },
          {
            key: 'orders',
            label: labels.ordersPage,
            onClick: () => actions.onOpenOrder(customer.latestOrderNo),
          },
          {
            key: 'support',
            label: labels.supportPage,
            onClick: () => actions.onOpenSupport(customer.latestTicketNo),
          },
        ]}
      />
    )
  }
}
