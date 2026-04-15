import type { PaymentMethodKey } from '../../i18n/copy'

export type AdminManagedProductType = 'recharge' | 'subscription' | 'digital' | 'manual'
export type ProductBillingCycle = 'one_time' | 'monthly' | 'quarterly' | 'yearly'
export type ProductArtVariant = 'trial' | 'starter' | 'growth' | 'team' | 'enterprise'

export type AdminManagedProduct = {
  key: string
  productType: AdminManagedProductType
  sku: string
  nameZh: string
  nameEn: string
  badgeZh: string
  badgeEn: string
  cycleLabelZh: string
  cycleLabelEn: string
  deliveryLabelZh: string
  deliveryLabelEn: string
  stockLabelZh: string
  stockLabelEn: string
  statusLabelZh: string
  statusLabelEn: string
  currency: string
  displayPrice: string
  originalPrice: string
  billingCycle: ProductBillingCycle
  inventory: number
  tagsZh: string[]
  tagsEn: string[]
  checkoutNotesZh: string[]
  checkoutNotesEn: string[]
  artVariant: ProductArtVariant
  enabled: boolean
  sortOrder: number
  paymentMethods: PaymentMethodKey[]
  fulfillmentStrategyKey: string
  deliveryStrategyKey: string
}

export type AdminProductPriceTemplate = {
  key: string
  productSku: string
  templateName: string
  paymentMethod: PaymentMethodKey
  amount: string
  originalAmount: string
  currency: string
  billingCycle: ProductBillingCycle
  enabled: boolean
  sortOrder: number
}

export type AdminProductDraft = {
  products: AdminManagedProduct[]
  priceTemplates: AdminProductPriceTemplate[]
}
