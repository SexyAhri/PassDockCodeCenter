import { useEffect, useState } from 'react'

import {
  loadAdminOrdersRemoteList,
  type AdminOrderListFilters,
  type AdminOrderRecord,
} from '../api/adminOrders'
import { isRemoteApiEnabled } from '../api/config'
import { getAdminOrders } from '../data/admin'
import type { Locale } from '../i18n/copy'
import type { AdminDraftSource } from './useAdminSystemConfig'

const emptyOrderFilters: AdminOrderListFilters = {}

export function useAdminOrdersData(locale: Locale, filters?: AdminOrderListFilters) {
  const effectiveFilters = filters ?? emptyOrderFilters
  const remoteEnabled = isRemoteApiEnabled()
  const [orders, setOrders] = useState<AdminOrderRecord[]>(() =>
    remoteEnabled ? [] : getLocalOrders(locale, effectiveFilters),
  )
  const [loading, setLoading] = useState(remoteEnabled)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<AdminDraftSource>(() =>
    remoteEnabled ? 'remote' : 'local',
  )

  useEffect(() => {
    if (!remoteEnabled) {
      setOrders(getLocalOrders(locale, effectiveFilters))
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
        const remoteOrders = await loadAdminOrdersRemoteList({
          ...effectiveFilters,
          page: 1,
          pageSize: effectiveFilters.pageSize ?? 100,
        })

        if (cancelled) {
          return
        }

        setOrders(remoteOrders)
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
  }, [effectiveFilters, locale, remoteEnabled])

  return {
    orders,
    setOrders,
    loading,
    error,
    source,
    remoteEnabled,
    reload: async () => {
      if (!remoteEnabled) {
        setOrders(getLocalOrders(locale, effectiveFilters))
        setSource('local')
        setError(null)
        return
      }

      setLoading(true)
      setSource('remote')

      try {
        const remoteOrders = await loadAdminOrdersRemoteList({
          ...effectiveFilters,
          page: 1,
          pageSize: effectiveFilters.pageSize ?? 100,
        })
        setOrders(remoteOrders)
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

function getLocalOrders(locale: Locale, filters: AdminOrderListFilters) {
  const normalizedOrders = getAdminOrders(locale).map((order) => {
    const match = order.amount.match(/^([0-9]+(?:\.[0-9]+)?)\s*([A-Z]+)?$/)

    return {
      ...order,
      amount: match?.[1] ?? order.amount,
      currency: match?.[2] ?? 'RMB',
    }
  })

  return normalizedOrders.filter((order) => {
    if (filters.orderNo && !order.orderNo.toLowerCase().includes(filters.orderNo.toLowerCase())) {
      return false
    }

    if (filters.orderStatus && order.orderStatus !== filters.orderStatus) {
      return false
    }

    if (filters.paymentStatus && order.paymentStatus !== filters.paymentStatus) {
      return false
    }

    if (filters.deliveryStatus && order.deliveryStatus !== filters.deliveryStatus) {
      return false
    }

    if (filters.paymentMethod && order.paymentMethod !== filters.paymentMethod) {
      return false
    }

    if (filters.sourceChannel && order.sourceChannel !== filters.sourceChannel) {
      return false
    }

    return true
  })
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Failed to load order data.'
}
