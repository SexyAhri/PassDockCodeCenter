import type {
  AdminManagedProduct,
  AdminManagedProductType,
  AdminProductDraft,
  AdminProductPriceTemplate,
  ProductArtVariant,
  ProductBillingCycle,
} from '../admin/products/types'
import type { PaymentMethodKey } from '../i18n/copy'
import { requestJson, unwrapListData } from './http'

type ProductDto = {
  id?: string | number
  product_id?: string | number
  product_type?: string
  sku?: string
  name?: string
  name_zh?: string
  name_en?: string
  display_price?: string | number
  original_price?: string | number
  currency?: string
  enabled?: boolean
  sort_order?: number
  payment_methods?: unknown
  fulfillment_strategy_key?: string
  delivery_strategy_key?: string
  billing_cycle?: string
  inventory?: number
  metadata?: Record<string, unknown>
}

type ProductPriceDto = {
  id?: string | number
  price_id?: string | number
  product_id?: string | number
  product_sku?: string
  sku?: string
  template_name?: string
  name?: string
  payment_method?: string
  amount?: string | number
  display_price?: string | number
  original_amount?: string | number
  original_price?: string | number
  currency?: string
  billing_cycle?: string
  enabled?: boolean
  sort_order?: number
}

export function supportsRemoteProductSection(section: string) {
  return section !== 'auditLogs'
}

export async function loadAdminProductsRemoteDraft(): Promise<AdminProductDraft> {
  const productsData = await requestJson<unknown>('/api/v1/admin/products')
  const productDtos = unwrapListData<ProductDto>(productsData)
  const mappedProducts = productDtos.map(mapProductDto)

  const priceGroups = await Promise.all(
    mappedProducts.map(async (product) => {
      const productId = resolveProductRouteId(product)

      if (!productId) {
        return []
      }

      try {
        const priceData = await requestJson<unknown>(
          `/api/v1/admin/products/${encodeURIComponent(productId)}/prices`,
        )
        const priceDtos = unwrapListData<ProductPriceDto>(priceData)
        return priceDtos.map((dto) => mapPriceTemplateDto(dto, product))
      } catch (error) {
        throw new Error(`Failed to load price templates for ${product.sku}: ${getErrorMessage(error)}`)
      }
    }),
  )

  return {
    products: mappedProducts,
    priceTemplates: priceGroups.flat(),
  }
}

export async function saveAdminProductSectionRecord(
  section: 'products' | 'priceTemplates',
  mode: 'create' | 'edit',
  values: Record<string, unknown>,
) {
  switch (section) {
    case 'products': {
      const routeId = resolveProductRouteId(values)

      await requestJson(
        mode === 'create' ? '/api/v1/admin/products' : `/api/v1/admin/products/${encodeURIComponent(routeId)}`,
        {
          method: mode === 'create' ? 'POST' : 'PUT',
          body: buildProductPayload(values),
        },
      )

      return String(values.sku ?? routeId)
    }
    case 'priceTemplates': {
      const productId = resolveProductRouteId(values)

	      await requestJson(`/api/v1/admin/products/${encodeURIComponent(productId)}/prices`, {
	        method: 'POST',
	        body: buildPriceTemplatePayload(values),
	      })

	      return buildPriceTemplateBusinessId(values)
    }
  }
}

export async function deleteAdminProductSectionRecord(
  section: 'products' | 'priceTemplates',
  values: Record<string, unknown>,
) {
  switch (section) {
    case 'products': {
      await requestJson(`/api/v1/admin/products/${encodeURIComponent(resolveProductRouteId(values))}`, {
        method: 'DELETE',
      })
      return
    }
    case 'priceTemplates': {
      const productId = resolveProductRouteId({
        key: values.productKey,
        productId: values.productId,
        sku: values.productSku,
      })
      const priceId = resolvePriceTemplateRouteId(values)

      await requestJson(
        `/api/v1/admin/products/${encodeURIComponent(productId)}/prices/${encodeURIComponent(priceId)}`,
        {
          method: 'DELETE',
        },
      )
    }
  }
}

function mapProductDto(dto: ProductDto): AdminManagedProduct {
  const metadata = getRecord(dto.metadata)
  const sku = String(dto.sku ?? dto.id ?? '')
  const name = String(dto.name ?? '')
  const paymentMethods = normalizePaymentMethods(dto.payment_methods ?? metadata.payment_methods)

  return {
    key: String(dto.id ?? dto.product_id ?? sku),
    productType: normalizeProductType(dto.product_type ?? metadata.product_type),
    sku,
    nameZh: String(dto.name_zh ?? dto.name ?? metadata.name_zh ?? ''),
    nameEn: String(dto.name_en ?? dto.name ?? metadata.name_en ?? name),
    badgeZh: String(metadata.badge_zh ?? ''),
    badgeEn: String(metadata.badge_en ?? ''),
    cycleLabelZh: String(metadata.cycle_label_zh ?? ''),
    cycleLabelEn: String(metadata.cycle_label_en ?? ''),
    deliveryLabelZh: String(metadata.delivery_label_zh ?? ''),
    deliveryLabelEn: String(metadata.delivery_label_en ?? ''),
    stockLabelZh: String(metadata.stock_label_zh ?? ''),
    stockLabelEn: String(metadata.stock_label_en ?? ''),
    statusLabelZh: String(metadata.status_label_zh ?? ''),
    statusLabelEn: String(metadata.status_label_en ?? ''),
    currency: String(dto.currency ?? 'RMB'),
    displayPrice: toText(dto.display_price ?? ''),
    originalPrice: toText(dto.original_price ?? metadata.original_price ?? ''),
    billingCycle: normalizeBillingCycle(dto.billing_cycle ?? metadata.billing_cycle),
    inventory: Number(dto.inventory ?? metadata.inventory ?? 0),
    tagsZh: normalizeStringList(metadata.tags_zh),
    tagsEn: normalizeStringList(metadata.tags_en),
    checkoutNotesZh: normalizeStringList(metadata.checkout_notes_zh),
    checkoutNotesEn: normalizeStringList(metadata.checkout_notes_en),
    artVariant: normalizeArtVariant(metadata.art_variant),
    enabled: dto.enabled !== false,
    sortOrder: Number(dto.sort_order ?? metadata.sort_order ?? 1),
    paymentMethods,
    fulfillmentStrategyKey: String(
      dto.fulfillment_strategy_key ?? metadata.fulfillment_strategy_key ?? '',
    ),
    deliveryStrategyKey: String(
      dto.delivery_strategy_key ?? metadata.delivery_strategy_key ?? '',
    ),
  }
}

function mapPriceTemplateDto(
  dto: ProductPriceDto,
  product: AdminManagedProduct,
): AdminProductPriceTemplate {
  const templateName = String(dto.template_name ?? dto.name ?? product.nameEn ?? product.sku)
  const paymentMethod = normalizePaymentMethod(dto.payment_method)

  return {
    key: String(
      dto.id ??
        dto.price_id ??
        buildPriceTemplateBusinessId({
          productSku: product.sku,
          templateName,
          paymentMethod,
        }),
    ),
    productSku: String(dto.product_sku ?? dto.sku ?? product.sku),
    templateName,
    paymentMethod,
    amount: toText(dto.amount ?? dto.display_price ?? product.displayPrice),
    originalAmount: toText(dto.original_amount ?? dto.original_price ?? product.originalPrice),
    currency: String(dto.currency ?? product.currency),
    billingCycle: normalizeBillingCycle(dto.billing_cycle ?? product.billingCycle),
    enabled: dto.enabled !== false,
    sortOrder: Number(dto.sort_order ?? 1),
  }
}

function buildProductPayload(values: Record<string, unknown>) {
  const nameZh = String(values.nameZh ?? '')
  const nameEn = String(values.nameEn ?? '')

  return {
    product_type: normalizeProductType(values.productType),
    sku: String(values.sku ?? ''),
    name: nameEn || nameZh || String(values.sku ?? ''),
    display_price: String(values.displayPrice ?? ''),
    currency: String(values.currency ?? 'RMB'),
    enabled: values.enabled === undefined ? true : Boolean(values.enabled),
    sort_order: Number(values.sortOrder ?? 1),
    payment_methods: normalizePaymentMethods(values.paymentMethods),
    fulfillment_strategy_key: String(values.fulfillmentStrategyKey ?? ''),
    delivery_strategy_key: String(values.deliveryStrategyKey ?? ''),
    metadata: {
      name_zh: nameZh,
      name_en: nameEn,
      badge_zh: String(values.badgeZh ?? ''),
      badge_en: String(values.badgeEn ?? ''),
      cycle_label_zh: String(values.cycleLabelZh ?? ''),
      cycle_label_en: String(values.cycleLabelEn ?? ''),
      delivery_label_zh: String(values.deliveryLabelZh ?? ''),
      delivery_label_en: String(values.deliveryLabelEn ?? ''),
      stock_label_zh: String(values.stockLabelZh ?? ''),
      stock_label_en: String(values.stockLabelEn ?? ''),
      status_label_zh: String(values.statusLabelZh ?? ''),
      status_label_en: String(values.statusLabelEn ?? ''),
      original_price: String(values.originalPrice ?? ''),
      billing_cycle: normalizeBillingCycle(values.billingCycle),
      inventory: Number(values.inventory ?? 0),
      payment_methods: normalizePaymentMethods(values.paymentMethods),
      tags_zh: normalizeStringList(values.tagsZh),
      tags_en: normalizeStringList(values.tagsEn),
      checkout_notes_zh: normalizeStringList(values.checkoutNotesZh),
      checkout_notes_en: normalizeStringList(values.checkoutNotesEn),
      art_variant: normalizeArtVariant(values.artVariant),
    },
  }
}

function buildPriceTemplatePayload(values: Record<string, unknown>) {
  const routeId = resolvePriceTemplateRouteId(values)

  return {
	    price_id: routeId.includes(':') ? undefined : routeId,
	    template_name: String(values.templateName ?? ''),
	    payment_method: normalizePaymentMethod(values.paymentMethod),
	    amount: String(values.amount ?? ''),
	    original_amount: String(values.originalAmount ?? ''),
	    currency: String(values.currency ?? 'RMB'),
    billing_cycle: normalizeBillingCycle(values.billingCycle),
    enabled: values.enabled === undefined ? true : Boolean(values.enabled),
    sort_order: Number(values.sortOrder ?? 1),
  }
}

function resolveProductRouteId(values: Record<string, unknown>) {
  return String(values.key ?? values.productId ?? values.sku ?? values.productSku ?? '')
}

function resolvePriceTemplateRouteId(values: Record<string, unknown>) {
  return String(values.key ?? values.priceId ?? buildPriceTemplateRouteId(values))
}

function buildPriceTemplateBusinessId(values: Record<string, unknown>) {
  return `${String(values.productSku ?? '')}:${String(values.templateName ?? '')}:${normalizePaymentMethod(values.paymentMethod)}`
}

function buildPriceTemplateRouteId(values: Record<string, unknown>) {
  return `${String(values.templateName ?? '')}:${normalizePaymentMethod(values.paymentMethod)}`
}

function normalizeProductType(value: unknown): AdminManagedProductType {
  switch (value) {
    case 'recharge':
    case 'subscription':
    case 'manual':
      return value
    default:
      return 'digital'
  }
}

function normalizeBillingCycle(value: unknown): ProductBillingCycle {
  switch (value) {
    case 'monthly':
    case 'quarterly':
    case 'yearly':
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

function normalizePaymentMethod(value: unknown): PaymentMethodKey {
  switch (value) {
    case 'alipay_qr':
    case 'okx_usdt':
      return value
    default:
      return 'wechat_qr'
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

function getRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function toText(value: unknown) {
  if (value == null) {
    return ''
  }

  return String(value)
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Remote request failed.'
}
