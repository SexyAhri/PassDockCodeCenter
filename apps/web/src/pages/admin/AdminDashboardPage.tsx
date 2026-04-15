import { App, Tag } from 'antd'
import { useState } from 'react'

import {
  emptyDashboardDetailDrawerState,
  getDashboardLabels,
  getDashboardSourceLabel,
  getErrorMessage,
  type AdminDashboardDetailDrawerState,
} from '../../admin/dashboard/detail'
import { getAdminDetailSeedData } from '../../admin/detailDrawer'
import {
  buildDashboardMetricItems,
} from '../../admin/dashboard/metrics'
import { getDashboardSections } from '../../admin/dashboard/sections'
import {
  buildLocalOrderDetail,
  getOrderDetailLabels,
  getOrderDetailPreferredKeys,
} from '../../admin/orders/detail'
import { buildAdminQueryPath } from '../../admin/routeFilters'
import {
  buildLocalTicketDetail,
  getTicketDetailLabels,
  getTicketDetailPreferredKeys,
} from '../../admin/support/detail'
import { getAdminSourceTagColor } from '../../admin/source'
import { getAdminOrderDetail, type AdminOrderRecord } from '../../api/adminOrders'
import { getAdminTicketDetail, type AdminTicketRecord } from '../../api/adminSupport'
import { AdminDetailDrawer } from '../../components/admin/AdminDetailDrawer'
import { AdminMetricStrip } from '../../components/admin/AdminMetricStrip'
import { AdminTabbedWorkbench } from '../../components/admin/AdminTabbedWorkbench'
import { ActionButtons } from '../../components/common/ActionButtons'
import { PageHeader } from '../../components/common/PageHeader'
import { useAdminDashboardData } from '../../hooks/useAdminDashboardData'
import { getAdminConsoleText } from '../../i18n/adminConsole'
import type { Locale } from '../../i18n/copy'
import { navigateTo } from '../../router'

type AdminDashboardPageProps = {
  locale: Locale
}

export function AdminDashboardPage(props: AdminDashboardPageProps) {
  const { locale } = props
  const text = getAdminConsoleText(locale)
  const labels = getDashboardLabels(locale)
  const { message } = App.useApp()
  const {
    summary,
    recentOrders,
    reviewQueue,
    urgentTickets,
    providers,
    channelRevenue,
    loading,
    error,
    source,
    reload,
  } = useAdminDashboardData(locale)
  const [detailDrawer, setDetailDrawer] = useState<AdminDashboardDetailDrawerState>(
    emptyDashboardDetailDrawerState,
  )

  const sections = getDashboardSections({
    locale,
    text,
    recentOrders,
    reviewQueue,
    urgentTickets,
    providers,
    channelRevenue,
    labels,
    actions: {
      onOpenOrderDetail: (order) => {
        void openOrderDetail(order)
      },
      onOpenTicketDetail: (ticket) => {
        void openTicketDetail(ticket)
      },
      onOpenOrder: (orderNo) =>
        navigateTo(
          buildAdminQueryPath('/admin/orders', {
            orderNo,
          }),
        ),
      onOpenSupport: (ticketNo) =>
        navigateTo(
          buildAdminQueryPath('/admin/support', {
            ticketNo,
          }),
        ),
      onOpenSystem: () => navigateTo('/admin/system'),
    },
  })

  const sourceTag = (
    <Tag color={getAdminSourceTagColor(source)}>
      {getDashboardSourceLabel(source, labels)}
    </Tag>
  )

  return (
    <div className="admin-page">
      <PageHeader
        title={text.pages.dashboard.title}
        subtitle={text.pages.dashboard.subtitle}
        extra={sourceTag}
      />

      <AdminMetricStrip
        items={buildDashboardMetricItems({
          text,
          revenueToday: summary.revenueToday,
          revenueCurrency: summary.currency,
          reviewQueueSize: summary.reviewQueueSize,
          totalOrders: summary.totalOrders,
          urgentTicketSize: summary.urgentTicketSize,
          totalTickets: summary.totalTickets,
          healthyProviderCount: summary.healthyProviderCount,
          totalProviderCount: summary.totalProviderCount,
        })}
      />

      <AdminTabbedWorkbench
        locale={locale}
        sections={sections}
        loading={loading}
        error={error}
        toolbarExtra={
          <ActionButtons
            actions={[
              {
                key: 'review_queue',
                label: labels.reviewQueuePage,
                onClick: () =>
                  navigateTo(
                    buildAdminQueryPath('/admin/orders', {
                      paymentStatus: 'pending_review',
                    }),
                  ),
              },
              {
                key: 'payment_review',
                label: labels.paymentReviewPage,
                onClick: () =>
                  navigateTo(
                    buildAdminQueryPath('/admin/payments', {
                      paymentStatus: 'pending_review',
                    }),
                  ),
              },
              {
                key: 'urgent_tickets',
                label: labels.urgentTicketsPage,
                onClick: () =>
                  navigateTo(
                    buildAdminQueryPath('/admin/support', {
                      priority: 'urgent',
                    }),
                  ),
              },
              {
                key: 'running_fulfillment',
                label: labels.runningFulfillmentPage,
                onClick: () =>
                  navigateTo(
                    buildAdminQueryPath('/admin/fulfillment', {
                      fulfillmentStatus: 'running',
                    }),
                  ),
              },
              {
                key: 'reload',
                label: labels.reload,
                onClick: () => {
                  void reload().catch((nextError) => {
                    message.error(getErrorMessage(nextError, labels.actionFailed))
                  })
                },
              },
            ]}
          />
        }
      />

      <AdminDetailDrawer
        locale={locale}
        open={detailDrawer.open}
        title={detailDrawer.title}
        loading={detailDrawer.loading}
        error={detailDrawer.error}
        data={detailDrawer.data}
        fieldLabels={
          detailDrawer.kind === 'ticket'
            ? getTicketDetailLabels(locale)
            : getOrderDetailLabels(locale)
        }
        preferredKeys={
          detailDrawer.kind === 'ticket'
            ? getTicketDetailPreferredKeys()
            : getOrderDetailPreferredKeys()
        }
        onClose={() => setDetailDrawer(emptyDashboardDetailDrawerState)}
      />
    </div>
  )

  async function openOrderDetail(order: AdminOrderRecord) {
    const remoteDetailReady = source === 'remote'
    const fallbackDetail = buildLocalOrderDetail(order, locale)
    const title = `${labels.details} - ${order.orderNo}`

    setDetailDrawer({
      open: true,
      kind: 'order',
      title,
      loading: remoteDetailReady,
      error: null,
      data: getAdminDetailSeedData(remoteDetailReady, fallbackDetail),
    })

    if (!remoteDetailReady) {
      return
    }

    try {
      const remoteDetail = await getAdminOrderDetail(order.orderNo)
      setDetailDrawer({
        open: true,
        kind: 'order',
        title,
        loading: false,
        error: null,
        data: remoteDetail,
      })
    } catch (nextError) {
      setDetailDrawer({
        open: true,
        kind: 'order',
        title,
        loading: false,
        error: getErrorMessage(nextError, labels.actionFailed),
        data: getAdminDetailSeedData(remoteDetailReady, fallbackDetail),
      })
    }
  }

  async function openTicketDetail(ticket: AdminTicketRecord) {
    const remoteDetailReady = source === 'remote'
    const fallbackDetail = buildLocalTicketDetail(ticket, locale)
    const title = `${labels.details} - ${ticket.ticketNo}`

    setDetailDrawer({
      open: true,
      kind: 'ticket',
      title,
      loading: remoteDetailReady,
      error: null,
      data: getAdminDetailSeedData(remoteDetailReady, fallbackDetail),
    })

    if (!remoteDetailReady) {
      return
    }

    try {
      const remoteDetail = await getAdminTicketDetail(ticket.ticketNo)
      setDetailDrawer({
        open: true,
        kind: 'ticket',
        title,
        loading: false,
        error: null,
        data: remoteDetail,
      })
    } catch (nextError) {
      setDetailDrawer({
        open: true,
        kind: 'ticket',
        title,
        loading: false,
        error: getErrorMessage(nextError, labels.actionFailed),
        data: getAdminDetailSeedData(remoteDetailReady, fallbackDetail),
      })
    }
  }
}
