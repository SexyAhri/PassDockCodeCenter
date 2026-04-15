import { useEffect, useState } from 'react'

import { loadAdminPaymentsRemoteSnapshot, type AdminPaymentListFilters } from '../api/adminPayments'
import { isRemoteApiEnabled } from '../api/config'
import { getAdminCallbackLogs, getAdminPaymentProofs, getAdminPayments, getAdminWatcherRecords } from '../data/admin'
import type { Locale } from '../i18n/copy'
import type { AdminDraftSource } from './useAdminSystemConfig'

export function useAdminPaymentsData(locale: Locale, filters?: AdminPaymentListFilters) {
  const effectiveFilters = filters ?? {}
  const remoteEnabled = isRemoteApiEnabled()
  const [paymentRecords, setPaymentRecords] = useState(() =>
    remoteEnabled ? [] : getLocalPaymentRecords(effectiveFilters),
  )
  const [paymentProofs, setPaymentProofs] = useState(() =>
    remoteEnabled ? [] : getLocalPaymentProofs(effectiveFilters),
  )
  const [callbackLogs, setCallbackLogs] = useState(() => (remoteEnabled ? [] : getAdminCallbackLogs(locale)))
  const [watcherRecords, setWatcherRecords] = useState(() => (remoteEnabled ? [] : getAdminWatcherRecords()))
  const [loading, setLoading] = useState(remoteEnabled)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<AdminDraftSource>(() =>
    remoteEnabled ? 'remote' : 'local',
  )

  useEffect(() => {
    if (!remoteEnabled) {
      setPaymentRecords(getLocalPaymentRecords(effectiveFilters))
      setPaymentProofs(getLocalPaymentProofs(effectiveFilters))
      setCallbackLogs(getAdminCallbackLogs(locale))
      setWatcherRecords(getAdminWatcherRecords())
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
        const remoteSnapshot = await loadAdminPaymentsRemoteSnapshot({
          ...effectiveFilters,
          page: 1,
          pageSize: effectiveFilters.pageSize ?? 100,
        })

        if (cancelled) {
          return
        }

        setPaymentRecords(remoteSnapshot.paymentRecords)
        setPaymentProofs(remoteSnapshot.paymentProofs)
        setCallbackLogs(remoteSnapshot.callbackLogs)
        setWatcherRecords(remoteSnapshot.watcherRecords)
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
    paymentRecords,
    paymentProofs,
    callbackLogs,
    watcherRecords,
    loading,
    error,
    source,
    remoteEnabled,
    reload: async () => {
      if (!remoteEnabled) {
        setPaymentRecords(getLocalPaymentRecords(effectiveFilters))
        setPaymentProofs(getLocalPaymentProofs(effectiveFilters))
        setCallbackLogs(getAdminCallbackLogs(locale))
        setWatcherRecords(getAdminWatcherRecords())
        setSource('local')
        setError(null)
        return
      }

      setLoading(true)
      setSource('remote')

      try {
        const remoteSnapshot = await loadAdminPaymentsRemoteSnapshot({
          ...effectiveFilters,
          page: 1,
          pageSize: effectiveFilters.pageSize ?? 100,
        })
        setPaymentRecords(remoteSnapshot.paymentRecords)
        setPaymentProofs(remoteSnapshot.paymentProofs)
        setCallbackLogs(remoteSnapshot.callbackLogs)
        setWatcherRecords(remoteSnapshot.watcherRecords)
        setSource('remote')
        setError(null)
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

function getLocalPaymentRecords(filters: AdminPaymentListFilters) {
  return getAdminPayments().filter((record) => {
    if (filters.orderNo && !record.orderNo.toLowerCase().includes(filters.orderNo.toLowerCase())) {
      return false
    }

    if (filters.paymentStatus && record.status !== filters.paymentStatus) {
      return false
    }

    if (filters.paymentMethod && record.paymentMethod !== filters.paymentMethod) {
      return false
    }

    return true
  })
}

function getLocalPaymentProofs(filters: AdminPaymentListFilters) {
  return getAdminPaymentProofs().filter((record) => {
    if (filters.orderNo && !record.orderNo.toLowerCase().includes(filters.orderNo.toLowerCase())) {
      return false
    }

    if (filters.reviewStatus && record.reviewStatus !== filters.reviewStatus) {
      return false
    }

    if (filters.paymentMethod && record.paymentMethod !== filters.paymentMethod) {
      return false
    }

    if (filters.sourceChannel && record.sourceChannel !== filters.sourceChannel) {
      return false
    }

    return true
  })
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Failed to load payment data.'
}
