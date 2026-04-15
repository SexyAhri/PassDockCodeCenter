import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  RollbackOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons'
import type { ReactNode } from 'react'

import type { AdminOrderRecord } from '../../api/adminOrders'
import type { AdminConsoleText } from '../../i18n/adminConsole-types'

type OrderMetricItem = {
  key: string
  title: string
  value: string | number
  suffix?: string
  icon: ReactNode
  percent?: number
  color?: string
}

export type OrderStatusRow = {
  key: string
  scope: string
  metric: string
  total: number
}

type OrderMetricParams = {
  text: AdminConsoleText
  orders: AdminOrderRecord[]
  reviewQueueSize: number
}

export function buildOrderMetricItems(
  params: OrderMetricParams,
): OrderMetricItem[] {
  const { text, orders, reviewQueueSize } = params
  const deliveryPendingCount = orders.filter(
    (order) => order.orderStatus === 'delivery_pending',
  ).length
  const refundedCount = orders.filter(
    (order) => order.orderStatus === 'refunded',
  ).length

  return [
    {
      key: 'order_total',
      title: text.table.orders,
      value: orders.length,
      percent: 100,
      icon: <ShoppingCartOutlined />,
    },
    {
      key: 'review_queue',
      title: text.metrics.paymentReviews,
      value: reviewQueueSize,
      percent: Math.round((reviewQueueSize / Math.max(orders.length, 1)) * 100),
      color: '#d97706',
      icon: <ClockCircleOutlined />,
    },
    {
      key: 'delivery_pending',
      title: text.enums.orderStatus.delivery_pending,
      value: deliveryPendingCount,
      percent: Math.round(
        (deliveryPendingCount / Math.max(orders.length, 1)) * 100,
      ),
      color: '#2563eb',
      icon: <CheckCircleOutlined />,
    },
    {
      key: 'refunded',
      title: text.enums.orderStatus.refunded,
      value: refundedCount,
      percent: Math.round((refundedCount / Math.max(orders.length, 1)) * 100),
      color: '#ef4444',
      icon: <RollbackOutlined />,
    },
  ]
}

export function buildOrderStatusRows(
  text: AdminConsoleText,
  orders: AdminOrderRecord[],
): OrderStatusRow[] {
  return [
    {
      key: 'awaiting_payment',
      scope: text.table.orderStatus,
      metric: text.enums.orderStatus.awaiting_payment,
      total: orders.filter((order) => order.orderStatus === 'awaiting_payment')
        .length,
    },
    {
      key: 'delivery_pending',
      scope: text.table.orderStatus,
      metric: text.enums.orderStatus.delivery_pending,
      total: orders.filter((order) => order.orderStatus === 'delivery_pending')
        .length,
    },
    {
      key: 'refunded',
      scope: text.table.orderStatus,
      metric: text.enums.orderStatus.refunded,
      total: orders.filter((order) => order.orderStatus === 'refunded').length,
    },
    {
      key: 'failed_delivery',
      scope: text.table.deliveryStatus,
      metric: text.enums.deliveryStatus.failed,
      total: orders.filter((order) => order.deliveryStatus === 'failed').length,
    },
  ]
}
