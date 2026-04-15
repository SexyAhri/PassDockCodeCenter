import type { TableColumnsType } from 'antd'

import type { AdminOrderRecord } from '../../api/adminOrders'
import type { AdminTicketRecord } from '../../api/adminSupport'
import type { AdminWorkbenchSection } from '../../components/admin/AdminTabbedWorkbench'
import { StatusTag } from '../../components/admin/StatusTag'
import { ActionButtons } from '../../components/common/ActionButtons'
import type { AdminIntegrationProvider } from '../../data/admin'
import type { AdminConsoleText } from '../../i18n/adminConsole-types'
import type { Locale } from '../../i18n/copy'
import {
  getHealthTone,
  getOrderStatusTone,
  getPaymentStatusTone,
  getTicketPriorityTone,
  getTicketStatusTone,
} from '../status'
import type { DashboardChannelRevenueRow } from './metrics'

type DashboardSectionHandlers = {
  onOpenOrderDetail: (record: AdminOrderRecord) => void
  onOpenTicketDetail: (record: AdminTicketRecord) => void
  onOpenOrder: (orderNo: string) => void
  onOpenSupport: (ticketNo: string) => void
  onOpenSystem: () => void
}

type DashboardSectionLabels = {
  details: string
  ordersPage: string
  supportPage: string
  systemPage: string
  recentOrdersDescription: string
  reviewQueueDescription: string
  urgentTicketsDescription: string
  integrationHealthDescription: string
  revenueChannelsDescription: string
}

type DashboardSectionParams = {
  locale: Locale
  text: AdminConsoleText
  recentOrders: AdminOrderRecord[]
  reviewQueue: AdminOrderRecord[]
  urgentTickets: AdminTicketRecord[]
  providers: AdminIntegrationProvider[]
  channelRevenue: DashboardChannelRevenueRow[]
  labels: DashboardSectionLabels
  actions: DashboardSectionHandlers
}

export function getDashboardSections(
  params: DashboardSectionParams,
): AdminWorkbenchSection[] {
  const {
    locale,
    text,
    recentOrders,
    reviewQueue,
    urgentTickets,
    providers,
    channelRevenue,
    labels,
    actions,
  } = params

  const orderColumns: TableColumnsType<Record<string, unknown>> = [
    {
      title: text.table.orderNo,
      dataIndex: 'orderNo',
      width: 176,
      render: (_value, record) => {
        const order = record as AdminOrderRecord

        return (
          <div className="admin-row-title">
            <strong>{order.orderNo}</strong>
            <small>{order.product}</small>
          </div>
        )
      },
    },
    { title: text.table.customer, dataIndex: 'customer', width: 180 },
    {
      title: text.table.amount,
      dataIndex: 'amount',
      width: 126,
      render: (_value, record) =>
        `${String(record.amount ?? '')} ${String(record.currency ?? 'RMB')}`,
    },
    {
      title: text.table.paymentStatus,
      dataIndex: 'paymentStatus',
      width: 136,
      render: (value: string) => (
        <StatusTag
          label={text.enums.paymentStatus[value] ?? value}
          tone={getPaymentStatusTone(value as never)}
        />
      ),
    },
    {
      title: text.table.orderStatus,
      dataIndex: 'orderStatus',
      width: 166,
      render: (value: string) => (
        <StatusTag
          label={text.enums.orderStatus[value] ?? value}
          tone={getOrderStatusTone(value as never)}
        />
      ),
    },
    { title: text.table.createdAt, dataIndex: 'createdAt', width: 156 },
    {
      title: locale === 'zh-CN' ? '操作' : 'Actions',
      key: 'actions',
      width: 176,
      fixed: 'right',
      render: (_value, record) => {
        const order = record as AdminOrderRecord

        return (
          <ActionButtons
            actions={[
              {
                key: 'detail',
                label: labels.details,
                onClick: () => actions.onOpenOrderDetail(order),
              },
              {
                key: 'orders',
                label: labels.ordersPage,
                onClick: () => actions.onOpenOrder(order.orderNo),
              },
            ]}
          />
        )
      },
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
      width: 116,
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

  const revenueColumns: TableColumnsType<Record<string, unknown>> = [
    { title: text.table.channelType, dataIndex: 'label', width: '46%' },
    { title: text.table.amount, dataIndex: 'value', width: '30%' },
    {
      title: text.table.status,
      dataIndex: 'trend',
      width: '24%',
      render: (value: string) => <StatusTag label={value} tone="success" />,
    },
  ]

  const providerColumns: TableColumnsType<Record<string, unknown>> = [
    { title: text.table.provider, dataIndex: 'providerName', width: 220 },
    { title: text.table.providerKey, dataIndex: 'providerKey', width: 180 },
    { title: text.table.baseUrl, dataIndex: 'baseUrl' },
    {
      title: text.table.health,
      dataIndex: 'health',
      width: 132,
      render: (value: string) => (
        <StatusTag
          label={text.enums.health[value] ?? value}
          tone={getHealthTone(value as never)}
        />
      ),
    },
    {
      title: locale === 'zh-CN' ? '操作' : 'Actions',
      key: 'actions',
      width: 112,
      fixed: 'right',
      render: () => (
        <ActionButtons
          actions={[
            {
              key: 'system',
              label: labels.systemPage,
              onClick: actions.onOpenSystem,
            },
          ]}
        />
      ),
    },
  ]

  return [
    {
      key: 'recent_orders',
      label: text.sections.recentOrders,
      title: text.sections.recentOrders,
      description: labels.recentOrdersDescription,
      dataSource: recentOrders,
      columns: orderColumns,
      scrollX: 1320,
      showPagination: false,
    },
    {
      key: 'review_queue',
      label: text.sections.reviewQueue,
      title: text.sections.reviewQueue,
      description: labels.reviewQueueDescription,
      dataSource: reviewQueue,
      columns: orderColumns,
      scrollX: 1320,
      showPagination: false,
    },
    {
      key: 'urgent_tickets',
      label: text.sections.urgentTickets,
      title: text.sections.urgentTickets,
      description: labels.urgentTicketsDescription,
      dataSource: urgentTickets,
      columns: ticketColumns,
      scrollX: 1280,
      showPagination: false,
    },
    {
      key: 'integration_health',
      label: text.sections.integrationHealth,
      title: text.sections.integrationHealth,
      description: labels.integrationHealthDescription,
      dataSource: providers,
      columns: providerColumns,
      scrollX: 1160,
      showPagination: false,
    },
    {
      key: 'revenue_channels',
      label: text.sections.revenueChannels,
      title: text.sections.revenueChannels,
      description: labels.revenueChannelsDescription,
      dataSource: channelRevenue,
      columns: revenueColumns,
      scrollX: '100%',
      showPagination: false,
    },
  ]
}
