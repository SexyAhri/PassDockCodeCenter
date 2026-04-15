import type { PaymentMethodKey } from '../../i18n/copy'
import type {
  AdminManagedProduct,
  AdminManagedProductType,
  AdminProductDraft,
  AdminProductPriceTemplate,
  ProductArtVariant,
  ProductBillingCycle,
} from './types'

export function upsertAdminProduct(
  draft: AdminProductDraft,
  mode: 'create' | 'edit',
  values: Record<string, unknown>,
) {
  const rawSku = String(values.sku ?? '')
  const existingRecord =
    draft.products.find((item) => item.key === String(values.key ?? '')) ??
    draft.products.find((item) => item.sku === rawSku)

  const record: AdminManagedProduct = {
    key: existingRecord?.key ?? String(values.key ?? createRowKey('product')),
    productType: normalizeProductType(values.productType),
    sku: rawSku,
    nameZh: String(values.nameZh ?? ''),
    nameEn: String(values.nameEn ?? ''),
    badgeZh: String(values.badgeZh ?? ''),
    badgeEn: String(values.badgeEn ?? ''),
    cycleLabelZh: String(values.cycleLabelZh ?? ''),
    cycleLabelEn: String(values.cycleLabelEn ?? ''),
    deliveryLabelZh: String(values.deliveryLabelZh ?? ''),
    deliveryLabelEn: String(values.deliveryLabelEn ?? ''),
    stockLabelZh: String(values.stockLabelZh ?? ''),
    stockLabelEn: String(values.stockLabelEn ?? ''),
    statusLabelZh: String(values.statusLabelZh ?? ''),
    statusLabelEn: String(values.statusLabelEn ?? ''),
    currency: String(values.currency ?? 'RMB'),
    displayPrice: String(values.displayPrice ?? ''),
    originalPrice: String(values.originalPrice ?? ''),
    billingCycle: normalizeBillingCycle(values.billingCycle),
    inventory: Number(values.inventory ?? 0),
    tagsZh: normalizeStringList(values.tagsZh),
    tagsEn: normalizeStringList(values.tagsEn),
    checkoutNotesZh: normalizeStringList(values.checkoutNotesZh),
    checkoutNotesEn: normalizeStringList(values.checkoutNotesEn),
    artVariant: normalizeArtVariant(values.artVariant),
    enabled: values.enabled === undefined ? true : Boolean(values.enabled),
    sortOrder: Number(values.sortOrder ?? existingRecord?.sortOrder ?? draft.products.length + 1),
    paymentMethods: normalizePaymentMethods(values.paymentMethods),
    fulfillmentStrategyKey: String(values.fulfillmentStrategyKey ?? ''),
    deliveryStrategyKey: String(values.deliveryStrategyKey ?? ''),
  }

  const previousSku = existingRecord?.sku
  let nextPriceTemplates = draft.priceTemplates

  if (previousSku && previousSku !== record.sku) {
    nextPriceTemplates = nextPriceTemplates.map((template) =>
      template.productSku === previousSku
        ? {
            ...template,
            productSku: record.sku,
          }
        : template,
    )
  }

  if (mode === 'create' && !nextPriceTemplates.some((template) => template.productSku === record.sku)) {
    nextPriceTemplates = [createDefaultPriceTemplate(record), ...nextPriceTemplates]
  }

  return {
    draft: {
      ...draft,
      products: upsertProductRows(draft.products, record),
      priceTemplates: nextPriceTemplates,
    },
    targetId: record.sku,
  }
}

export function deleteAdminProduct(draft: AdminProductDraft, product: AdminManagedProduct) {
  return {
    draft: {
      ...draft,
      products: draft.products.filter((item) => item.key !== product.key),
      priceTemplates: draft.priceTemplates.filter((template) => template.productSku !== product.sku),
    },
    targetId: product.sku,
  }
}

export function deleteAdminProducts(draft: AdminProductDraft, productKeys: string[]) {
  const keySet = new Set(productKeys)
  const deletedProducts = draft.products.filter((item) => keySet.has(item.key))
  const deletedSkus = new Set(deletedProducts.map((item) => item.sku))

  return {
    draft: {
      ...draft,
      products: draft.products.filter((item) => !keySet.has(item.key)),
      priceTemplates: draft.priceTemplates.filter((template) => !deletedSkus.has(template.productSku)),
    },
    targetIds: deletedProducts.map((item) => item.sku),
  }
}

export function updateAdminProductsEnabled(
  draft: AdminProductDraft,
  productKeys: string[],
  enabled: boolean,
) {
  const keySet = new Set(productKeys)
  const targetIds = draft.products.filter((item) => keySet.has(item.key)).map((item) => item.sku)

  return {
    draft: {
      ...draft,
      products: draft.products.map((item) =>
        keySet.has(item.key)
          ? {
              ...item,
              enabled,
            }
          : item,
      ),
    },
    targetIds,
  }
}

export function upsertAdminProductPriceTemplate(
  draft: AdminProductDraft,
  productSku: string,
  values: Record<string, unknown>,
) {
  const identityKey = String(values.key ?? '')
  const nextProductSku = String(values.productSku ?? productSku)
  const nextTemplateName = String(values.templateName ?? '')
  const nextPaymentMethod = normalizePaymentMethod(values.paymentMethod)
  const existingRecord =
    draft.priceTemplates.find((item) => item.key === identityKey) ??
    draft.priceTemplates.find(
      (item) =>
        item.productSku === nextProductSku &&
        item.templateName === nextTemplateName &&
        item.paymentMethod === nextPaymentMethod,
    )

  const record: AdminProductPriceTemplate = {
    key: existingRecord?.key ?? String(values.key ?? createRowKey('price')),
    productSku: nextProductSku,
    templateName: nextTemplateName,
    paymentMethod: nextPaymentMethod,
    amount: String(values.amount ?? ''),
    originalAmount: String(values.originalAmount ?? ''),
    currency: String(values.currency ?? 'RMB'),
    billingCycle: normalizeBillingCycle(values.billingCycle),
    enabled: values.enabled === undefined ? true : Boolean(values.enabled),
    sortOrder: Number(values.sortOrder ?? existingRecord?.sortOrder ?? 1),
  }

  return {
    draft: {
      ...draft,
      priceTemplates: upsertPriceTemplateRows(draft.priceTemplates, record),
    },
    targetId: buildPriceTemplateTargetId(record),
  }
}

export function deleteAdminProductPriceTemplate(
  draft: AdminProductDraft,
  template: AdminProductPriceTemplate,
) {
  return {
    draft: {
      ...draft,
      priceTemplates: draft.priceTemplates.filter((item) => item.key !== template.key),
    },
    targetId: buildPriceTemplateTargetId(template),
  }
}

export function deleteAdminProductPriceTemplates(draft: AdminProductDraft, templateKeys: string[]) {
  const keySet = new Set(templateKeys)
  const deletedTemplates = draft.priceTemplates.filter((item) => keySet.has(item.key))

  return {
    draft: {
      ...draft,
      priceTemplates: draft.priceTemplates.filter((item) => !keySet.has(item.key)),
    },
    targetIds: deletedTemplates.map((item) => buildPriceTemplateTargetId(item)),
  }
}

export function updateAdminProductPriceTemplatesEnabled(
  draft: AdminProductDraft,
  templateKeys: string[],
  enabled: boolean,
) {
  const keySet = new Set(templateKeys)
  const targetIds = draft.priceTemplates
    .filter((item) => keySet.has(item.key))
    .map((item) => buildPriceTemplateTargetId(item))

  return {
    draft: {
      ...draft,
      priceTemplates: draft.priceTemplates.map((item) =>
        keySet.has(item.key)
          ? {
              ...item,
              enabled,
            }
          : item,
      ),
    },
    targetIds,
  }
}

function normalizeProductType(value: unknown): AdminManagedProductType {
  switch (value) {
    case 'recharge':
    case 'subscription':
    case 'digital':
    case 'manual':
      return value
    default:
      return 'digital'
  }
}

function normalizeArtVariant(value: unknown): ProductArtVariant {
  switch (value) {
    case 'trial':
    case 'starter':
    case 'growth':
    case 'team':
    case 'enterprise':
      return value
    case 'pro':
      return 'growth'
    default:
      return 'starter'
  }
}

function normalizeBillingCycle(value: unknown): ProductBillingCycle {
  switch (value) {
    case 'monthly':
    case 'quarterly':
    case 'yearly':
    case 'one_time':
      return value
    default:
      return 'one_time'
  }
}

function normalizePaymentMethods(value: unknown): PaymentMethodKey[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is PaymentMethodKey => typeof item === 'string' && item.length > 0)
}

function normalizeStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean)
  }

  return String(value ?? '')
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizePaymentMethod(value: unknown): PaymentMethodKey {
  switch (value) {
    case 'alipay_qr':
    case 'okx_usdt':
      return value
    default:
      return 'wechat_qr'
  }
}

function createDefaultPriceTemplate(product: AdminManagedProduct): AdminProductPriceTemplate {
  return {
    key: createRowKey('price'),
    productSku: product.sku,
    templateName: product.nameEn || product.sku,
    paymentMethod: product.paymentMethods[0] ?? 'wechat_qr',
    amount: product.displayPrice,
    originalAmount: product.originalPrice,
    currency: product.currency,
    billingCycle: product.billingCycle,
    enabled: product.enabled,
    sortOrder: 1,
  }
}

function upsertProductRows(rows: AdminManagedProduct[], nextRow: AdminManagedProduct) {
  const keyIndex = rows.findIndex((row) => row.key === nextRow.key)
  const businessIndex = rows.findIndex((row) => row.sku === nextRow.sku)
  const matchIndex = keyIndex >= 0 ? keyIndex : businessIndex

  if (matchIndex < 0) {
    return [nextRow, ...rows]
  }

  return rows.map((row, index) => (index === matchIndex ? nextRow : row))
}

function upsertPriceTemplateRows(rows: AdminProductPriceTemplate[], nextRow: AdminProductPriceTemplate) {
  const keyIndex = rows.findIndex((row) => row.key === nextRow.key)
  const businessIndex = rows.findIndex(
    (row) =>
      row.productSku === nextRow.productSku &&
      row.templateName === nextRow.templateName &&
      row.paymentMethod === nextRow.paymentMethod,
  )
  const matchIndex = keyIndex >= 0 ? keyIndex : businessIndex

  if (matchIndex < 0) {
    return [nextRow, ...rows]
  }

  return rows.map((row, index) => (index === matchIndex ? nextRow : row))
}

function createRowKey(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`
}

function buildPriceTemplateTargetId(
  template: Pick<AdminProductPriceTemplate, 'productSku' | 'templateName' | 'paymentMethod'>,
) {
  return `${template.productSku}:${template.templateName}:${template.paymentMethod}`
}
