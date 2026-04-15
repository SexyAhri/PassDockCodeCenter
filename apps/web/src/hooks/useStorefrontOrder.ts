import { useEffect, useState } from 'react'

import {
  cancelStorefrontOrder,
  createStorefrontOrder,
  getStorefrontOrderDelivery,
  getStorefrontOrderDetail,
  markStorefrontOrderPaid,
  uploadStorefrontPaymentProof,
  type StorefrontDeliveryResult,
  type StorefrontOrderSnapshot,
  type UploadPaymentProofInput,
} from '../api/storefrontOrders'
import { isRemoteApiEnabled } from '../api/config'
import { uploadStorefrontPaymentProofAsset } from '../api/storefrontUploads'
import type { StorefrontProduct, StorefrontProductPriceOption } from '../data/catalog'
import type { PaymentChannel } from '../data/paymentChannels'
import type { PaymentMethodKey } from '../i18n/copy'
import {
  getLatestStoredStorefrontOrderForProduct,
  getStoredStorefrontOrder,
  inferStorefrontOrderProductSku,
  persistStoredStorefrontOrder,
} from '../storefront/orders/storage'

type StorefrontOrderSource = 'local' | 'remote' | 'remote-error'

type UseStorefrontOrderInput = {
  product: StorefrontProduct
  paymentChannelMap: Record<PaymentMethodKey, PaymentChannel>
}

type CreateOrderSelection = {
  paymentMethod: PaymentMethodKey
  priceOption?: StorefrontProductPriceOption | null
}

type LookupOrderInput = {
  orderNo: string
  accessToken?: string
}

export function useStorefrontOrder(input: UseStorefrontOrderInput) {
  const { product, paymentChannelMap } = input
  const remoteEnabled = isRemoteApiEnabled()
  const storedOrderOptions = remoteEnabled ? { includeLocalDraft: false } : undefined
  const [order, setOrder] = useState<StorefrontOrderSnapshot | null>(() =>
    getLatestStoredStorefrontOrderForProduct(product.sku, storedOrderOptions),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deliveryResult, setDeliveryResult] = useState<StorefrontDeliveryResult | null>(null)
  const [source, setSource] = useState<StorefrontOrderSource>(() =>
    remoteEnabled ? 'remote' : 'local',
  )

  useEffect(() => {
    const storedOrder = getLatestStoredStorefrontOrderForProduct(product.sku, storedOrderOptions)

    setOrder(storedOrder)
    setDeliveryResult(storedOrder?.deliveryResult ?? null)
    setSource(remoteEnabled ? 'remote' : 'local')
    setError(null)
  }, [product.sku, remoteEnabled])

  return {
    order,
    deliveryResult,
    loading,
    error,
    source,
    clearError: () => setError(null),
    createOrder: async (selection: CreateOrderSelection) => {
      const { paymentMethod, priceOption } = selection
      const fallbackOrder = buildFallbackOrder(product, paymentChannelMap[paymentMethod], paymentMethod, priceOption)

      setLoading(true)
      setError(null)

      if (!remoteEnabled) {
        applyOrderState(product.sku, fallbackOrder, 'local', setOrder, setSource)
        setDeliveryResult(fallbackOrder.deliveryResult)
        setLoading(false)
        return fallbackOrder
      }

      try {
        const remoteOrder = await createStorefrontOrder({
          productId: product.id,
          priceId: resolvePriceID(priceOption, paymentMethod),
          templateName: priceOption?.templateName,
          billingCycle: priceOption?.billingCycle,
          paymentMethod,
          buyerRef: `web:${product.sku}`,
          quantity: 1,
          currency: priceOption?.currency ?? product.currency,
          sourceChannel: 'web',
        })
        const nextOrder = mergeOrders(fallbackOrder, remoteOrder)

        applyOrderState(resolveOrderProductSku(nextOrder, product.sku), nextOrder, 'remote', setOrder, setSource)
        setDeliveryResult(nextOrder.deliveryResult)
        return nextOrder
      } catch (nextError) {
        setSource('remote-error')
        setError(getErrorMessage(nextError))
        return null
      } finally {
        setLoading(false)
      }
    },
    lookupOrder: async (input: LookupOrderInput) => {
      const trimmedOrderNo = input.orderNo.trim()
      const trimmedAccessToken = String(input.accessToken ?? '').trim()

      if (!trimmedOrderNo) {
        return null
      }

      setLoading(true)
      setError(null)

      const storedOrder = getStoredStorefrontOrder(trimmedOrderNo, storedOrderOptions)

      if (!remoteEnabled) {
        if (!storedOrder) {
          setError('Order not found in local draft.')
          setLoading(false)
          return null
        }

        applyOrderState(resolveOrderProductSku(storedOrder, product.sku), storedOrder, 'local', setOrder, setSource)
        setDeliveryResult(storedOrder.deliveryResult)
        setLoading(false)
        return storedOrder
      }

      try {
        const remoteOrder = await getStorefrontOrderDetail(
          trimmedOrderNo,
          trimmedAccessToken || storedOrder?.orderAccessToken,
        )
        const nextOrder = storedOrder ? mergeOrders(storedOrder, remoteOrder) : remoteOrder

        applyOrderState(resolveOrderProductSku(nextOrder, product.sku), nextOrder, 'remote', setOrder, setSource)
        setDeliveryResult(nextOrder.deliveryResult)
        return nextOrder
      } catch (nextError) {
        if (storedOrder) {
          applyOrderState(
            resolveOrderProductSku(storedOrder, product.sku),
            storedOrder,
            'remote-error',
            setOrder,
            setSource,
          )
          setDeliveryResult(storedOrder.deliveryResult)
          setError(getErrorMessage(nextError))
          return storedOrder
        }

        setError(getErrorMessage(nextError))
        return null
      } finally {
        setLoading(false)
      }
    },
    refreshOrder: async () => {
      if (!order) {
        return null
      }

      setLoading(true)
      setError(null)

      if (!remoteEnabled) {
        setLoading(false)
        return order
      }

      try {
        const remoteOrder = await getStorefrontOrderDetail(order.orderNo, order.orderAccessToken)
        const nextOrder = mergeOrders(order, remoteOrder)

        applyOrderState(resolveOrderProductSku(nextOrder, product.sku), nextOrder, 'remote', setOrder, setSource)
        setDeliveryResult(nextOrder.deliveryResult)
        return nextOrder
      } catch (nextError) {
        setSource('remote-error')
        setError(getErrorMessage(nextError))
        return null
      } finally {
        setLoading(false)
      }
    },
    markPaid: async () => {
      if (!order) {
        return null
      }

      setLoading(true)
      setError(null)

      if (!remoteEnabled) {
        if (!canMutateLocalStorefrontDraft(source, remoteEnabled)) {
          setError(getRemoteActionRequiredMessage())
          setLoading(false)
          return null
        }

        const nextOrder = {
          ...order,
          orderStatus: 'paid_pending_review',
          paymentStatus: 'pending_review',
        }

        applyOrderState(
          resolveOrderProductSku(nextOrder, product.sku),
          nextOrder,
          'local',
          setOrder,
          setSource,
        )
        setDeliveryResult(nextOrder.deliveryResult)
        setLoading(false)
        return nextOrder
      }

      try {
        await markStorefrontOrderPaid(order.orderNo, order.orderAccessToken)
        const remoteOrder = await getStorefrontOrderDetail(order.orderNo, order.orderAccessToken)
        const nextOrder = mergeOrders(order, remoteOrder)

        applyOrderState(resolveOrderProductSku(nextOrder, product.sku), nextOrder, 'remote', setOrder, setSource)
        setDeliveryResult(nextOrder.deliveryResult)
        return nextOrder
      } catch (nextError) {
        setSource('remote-error')
        setError(getErrorMessage(nextError))
        return null
      } finally {
        setLoading(false)
      }
    },
    submitPaymentProof: async (input: UploadPaymentProofInput) => {
      if (!order) {
        return null
      }

      setLoading(true)
      setError(null)

      try {
        if (!remoteEnabled && !canMutateLocalStorefrontDraft(source, remoteEnabled)) {
          setError(getRemoteActionRequiredMessage())
          return null
        }

        let preparedInput = { ...input }
        if (preparedInput.file) {
          if (remoteEnabled) {
            const uploadedObject = await uploadStorefrontPaymentProofAsset(
              preparedInput.file,
              order.orderNo,
              order.orderAccessToken,
            )
            preparedInput = {
              ...preparedInput,
              objectKey: uploadedObject.objectKey,
              objectUrl: uploadedObject.objectUrl,
            }
          } else {
            preparedInput = {
              ...preparedInput,
              objectKey: preparedInput.objectKey ?? preparedInput.file.name,
              objectUrl: preparedInput.objectUrl ?? URL.createObjectURL(preparedInput.file),
            }
          }
        }

        if (!preparedInput.objectUrl?.trim()) {
          setError('Payment proof file is required.')
          return null
        }

        const proofDraft = buildPaymentProofDraft(preparedInput)
        const nextLocalOrder = {
          ...order,
          paymentProofs: [proofDraft, ...order.paymentProofs],
        } satisfies StorefrontOrderSnapshot

        if (canMutateLocalStorefrontDraft(source, remoteEnabled)) {
          applyOrderState(
            resolveOrderProductSku(nextLocalOrder, product.sku),
            nextLocalOrder,
            'local',
            setOrder,
            setSource,
          )
          setDeliveryResult(nextLocalOrder.deliveryResult)
          return nextLocalOrder
        }

        await uploadStorefrontPaymentProof(order.orderNo, preparedInput, order.orderAccessToken)

        try {
          const remoteOrder = await getStorefrontOrderDetail(order.orderNo, order.orderAccessToken)
          const nextOrder = mergeOrders(nextLocalOrder, remoteOrder)

          applyOrderState(resolveOrderProductSku(nextOrder, product.sku), nextOrder, 'remote', setOrder, setSource)
          setDeliveryResult(nextOrder.deliveryResult)
          return nextOrder
        } catch {
          applyOrderState(
            resolveOrderProductSku(nextLocalOrder, product.sku),
            nextLocalOrder,
            'remote-error',
            setOrder,
            setSource,
          )
          setDeliveryResult(nextLocalOrder.deliveryResult)
          return nextLocalOrder
        }
      } catch (nextError) {
        if (remoteEnabled) {
          setSource('remote-error')
        }
        setError(getErrorMessage(nextError))
        return null
      } finally {
        setLoading(false)
      }
    },
    cancelOrder: async () => {
      if (!order) {
        return null
      }

      setLoading(true)
      setError(null)

      if (!remoteEnabled) {
        if (!canMutateLocalStorefrontDraft(source, remoteEnabled)) {
          setError(getRemoteActionRequiredMessage())
          setLoading(false)
          return null
        }

        const nextOrder = {
          ...order,
          orderStatus: 'cancelled',
          paymentStatus: order.paymentStatus === 'paid' ? order.paymentStatus : 'failed',
          deliveryStatus: 'cancelled',
        }

        applyOrderState(
          resolveOrderProductSku(nextOrder, product.sku),
          nextOrder,
          'local',
          setOrder,
          setSource,
        )
        setDeliveryResult(nextOrder.deliveryResult)
        setLoading(false)
        return nextOrder
      }

      try {
        await cancelStorefrontOrder(order.orderNo, order.orderAccessToken)
        const remoteOrder = await getStorefrontOrderDetail(order.orderNo, order.orderAccessToken)
        const nextOrder = mergeOrders(order, remoteOrder)

        applyOrderState(resolveOrderProductSku(nextOrder, product.sku), nextOrder, 'remote', setOrder, setSource)
        setDeliveryResult(nextOrder.deliveryResult)
        return nextOrder
      } catch (nextError) {
        setSource('remote-error')
        setError(getErrorMessage(nextError))
        return null
      } finally {
        setLoading(false)
      }
    },
    loadDeliveryResult: async () => {
      if (!order) {
        return null
      }

      setLoading(true)
      setError(null)

      if (!remoteEnabled) {
        setLoading(false)
        return null
      }

      try {
        const nextDeliveryResult = await getStorefrontOrderDelivery(order.orderNo, order.orderAccessToken)
        const nextOrder = {
          ...order,
          deliveryResult: nextDeliveryResult,
        } satisfies StorefrontOrderSnapshot

        applyOrderState(resolveOrderProductSku(nextOrder, product.sku), nextOrder, source, setOrder, setSource)
        setDeliveryResult(nextDeliveryResult)
        return nextDeliveryResult
      } catch (nextError) {
        setSource('remote-error')
        setError(getErrorMessage(nextError))
        return null
      } finally {
        setLoading(false)
      }
    },
  }
}

function buildFallbackOrder(
  product: StorefrontProduct,
  channel: PaymentChannel | undefined,
  paymentMethod: PaymentMethodKey,
  priceOption?: StorefrontProductPriceOption | null,
) {
  const orderNo = `PD-LOCAL-${Date.now().toString().slice(-8)}`
  const resolvedPriceOption = priceOption ?? product.priceOptions[0] ?? null
  const displayAmount = resolvedPriceOption?.amount ?? product.price
  const currency = resolvedPriceOption?.currency ?? product.currency ?? channel?.currency ?? 'RMB'

  return {
    orderNo,
    orderAccessToken: '',
    orderStatus: 'awaiting_payment',
    paymentStatus: 'unpaid',
    deliveryStatus: 'pending',
    paymentMethod,
    sourceChannel: 'web',
    botKey: '',
    buyerRef: `web:${product.sku}`,
    quantity: 1,
    currency,
    displayAmount,
    priceId: resolvePriceID(resolvedPriceOption, paymentMethod),
    templateName: resolvedPriceOption?.templateName ?? '',
    billingCycle: resolvedPriceOption?.billingCycle ?? '',
    paymentInstruction: {
      channelKey: channel?.channelKey ?? paymentMethod,
      type: 'qr',
      displayAmount,
      currency: channel?.currency ?? currency,
      qrContent: channel?.qrValue ?? '',
      expireAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      reference: channel?.reference ?? orderNo,
    },
    paymentProofs: [],
    deliveryResult: null,
  } satisfies StorefrontOrderSnapshot
}

function buildPaymentProofDraft(input: UploadPaymentProofInput) {
  return {
    proofType: input.proofType ?? 'screenshot',
    objectKey: input.objectKey ?? '',
    objectUrl: input.objectUrl ?? '',
    reviewStatus: 'pending',
    reviewedAt: '',
    note: input.note ?? '',
    createdAt: new Date().toISOString(),
  }
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
  const merged = [...right, ...left].filter((item) => {
    const key = `${item.objectUrl}|${item.objectKey}|${item.createdAt}|${item.note}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })

  return merged
}

function applyOrderState(
  productSku: string,
  order: StorefrontOrderSnapshot,
  source: StorefrontOrderSource,
  setOrder: (value: StorefrontOrderSnapshot | null) => void,
  setSource: (value: StorefrontOrderSource) => void,
) {
  setOrder(order)
  setSource(source)
  persistStoredStorefrontOrder(productSku, order)
}

function resolveOrderProductSku(order: Pick<StorefrontOrderSnapshot, 'buyerRef'>, fallbackSku: string) {
  return inferStorefrontOrderProductSku(order) || fallbackSku
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Checkout request failed.'
}

function canMutateLocalStorefrontDraft(source: StorefrontOrderSource, remoteEnabled: boolean) {
  return !remoteEnabled && source === 'local'
}

function getRemoteActionRequiredMessage() {
  return 'Remote API is required for this action.'
}

function resolvePriceID(
  priceOption: StorefrontProductPriceOption | null | undefined,
  paymentMethod: PaymentMethodKey,
) {
  if (!priceOption) {
    return ''
  }

  return String(priceOption.priceIdByPaymentMethod[paymentMethod] ?? '')
}
