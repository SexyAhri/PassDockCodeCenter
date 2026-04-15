import type { ReactNode } from 'react'

import type { TableColumnsType, TableProps } from 'antd'

import type { AdminOrderRecord } from '../../api/adminOrders'
import type { AdminWorkbenchSection } from '../../components/admin/AdminTabbedWorkbench'
import { StatusTag } from '../../components/admin/StatusTag'
import { ActionButtons } from '../../components/common/ActionButtons'
import type { AdminConsoleText } from '../../i18n/adminConsole-types'
import type { Locale } from '../../i18n/copy'
import {
  getDeliveryStatusTone,
  getOrderStatusTone,
  getPaymentStatusTone,
} from '../status'
import {
  canCancel,
  canConfirmPayment,
  canCompleteDelivery,
  canDeliver,
  canFulfill,
  canMarkRefund,
  canOriginalRefund,
  canRejectPayment,
  canResend,
  canRetryDelivery,
  canRetryFulfillment,
  type OrderActionKey,
} from './actions'
import type { OrderStatusRow } from './metrics'

type OrderSectionLabels = {
  viewDetail: string
  confirmPayment: string
  rejectPayment: string
  fulfill: string
  retryFulfillment: string
  deliver: string
  completeDelivery: string
  retryDelivery: string
  cancel: string
  markRefund: string
  originalRefund: string
  resend: string
  operationalStatus: string
  ordersDescription: string
  reviewQueueDescription: string
}

type OrderSectionHandlers = {
  onOpenOrderDetail: (order: AdminOrderRecord) => void
  onOpenConfirmPayment: (order: AdminOrderRecord) => void
  onRunOrderAction: (order: AdminOrderRecord, action: OrderActionKey) => void
}

type OrderSectionParams = {
  locale: Locale
  text: AdminConsoleText
  orders: AdminOrderRecord[]
  reviewQueue: AdminOrderRecord[]
  orderStatusRows: OrderStatusRow[]
  rowSelection: TableProps<Record<string, unknown>>['rowSelection']
  orderSelectionBar: ReactNode
  orderFilters: ReactNode
  labels: OrderSectionLabels
  actions: OrderSectionHandlers
}

export function getOrderSections(
  params: OrderSectionParams,
): AdminWorkbenchSection[] {
  const {
    locale,
    text,
    orders,
    reviewQueue,
    orderStatusRows,
    rowSelection,
    orderSelectionBar,
    orderFilters,
    labels,
    actions,
  } = params

  const orderColumns: TableColumnsType<Record<string, unknown>> = [
    { title: text.table.orderNo, dataIndex: 'orderNo', width: 168 },
    { title: text.table.product, dataIndex: 'product' },
    { title: text.table.customer, dataIndex: 'customer', width: 168 },
    {
      title: text.table.amount,
      dataIndex: 'amount',
      width: 132,
      render: (_value, record) => {
        const order = record as AdminOrderRecord
        return `${order.amount} ${order.currency}`
      },
    },
    {
      title: text.table.paymentMethod,
      dataIndex: 'paymentMethod',
      width: 132,
      render: (value: string) => text.enums.paymentMethod[value] ?? value,
    },
    {
      title: text.table.paymentStatus,
      dataIndex: 'paymentStatus',
      width: 132,
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
      width: 164,
      render: (value: string) => (
        <StatusTag
          label={text.enums.orderStatus[value] ?? value}
          tone={getOrderStatusTone(value as never)}
        />
      ),
    },
    {
      title: text.table.deliveryStatus,
      dataIndex: 'deliveryStatus',
      width: 132,
      render: (value: string) => (
        <StatusTag
          label={text.enums.deliveryStatus[value] ?? value}
          tone={getDeliveryStatusTone(value as never)}
        />
      ),
    },
    {
      title: text.table.sourceChannel,
      dataIndex: 'sourceChannel',
      width: 110,
      render: (value: string) => text.enums.sourceChannel[value] ?? value,
    },
    { title: text.table.createdAt, dataIndex: 'createdAt', width: 156 },
    {
      title: locale === 'zh-CN' ? '操作' : 'Actions',
      key: 'actions',
      width: 408,
      fixed: 'right',
      render: (_value, record) => renderOrderActions(record as AdminOrderRecord),
    },
  ]

  const summaryColumns: TableColumnsType<Record<string, unknown>> = [
    { title: text.table.status, dataIndex: 'metric', width: '42%' },
    { title: text.table.module, dataIndex: 'scope', width: '30%' },
    { title: text.table.value, dataIndex: 'total', width: '28%', align: 'center' },
  ]

  return [
    {
      key: 'orders',
      label: text.pages.orders.title,
      title: text.pages.orders.title,
      description: labels.ordersDescription,
      dataSource: orders,
      columns: orderColumns,
      rowSelection,
      scrollX: 1740,
      selectionBar: orderSelectionBar,
      toolbarExtra: orderFilters,
    },
    {
      key: 'review_queue',
      label: text.sections.reviewQueue,
      title: text.sections.reviewQueue,
      description: labels.reviewQueueDescription,
      dataSource: reviewQueue,
      columns: orderColumns,
      rowSelection,
      scrollX: 1740,
      showPagination: false,
      selectionBar: orderSelectionBar,
      toolbarExtra: orderFilters,
    },
    {
      key: 'delivery_records',
      label: labels.operationalStatus,
      title: labels.operationalStatus,
      dataSource: orderStatusRows as Array<Record<string, unknown>>,
      columns: summaryColumns,
      scrollX: '100%',
      showPagination: false,
    },
  ]

  function renderOrderActions(order: AdminOrderRecord) {
    return (
      <ActionButtons
        wrap
        actions={[
          {
            key: 'detail',
            label: labels.viewDetail,
            onClick: () => actions.onOpenOrderDetail(order),
          },
          {
            key: 'confirm',
            label: labels.confirmPayment,
            type: 'primary',
            hidden: !canConfirmPayment(order),
            onClick: () => actions.onOpenConfirmPayment(order),
          },
          {
            key: 'reject',
            label: labels.rejectPayment,
            hidden: !canRejectPayment(order),
            onClick: () => actions.onRunOrderAction(order, 'reject_payment'),
          },
          {
            key: 'fulfill',
            label: labels.fulfill,
            hidden: !canFulfill(order),
            onClick: () => actions.onRunOrderAction(order, 'fulfill'),
          },
          {
            key: 'retry_fulfillment',
            label: labels.retryFulfillment,
            hidden: !canRetryFulfillment(order),
            onClick: () =>
              actions.onRunOrderAction(order, 'retry_fulfillment'),
          },
          {
            key: 'deliver',
            label: labels.deliver,
            hidden: !canDeliver(order),
            onClick: () => actions.onRunOrderAction(order, 'deliver'),
          },
          {
            key: 'complete_delivery',
            label: labels.completeDelivery,
            type: 'primary',
            hidden: !canCompleteDelivery(order),
            onClick: () => actions.onRunOrderAction(order, 'complete_delivery'),
          },
          {
            key: 'retry_delivery',
            label: labels.retryDelivery,
            hidden: !canRetryDelivery(order),
            onClick: () => actions.onRunOrderAction(order, 'retry_delivery'),
          },
          {
            key: 'refund_mark',
            label: labels.markRefund,
            hidden: !canMarkRefund(order),
            onClick: () => actions.onRunOrderAction(order, 'refund_mark'),
          },
          {
            key: 'refund_original',
            label: labels.originalRefund,
            hidden: !canOriginalRefund(order),
            onClick: () => actions.onRunOrderAction(order, 'refund_original'),
          },
          {
            key: 'cancel',
            label: labels.cancel,
            danger: true,
            hidden: !canCancel(order),
            onClick: () => actions.onRunOrderAction(order, 'cancel'),
          },
          {
            key: 'resend',
            label: labels.resend,
            hidden: !canResend(order),
            onClick: () => actions.onRunOrderAction(order, 'resend'),
          },
        ]}
      />
    )
  }
}
