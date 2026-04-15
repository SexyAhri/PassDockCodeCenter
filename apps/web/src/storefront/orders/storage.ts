import type { StorefrontOrderSnapshot } from '../../api/storefrontOrders'

export type StoredStorefrontOrderEntry = {
  productSku: string
  updatedAt: number
  order: StorefrontOrderSnapshot
}

const STOREFRONT_ORDERS_STORAGE_KEY = 'passdock:storefront-orders'

type StoredStorefrontOrderOptions = {
  includeLocalDraft?: boolean
}

export function listStoredStorefrontOrders(options: StoredStorefrontOrderOptions = {}) {
  return filterStoredStorefrontEntries(readStoredStorefrontOrders(), options).sort(
    (left, right) => right.updatedAt - left.updatedAt,
  )
}

export function getStoredStorefrontOrderEntry(
  orderNo: string,
  options: StoredStorefrontOrderOptions = {},
) {
  const entries = Object.fromEntries(
    filterStoredStorefrontEntries(readStoredStorefrontOrders(), options).map((entry) => [
      entry.order.orderNo,
      entry,
    ]),
  ) as Record<string, StoredStorefrontOrderEntry>

  return entries[orderNo] ?? null
}

export function getStoredStorefrontOrder(orderNo: string, options: StoredStorefrontOrderOptions = {}) {
  return getStoredStorefrontOrderEntry(orderNo, options)?.order ?? null
}

export function getLatestStoredStorefrontOrderForProduct(
  productSku: string,
  options: StoredStorefrontOrderOptions = {},
) {
  return listStoredStorefrontOrders(options).find((entry) => entry.productSku === productSku)?.order ?? null
}

export function persistStoredStorefrontOrder(productSku: string, order: StorefrontOrderSnapshot) {
  const entries = readStoredStorefrontOrders()
  entries[order.orderNo] = {
    productSku,
    updatedAt: Date.now(),
    order,
  }

  const trimmedEntries = Object.fromEntries(
    Object.entries(entries)
      .sort(([, left], [, right]) => right.updatedAt - left.updatedAt)
      .slice(0, 24),
  ) as Record<string, StoredStorefrontOrderEntry>

  writeStoredStorefrontOrders(trimmedEntries)
}

export function inferStorefrontOrderProductSku(order: Pick<StorefrontOrderSnapshot, 'buyerRef'>) {
  if (typeof order.buyerRef !== 'string') {
    return ''
  }

  const match = order.buyerRef.match(/^web:(.+)$/)
  return match?.[1] ?? ''
}

function filterStoredStorefrontEntries(
  entries: Record<string, StoredStorefrontOrderEntry>,
  options: StoredStorefrontOrderOptions,
) {
  const includeLocalDraft = options.includeLocalDraft ?? true

  return Object.values(entries).filter(
    (entry) => includeLocalDraft || !isLocalDraftStorefrontOrder(entry.order),
  )
}

function isLocalDraftStorefrontOrder(order: Pick<StorefrontOrderSnapshot, 'orderNo'>) {
  return String(order.orderNo ?? '').startsWith('PD-LOCAL-')
}

function readStoredStorefrontOrders() {
  if (typeof window === 'undefined') {
    return {} as Record<string, StoredStorefrontOrderEntry>
  }

  try {
    const rawValue = window.sessionStorage.getItem(STOREFRONT_ORDERS_STORAGE_KEY)

    if (!rawValue) {
      return {} as Record<string, StoredStorefrontOrderEntry>
    }

    const parsed = JSON.parse(rawValue) as Record<string, StoredStorefrontOrderEntry>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {} as Record<string, StoredStorefrontOrderEntry>
  }
}

function writeStoredStorefrontOrders(entries: Record<string, StoredStorefrontOrderEntry>) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(STOREFRONT_ORDERS_STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Ignore storage failures and keep the storefront functional.
  }
}
