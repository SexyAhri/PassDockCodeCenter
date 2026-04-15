import { useEffect, useState } from 'react'

import {
  buildDashboardChannelRevenueRows,
  sortDashboardProviders,
} from '../admin/dashboard/metrics'
import type { AdminDashboardSnapshot } from '../api/adminDashboard'
import { loadAdminDashboardRemoteSnapshot } from '../api/adminDashboard'
import { isRemoteApiEnabled } from '../api/config'
import { getIntegrationProviders } from '../data/admin'
import { getAdminOrders, getAdminTickets } from '../data/admin'
import type { Locale } from '../i18n/copy'
import type { AdminDraftSource } from './useAdminSystemConfig'

export function useAdminDashboardData(locale: Locale) {
  const remoteEnabled = isRemoteApiEnabled()
  const [snapshot, setSnapshot] = useState<AdminDashboardSnapshot>(() =>
    remoteEnabled ? createEmptyDashboardSnapshot() : buildLocalDashboardSnapshot(locale),
  )
  const [loading, setLoading] = useState(remoteEnabled)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<AdminDraftSource>(() =>
    remoteEnabled ? 'remote' : 'local',
  )

  useEffect(() => {
    if (!remoteEnabled) {
      setSnapshot(buildLocalDashboardSnapshot(locale))
      setLoading(false)
      setError(null)
      setSource('local')
      return
    }

    let cancelled = false

    void (async () => {
      setLoading(true)
      setSource('remote')

      try {
        const remoteSnapshot = await loadAdminDashboardRemoteSnapshot(locale)
        if (cancelled) {
          return
        }

        setSnapshot({
          ...remoteSnapshot,
          providers: sortDashboardProviders(remoteSnapshot.providers),
        })
        setError(null)
        setSource('remote')
      } catch (nextError) {
        if (cancelled) {
          return
        }

        setError(getErrorMessage(nextError))
        setSource('remote-error')
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [locale, remoteEnabled])

  return {
    ...snapshot,
    loading,
    error,
    source,
    remoteEnabled,
    reload: async () => {
      if (!remoteEnabled) {
        setSnapshot(buildLocalDashboardSnapshot(locale))
        setSource('local')
        setError(null)
        return
      }

      setLoading(true)
      setSource('remote')

      try {
        const remoteSnapshot = await loadAdminDashboardRemoteSnapshot(locale)
        setSnapshot({
          ...remoteSnapshot,
          providers: sortDashboardProviders(remoteSnapshot.providers),
        })
        setError(null)
        setSource('remote')
      } catch (nextError) {
        setError(getErrorMessage(nextError))
        setSource('remote-error')
        throw nextError
      } finally {
        setLoading(false)
      }
    },
  }
}

function createEmptyDashboardSnapshot(): AdminDashboardSnapshot {
  return {
    summary: {
      revenueToday: 0,
      currency: 'MIXED',
      reviewQueueSize: 0,
      totalOrders: 0,
      urgentTicketSize: 0,
      totalTickets: 0,
      healthyProviderCount: 0,
      totalProviderCount: 0,
    },
    recentOrders: [],
    reviewQueue: [],
    urgentTickets: [],
    providers: [],
    channelRevenue: [],
  }
}

function buildLocalDashboardSnapshot(locale: Locale): AdminDashboardSnapshot {
  const orders = getAdminOrders(locale).map((order) => {
    const match = order.amount.match(/^([0-9]+(?:\.[0-9]+)?)\s*([A-Z]+)?$/)

    return {
      ...order,
      amount: match?.[1] ?? order.amount,
      currency: match?.[2] ?? 'RMB',
    }
  })
  const tickets = getAdminTickets(locale)
  const providers = sortDashboardProviders(getIntegrationProviders())
  const reviewQueue = orders.filter(
    (order) =>
      order.paymentStatus === 'pending_review' ||
      order.orderStatus === 'paid_pending_review',
  )
  const urgentTickets = tickets.filter(
    (ticket) => ticket.priority === 'urgent' || ticket.priority === 'high',
  )
  const paidOrders = orders.filter((order) => order.paymentStatus === 'paid')

  return {
    summary: {
      revenueToday: paidOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0),
      currency: 'MIXED',
      reviewQueueSize: reviewQueue.length,
      totalOrders: orders.length,
      urgentTicketSize: urgentTickets.length,
      totalTickets: tickets.length,
      healthyProviderCount: providers.filter((provider) => provider.health === 'healthy').length,
      totalProviderCount: providers.length,
    },
    recentOrders: orders.slice(0, 8),
    reviewQueue: reviewQueue.slice(0, 8),
    urgentTickets: urgentTickets.slice(0, 8),
    providers,
    channelRevenue: buildDashboardChannelRevenueRows(
      paidOrders,
      {
        wechat_qr: locale === 'zh-CN' ? '微信扫码' : 'WeChat QR',
        alipay_qr: locale === 'zh-CN' ? '支付宝扫码' : 'Alipay QR',
        okx_usdt: 'OKX USDT',
      },
    ),
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Failed to load dashboard data.'
}
