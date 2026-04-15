import { useEffect, useState } from 'react'

import type { AdminDeliveryRecord, AdminTelegramBindingRecord } from '../api/adminBots'
import { loadAdminTelegramOperationsSnapshot } from '../api/adminBots'
import { isRemoteApiEnabled } from '../api/config'
import type { AdminDraftSource } from './useAdminSystemConfig'

export function useAdminBotsData(botKey: string) {
  const remoteEnabled = isRemoteApiEnabled()
  const [bindings, setBindings] = useState<AdminTelegramBindingRecord[]>([])
  const [deliveryRecords, setDeliveryRecords] = useState<AdminDeliveryRecord[]>([])
  const [loading, setLoading] = useState(remoteEnabled)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<AdminDraftSource>(() =>
    remoteEnabled ? 'remote' : 'local',
  )

  useEffect(() => {
    if (!remoteEnabled) {
      setBindings([])
      setDeliveryRecords([])
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
        const snapshot = await loadAdminTelegramOperationsSnapshot(botKey)
        if (cancelled) {
          return
        }

        setBindings(snapshot.bindings)
        setDeliveryRecords(snapshot.deliveryRecords)
        setError(null)
        setSource('remote')
      } catch (nextError) {
        if (cancelled) {
          return
        }

        setBindings([])
        setDeliveryRecords([])
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
  }, [botKey, remoteEnabled])

  return {
    bindings,
    deliveryRecords,
    loading,
    error,
    source,
    remoteEnabled,
    reload: async () => {
      if (!remoteEnabled) {
        setBindings([])
        setDeliveryRecords([])
        setSource('local')
        setError(null)
        return
      }

      setLoading(true)
      setSource('remote')

      try {
        const snapshot = await loadAdminTelegramOperationsSnapshot(botKey)
        setBindings(snapshot.bindings)
        setDeliveryRecords(snapshot.deliveryRecords)
        setError(null)
        setSource('remote')
      } catch (nextError) {
        setBindings([])
        setDeliveryRecords([])
        setError(getErrorMessage(nextError))
        setSource('remote-error')
        throw nextError
      } finally {
        setLoading(false)
      }
    },
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Failed to load Telegram bot data.'
}
