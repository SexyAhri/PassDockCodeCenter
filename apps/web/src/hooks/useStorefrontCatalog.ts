import { useEffect, useState } from 'react'

import { loadStorefrontRemoteSnapshot } from '../api/storefront'
import { isRemoteApiEnabled } from '../api/config'
import { getStorefrontProducts, type StorefrontProduct } from '../data/catalog'
import { getPaymentChannels, type PaymentChannel } from '../data/paymentChannels'
import type { Locale } from '../i18n/copy'

type StorefrontSource = 'local' | 'remote' | 'remote-error'

export function useStorefrontCatalog(locale: Locale) {
  const remoteEnabled = isRemoteApiEnabled()
  const [products, setProducts] = useState<StorefrontProduct[]>(() =>
    remoteEnabled ? [] : getStorefrontProducts(locale),
  )
  const [paymentChannels, setPaymentChannels] = useState<PaymentChannel[]>(() =>
    remoteEnabled ? [] : getPaymentChannels(locale),
  )
  const [loading, setLoading] = useState(remoteEnabled)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<StorefrontSource>(() =>
    remoteEnabled ? 'remote' : 'local',
  )

  useEffect(() => {
    const fallbackProducts = getStorefrontProducts(locale)

    if (!remoteEnabled) {
      setProducts(fallbackProducts)
      setPaymentChannels(getPaymentChannels(locale))
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
        const snapshot = await loadStorefrontRemoteSnapshot({
          locale,
        })

        if (cancelled) {
          return
        }

        setProducts(snapshot.products)
        setPaymentChannels(snapshot.paymentChannels)
        setSource('remote')
        setError(null)
      } catch (nextError) {
        if (cancelled) {
          return
        }

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
  }, [locale, remoteEnabled])

  return {
    products,
    paymentChannels,
    paymentChannelMap: Object.fromEntries(paymentChannels.map((item) => [item.key, item])) as Record<
      PaymentChannel['key'],
      PaymentChannel
    >,
    paymentChannelCount: paymentChannels.filter((item) => item.enabled).length,
    loading,
    error,
    source,
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Failed to load storefront data.'
}
