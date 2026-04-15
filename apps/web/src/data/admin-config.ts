import type { Locale } from '../i18n/copy'

export type AuthTypeKey = 'none' | 'bearer_token' | 'static_header' | 'hmac_sha256' | 'query_signature'
export type IntegrationHealthKey = 'unknown' | 'healthy' | 'degraded' | 'failed'

export type AdminIntegrationProvider = {
  key: string
  providerKey: string
  providerName: string
  baseUrl: string
  authType: AuthTypeKey
  authConfig: Record<string, unknown>
  retryTimes: number
  timeoutMs: number
  health: IntegrationHealthKey
  enabled: boolean
  lastCheckedAt?: string
}

export type AdminIntegrationAction = {
  key: string
  providerKey: string
  actionKey: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  pathTemplate: string
  successPath: string
  messagePath: string
  codeListPath: string
  headerTemplate: Record<string, unknown>
  queryTemplate: Record<string, unknown>
  bodyTemplate: Record<string, unknown>
  enabled: boolean
}

export type AdminFulfillmentStrategy = {
  key: string
  strategyKey: string
  strategyName: string
  fulfillmentType: string
  providerKey: string
  actionKey: string
  requestTemplate: Record<string, unknown>
  resultSchema: Record<string, unknown>
  deliveryTemplate: Record<string, unknown>
  retryPolicy: Record<string, unknown>
  enabled: boolean
}

export type AdminDeliveryStrategy = {
  key: string
  strategyKey: string
  strategyName: string
  channelType: 'web' | 'telegram' | 'email' | 'manual'
  maskPolicy: string
  resendAllowed: boolean
  messageTemplate: Record<string, unknown>
  enabled: boolean
}

export type AdminRuntimeSetting = {
  key: string
  module: string
  name: string
  value: string
  scope: 'db' | 'env'
  effectiveValue: string
  valueSource: 'env' | 'db' | 'default'
  appliesLive: boolean
  description?: string
  envKey?: string
}

export type AdminTelegramConfig = {
  key: string
  botKey: string
  botUsername: string
  botToken: string
  botTokenMasked: string
  webhookSecret: string
  webhookMasked: string
  webhookUrl: string
  webhookUrlResolved: string
  webhookIP: string
  allowedUpdates: string
  maxConnections: number
  dropPendingUpdates: boolean
  enabled: boolean
  source: 'db' | 'config'
}

export type AdminInternalClientKey = {
  key: string
  clientKey: string
  clientName: string
  clientSecret: string
  clientSecretMasked: string
  scopes: string
  allowedIPs: string
  status: 'active' | 'disabled' | 'revoked'
  enabled: boolean
}

export type AdminAuditLog = {
  key: string
  operator: string
  module: string
  action: string
  targetId: string
  createdAt: string
  targetType?: string
  requestIp?: string
  requestPayload?: unknown
}

const providerConfigs: AdminIntegrationProvider[] = [
  {
    key: 'provider_1',
    providerKey: 'new_api_prod',
    providerName: 'new-api internal adapter (production)',
    baseUrl: 'https://newapi-internal.example.com',
    authType: 'hmac_sha256',
    authConfig: {
      key_id: 'passdock-prod',
      secret: 'replace-with-real-secret',
    },
    retryTimes: 2,
    timeoutMs: 10000,
    health: 'healthy',
    enabled: true,
  },
  {
    key: 'provider_2',
    providerKey: 'new_api_staging',
    providerName: 'new-api internal adapter (staging)',
    baseUrl: 'https://staging-newapi-internal.example.com',
    authType: 'hmac_sha256',
    authConfig: {
      key_id: 'passdock-staging',
      secret: 'replace-with-staging-secret',
    },
    retryTimes: 1,
    timeoutMs: 8000,
    health: 'healthy',
    enabled: true,
  },
  {
    key: 'provider_3',
    providerKey: 'manual_review_queue',
    providerName: 'manual review queue',
    baseUrl: 'internal://ops/manual-review',
    authType: 'none',
    authConfig: {},
    retryTimes: 0,
    timeoutMs: 3000,
    health: 'degraded',
    enabled: true,
  },
]

const actionConfigs: AdminIntegrationAction[] = [
  {
    key: 'action_1',
    providerKey: 'new_api_prod',
    actionKey: 'issue_recharge_code',
    method: 'POST',
    pathTemplate: '/api/internal/redemption/issue',
    successPath: 'success',
    messagePath: 'message',
    codeListPath: 'data.codes',
    headerTemplate: {
      'Content-Type': 'application/json',
    },
    queryTemplate: {},
    bodyTemplate: {
      order_no: '{{order_no}}',
      buyer_ref: '{{buyer_ref}}',
      product_id: '{{product_id}}',
    },
    enabled: true,
  },
  {
    key: 'action_2',
    providerKey: 'new_api_prod',
    actionKey: 'issue_subscription_code',
    method: 'POST',
    pathTemplate: '/api/internal/subscription_code/issue',
    successPath: 'success',
    messagePath: 'message',
    codeListPath: 'data.codes',
    headerTemplate: {
      'Content-Type': 'application/json',
    },
    queryTemplate: {},
    bodyTemplate: {
      order_no: '{{order_no}}',
      buyer_ref: '{{buyer_ref}}',
      product_id: '{{product_id}}',
    },
    enabled: true,
  },
  {
    key: 'action_3',
    providerKey: 'new_api_prod',
    actionKey: 'query_issue_result',
    method: 'GET',
    pathTemplate: '/api/internal/code_issue/{order_no}',
    successPath: 'success',
    messagePath: 'message',
    codeListPath: 'data.codes',
    headerTemplate: {},
    queryTemplate: {
      order_no: '{{order_no}}',
    },
    bodyTemplate: {},
    enabled: true,
  },
  {
    key: 'action_4',
    providerKey: 'manual_review_queue',
    actionKey: 'manual_review_delivery',
    method: 'POST',
    pathTemplate: '/internal/v1/manual/review',
    successPath: 'queued',
    messagePath: 'message',
    codeListPath: '',
    headerTemplate: {},
    queryTemplate: {},
    bodyTemplate: {
      order_no: '{{order_no}}',
      reason: 'manual_review',
    },
    enabled: true,
  },
]

const strategyConfigs: AdminFulfillmentStrategy[] = [
  {
    key: 'strategy_1',
    strategyKey: 'recharge_code_standard',
    strategyName: 'Recharge code standard',
    fulfillmentType: 'issue_code',
    providerKey: 'new_api_prod',
    actionKey: 'issue_recharge_code',
    requestTemplate: {
      order_no: '{{order_no}}',
      buyer_ref: '{{buyer_ref}}',
    },
    resultSchema: {
      code_list_path: 'data.codes',
      mask_policy: 'show_last_6',
    },
    deliveryTemplate: {
      title: 'Recharge code',
      content: 'Code: {{codes[0]}}',
    },
    retryPolicy: {
      max_retries: 2,
      backoff_seconds: [5, 30],
    },
    enabled: true,
  },
  {
    key: 'strategy_2',
    strategyKey: 'subscription_code_standard',
    strategyName: 'Subscription code standard',
    fulfillmentType: 'issue_subscription',
    providerKey: 'new_api_prod',
    actionKey: 'issue_subscription_code',
    requestTemplate: {
      order_no: '{{order_no}}',
      buyer_ref: '{{buyer_ref}}',
    },
    resultSchema: {
      code_list_path: 'data.codes',
      mask_policy: 'show_last_6',
    },
    deliveryTemplate: {
      title: 'Subscription code',
      content: 'Code: {{codes[0]}}',
    },
    retryPolicy: {
      max_retries: 2,
      backoff_seconds: [5, 30],
    },
    enabled: true,
  },
  {
    key: 'strategy_3',
    strategyKey: 'manual_review_delivery',
    strategyName: 'Manual review delivery',
    fulfillmentType: 'manual_delivery',
    providerKey: 'manual_review_queue',
    actionKey: 'manual_review_delivery',
    requestTemplate: {
      order_no: '{{order_no}}',
      queue: 'manual_review',
    },
    resultSchema: {
      queued: true,
    },
    deliveryTemplate: {
      title: 'Manual review',
      content: 'Your order is queued for manual processing.',
    },
    retryPolicy: {
      max_retries: 0,
    },
    enabled: true,
  },
]

const deliveryStrategyConfigs: AdminDeliveryStrategy[] = [
  {
    key: 'delivery_1',
    strategyKey: 'telegram_and_web_default',
    strategyName: 'Telegram and web default',
    channelType: 'telegram',
    maskPolicy: 'show_last_6',
    resendAllowed: true,
    messageTemplate: {
      title: 'Telegram delivery',
      content: 'Your code is {{codes[0]}}',
    },
    enabled: true,
  },
  {
    key: 'delivery_2',
    strategyKey: 'web_masked_fallback',
    strategyName: 'Web masked fallback',
    channelType: 'web',
    maskPolicy: 'masked_full',
    resendAllowed: false,
    messageTemplate: {
      title: 'Web delivery',
      content: 'Reveal code from the order detail page.',
    },
    enabled: true,
  },
  {
    key: 'delivery_3',
    strategyKey: 'manual_email_enterprise',
    strategyName: 'Manual enterprise email',
    channelType: 'manual',
    maskPolicy: 'manual_only',
    resendAllowed: true,
    messageTemplate: {
      title: 'Manual enterprise delivery',
      content: 'The enterprise operations team will follow up offline.',
    },
    enabled: false,
  },
]

const runtimeSettingConfigs: AdminRuntimeSetting[] = [
  {
    key: 'runtime_1',
    module: 'orders',
    name: 'ORDER_EXPIRE_MINUTES',
    value: '30',
    scope: 'env',
    effectiveValue: '30',
    valueSource: 'env',
    appliesLive: true,
    description: 'Minutes before an awaiting-payment order expires.',
    envKey: 'ORDER_EXPIRE_MINUTES',
  },
  {
    key: 'runtime_2',
    module: 'payments',
    name: 'PAYMENT_REVIEW_TIMEOUT_MINUTES',
    value: '60',
    scope: 'env',
    effectiveValue: '60',
    valueSource: 'env',
    appliesLive: true,
    description: 'Minutes before a pending-review payment is considered overdue.',
    envKey: 'PAYMENT_REVIEW_TIMEOUT_MINUTES',
  },
  {
    key: 'runtime_3',
    module: 'orders',
    name: 'ORDER_SWEEP_INTERVAL_SECONDS',
    value: '30',
    scope: 'env',
    effectiveValue: '30',
    valueSource: 'env',
    appliesLive: true,
    description: 'Seconds between automated order expiration and payment-review timeout sweeps.',
    envKey: 'ORDER_SWEEP_INTERVAL_SECONDS',
  },
  {
    key: 'runtime_4',
    module: 'queue',
    name: 'ASYNC_CONCURRENCY',
    value: '10',
    scope: 'env',
    effectiveValue: '10',
    valueSource: 'db',
    appliesLive: false,
    description: 'Maximum number of async retry jobs processed in parallel per worker sweep.',
    envKey: 'ASYNC_CONCURRENCY',
  },
]

const telegramConfigConfigs: AdminTelegramConfig[] = [
  {
    key: 'telegram_default',
    botKey: 'default',
    botUsername: 'passdock_ops_bot',
    botToken: '<SECRET>',
    botTokenMasked: '******************345678',
    webhookSecret: '<SECRET>',
    webhookMasked: '**********RETKEY',
    webhookUrl: '',
    webhookUrlResolved: 'https://passdock.example.com/api/v1/bots/default/telegram/webhook',
    webhookIP: '',
    allowedUpdates: 'message,callback_query',
    maxConnections: 40,
    dropPendingUpdates: false,
    enabled: true,
    source: 'db',
  },
]

const internalClientKeyConfigs: AdminInternalClientKey[] = [
  {
    key: 'passdock-staging',
    clientKey: 'passdock-staging',
    clientName: 'PassDock staging worker',
    clientSecret: '<SECRET>',
    clientSecretMasked: '****************A91F20',
    scopes: 'orders.fulfillment,orders.delivery,orders.read,payments.confirm',
    allowedIPs: '10.10.0.0/16,127.0.0.1',
    status: 'active',
    enabled: true,
  },
  {
    key: 'manual-ops',
    clientKey: 'manual-ops',
    clientName: 'Manual ops bridge',
    clientSecret: '<SECRET>',
    clientSecretMasked: '****************8B42D0',
    scopes: 'orders.read,integrations.execute',
    allowedIPs: '',
    status: 'disabled',
    enabled: false,
  },
]

const auditLogConfigs: AdminAuditLog[] = [
  {
    key: 'audit_1',
    operator: 'Ava',
    module: 'payments',
    action: 'confirm_payment',
    targetId: 'PD-240412-1002',
    createdAt: '2026-04-12 09:55',
  },
  {
    key: 'audit_2',
    operator: 'Lina',
    module: 'fulfillment_strategies',
    action: 'preview_strategy',
    targetId: 'subscription_code_standard',
    createdAt: '2026-04-12 09:14',
  },
  {
    key: 'audit_3',
    operator: 'Noah',
    module: 'payment_channels',
    action: 'update_channel',
    targetId: 'okx_usdt_watch',
    createdAt: '2026-04-12 08:48',
  },
]

export function getIntegrationProviders() {
  return providerConfigs
}

export function getIntegrationActions() {
  return actionConfigs
}

export function getFulfillmentStrategies() {
  return strategyConfigs
}

export function getDeliveryStrategies() {
  return deliveryStrategyConfigs
}

export function getRuntimeSettings(_locale: Locale) {
  void _locale
  return runtimeSettingConfigs
}

export function getTelegramConfigs() {
  return telegramConfigConfigs
}

export function getInternalClientKeys() {
  return internalClientKeyConfigs
}

export function getAuditLogs() {
  return auditLogConfigs
}
