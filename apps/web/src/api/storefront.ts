import type { StorefrontProduct, StorefrontProductPriceOption } from '../data/catalog'
import type { PaymentChannel } from '../data/paymentChannels'
import type { Locale, PaymentMethodKey } from '../i18n/copy'
import { requestJson, unwrapListData } from './http'

type PublicProductDto = {
  id?: string | number
  sku?: string
  name?: string
  name_zh?: string
  name_en?: string
  description?: string
  display_price?: string | number
  original_price?: string | number
  currency?: string
  product_type?: string
  billing_cycle?: string
  payment_methods?: unknown
  enabled?: boolean
  inventory?: number
  badge_zh?: string
  badge_en?: string
  cycle_label_zh?: string
  cycle_label_en?: string
  delivery_label_zh?: string
  delivery_label_en?: string
  stock_label_zh?: string
  stock_label_en?: string
  status_label_zh?: string
  status_label_en?: string
  tags_zh?: unknown
  tags_en?: unknown
  checkout_notes_zh?: unknown
  checkout_notes_en?: unknown
  art_variant?: string
  price_templates?: unknown
}

type PublicPriceTemplateDto = {
  id?: string | number
  price_id?: string | number
  template_name?: string
  payment_method?: string
  display_price?: string | number
  original_price?: string | number
  currency?: string
  billing_cycle?: string
  enabled?: boolean
  sort_order?: number
}

type PublicPaymentChannelDto = {
  id?: string | number
  channel_key?: string
  channel_name?: string
  channel_type?: string
  provider_name?: string
  currency?: string
  settlement_mode?: 'manual' | 'auto'
  enabled?: boolean
  config?: {
    qr_content?: string
    display_name?: string
    display_name_zh?: string
    display_name_en?: string
    mode_label_zh?: string
    mode_label_en?: string
    reference?: string
    auto_fulfill?: boolean
    auto_deliver?: boolean
  }
  display_name_zh?: string
  display_name_en?: string
  mode_label_zh?: string
  mode_label_en?: string
  qr_value?: string
  reference?: string
  auto_fulfill?: boolean
  auto_deliver?: boolean
}

export async function loadStorefrontRemoteSnapshot(params: { locale: Locale }) {
  const { locale } = params
  const [productsData, channelsData] = await Promise.all([
    requestJson<unknown>('/api/v1/public/products', { includeAdminAuth: false }),
    requestJson<unknown>('/api/v1/public/payment-channels', { includeAdminAuth: false }),
  ])

  return {
    products: unwrapListData<PublicProductDto>(productsData)
      .filter((item) => item.enabled !== false)
      .map((dto) => mapPublicProductDto(dto, locale)),
    paymentChannels: unwrapListData<PublicPaymentChannelDto>(channelsData)
      .filter((item) => item.enabled !== false)
      .map((dto) => mapPublicPaymentChannelDto(dto, locale)),
  }
}

function mapPublicProductDto(dto: PublicProductDto, locale: Locale): StorefrontProduct {
  const sku = String(dto.sku ?? dto.id ?? '')
  const name = pickLocalizedText(locale, dto.name_zh, dto.name_en, dto.name, sku)
  const paymentMethods = normalizePaymentMethods(dto.payment_methods)
  const cycleLabel = pickLocalizedText(
    locale,
    dto.cycle_label_zh,
    dto.cycle_label_en,
    formatBillingCycleText(String(dto.billing_cycle ?? ''), locale),
    '',
  )
  const priceOptions = normalizePublicProductPriceOptions(dto.price_templates, {
    locale,
    fallbackName: name,
    fallbackAmount: toText(dto.display_price ?? ''),
    fallbackOriginalAmount: toText(dto.original_price ?? ''),
    fallbackCurrency: String(dto.currency ?? 'RMB'),
    fallbackBillingCycle: String(dto.billing_cycle ?? ''),
    fallbackCycleLabel: cycleLabel,
    fallbackPaymentMethods: paymentMethods,
  })
  const primaryPriceOption = priceOptions[0]
  const resolvedPaymentMethods = paymentMethods.length
    ? paymentMethods
    : Array.from(new Set(priceOptions.flatMap((option) => option.paymentMethods)))

  return {
    id: Number(dto.id ?? 0),
    sku,
    name,
    badge: pickLocalizedText(locale, dto.badge_zh, dto.badge_en, '', ''),
    cycleLabel: primaryPriceOption?.cycleLabel ?? cycleLabel,
    deliveryLabel: pickLocalizedText(locale, dto.delivery_label_zh, dto.delivery_label_en, '', ''),
    stockLabel: pickLocalizedText(locale, dto.stock_label_zh, dto.stock_label_en, '', ''),
    price: primaryPriceOption?.amount ?? toText(dto.display_price ?? ''),
    originalPrice: primaryPriceOption?.originalAmount ?? toText(dto.original_price ?? ''),
    currency: primaryPriceOption?.currency ?? String(dto.currency ?? 'RMB'),
    inventory: Number(dto.inventory ?? 0),
    statusLabel: pickLocalizedText(
      locale,
      dto.status_label_zh,
      dto.status_label_en,
      dto.enabled === false ? (locale === 'zh-CN' ? '停用' : 'Disabled') : (locale === 'zh-CN' ? '上架' : 'Live'),
      '',
    ),
    paymentMethods: resolvedPaymentMethods,
    priceOptions,
    tags: pickLocalizedTextList(locale, dto.tags_zh, dto.tags_en),
    checkoutNotes: pickLocalizedTextList(locale, dto.checkout_notes_zh, dto.checkout_notes_en),
    artVariant: normalizeArtVariant(dto.art_variant),
  }
}

function normalizePublicProductPriceOptions(
  value: unknown,
  fallback: {
    locale: Locale
    fallbackName: string
    fallbackAmount: string
    fallbackOriginalAmount: string
    fallbackCurrency: string
    fallbackBillingCycle: string
    fallbackCycleLabel: string
    fallbackPaymentMethods: PaymentMethodKey[]
  },
) {
  if (!Array.isArray(value) || value.length === 0) {
    return buildFallbackPriceOptions(fallback)
  }

  const grouped = new Map<
    string,
    StorefrontProductPriceOption & {
      sortOrder: number
    }
  >()

  value.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return
    }

    const dto = item as PublicPriceTemplateDto
    if (dto.enabled === false) {
      return
    }

    const paymentMethod = normalizePriceTemplatePaymentMethod(dto.payment_method)
    if (!paymentMethod) {
      return
    }

    const templateName = String(dto.template_name ?? '').trim() || fallback.fallbackName || 'Default'
    const billingCycle = String(dto.billing_cycle ?? '').trim()
    const amount = toText(dto.display_price ?? '')
    const originalAmount = toText(dto.original_price ?? '')
    const currency = String(dto.currency ?? fallback.fallbackCurrency ?? 'RMB')
    const key = [templateName, billingCycle, amount, originalAmount, currency].join('|')
    const existing = grouped.get(key)

    if (existing) {
      if (!existing.paymentMethods.includes(paymentMethod)) {
        existing.paymentMethods.push(paymentMethod)
      }
      existing.priceIdByPaymentMethod[paymentMethod] = String(dto.price_id ?? dto.id ?? '')
      existing.sortOrder = Math.min(existing.sortOrder, Number(dto.sort_order ?? existing.sortOrder ?? 9999))
      return
    }

    grouped.set(key, {
      key,
      templateName,
      billingCycle,
      cycleLabel: formatBillingCycleText(billingCycle, fallback.locale) || fallback.fallbackCycleLabel || templateName,
      amount,
      originalAmount,
      currency,
      paymentMethods: [paymentMethod],
      priceIdByPaymentMethod: {
        [paymentMethod]: String(dto.price_id ?? dto.id ?? ''),
      },
      sortOrder: Number(dto.sort_order ?? 9999),
    })
  })

  const options = [...grouped.values()]
    .sort((left, right) => left.sortOrder - right.sortOrder || left.key.localeCompare(right.key))
    .map(({ sortOrder: _sortOrder, ...option }) => option)

  return options.length ? options : buildFallbackPriceOptions(fallback)
}

function mapPublicPaymentChannelDto(dto: PublicPaymentChannelDto, locale: Locale): PaymentChannel {
  const channelType = normalizePaymentChannelType(dto.channel_type) ?? 'wechat_qr'
  const settlementMode = dto.settlement_mode === 'auto' ? 'auto' : 'manual'
  const providerName = String(dto.provider_name ?? '')

  return {
    key: channelType,
    enabled: dto.enabled !== false,
    channelKey: String(dto.channel_key ?? channelType),
    channelType,
    providerName,
    currency: String(dto.currency ?? 'RMB'),
    settlementMode,
    autoFulfill: Boolean(dto.config?.auto_fulfill ?? dto.auto_fulfill),
    autoDeliver: Boolean(dto.config?.auto_deliver ?? dto.auto_deliver),
    label: pickLocalizedText(
      locale,
      dto.config?.display_name_zh ?? dto.display_name_zh,
      dto.config?.display_name_en ?? dto.display_name_en,
      dto.config?.display_name ?? dto.channel_name,
      channelType,
    ),
    mode: pickLocalizedText(
      locale,
      dto.config?.mode_label_zh ?? dto.mode_label_zh,
      dto.config?.mode_label_en ?? dto.mode_label_en,
      defaultPublicPaymentModeText(channelType, settlementMode, providerName, locale),
      '',
    ),
    qrValue: String(dto.config?.qr_content ?? dto.qr_value ?? ''),
    reference: String(dto.reference ?? dto.config?.reference ?? ''),
  }
}

function normalizePaymentMethods(value: unknown, fallback: PaymentMethodKey[] = []) {
  if (!Array.isArray(value)) {
    return fallback
  }

  const methods = value.filter(
    (item): item is PaymentMethodKey => typeof item === 'string' && item.length > 0,
  )

  return methods.length ? methods : fallback
}

function pickLocalizedText(
  locale: Locale,
  zhValue: unknown,
  enValue: unknown,
  fallbackValue: unknown,
  defaultValue = '',
) {
  if (locale === 'zh-CN') {
    return String(zhValue ?? enValue ?? fallbackValue ?? defaultValue)
  }

  return String(enValue ?? zhValue ?? fallbackValue ?? defaultValue)
}

function pickLocalizedTextList(locale: Locale, zhValue: unknown, enValue: unknown) {
  const primary = locale === 'zh-CN' ? zhValue : enValue
  const secondary = locale === 'zh-CN' ? enValue : zhValue
  return normalizeStringList(primary).length ? normalizeStringList(primary) : normalizeStringList(secondary)
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((item) => String(item).trim()).filter(Boolean)
}

function normalizeArtVariant(value: unknown): StorefrontProduct['artVariant'] {
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

function normalizePriceTemplatePaymentMethod(value: unknown) {
  switch (value) {
    case 'wechat_qr':
    case 'alipay_qr':
    case 'okx_usdt':
      return value as PaymentMethodKey
    default:
      return null
  }
}

function normalizePaymentChannelType(value: unknown) {
  switch (value) {
    case 'wechat_qr':
    case 'alipay_qr':
    case 'okx_usdt':
      return value as PaymentMethodKey
    default:
      return null
  }
}

function defaultPublicPaymentModeText(
  channelType: PaymentMethodKey,
  settlementMode: PaymentChannel['settlementMode'],
  providerName: string,
  locale: Locale,
) {
  const loweredProvider = providerName.trim().toLowerCase()
  if (settlementMode === 'auto') {
    if (loweredProvider.includes('chain') || channelType === 'okx_usdt') {
      return locale === 'zh-CN' ? '链上 watcher' : 'On-chain watcher'
    }
    return locale === 'zh-CN' ? '自动确认' : 'Auto confirmation'
  }

  return locale === 'zh-CN' ? '人工确认' : 'Manual review'
}

function toText(value: unknown) {
  if (value == null) {
    return ''
  }

  return String(value)
}

function formatBillingCycleText(value: string, locale: Locale) {
  switch (value.trim().toLowerCase()) {
    case 'monthly':
      return locale === 'zh-CN' ? '月付' : 'Monthly'
    case 'quarterly':
      return locale === 'zh-CN' ? '季付' : 'Quarterly'
    case 'yearly':
    case 'annual':
      return locale === 'zh-CN' ? '年付' : 'Yearly'
    case 'one_time':
    case 'one-time':
      return locale === 'zh-CN' ? '一次性' : 'One-time'
    default:
      return ''
  }
}

function buildFallbackPriceOptions(fallback: {
  locale: Locale
  fallbackName: string
  fallbackAmount: string
  fallbackOriginalAmount: string
  fallbackCurrency: string
  fallbackBillingCycle: string
  fallbackCycleLabel: string
  fallbackPaymentMethods: PaymentMethodKey[]
}) {
  if (!fallback.fallbackAmount) {
    return []
  }

  return [
    {
      key: [
        fallback.fallbackName,
        fallback.fallbackBillingCycle,
        fallback.fallbackAmount,
        fallback.fallbackCurrency,
      ].join('|'),
      templateName: fallback.fallbackName || 'Default',
      billingCycle: fallback.fallbackBillingCycle,
      cycleLabel:
        fallback.fallbackCycleLabel ||
        formatBillingCycleText(fallback.fallbackBillingCycle, fallback.locale) ||
        fallback.fallbackName ||
        'Default',
      amount: fallback.fallbackAmount,
      originalAmount: fallback.fallbackOriginalAmount,
      currency: fallback.fallbackCurrency,
      paymentMethods: fallback.fallbackPaymentMethods,
      priceIdByPaymentMethod: {},
    },
  ]
}
