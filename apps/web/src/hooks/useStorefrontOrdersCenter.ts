import { useEffect, useMemo, useState } from 'react'

import {
  getStorefrontOrderDelivery,
  getStorefrontOrderDetail,
  type StorefrontDeliveryResult,
  type StorefrontOrderSnapshot,
} from '../api/storefrontOrders'
import { isRemoteApiEnabled } from '../api/config'
import type { StorefrontProduct } from '../data/catalog'
import {
  getStoredStorefrontOrderEntry,
  inferStorefrontOrderProductSku,
  listStoredStorefrontOrders,
  persistStoredStorefrontOrder,
  type StoredStorefrontOrderEntry,
} from '../storefront/orders/storage'

type OrdersCenterSource = 'local' | 'remote' | 'remote-error'

type UseStorefrontOrdersCenterInput = {
  products: StorefrontProduct[]
}

type LookupOrderInput = {
  orderNo: string
  accessToken?: string
}

export function useStorefrontOrdersCenter(input: UseStorefrontOrdersCenterInput) {
  const { products } = input
  const remoteEnabled = isRemoteApiEnabled()
  const storedOrderOptions = remoteEnabled ? { includeLocalDraft: false } : undefined
  const [entries, setEntries] = useState<StoredStorefrontOrderEntry[]>(() =>
    listStoredStorefrontOrders(storedOrderOptions),
  )
  const [selectedOrderNo, setSelectedOrderNo] = useState(
    () => listStoredStorefrontOrders(storedOrderOptions)[0]?.order.orderNo ?? '',
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deliveryResults, setDeliveryResults] = useState<Record<string, StorefrontDeliveryResult | null>>({})
  const [sources, setSources] = useState<Record<string, OrdersCenterSource>>({})

  useEffect(() => {
    const nextEntries = listStoredStorefrontOrders(storedOrderOptions)
    setEntries(nextEntries)

    if (!nextEntries.some((entry) => entry.order.orderNo === selectedOrderNo)) {
      setSelectedOrderNo(nextEntries[0]?.order.orderNo ?? '')
    }
  }, [products, selectedOrderNo, remoteEnabled])

  const productMap = useMemo(
    () => Object.fromEntries(products.map((product) => [product.sku, product])) as Record<string, StorefrontProduct>,
    [products],
  )
  const selectedEntry = entries.find((entry) => entry.order.orderNo === selectedOrderNo) ?? null
  const selectedProduct = selectedEntry ? productMap[selectedEntry.productSku] ?? null : null
  const selectedDeliveryResult = selectedEntry
    ? deliveryResults[selectedEntry.order.orderNo] ?? selectedEntry.order.deliveryResult ?? null
    : null
  const selectedSource = selectedEntry
    ? (sources[selectedEntry.order.orderNo] ?? (remoteEnabled ? 'remote' : 'local'))
    : remoteEnabled
      ? 'remote'
      : 'local'

  return {
    entries,
    selectedEntry,
    selectedProduct,
    selectedDeliveryResult,
    selectedSource,
    loading,
    error,
    clearError: () => setError(null),
    selectOrder: (orderNo: string) => {
      setSelectedOrderNo(orderNo)
      setError(null)
    },
    lookupOrder: async (input: LookupOrderInput) => {
      const trimmedOrderNo = input.orderNo.trim()
      const trimmedAccessToken = String(input.accessToken ?? '').trim()

      if (!trimmedOrderNo) {
        return null
      }

      setLoading(true)
      setError(null)

      const storedEntry = getStoredStorefrontOrderEntry(trimmedOrderNo, storedOrderOptions)

      if (!remoteEnabled) {
        if (!storedEntry) {
          setError('Order not found in local draft.')
          setLoading(false)
          return null
        }

        syncEntries(setEntries, setSelectedOrderNo, trimmedOrderNo)
        setSources((prev) => ({ ...prev, [trimmedOrderNo]: 'local' }))
        setLoading(false)
        return storedEntry.order
      }

      try {
        const remoteOrder = await getStorefrontOrderDetail(
          trimmedOrderNo,
          trimmedAccessToken || storedEntry?.order.orderAccessToken,
        )
        const nextOrder = storedEntry ? mergeOrders(storedEntry.order, remoteOrder) : remoteOrder
        const productSku = storedEntry?.productSku || inferStorefrontOrderProductSku(nextOrder)

        persistStoredStorefrontOrder(productSku, nextOrder)
        syncEntries(setEntries, setSelectedOrderNo, trimmedOrderNo, storedOrderOptions)
        setDeliveryResults((prev) => ({
          ...prev,
          [trimmedOrderNo]: nextOrder.deliveryResult,
        }))
        setSources((prev) => ({ ...prev, [trimmedOrderNo]: 'remote' }))
        return nextOrder
      } catch (nextError) {
        if (storedEntry) {
          syncEntries(setEntries, setSelectedOrderNo, trimmedOrderNo, storedOrderOptions)
          setSources((prev) => ({ ...prev, [trimmedOrderNo]: 'remote-error' }))
          setError(getErrorMessage(nextError))
          return storedEntry.order
        }

        setError(getErrorMessage(nextError))
        return null
      } finally {
        setLoading(false)
      }
    },
    refreshSelectedOrder: async () => {
      if (!selectedEntry) {
        return null
      }

      const orderNo = selectedEntry.order.orderNo
      setLoading(true)
      setError(null)

      if (!remoteEnabled) {
        setSources((prev) => ({ ...prev, [orderNo]: 'local' }))
        setLoading(false)
        return selectedEntry.order
      }

      try {
        const remoteOrder = await getStorefrontOrderDetail(orderNo, selectedEntry.order.orderAccessToken)
        const nextOrder = mergeOrders(selectedEntry.order, remoteOrder)

        persistStoredStorefrontOrder(selectedEntry.productSku || inferStorefrontOrderProductSku(nextOrder), nextOrder)
        syncEntries(setEntries, setSelectedOrderNo, orderNo, storedOrderOptions)
        setDeliveryResults((prev) => ({
          ...prev,
          [orderNo]: nextOrder.deliveryResult,
        }))
        setSources((prev) => ({ ...prev, [orderNo]: 'remote' }))
        return nextOrder
      } catch (nextError) {
        setSources((prev) => ({ ...prev, [orderNo]: 'remote-error' }))
        setError(getErrorMessage(nextError))
        return null
      } finally {
        setLoading(false)
      }
    },
    loadSelectedDeliveryResult: async () => {
      if (!selectedEntry) {
        return null
      }

      const orderNo = selectedEntry.order.orderNo
      setLoading(true)
      setError(null)

      if (!remoteEnabled) {
        setLoading(false)
        return null
      }

      try {
        const nextResult = await getStorefrontOrderDelivery(orderNo, selectedEntry.order.orderAccessToken)
        setDeliveryResults((prev) => ({
          ...prev,
          [orderNo]: nextResult,
        }))
        return nextResult
      } catch (nextError) {
        setError(getErrorMessage(nextError))
        return null
      } finally {
        setLoading(false)
      }
    },
  }
}

function syncEntries(
  setEntries: (value: StoredStorefrontOrderEntry[]) => void,
  setSelectedOrderNo: (value: string) => void,
  orderNo: string,
  options?: {
    includeLocalDraft?: boolean
  },
) {
  const nextEntries = listStoredStorefrontOrders(options)
  setEntries(nextEntries)
  setSelectedOrderNo(orderNo || (nextEntries[0]?.order.orderNo ?? ''))
}

function mergeOrders(base: StorefrontOrderSnapshot, incoming: StorefrontOrderSnapshot) {
  return {
    ...base,
    ...incoming,
    orderAccessToken: incoming.orderAccessToken || base.orderAccessToken,
    paymentInstruction: incoming.paymentInstruction
      ? {
          ...base.paymentInstruction,
          ...incoming.paymentInstruction,
        }
      : base.paymentInstruction,
    paymentProofs: mergePaymentProofs(base.paymentProofs, incoming.paymentProofs),
  } satisfies StorefrontOrderSnapshot
}

function mergePaymentProofs(
  left: StorefrontOrderSnapshot['paymentProofs'],
  right: StorefrontOrderSnapshot['paymentProofs'],
) {
  const seen = new Set<string>()

  return [...right, ...left].filter((item) => {
    const key = `${item.objectUrl}|${item.objectKey}|${item.createdAt}|${item.note}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Order request failed.'
}
