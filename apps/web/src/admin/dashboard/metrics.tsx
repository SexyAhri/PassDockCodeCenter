import {
  CreditCardOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import type { ReactNode } from 'react'

import type { AdminIntegrationProvider } from '../../data/admin'
import type { AdminConsoleText } from '../../i18n/adminConsole-types'

export type DashboardMetricItem = {
  key: string
  title: string
  value: string | number
  suffix?: string
  icon: ReactNode
  percent?: number
  color?: string
}

export type DashboardChannelRevenueRow = {
  key: string
  label: string
  value: string
  trend: string
}

type DashboardMetricParams = {
  text: AdminConsoleText
  revenueToday: number
  revenueCurrency: string
  reviewQueueSize: number
  totalOrders: number
  urgentTicketSize: number
  totalTickets: number
  healthyProviderCount: number
  totalProviderCount: number
}

export function buildDashboardMetricItems(
  params: DashboardMetricParams,
): DashboardMetricItem[] {
  const {
    text,
    revenueToday,
    revenueCurrency,
    reviewQueueSize,
    totalOrders,
    urgentTicketSize,
    totalTickets,
    healthyProviderCount,
    totalProviderCount,
  } = params

  return [
    {
      key: 'revenue_today',
      title: text.metrics.revenueToday,
      value: revenueToday.toFixed(2),
      suffix: revenueCurrency,
      percent: 82,
      icon: <CreditCardOutlined />,
    },
    {
      key: 'payment_reviews',
      title: text.metrics.paymentReviews,
      value: reviewQueueSize,
      percent: Math.round((reviewQueueSize / Math.max(totalOrders, 1)) * 100),
      color: '#d97706',
      icon: <ThunderboltOutlined />,
    },
    {
      key: 'urgent_tickets',
      title: text.sections.urgentTickets,
      value: urgentTicketSize,
      percent: Math.round((urgentTicketSize / Math.max(totalTickets, 1)) * 100),
      color: '#ef4444',
      icon: <WarningOutlined />,
    },
    {
      key: 'healthy_providers',
      title: text.metrics.providerHealth,
      value: healthyProviderCount,
      percent: Math.round(
        (healthyProviderCount / Math.max(totalProviderCount, 1)) * 100,
      ),
      color: '#0f9f6e',
      icon: <SafetyCertificateOutlined />,
    },
  ]
}

export function buildDashboardChannelRevenueRows(
  orders: Array<{ paymentMethod: string; amount: string; currency: string }>,
  labelMap: Record<string, string>,
): DashboardChannelRevenueRow[] {
  const paidOrders = orders.filter(
    (order) => order.amount && Number(order.amount) > 0,
  )
  const total = paidOrders.reduce((sum, order) => sum + Number(order.amount), 0)
  const grouped = paidOrders.reduce((map, order) => {
    const current = map.get(order.paymentMethod) ?? { amount: 0, currency: order.currency || 'RMB' }
    map.set(order.paymentMethod, {
      amount: current.amount + Number(order.amount),
      currency: current.currency || order.currency || 'RMB',
    })
    return map
  }, new Map<string, { amount: number; currency: string }>())

  return Array.from(grouped.entries()).map(([key, item]) => ({
    key,
    label: labelMap[key] ?? key,
    value: `${item.amount.toFixed(2)} ${item.currency}`.trim(),
    trend: `${Math.round((item.amount / Math.max(total, 1)) * 100)}%`,
  }))
}

export function sortDashboardProviders(
  providers: AdminIntegrationProvider[],
): AdminIntegrationProvider[] {
  return [...providers].sort((left, right) => {
    if (left.health === right.health) {
      return left.providerName.localeCompare(right.providerName)
    }

    if (left.health === 'healthy') {
      return 1
    }

    if (right.health === 'healthy') {
      return -1
    }

    return left.health.localeCompare(right.health)
  })
}
