import { useEffect, useState } from 'react'

import { isRemoteApiEnabled } from '../api/config'
import {
  createStorefrontOrderTicket,
  listStorefrontOrderTickets,
  type CreateStorefrontSupportTicketInput,
  type StorefrontSupportTicket,
} from '../api/storefrontSupport'

type StorefrontSupportSource = 'local' | 'remote' | 'remote-error'

export function useStorefrontSupport(orderNo: string | null | undefined, orderAccessToken?: string | null) {
  const remoteEnabled = isRemoteApiEnabled()
  const [tickets, setTickets] = useState<StorefrontSupportTicket[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<StorefrontSupportSource>(() =>
    remoteEnabled ? 'remote' : 'local',
  )

  useEffect(() => {
    if (!orderNo) {
      setTickets([])
      setError(null)
      setSource(remoteEnabled ? 'remote' : 'local')
      return
    }

    if (!remoteEnabled) {
      setTickets([])
      setError(null)
      setSource('local')
      return
    }

    let cancelled = false

    void (async () => {
      setLoading(true)
      setError(null)
      setTickets([])

      try {
        const nextTickets = await listStorefrontOrderTickets(orderNo, orderAccessToken ?? undefined)
        if (cancelled) {
          return
        }

        setTickets(nextTickets)
        setSource('remote')
      } catch (nextError) {
        if (cancelled) {
          return
        }

        setTickets([])
        setSource('remote-error')
        setError(getErrorMessage(nextError))
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [orderNo, orderAccessToken, remoteEnabled])

  return {
    tickets,
    loading,
    submitting,
    error,
    source,
    remoteEnabled,
    clearError: () => setError(null),
    reload: async () => {
      if (!orderNo) {
        setTickets([])
        setError(null)
        return
      }

      if (!remoteEnabled) {
        setTickets([])
        setError(null)
        setSource('local')
        return
      }

      setLoading(true)
      setError(null)

      try {
        const nextTickets = await listStorefrontOrderTickets(orderNo, orderAccessToken ?? undefined)
        setTickets(nextTickets)
        setSource('remote')
      } catch (nextError) {
        setTickets([])
        setSource('remote-error')
        setError(getErrorMessage(nextError))
        throw nextError
      } finally {
        setLoading(false)
      }
    },
    createTicket: async (input: CreateStorefrontSupportTicketInput) => {
      if (!orderNo) {
        throw new Error('Order not selected')
      }
      if (!remoteEnabled) {
        throw new Error('Support submission requires the remote API')
      }

      setSubmitting(true)
      setError(null)

      try {
        const created = await createStorefrontOrderTicket(orderNo, input, orderAccessToken ?? undefined)
        try {
          const nextTickets = await listStorefrontOrderTickets(orderNo, orderAccessToken ?? undefined)
          setTickets(nextTickets)
          setSource('remote')
        } catch (refreshError) {
          setTickets((current) => upsertStorefrontSupportTicket(current, created))
          setSource('remote-error')
          setError(getRefreshErrorMessage(refreshError))
        }

        return created
      } catch (nextError) {
        setError(getErrorMessage(nextError))
        throw nextError
      } finally {
        setSubmitting(false)
      }
    },
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Support request failed.'
}

function getRefreshErrorMessage(error: unknown) {
  const detail = getErrorMessage(error)
  if (!detail) {
    return 'Support request created, but the latest ticket list could not be refreshed.'
  }

  return `Support request created, but refresh failed: ${detail}`
}

function upsertStorefrontSupportTicket(
  current: StorefrontSupportTicket[],
  created: StorefrontSupportTicket,
) {
  const existing = current.findIndex((item) => item.ticketNo === created.ticketNo)
  if (existing >= 0) {
    return current.map((item, index) => (index === existing ? created : item))
  }

  return [created, ...current]
}
