import { useEffect, useRef, useState } from 'react'

import { createAdminAuditLog } from '../admin/audit'
import type {
  AdminManagedProduct,
  AdminManagedProductType,
  AdminProductDraft,
  AdminProductPriceTemplate,
  ProductArtVariant,
  ProductBillingCycle,
} from '../admin/products/types'
import { loadAdminProductsRemoteDraft } from '../api/adminProducts'
import { isRemoteApiEnabled } from '../api/config'
import { getAdminCatalogSeedProducts } from '../data/catalog'
import { usePersistentState } from './usePersistentState'
import type { AdminDraftSource } from './useAdminSystemConfig'

const adminProductsStorageKey = 'passdock.admin.products-config.v1'

const fulfillmentStrategyBindings: Record<string, string> = {
  'credit-trial': 'recharge_code_standard',
  'starter-monthly': 'subscription_code_standard',
  'pro-monthly': 'subscription_code_standard',
  'team-quarterly': 'manual_review_delivery',
  'enterprise-yearly': 'manual_review_delivery',
}

const deliveryStrategyBindings: Record<string, string> = {
  'credit-trial': 'telegram_and_web_default',
  'starter-monthly': 'telegram_and_web_default',
  'pro-monthly': 'telegram_and_web_default',
  'team-quarterly': 'telegram_and_web_default',
  'enterprise-yearly': 'manual_email_enterprise',
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function inferBillingCycle(seed: ReturnType<typeof getAdminCatalogSeedProducts>[number]): ProductBillingCycle {
  if (seed.sku.includes('monthly')) {
    return 'monthly'
  }

  if (seed.sku.includes('quarterly')) {
    return 'quarterly'
  }

  if (seed.sku.includes('yearly') || seed.sku.includes('annual')) {
    return 'yearly'
  }

  return 'one_time'
}

function inferProductType(seed: ReturnType<typeof getAdminCatalogSeedProducts>[number]): AdminManagedProductType {
  if (seed.sku.includes('trial') || seed.sku.includes('credit') || seed.sku.includes('recharge')) {
    return 'recharge'
  }

  if (seed.sku.includes('monthly') || seed.sku.includes('quarterly') || seed.sku.includes('yearly')) {
    return 'subscription'
  }

  return 'digital'
}

function inferArtVariant(seed: ReturnType<typeof getAdminCatalogSeedProducts>[number]): ProductArtVariant {
  switch (seed.artVariant) {
    case 'trial':
    case 'starter':
    case 'growth':
    case 'team':
    case 'enterprise':
      return seed.artVariant
    default:
      return 'starter'
  }
}

export function getInitialAdminProductsDraft(): AdminProductDraft {
  const seeds = getAdminCatalogSeedProducts()

  const products: AdminManagedProduct[] = seeds.map((seed, index) => ({
    key: seed.sku,
    productType: inferProductType(seed),
    sku: seed.sku,
    nameZh: seed.nameZh,
    nameEn: seed.nameEn,
    badgeZh: seed.badgeZh,
    badgeEn: seed.badgeEn,
    cycleLabelZh: seed.cycleLabelZh,
    cycleLabelEn: seed.cycleLabelEn,
    deliveryLabelZh: seed.deliveryLabelZh,
    deliveryLabelEn: seed.deliveryLabelEn,
    stockLabelZh: seed.stockLabelZh,
    stockLabelEn: seed.stockLabelEn,
    statusLabelZh: seed.statusLabelZh,
    statusLabelEn: seed.statusLabelEn,
    currency: seed.currency,
    displayPrice: seed.price,
    originalPrice: seed.originalPrice,
    billingCycle: inferBillingCycle(seed),
    inventory: seed.inventory,
    tagsZh: seed.tagsZh,
    tagsEn: seed.tagsEn,
    checkoutNotesZh: seed.checkoutNotesZh,
    checkoutNotesEn: seed.checkoutNotesEn,
    artVariant: inferArtVariant(seed),
    enabled: true,
    sortOrder: index + 1,
    paymentMethods: seed.paymentMethods,
    fulfillmentStrategyKey: fulfillmentStrategyBindings[seed.sku] ?? '',
    deliveryStrategyKey: deliveryStrategyBindings[seed.sku] ?? '',
  }))

  const priceTemplates: AdminProductPriceTemplate[] = products.map((product, index) => ({
    key: `price_${product.sku}`,
    productSku: product.sku,
    templateName: product.nameEn,
    paymentMethod: product.paymentMethods[0] ?? 'wechat_qr',
    amount: product.displayPrice,
    originalAmount: product.originalPrice,
    currency: product.currency,
    billingCycle: product.billingCycle,
    enabled: true,
    sortOrder: index + 1,
  }))

  return {
    products: cloneValue(products),
    priceTemplates: cloneValue(priceTemplates),
  }
}

function getEmptyAdminProductsDraft(): AdminProductDraft {
  return {
    products: [],
    priceTemplates: [],
  }
}

const initialAdminProductsDraftSignature = JSON.stringify(getInitialAdminProductsDraft())

function isSeededAdminProductsDraft(value: AdminProductDraft) {
  return JSON.stringify(value) === initialAdminProductsDraftSignature
}

export function useAdminProductsConfig() {
  const remoteEnabled = isRemoteApiEnabled()
  const [draft, setDraft] = usePersistentState(
    adminProductsStorageKey,
    () => (remoteEnabled ? getEmptyAdminProductsDraft() : getInitialAdminProductsDraft()),
    {
      shouldUseStoredValue: (value) => !remoteEnabled || !isSeededAdminProductsDraft(value),
    },
  )
  const [loading, setLoading] = useState(remoteEnabled)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<AdminDraftSource>(() =>
    remoteEnabled ? 'remote' : 'local',
  )
  const hydratedRef = useRef(false)
  const hydrateRemoteDraftRef = useRef<(mode: 'reload' | 'reset') => Promise<void>>(async () => undefined)

  hydrateRemoteDraftRef.current = hydrateRemoteDraft

  useEffect(() => {
    if (!remoteEnabled) {
      setSource('local')
      setError(null)
      setLoading(false)
      return
    }

    if (hydratedRef.current) {
      return
    }

    hydratedRef.current = true
    void hydrateRemoteDraftRef.current('reload').catch(() => undefined)
  }, [remoteEnabled])

  async function hydrateRemoteDraft(mode: 'reload' | 'reset') {
    if (!remoteEnabled) {
      const nextDraft = getInitialAdminProductsDraft()

      if (mode === 'reset') {
        setDraft(nextDraft)
      }

      setSource('local')
      setError(null)
      return
    }

    setLoading(true)
    setSource('remote')

    try {
      const remoteDraft = await loadAdminProductsRemoteDraft()

      setDraft(remoteDraft)
      setSource('remote')
      setError(null)
    } catch (nextError) {
      if (mode === 'reset') {
        setDraft(getEmptyAdminProductsDraft())
      }

      setSource('remote-error')
      setError(getErrorMessage(nextError))
      throw nextError
    } finally {
      setLoading(false)
    }
  }

  return {
    draft,
    setDraft,
    loading,
    error,
    source,
    remoteEnabled,
    reload: () => hydrateRemoteDraft('reload'),
    resetDraft: () => (remoteEnabled ? hydrateRemoteDraft('reset') : Promise.resolve(setDraft(getInitialAdminProductsDraft()))),
  }
}

export function createAdminProductAuditLog(action: string, targetId: string, operator: string) {
  return createAdminAuditLog('products', action, targetId, operator)
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Failed to load remote product configuration.'
}
