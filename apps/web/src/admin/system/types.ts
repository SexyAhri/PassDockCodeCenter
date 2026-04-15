import type {
  AdminAuditLog,
  AdminDeliveryStrategy,
  AdminFulfillmentStrategy,
  AdminInternalClientKey,
  AdminIntegrationAction,
  AdminIntegrationProvider,
  AdminRuntimeSetting,
  AdminTelegramConfig,
} from '../../data/admin'
import type { PaymentMethodKey } from '../../i18n/copy'

export type AdminPaymentChannelType = PaymentMethodKey | 'usdt_qr'

export type AdminManagedPaymentChannel = {
  key: string
  channelKey: string
  channelName: string
  displayNameZh: string
  displayNameEn: string
  modeLabelZh: string
  modeLabelEn: string
  channelType: AdminPaymentChannelType
  providerName: string
  currency: string
  settlementMode: 'manual' | 'auto'
  enabled: boolean
  qrValue: string
  reference: string
  autoFulfill: boolean
  autoDeliver: boolean
  callbackAuthType: 'none' | 'static_header' | 'hmac_sha256'
  callbackSecret: string
  callbackSecretMasked: string
  callbackKey: string
  callbackHeaderName: string
  callbackSignHeader: string
  callbackTimestampHeader: string
  callbackNonceHeader: string
  callbackSignatureParam: string
  callbackTimestampParam: string
  callbackNonceParam: string
  callbackTTLSeconds: number
  callbackSignSource:
    | 'body'
    | 'body_sha256'
    | 'timestamp_body'
    | 'method_path_timestamp_nonce_body_sha256'
  refundProviderKey: string
  refundActionKey: string
  refundStatusPath: string
  refundReceiptPath: string
}

export type SystemSectionKey =
  | 'paymentChannels'
  | 'providers'
  | 'actions'
  | 'fulfillmentStrategies'
  | 'deliveryStrategies'
  | 'telegramConfigs'
  | 'internalClientKeys'
  | 'runtimeSettings'
  | 'auditLogs'

export type AdminSystemDraft = {
  paymentChannels: AdminManagedPaymentChannel[]
  providers: AdminIntegrationProvider[]
  actions: AdminIntegrationAction[]
  fulfillmentStrategies: AdminFulfillmentStrategy[]
  deliveryStrategies: AdminDeliveryStrategy[]
  telegramConfigs: AdminTelegramConfig[]
  internalClientKeys: AdminInternalClientKey[]
  runtimeSettings: AdminRuntimeSetting[]
  auditLogs: AdminAuditLog[]
}

export type DrawerFieldSchema = {
  name: string
  label: string
  type: 'text' | 'number' | 'select' | 'switch' | 'textarea' | 'json' | 'asset'
  mode?: 'multiple'
  required?: boolean
  placeholder?: string
  rows?: number
  min?: number
  help?: string
  options?: Array<{ label: string; value: string }>
  accept?: string
  uploadButtonLabel?: string
  uploadHint?: string
  uploadSuccessText?: string
  previewKind?: 'image'
  onUpload?: (file: File) => Promise<string>
}
