import { App, Tag } from 'antd'
import { useEffect, useMemo, useState } from 'react'

import {
  buildAdminCustomerDetail,
  getCustomerDetailLabels,
  getCustomerDetailPreferredKeys,
  matchesAdminCustomerFilters,
  type AdminCustomerRecord,
} from '../../admin/customers/aggregate'
import { getAdminDetailSeedData } from '../../admin/detailDrawer'
import {
  emptyAdminCustomersDetailDrawerState,
  getCustomerPageLabels,
  getCustomersSourceLabel,
  getErrorMessage,
  type AdminCustomersDetailDrawerState,
} from '../../admin/customers/detail'
import {
  buildAdminCustomersLocation,
  emptyAdminCustomerFilters,
} from '../../admin/customers/filters'
import { buildCustomerMetricItems } from '../../admin/customers/metrics'
import { getCustomerSections } from '../../admin/customers/sections'
import {
  areAdminCustomerFiltersEqual,
  buildAdminQueryPath,
  readAdminCustomerFiltersFromSearch,
} from '../../admin/routeFilters'
import { combineAdminSources, getAdminSourceTagColor } from '../../admin/source'
import {
  buildLocalTicketDetail,
  getTicketDetailLabels,
  getTicketDetailPreferredKeys,
} from '../../admin/support/detail'
import { getAdminCustomerDetail } from '../../api/adminCustomers'
import { getAdminTicketDetail, type AdminTicketRecord } from '../../api/adminSupport'
import { AdminDetailDrawer } from '../../components/admin/AdminDetailDrawer'
import { AdminMetricStrip } from '../../components/admin/AdminMetricStrip'
import { AdminTabbedWorkbench } from '../../components/admin/AdminTabbedWorkbench'
import { AdminCustomerFilters } from '../../components/admin/customers/AdminCustomerFilters'
import { ActionButtons } from '../../components/common/ActionButtons'
import { PageHeader } from '../../components/common/PageHeader'
import { useAdminCustomersData } from '../../hooks/useAdminCustomersData'
import { useAdminSupportData } from '../../hooks/useAdminSupportData'
import { getAdminConsoleText } from '../../i18n/adminConsole'
import type { Locale } from '../../i18n/copy'
import { navigateTo, replaceTo, useLocationSearch } from '../../router'

type AdminCustomersPageProps = {
  locale: Locale
}

export function AdminCustomersPage(props: AdminCustomersPageProps) {
  const { locale } = props
  const text = getAdminConsoleText(locale)
  const labels = getCustomerPageLabels(locale)
  const { message } = App.useApp()
  const locationSearch = useLocationSearch()
  const {
    tickets,
    loading: ticketsLoading,
    error: ticketsError,
    source: ticketsSource,
    reload: reloadTickets,
  } = useAdminSupportData(locale)
  const {
    customers: sourceCustomers,
    loading: customersLoading,
    error: customersError,
    source: customersSource,
    reload: reloadCustomers,
  } = useAdminCustomersData(locale)
  const routeFilters = useMemo(
    () => readAdminCustomerFiltersFromSearch(locationSearch),
    [locationSearch],
  )
  const [customerFilters, setCustomerFilters] = useState(() =>
    readAdminCustomerFiltersFromSearch(window.location.search),
  )
  const [detailDrawer, setDetailDrawer] = useState<AdminCustomersDetailDrawerState>(
    emptyAdminCustomersDetailDrawerState,
  )

  useEffect(() => {
    setCustomerFilters((prev) =>
      areAdminCustomerFiltersEqual(prev, routeFilters) ? prev : routeFilters,
    )
  }, [routeFilters])

  useEffect(() => {
    replaceTo(buildAdminCustomersLocation(customerFilters))
  }, [customerFilters])

  const customers = sourceCustomers
  const filteredCustomers = useMemo(
    () => customers.filter((customer) => matchesAdminCustomerFilters(customer, customerFilters)),
    [customerFilters, customers],
  )
  const attentionCustomers = useMemo(
    () =>
      [...filteredCustomers]
        .filter(
          (customer) =>
            customer.pendingReviewOrders > 0 ||
            customer.openTickets > 0 ||
            customer.urgentTickets > 0,
        )
        .sort((left, right) => {
          if (left.urgentTickets !== right.urgentTickets) {
            return right.urgentTickets - left.urgentTickets
          }

          if (left.openTickets !== right.openTickets) {
            return right.openTickets - left.openTickets
          }

          if (left.pendingReviewOrders !== right.pendingReviewOrders) {
            return right.pendingReviewOrders - left.pendingReviewOrders
          }

          return right.lastActivity.localeCompare(left.lastActivity)
        }),
    [filteredCustomers],
  )
  const visibleCustomerNames = useMemo(
    () => new Set(filteredCustomers.map((customer) => customer.name)),
    [filteredCustomers],
  )
  const visibleTicketNos = useMemo(
    () => new Set(filteredCustomers.flatMap((customer) => customer.ticketNos)),
    [filteredCustomers],
  )
  const customerTickets = useMemo(
    () =>
      tickets
        .filter(
          (ticket) =>
            visibleTicketNos.has(ticket.ticketNo) || visibleCustomerNames.has(ticket.customer),
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [tickets, visibleCustomerNames, visibleTicketNos],
  )

  const customerFiltersToolbar = (
    <AdminCustomerFilters
      locale={locale}
      value={customerFilters}
      loading={customersLoading || ticketsLoading}
      onChange={setCustomerFilters}
      onReset={() => setCustomerFilters(emptyAdminCustomerFilters)}
    />
  )

  const sections = getCustomerSections({
    locale,
    text,
    filteredCustomers,
    attentionCustomers,
    customerTickets,
    customerFiltersToolbar,
    labels,
    actions: {
      onOpenCustomerDetail: openCustomerDetail,
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
    },
  })

  const source = combineAdminSources(customersSource, ticketsSource)
  const loading = customersLoading || ticketsLoading
  const error = customersError || ticketsError
  const sourceTag = (
    <Tag color={getAdminSourceTagColor(source)}>
      {getCustomersSourceLabel(source, labels)}
    </Tag>
  )

  return (
    <div className="admin-page">
      <PageHeader
        title={text.pages.customers.title}
        subtitle={text.pages.customers.subtitle}
        extra={sourceTag}
      />

      <AdminMetricStrip
        items={buildCustomerMetricItems({
          locale,
          text,
          totalCustomers: filteredCustomers.length,
          vipCustomers: filteredCustomers.filter((customer) => customer.tier === 'vip').length,
          attentionCustomers: attentionCustomers.length,
          totalOrders: filteredCustomers.reduce((sum, customer) => sum + customer.orders, 0),
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
                key: 'orders',
                label: labels.ordersPage,
                onClick: () => navigateTo('/admin/orders'),
              },
              {
                key: 'support',
                label: labels.supportPage,
                  onClick: () => navigateTo('/admin/support'),
              },
              {
                key: 'reload',
                label: labels.reload,
                onClick: () => {
                  void Promise.all([reloadCustomers(), reloadTickets()]).catch((nextError) => {
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
          detailDrawer.kind === 'customer'
            ? getCustomerDetailLabels(locale)
            : getTicketDetailLabels(locale)
        }
        preferredKeys={
          detailDrawer.kind === 'customer'
            ? getCustomerDetailPreferredKeys()
            : getTicketDetailPreferredKeys()
        }
        extra={
          detailDrawer.kind === 'customer' ? (
            <ActionButtons
              actions={[
                {
                  key: 'orders',
                  label: labels.ordersPage,
                  onClick: () => navigateTo('/admin/orders'),
                },
                {
                  key: 'support',
                  label: labels.supportPage,
                  onClick: () => navigateTo('/admin/support'),
                },
              ]}
            />
          ) : null
        }
        onClose={() => setDetailDrawer(emptyAdminCustomersDetailDrawerState)}
      />
    </div>
  )

  async function openCustomerDetail(customer: AdminCustomerRecord) {
    const remoteDetailReady = customersSource === 'remote'
    const fallbackDetail = buildAdminCustomerDetail(customer, locale)
    const title = `${labels.details} - ${customer.name}`

    setDetailDrawer({
      open: true,
      kind: 'customer',
      title,
      loading: remoteDetailReady,
      error: null,
      data: getAdminDetailSeedData(remoteDetailReady, fallbackDetail),
    })

    if (!remoteDetailReady) {
      return
    }

    try {
      const remoteDetail = await getAdminCustomerDetail(customer.key)
      setDetailDrawer({
        open: true,
        kind: 'customer',
        title,
        loading: false,
        error: null,
        data: remoteDetail,
      })
    } catch (nextError) {
      setDetailDrawer({
        open: true,
        kind: 'customer',
        title,
        loading: false,
        error: getErrorMessage(nextError, labels.actionFailed),
        data: getAdminDetailSeedData(remoteDetailReady, fallbackDetail),
      })
    }
  }

  async function openTicketDetail(ticket: AdminTicketRecord) {
    const remoteDetailReady = ticketsSource === 'remote'
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
