import { useEffect, useState } from 'react'

import { buildAdminCustomerRecords, type AdminCustomerRecord } from '../admin/customers/aggregate'
import { loadAdminCustomersRemoteList } from '../api/adminCustomers'
import { isRemoteApiEnabled } from '../api/config'
import { getAdminOrders, getAdminTickets } from '../data/admin'
import type { Locale } from '../i18n/copy'
import type { AdminDraftSource } from './useAdminSystemConfig'

export function useAdminCustomersData(locale: Locale) {
  const remoteEnabled = isRemoteApiEnabled()
  const [customers, setCustomers] = useState<AdminCustomerRecord[]>(() =>
    remoteEnabled ? [] : getLocalCustomers(locale),
  )
  const [loading, setLoading] = useState(remoteEnabled)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<AdminDraftSource>(() =>
    remoteEnabled ? 'remote' : 'local',
  )

  useEffect(() => {
    if (!remoteEnabled) {
      setCustomers(getLocalCustomers(locale))
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
        const remoteCustomers = await loadAdminCustomersRemoteList()
        if (cancelled) {
          return
        }

        setCustomers(remoteCustomers)
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
    customers,
    loading,
    error,
    source,
    remoteEnabled,
    reload: async () => {
      if (!remoteEnabled) {
        setCustomers(getLocalCustomers(locale))
        setError(null)
        setSource('local')
        return
      }

      setLoading(true)
      setSource('remote')

      try {
        const remoteCustomers = await loadAdminCustomersRemoteList()
        setCustomers(remoteCustomers)
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

function getLocalCustomers(locale: Locale) {
  return buildAdminCustomerRecords({
    locale,
    orders: getAdminOrders(locale).map((order) => {
      const match = order.amount.match(/^([0-9]+(?:\.[0-9]+)?)\s*([A-Z]+)?$/)

      return {
        ...order,
        currency: match?.[2] ?? 'RMB',
      }
    }),
    tickets: getAdminTickets(locale),
  })
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Failed to load customer profiles.'
}
