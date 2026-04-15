import { useEffect, useState } from 'react'

import {
  createStorefrontAccountTicket,
  getStorefrontAccountOrderDetail,
  getStorefrontAccountProfile,
  listStorefrontAccountOrders,
  listStorefrontAccountTickets,
  type CreateStorefrontAccountTicketInput,
  type StorefrontAccountOrder,
  type StorefrontAccountProfile,
  type StorefrontAccountTicket,
} from '../api/storefrontAccount'
import { isRemoteApiEnabled } from '../api/config'
import { getStorefrontOrderDelivery, type StorefrontDeliveryResult, type StorefrontOrderSnapshot } from '../api/storefrontOrders'
import type { StorefrontSession } from './useStorefrontSession'

export function useStorefrontAccountCenter(session: StorefrontSession | null) {
  const remoteEnabled = isRemoteApiEnabled()
  const [profile, setProfile] = useState<StorefrontAccountProfile | null>(null)
  const [orders, setOrders] = useState<StorefrontAccountOrder[]>([])
  const [tickets, setTickets] = useState<StorefrontAccountTicket[]>([])
  const [selectedOrderNo, setSelectedOrderNo] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<StorefrontOrderSnapshot | null>(null)
  const [deliveryResult, setDeliveryResult] = useState<StorefrontDeliveryResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) {
      setProfile(null)
      setOrders([])
      setTickets([])
      setSelectedOrderNo('')
      setSelectedOrder(null)
      setDeliveryResult(null)
      setError(null)
      return
    }

    if (!remoteEnabled) {
      setProfile({
        userId: Number(session.userId ?? 0),
        email: session.email,
        name: session.name,
        role: String(session.role ?? 'user'),
        status: 'preview',
        locale: '',
        lastLoginAt: '',
      })
      setOrders([])
      setTickets([])
      setSelectedOrderNo('')
      setSelectedOrder(null)
      setDeliveryResult(null)
      setError(null)
      return
    }

    void loadAll()
  }, [remoteEnabled, session?.email, session?.token])

  async function loadAll(preferredOrderNo?: string) {
    if (!session) {
      return
    }

    if (!remoteEnabled) {
      setProfile({
        userId: Number(session.userId ?? 0),
        email: session.email,
        name: session.name,
        role: String(session.role ?? 'user'),
        status: 'preview',
        locale: '',
        lastLoginAt: '',
      })
      setOrders([])
      setTickets([])
      setSelectedOrderNo(preferredOrderNo ?? '')
      setSelectedOrder(null)
      setDeliveryResult(null)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [nextProfile, nextOrders, nextTickets] = await Promise.all([
        getStorefrontAccountProfile(),
        listStorefrontAccountOrders(),
        listStorefrontAccountTickets(),
      ])
      const resolvedOrderNo =
        (preferredOrderNo && nextOrders.some((item) => item.orderNo === preferredOrderNo) ? preferredOrderNo : '') ||
        nextOrders[0]?.orderNo ||
        ''

      setProfile(nextProfile)
      setOrders(nextOrders)
      setTickets(nextTickets)
      setSelectedOrderNo(resolvedOrderNo)
      setDeliveryResult(null)

      if (resolvedOrderNo) {
        const detail = await getStorefrontAccountOrderDetail(resolvedOrderNo)
        setSelectedOrder(detail)
      } else {
        setSelectedOrder(null)
      }
    } catch (nextError) {
      setError(getErrorMessage(nextError))
    } finally {
      setLoading(false)
    }
  }

  async function selectOrder(orderNo: string) {
    if (!orderNo) {
      setSelectedOrderNo('')
      setSelectedOrder(null)
      setDeliveryResult(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const detail = remoteEnabled ? await getStorefrontAccountOrderDetail(orderNo) : null
      setSelectedOrderNo(orderNo)
      setSelectedOrder(detail)
      setDeliveryResult(null)
    } catch (nextError) {
      setError(getErrorMessage(nextError))
    } finally {
      setLoading(false)
    }
  }

  return {
    profile,
    orders,
    tickets,
    selectedOrderNo,
    selectedOrder,
    deliveryResult,
    loading,
    submitting,
    error,
    remoteEnabled,
    clearError: () => setError(null),
    reload: async () => {
      await loadAll(selectedOrderNo)
    },
    selectOrder,
    loadDeliveryResult: async () => {
      if (!selectedOrderNo || !remoteEnabled) {
        return null
      }

      setLoading(true)
      setError(null)

      try {
        const nextResult = await getStorefrontOrderDelivery(selectedOrderNo, selectedOrder?.orderAccessToken)
        setDeliveryResult(nextResult)
        return nextResult
      } catch (nextError) {
        setError(getErrorMessage(nextError))
        return null
      } finally {
        setLoading(false)
      }
    },
    createTicket: async (input: CreateStorefrontAccountTicketInput) => {
      if (!remoteEnabled) {
        throw new Error('Remote API is required')
      }

      setSubmitting(true)
      setError(null)

      try {
        const created = await createStorefrontAccountTicket(input)
        setTickets((prev) => [created, ...prev])
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

  return 'Account request failed.'
}
