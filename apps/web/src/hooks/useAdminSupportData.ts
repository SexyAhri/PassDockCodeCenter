import { useEffect, useState } from 'react'

import { loadAdminTicketsRemoteList, type AdminTicketRecord } from '../api/adminSupport'
import { isRemoteApiEnabled } from '../api/config'
import { getAdminTickets } from '../data/admin'
import type { Locale } from '../i18n/copy'
import type { AdminDraftSource } from './useAdminSystemConfig'

export function useAdminSupportData(locale: Locale) {
  const remoteEnabled = isRemoteApiEnabled()
  const [tickets, setTickets] = useState<AdminTicketRecord[]>(() =>
    remoteEnabled ? [] : getAdminTickets(locale),
  )
  const [loading, setLoading] = useState(remoteEnabled)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<AdminDraftSource>(() =>
    remoteEnabled ? 'remote' : 'local',
  )

  useEffect(() => {
    if (!remoteEnabled) {
      setTickets(getAdminTickets(locale))
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
        const remoteTickets = await loadAdminTicketsRemoteList()

        if (cancelled) {
          return
        }

        setTickets(remoteTickets)
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
    tickets,
    setTickets,
    loading,
    error,
    source,
    remoteEnabled,
    reload: async () => {
      if (!remoteEnabled) {
        setTickets(getAdminTickets(locale))
        setSource('local')
        setError(null)
        return
      }

      setLoading(true)
      setSource('remote')

      try {
        const remoteTickets = await loadAdminTicketsRemoteList()
        setTickets(remoteTickets)
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Failed to load support tickets.'
}
