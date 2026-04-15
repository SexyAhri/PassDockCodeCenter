import type { Locale, PaymentMethodKey } from '../i18n/copy'

type LocalizedText = Record<Locale, string>

type PaymentChannelConfig = {
  key: PaymentMethodKey
  enabled: boolean
  channelKey: string
  channelType: PaymentMethodKey
  providerName: string
  currency: string
  settlementMode: 'manual' | 'auto'
  autoFulfill: boolean
  autoDeliver: boolean
  label: LocalizedText
  mode: LocalizedText
  qrValue: string
  reference: string
}

export type PaymentChannel = {
  key: PaymentMethodKey
  enabled: boolean
  channelKey: string
  channelType: PaymentMethodKey
  providerName: string
  currency: string
  settlementMode: 'manual' | 'auto'
  autoFulfill: boolean
  autoDeliver: boolean
  label: string
  mode: string
  qrValue: string
  reference: string
}

const paymentChannelConfigs: PaymentChannelConfig[] = [
  {
    key: 'wechat_qr',
    enabled: true,
    channelKey: 'wechat_qr_main',
    channelType: 'wechat_qr',
    providerName: 'manual_qr',
    currency: 'RMB',
    settlementMode: 'manual',
    autoFulfill: true,
    autoDeliver: true,
    label: {
      'zh-CN': '微信收款码',
      'en-US': 'WeChat QR',
    },
    mode: {
      'zh-CN': '人工确认',
      'en-US': 'Manual review',
    },
    qrValue: 'https://pay.passdock.local/collect/wechat?merchant=PASSDOCK&scene=storefront',
    reference: 'WX-PASSDOCK-MAIN',
  },
  {
    key: 'alipay_qr',
    enabled: true,
    channelKey: 'alipay_qr_main',
    channelType: 'alipay_qr',
    providerName: 'manual_qr',
    currency: 'RMB',
    settlementMode: 'manual',
    autoFulfill: true,
    autoDeliver: true,
    label: {
      'zh-CN': '支付宝收款码',
      'en-US': 'Alipay QR',
    },
    mode: {
      'zh-CN': '人工确认',
      'en-US': 'Manual review',
    },
    qrValue: 'https://pay.passdock.local/collect/alipay?merchant=PASSDOCK&scene=storefront',
    reference: 'ALI-PASSDOCK-MAIN',
  },
  {
    key: 'okx_usdt',
    enabled: true,
    channelKey: 'okx_usdt_watch',
    channelType: 'okx_usdt',
    providerName: 'chain_watcher',
    currency: 'USDT',
    settlementMode: 'auto',
    autoFulfill: true,
    autoDeliver: true,
    label: {
      'zh-CN': 'OKX USDT',
      'en-US': 'OKX USDT',
    },
    mode: {
      'zh-CN': '链上 watcher',
      'en-US': 'On-chain watcher',
    },
    qrValue: 'https://www.okx.com/web3/send?chain=TRON&token=USDT&address=TS8ZrjH9N2o7x6V3m4Qf1C8kP2s7L0dXa2',
    reference: 'OKX-USDT-MAIN',
  },
]

export function getPaymentChannels(locale: Locale): PaymentChannel[] {
  return paymentChannelConfigs.map((channel) => ({
    key: channel.key,
    enabled: channel.enabled,
    channelKey: channel.channelKey,
    channelType: channel.channelType,
    providerName: channel.providerName,
    currency: channel.currency,
    settlementMode: channel.settlementMode,
    autoFulfill: channel.autoFulfill,
    autoDeliver: channel.autoDeliver,
    label: channel.label[locale],
    mode: channel.mode[locale],
    qrValue: channel.qrValue,
    reference: channel.reference,
  }))
}

export function getEnabledPaymentChannels(locale: Locale) {
  return getPaymentChannels(locale).filter((channel) => channel.enabled)
}

export function getPaymentChannelMap(locale: Locale): Record<PaymentMethodKey, PaymentChannel> {
  return Object.fromEntries(
    getPaymentChannels(locale).map((channel) => [channel.key, channel]),
  ) as Record<PaymentMethodKey, PaymentChannel>
}
