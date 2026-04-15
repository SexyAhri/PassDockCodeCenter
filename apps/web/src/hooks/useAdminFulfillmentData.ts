import { useEffect, useState } from 'react'

import {
  loadAdminFulfillmentRemoteSnapshot,
  type AdminRemoteCodeIssueRecord,
  type AdminDeliveryRecord,
} from '../api/adminFulfillment'
import { isRemoteApiEnabled } from '../api/config'
import { getAdminCodeIssueRecords, getAdminFulfillmentRecords } from '../data/admin'
import type { Locale } from '../i18n/copy'
import type { AdminDraftSource } from './useAdminSystemConfig'

export function useAdminFulfillmentData(_locale: Locale) {
  void _locale
  const remoteEnabled = isRemoteApiEnabled()
  const [snapshot, setSnapshot] = useState(() =>
    remoteEnabled ? getEmptySnapshot() : getFallbackSnapshot(),
  )
  const [loading, setLoading] = useState(remoteEnabled)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<AdminDraftSource>(() =>
    remoteEnabled ? 'remote' : 'local',
  )

  useEffect(() => {
    if (!remoteEnabled) {
      setSnapshot(getFallbackSnapshot())
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
        const remoteSnapshot = await loadAdminFulfillmentRemoteSnapshot()

        if (cancelled) {
          return
        }

        setSnapshot(remoteSnapshot)
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
  }, [remoteEnabled])

  return {
    ...snapshot,
    loading,
    error,
    source,
    remoteEnabled,
    reload: async () => {
      if (!remoteEnabled) {
        setSnapshot(getFallbackSnapshot())
        setSource('local')
        setError(null)
        return
      }

      setLoading(true)
      setSource('remote')

      try {
        const remoteSnapshot = await loadAdminFulfillmentRemoteSnapshot()
        setSnapshot(remoteSnapshot)
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

function getEmptySnapshot() {
  return {
    fulfillmentRecords: [],
    codeIssueRecords: [],
    deliveryRecords: [],
  }
}

function getFallbackSnapshot() {
  const fulfillmentRecords = getAdminFulfillmentRecords()
  const codeIssueRecords: AdminRemoteCodeIssueRecord[] = getAdminCodeIssueRecords()
  const deliveryRecords: AdminDeliveryRecord[] = fulfillmentRecords.map((record) => ({
    key: `delivery_${record.key}`,
    orderNo: record.orderNo,
    deliveryChannel: record.deliveryChannel,
    target: record.target,
    status:
      record.status === 'success'
        ? 'sent'
        : record.status === 'running'
          ? 'sending'
          : record.status === 'failed' || record.status === 'cancelled'
            ? 'failed'
            : 'pending',
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
  }))

  return {
    fulfillmentRecords,
    codeIssueRecords,
    deliveryRecords,
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Failed to load fulfillment data.'
}
