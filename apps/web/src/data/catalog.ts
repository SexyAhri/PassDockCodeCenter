import type { Locale, PaymentMethodKey } from '../i18n/copy'

type LocalizedText = Record<Locale, string>
type LocalizedList = Record<Locale, string[]>
type ArtVariant = 'trial' | 'starter' | 'growth' | 'team' | 'enterprise'

type ProductConfig = {
  id: number
  sku: string
  name: LocalizedText
  badge: LocalizedText
  cycleLabel: LocalizedText
  deliveryLabel: LocalizedText
  stockLabel: LocalizedText
  price: string
  originalPrice: string
  currency: string
  inventory: number
  statusLabel: LocalizedText
  paymentMethods: PaymentMethodKey[]
  tags: LocalizedList
  checkoutNotes: LocalizedList
  artVariant: ArtVariant
}

export type AdminCatalogSeedProduct = {
  id: number
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
  price: string
  originalPrice: string
  currency: string
  inventory: number
  statusLabelZh: string
  statusLabelEn: string
  paymentMethods: PaymentMethodKey[]
  tagsZh: string[]
  tagsEn: string[]
  checkoutNotesZh: string[]
  checkoutNotesEn: string[]
  artVariant: ArtVariant
}

export type StorefrontProduct = {
  id: number
  sku: string
  name: string
  badge: string
  cycleLabel: string
  deliveryLabel: string
  stockLabel: string
  price: string
  originalPrice: string
  currency: string
  inventory: number
  statusLabel: string
  paymentMethods: PaymentMethodKey[]
  priceOptions: StorefrontProductPriceOption[]
  tags: string[]
  checkoutNotes: string[]
  artVariant: ArtVariant
}

export type StorefrontProductPriceOption = {
  key: string
  templateName: string
  billingCycle: string
  cycleLabel: string
  amount: string
  originalAmount: string
  currency: string
  paymentMethods: PaymentMethodKey[]
  priceIdByPaymentMethod: Partial<Record<PaymentMethodKey, string>>
}

const productConfigs: ProductConfig[] = [
  {
    id: 1001,
    sku: 'credit-trial',
    name: {
      'zh-CN': '试用充值包',
      'en-US': 'Trial Credit Pack',
    },
    badge: {
      'zh-CN': '首购',
      'en-US': 'Starter',
    },
    cycleLabel: {
      'zh-CN': '一次性',
      'en-US': 'One-time',
    },
    deliveryLabel: {
      'zh-CN': '站内 + Telegram',
      'en-US': 'Web + Telegram',
    },
    stockLabel: {
      'zh-CN': '即时发放',
      'en-US': 'Instant issue',
    },
    price: '0.15',
    originalPrice: '0.28',
    currency: 'USDT',
    inventory: 620,
    statusLabel: {
      'zh-CN': '上架',
      'en-US': 'Live',
    },
    paymentMethods: ['okx_usdt', 'wechat_qr', 'alipay_qr'],
    tags: {
      'zh-CN': ['充值', '试用', '现货'],
      'en-US': ['Credit', 'Trial', 'In stock'],
    },
    checkoutNotes: {
      'zh-CN': ['适合跑通首条真实支付链路。', '订单确认后立即发放兑换码。', '运营视图需对卡密脱敏展示。'],
      'en-US': [
        'Good first SKU for validating a live payment loop.',
        'Issue the redemption code immediately after payment confirmation.',
        'Delivered codes should remain masked in operator views.',
      ],
    },
    artVariant: 'trial',
  },
  {
    id: 2001,
    sku: 'starter-monthly',
    name: {
      'zh-CN': '入门月卡',
      'en-US': 'Starter Monthly',
    },
    badge: {
      'zh-CN': '标准',
      'en-US': 'Core',
    },
    cycleLabel: {
      'zh-CN': '月付',
      'en-US': 'Monthly',
    },
    deliveryLabel: {
      'zh-CN': '站内 + Telegram',
      'en-US': 'Web + Telegram',
    },
    stockLabel: {
      'zh-CN': '自动交付',
      'en-US': 'Auto delivery',
    },
    price: '2.10',
    originalPrice: '2.70',
    currency: 'USDT',
    inventory: 358,
    statusLabel: {
      'zh-CN': '稳定',
      'en-US': 'Stable',
    },
    paymentMethods: ['okx_usdt', 'wechat_qr', 'alipay_qr'],
    tags: {
      'zh-CN': ['订阅', '月付', '自动'],
      'en-US': ['Subscription', 'Monthly', 'Automatic'],
    },
    checkoutNotes: {
      'zh-CN': ['适合个人与小团队试运行。', '支付成功后同步写入站内订单。', '默认启用 Telegram 交付通知。'],
      'en-US': [
        'Fits personal and small-team onboarding.',
        'Sync the web order after payment confirmation.',
        'Telegram delivery notice is enabled by default.',
      ],
    },
    artVariant: 'starter',
  },
  {
    id: 2002,
    sku: 'pro-monthly',
    name: {
      'zh-CN': '专业月卡',
      'en-US': 'Pro Monthly',
    },
    badge: {
      'zh-CN': '热销',
      'en-US': 'Popular',
    },
    cycleLabel: {
      'zh-CN': '月付',
      'en-US': 'Monthly',
    },
    deliveryLabel: {
      'zh-CN': '站内 + Telegram',
      'en-US': 'Web + Telegram',
    },
    stockLabel: {
      'zh-CN': '自动交付',
      'en-US': 'Auto delivery',
    },
    price: '5.49',
    originalPrice: '6.90',
    currency: 'USDT',
    inventory: 241,
    statusLabel: {
      'zh-CN': '稳定',
      'en-US': 'Stable',
    },
    paymentMethods: ['okx_usdt', 'wechat_qr', 'alipay_qr'],
    tags: {
      'zh-CN': ['订阅', '热销', '自动'],
      'en-US': ['Subscription', 'Popular', 'Automatic'],
    },
    checkoutNotes: {
      'zh-CN': ['适合高频使用场景。', '推荐链上 watcher 进行付款确认。', '库存不足时触发后台预警。'],
      'en-US': [
        'Built for higher-frequency usage.',
        'Watcher-based payment confirmation is recommended.',
        'Low stock should trigger an admin alert.',
      ],
    },
    artVariant: 'growth',
  },
  {
    id: 3001,
    sku: 'team-quarterly',
    name: {
      'zh-CN': '团队季卡',
      'en-US': 'Team Quarterly',
    },
    badge: {
      'zh-CN': '团队',
      'en-US': 'Team',
    },
    cycleLabel: {
      'zh-CN': '季付',
      'en-US': 'Quarterly',
    },
    deliveryLabel: {
      'zh-CN': '站内 + Telegram',
      'en-US': 'Web + Telegram',
    },
    stockLabel: {
      'zh-CN': '人工复核',
      'en-US': 'Manual review',
    },
    price: '12.39',
    originalPrice: '13.99',
    currency: 'USDT',
    inventory: 96,
    statusLabel: {
      'zh-CN': '人工复核',
      'en-US': 'Manual review',
    },
    paymentMethods: ['okx_usdt', 'wechat_qr', 'alipay_qr'],
    tags: {
      'zh-CN': ['团队', '季付', '复核'],
      'en-US': ['Team', 'Quarterly', 'Review'],
    },
    checkoutNotes: {
      'zh-CN': ['建议先确认付款再批量发放。', '适合渠道单和团队采购。', '需要保留完整操作日志。'],
      'en-US': [
        'Payment should be reviewed before batch issuance.',
        'Suitable for team and channel purchases.',
        'A full operator audit log should be retained.',
      ],
    },
    artVariant: 'team',
  },
  {
    id: 4001,
    sku: 'enterprise-yearly',
    name: {
      'zh-CN': '企业年包',
      'en-US': 'Enterprise Annual',
    },
    badge: {
      'zh-CN': '旗舰',
      'en-US': 'Flagship',
    },
    cycleLabel: {
      'zh-CN': '年付',
      'en-US': 'Yearly',
    },
    deliveryLabel: {
      'zh-CN': '专属交付',
      'en-US': 'Private delivery',
    },
    stockLabel: {
      'zh-CN': '人工复核',
      'en-US': 'Manual review',
    },
    price: '23.59',
    originalPrice: '27.90',
    currency: 'USDT',
    inventory: 38,
    statusLabel: {
      'zh-CN': '上架',
      'en-US': 'Live',
    },
    paymentMethods: ['okx_usdt', 'wechat_qr', 'alipay_qr'],
    tags: {
      'zh-CN': ['企业', '年付', '旗舰'],
      'en-US': ['Enterprise', 'Yearly', 'Flagship'],
    },
    checkoutNotes: {
      'zh-CN': ['高价值订单默认进入人工复核。', '可扩展企业专属规则与席位配置。', '交付完成后同步发送运营通知。'],
      'en-US': [
        'High-value orders default to manual review.',
        'Can evolve into enterprise-specific rules and seat allocation.',
        'Send an operator notification after fulfillment completes.',
      ],
    },
    artVariant: 'enterprise',
  },
]

export function getStorefrontProducts(locale: Locale): StorefrontProduct[] {
  return productConfigs.map((product) => ({
    id: product.id,
    sku: product.sku,
    name: product.name[locale],
    badge: product.badge[locale],
    cycleLabel: product.cycleLabel[locale],
    deliveryLabel: product.deliveryLabel[locale],
    stockLabel: product.stockLabel[locale],
    price: product.price,
    originalPrice: product.originalPrice,
    currency: product.currency,
    inventory: product.inventory,
    statusLabel: product.statusLabel[locale],
    paymentMethods: product.paymentMethods,
    priceOptions: [
      {
        key: `${product.sku}:default`,
        templateName: product.name[locale],
        billingCycle: 'default',
        cycleLabel: product.cycleLabel[locale],
        amount: product.price,
        originalAmount: product.originalPrice,
        currency: product.currency,
        paymentMethods: product.paymentMethods,
        priceIdByPaymentMethod: {},
      },
    ],
    tags: product.tags[locale],
    checkoutNotes: product.checkoutNotes[locale],
    artVariant: product.artVariant,
  }))
}

export function getProductBySKU(locale: Locale, sku: string) {
  return getStorefrontProducts(locale).find((product) => product.sku === sku)
}

export function getAdminCatalogSeedProducts(): AdminCatalogSeedProduct[] {
  return productConfigs.map((product) => ({
    id: product.id,
    sku: product.sku,
    nameZh: product.name['zh-CN'],
    nameEn: product.name['en-US'],
    badgeZh: product.badge['zh-CN'],
    badgeEn: product.badge['en-US'],
    cycleLabelZh: product.cycleLabel['zh-CN'],
    cycleLabelEn: product.cycleLabel['en-US'],
    deliveryLabelZh: product.deliveryLabel['zh-CN'],
    deliveryLabelEn: product.deliveryLabel['en-US'],
    stockLabelZh: product.stockLabel['zh-CN'],
    stockLabelEn: product.stockLabel['en-US'],
    price: product.price,
    originalPrice: product.originalPrice,
    currency: product.currency,
    inventory: product.inventory,
    statusLabelZh: product.statusLabel['zh-CN'],
    statusLabelEn: product.statusLabel['en-US'],
    paymentMethods: product.paymentMethods,
    tagsZh: product.tags['zh-CN'],
    tagsEn: product.tags['en-US'],
    checkoutNotesZh: product.checkoutNotes['zh-CN'],
    checkoutNotesEn: product.checkoutNotes['en-US'],
    artVariant: product.artVariant,
  }))
}
