import type { AdminSystemDraft, SystemSectionKey } from '../admin/system/types'
import type {
  AdminDeliveryStrategy,
  AdminIntegrationAction,
  AdminIntegrationProvider,
} from '../data/admin'
import type { AdminManagedPaymentChannel } from '../admin/system/types'
import { requestJson, unwrapListData } from './http'

type PaymentChannelDto = {
  id?: string | number
  channel_key?: string
  channel_name?: string
  channel_type?: string
  provider_name?: string
  currency?: string
  enabled?: boolean
  settlement_mode?: 'manual' | 'auto'
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
    callback_auth_type?: 'none' | 'static_header' | 'hmac_sha256'
    callback_secret?: string
    callback_secret_masked?: string
    callback_key?: string
    callback_header_name?: string
    callback_sign_header?: string
    callback_timestamp_header?: string
    callback_nonce_header?: string
    callback_signature_param?: string
    callback_timestamp_param?: string
    callback_nonce_param?: string
    callback_ttl_seconds?: number
    callback_sign_source?:
      | 'body'
      | 'body_sha256'
      | 'timestamp_body'
      | 'method_path_timestamp_nonce_body_sha256'
    refund_provider_key?: string
    refund_action_key?: string
    refund_status_path?: string
    refund_receipt_path?: string
  }
  qr_value?: string
  display_name_zh?: string
  display_name_en?: string
  mode_label_zh?: string
  mode_label_en?: string
  reference?: string
  auto_fulfill?: boolean
  auto_deliver?: boolean
  callback_auth_type?: 'none' | 'static_header' | 'hmac_sha256'
  callback_secret?: string
  callback_secret_masked?: string
  callback_key?: string
  callback_header_name?: string
  callback_sign_header?: string
  callback_timestamp_header?: string
  callback_nonce_header?: string
  callback_signature_param?: string
  callback_timestamp_param?: string
  callback_nonce_param?: string
  callback_ttl_seconds?: number
  callback_sign_source?:
    | 'body'
    | 'body_sha256'
    | 'timestamp_body'
    | 'method_path_timestamp_nonce_body_sha256'
  refund_provider_key?: string
  refund_action_key?: string
  refund_status_path?: string
  refund_receipt_path?: string
}

type ProviderDto = {
  id?: string | number
  provider_key?: string
  provider_name?: string
  base_url?: string
  auth_type?: AdminIntegrationProvider['authType']
  auth_config?: Record<string, unknown>
  retry_times?: number
  timeout_ms?: number
  health?: AdminIntegrationProvider['health']
  enabled?: boolean
  last_checked_at?: string
}

type ActionDto = {
  id?: string | number
  provider_key?: string
  action_key?: string
  http_method?: AdminIntegrationAction['method']
  method?: AdminIntegrationAction['method']
  path_template?: string
  success_path?: string
  message_path?: string
  code_list_path?: string
  header_template?: Record<string, unknown>
  query_template?: Record<string, unknown>
  body_template?: Record<string, unknown>
  enabled?: boolean
}

type FulfillmentStrategyDto = {
  id?: string | number
  strategy_key?: string
  strategy_name?: string
  fulfillment_type?: string
  provider_key?: string
  action_key?: string
  request_template?: Record<string, unknown>
  result_schema?: Record<string, unknown>
  delivery_template?: Record<string, unknown>
  retry_policy?: Record<string, unknown>
  enabled?: boolean
}

type DeliveryStrategyDto = {
  id?: string | number
  strategy_key?: string
  strategy_name?: string
  channel_type?: AdminDeliveryStrategy['channelType']
  mask_policy?: string
  resend_allowed?: boolean
  message_template?: Record<string, unknown>
  enabled?: boolean
}

type TelegramConfigDto = {
  id?: string | number
  bot_key?: string
  bot_username?: string
  bot_token?: string
  bot_token_masked?: string
  webhook_secret?: string
  webhook_masked?: string
  webhook_url?: string
  webhook_url_resolved?: string
  webhook_ip?: string
  allowed_updates?: string[]
  max_connections?: number
  drop_pending_updates?: boolean
  enabled?: boolean
  source?: 'db' | 'config'
}

type InternalClientKeyDto = {
  id?: string | number
  client_key?: string
  client_name?: string
  client_secret?: string
  client_secret_masked?: string
  scopes?: string
  allowed_ips?: string
  status?: 'active' | 'disabled' | 'revoked'
  enabled?: boolean
}

type RuntimeSettingDto = {
  id?: string | number
  key?: string
  module?: string
  name?: string
  value?: string
  scope?: 'db' | 'env'
  description?: string
  effective_value?: string
  value_source?: 'env' | 'db' | 'default'
  applies_live?: boolean
  env_key?: string
}

export function supportsRemoteSystemSection(section: SystemSectionKey) {
  return section !== 'auditLogs'
}

export async function getAdminAuditLogDetail(logId: string) {
  return requestJson<Record<string, unknown>>(
    `/api/v1/admin/audit-logs/${encodeURIComponent(logId)}`,
  )
}

export async function loadAdminSystemRemoteDraft() {
  const [
    paymentChannelsData,
    providersData,
    fulfillmentStrategiesData,
    deliveryStrategiesData,
    telegramConfigsData,
    internalClientKeysData,
    runtimeSettingsData,
    auditLogsData,
  ] =
    await Promise.all([
      requestJson<unknown>('/api/v1/admin/payment-channels'),
      requestJson<unknown>('/api/v1/admin/integrations/providers'),
      requestJson<unknown>('/api/v1/admin/fulfillment-strategies'),
      requestJson<unknown>('/api/v1/admin/delivery-strategies'),
      requestJson<unknown>('/api/v1/admin/telegram-configs'),
      requestJson<unknown>('/api/v1/admin/internal-client-keys'),
      requestJson<unknown>('/api/v1/admin/runtime-settings'),
      requestJson<unknown>('/api/v1/admin/audit-logs'),
    ])

  const providers = unwrapListData<ProviderDto>(providersData)
  const actionGroups = await Promise.all(
    providers.map(async (provider) => {
      const providerKey = String(provider.provider_key ?? '').trim()
      if (!providerKey) {
        return []
      }

      const value = await requestJson<unknown>(
        `/api/v1/admin/integrations/providers/${encodeURIComponent(providerKey)}/actions`,
      )
      return unwrapListData<ActionDto>(value)
    }),
  )

  return {
    paymentChannels: unwrapListData<PaymentChannelDto>(paymentChannelsData).map(mapPaymentChannelDto),
    providers: providers.map(mapProviderDto),
    actions: actionGroups.flat().map(mapActionDto),
    fulfillmentStrategies: unwrapListData<FulfillmentStrategyDto>(fulfillmentStrategiesData).map(
      mapFulfillmentStrategyDto,
    ),
    deliveryStrategies: unwrapListData<DeliveryStrategyDto>(deliveryStrategiesData).map(
      mapDeliveryStrategyDto,
    ),
    telegramConfigs: unwrapListData<TelegramConfigDto>(telegramConfigsData).map(mapTelegramConfigDto),
    internalClientKeys: unwrapListData<InternalClientKeyDto>(internalClientKeysData).map(
      mapInternalClientKeyDto,
    ),
    runtimeSettings: unwrapListData<RuntimeSettingDto>(runtimeSettingsData).map(mapRuntimeSettingDto),
    auditLogs: unwrapListData<Record<string, unknown>>(auditLogsData).map(mapAuditLogDto),
  } satisfies AdminSystemDraft
}

export async function saveAdminSystemSectionRecord(
  section: SystemSectionKey,
  mode: 'create' | 'edit',
  values: Record<string, unknown>,
) {
  switch (section) {
    case 'paymentChannels': {
      const targetId = String(values.channelKey ?? '')

      await requestJson(
        mode === 'create'
          ? '/api/v1/admin/payment-channels'
          : `/api/v1/admin/payment-channels/${encodeURIComponent(targetId)}`,
        {
          method: mode === 'create' ? 'POST' : 'PUT',
          body: buildPaymentChannelPayload(values),
        },
      )

      return targetId
    }
    case 'providers': {
      const targetId = String(values.providerKey ?? '')

      await requestJson(
        mode === 'create'
          ? '/api/v1/admin/integrations/providers'
          : `/api/v1/admin/integrations/providers/${encodeURIComponent(targetId)}`,
        {
          method: mode === 'create' ? 'POST' : 'PUT',
          body: buildProviderPayload(values),
        },
      )

      return targetId
    }
    case 'actions': {
      const targetId = String(values.actionKey ?? '')
      const providerKey = String(values.providerKey ?? '')

      await requestJson(
        mode === 'create'
          ? `/api/v1/admin/integrations/providers/${encodeURIComponent(providerKey)}/actions`
          : `/api/v1/admin/integrations/actions/${encodeURIComponent(targetId)}`,
        {
          method: mode === 'create' ? 'POST' : 'PUT',
          body: buildActionPayload(values),
        },
      )

      return targetId
    }
    case 'fulfillmentStrategies': {
      const targetId = String(values.strategyKey ?? '')

      await requestJson(
        mode === 'create'
          ? '/api/v1/admin/fulfillment-strategies'
          : `/api/v1/admin/fulfillment-strategies/${encodeURIComponent(targetId)}`,
        {
          method: mode === 'create' ? 'POST' : 'PUT',
          body: buildFulfillmentPayload(values),
        },
      )

      return targetId
    }
    case 'deliveryStrategies': {
      const targetId = String(values.strategyKey ?? '')

      await requestJson(
        mode === 'create'
          ? '/api/v1/admin/delivery-strategies'
          : `/api/v1/admin/delivery-strategies/${encodeURIComponent(targetId)}`,
        {
          method: mode === 'create' ? 'POST' : 'PUT',
          body: buildDeliveryPayload(values),
        },
      )

      return targetId
    }
    case 'telegramConfigs': {
      const targetId = String(values.botKey ?? '')

      await requestJson(
        mode === 'create'
          ? '/api/v1/admin/telegram-configs'
          : `/api/v1/admin/telegram-configs/${encodeURIComponent(targetId)}`,
        {
          method: mode === 'create' ? 'POST' : 'PUT',
          body: buildTelegramConfigPayload(values),
        },
      )

      return targetId
    }
    case 'internalClientKeys': {
      const targetId = String(values.clientKey ?? '')

      await requestJson(
        mode === 'create'
          ? '/api/v1/admin/internal-client-keys'
          : `/api/v1/admin/internal-client-keys/${encodeURIComponent(targetId)}`,
        {
          method: mode === 'create' ? 'POST' : 'PUT',
          body: buildInternalClientKeyPayload(values),
        },
      )

      return targetId
    }
    case 'runtimeSettings': {
      const targetId = String(values.name ?? '')

      await requestJson(
        mode === 'create'
          ? '/api/v1/admin/runtime-settings'
          : `/api/v1/admin/runtime-settings/${encodeURIComponent(targetId)}`,
        {
          method: mode === 'create' ? 'POST' : 'PUT',
          body: {
            module: String(values.module ?? ''),
            name: targetId,
            value: String(values.value ?? ''),
            scope: values.scope === 'env' ? 'env' : 'db',
          },
        },
      )

      return targetId
    }
    default:
      throw new Error(`Remote API does not support section ${section}`)
  }
}

export async function deleteAdminSystemSectionRecord(section: SystemSectionKey, targetId: string) {
  switch (section) {
    case 'paymentChannels':
      await requestJson(`/api/v1/admin/payment-channels/${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
      })
      return
    case 'providers':
      await requestJson(`/api/v1/admin/integrations/providers/${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
      })
      return
    case 'actions':
      await requestJson(`/api/v1/admin/integrations/actions/${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
      })
      return
    case 'fulfillmentStrategies':
      await requestJson(`/api/v1/admin/fulfillment-strategies/${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
      })
      return
    case 'deliveryStrategies':
      await requestJson(`/api/v1/admin/delivery-strategies/${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
      })
      return
    case 'telegramConfigs':
      await requestJson(`/api/v1/admin/telegram-configs/${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
      })
      return
    case 'internalClientKeys':
      await requestJson(`/api/v1/admin/internal-client-keys/${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
      })
      return
    case 'runtimeSettings':
      await requestJson(`/api/v1/admin/runtime-settings/${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
      })
      return
    default:
      throw new Error(`Remote API does not support section ${section}`)
  }
}

export async function getAdminTelegramWebhookSetup(botKey: string) {
  return requestJson<Record<string, unknown>>(
    `/api/v1/admin/telegram-configs/${encodeURIComponent(botKey)}/webhook`,
  )
}

export async function getAdminTelegramWebhookInfo(botKey: string) {
  return requestJson<Record<string, unknown>>(
    `/api/v1/admin/telegram-configs/${encodeURIComponent(botKey)}/webhook-info`,
  )
}

export async function syncAdminTelegramWebhook(botKey: string) {
  return requestJson<Record<string, unknown>>(
    `/api/v1/admin/telegram-configs/${encodeURIComponent(botKey)}/webhook-sync`,
    { method: 'POST' },
  )
}

export async function deleteAdminTelegramWebhook(botKey: string, dropPendingUpdates = false) {
  return requestJson<Record<string, unknown>>(
    `/api/v1/admin/telegram-configs/${encodeURIComponent(botKey)}/webhook-sync`,
    {
      method: 'DELETE',
      body: { drop_pending_updates: dropPendingUpdates },
    },
  )
}

export async function testAdminSystemSectionRecord(
  section: SystemSectionKey,
  targetId: string,
  options?: {
    mode?: 'auto' | 'preview' | 'live'
  },
) {
  switch (section) {
    case 'providers':
      return requestJson<Record<string, unknown>>(
        `/api/v1/admin/integrations/providers/${encodeURIComponent(targetId)}/health-check`,
        { method: 'POST' },
      )
    case 'actions':
      return requestJson<Record<string, unknown>>(`/api/v1/admin/integrations/actions/${encodeURIComponent(targetId)}/test`, {
        method: 'POST',
        body: options?.mode ? { mode: options.mode } : undefined,
      })
    case 'fulfillmentStrategies':
      return requestJson<Record<string, unknown>>(
        `/api/v1/admin/fulfillment-strategies/${encodeURIComponent(targetId)}/preview`,
        { method: 'POST' },
      )
    case 'deliveryStrategies':
      return requestJson<Record<string, unknown>>(`/api/v1/admin/delivery-strategies/${encodeURIComponent(targetId)}/test`, {
        method: 'POST',
      })
    default:
      return null
  }
}

function mapPaymentChannelDto(dto: PaymentChannelDto): AdminManagedPaymentChannel {
  const channelKey = String(dto.channel_key ?? dto.id ?? '')
  const qrValue = String(dto.config?.qr_content ?? dto.qr_value ?? '')
  const reference = String(dto.reference ?? dto.config?.reference ?? '')

  return {
    key: channelKey,
    channelKey,
    channelName: String(dto.channel_name ?? dto.config?.display_name ?? channelKey),
    displayNameZh: String(
      dto.config?.display_name_zh ?? dto.display_name_zh ?? dto.config?.display_name ?? dto.channel_name ?? channelKey,
    ),
    displayNameEn: String(
      dto.config?.display_name_en ?? dto.display_name_en ?? dto.config?.display_name ?? dto.channel_name ?? channelKey,
    ),
    modeLabelZh: String(dto.config?.mode_label_zh ?? dto.mode_label_zh ?? ''),
    modeLabelEn: String(dto.config?.mode_label_en ?? dto.mode_label_en ?? ''),
    channelType: String(dto.channel_type ?? 'wechat_qr') as AdminManagedPaymentChannel['channelType'],
    providerName: String(dto.provider_name ?? ''),
    currency: String(dto.currency ?? 'RMB'),
    settlementMode: dto.settlement_mode === 'auto' ? 'auto' : 'manual',
    enabled: Boolean(dto.enabled),
    qrValue,
    reference,
    autoFulfill: Boolean(dto.config?.auto_fulfill ?? dto.auto_fulfill),
    autoDeliver: Boolean(dto.config?.auto_deliver ?? dto.auto_deliver),
    callbackAuthType:
      dto.config?.callback_auth_type ?? dto.callback_auth_type ?? 'none',
    callbackSecret: String(dto.config?.callback_secret ?? dto.callback_secret ?? ''),
    callbackSecretMasked: String(
      dto.config?.callback_secret_masked ?? dto.callback_secret_masked ?? '',
    ),
    callbackKey: String(dto.config?.callback_key ?? dto.callback_key ?? ''),
    callbackHeaderName: String(
      dto.config?.callback_header_name ?? dto.callback_header_name ?? '',
    ),
    callbackSignHeader: String(
      dto.config?.callback_sign_header ?? dto.callback_sign_header ?? '',
    ),
    callbackTimestampHeader: String(
      dto.config?.callback_timestamp_header ?? dto.callback_timestamp_header ?? '',
    ),
    callbackNonceHeader: String(
      dto.config?.callback_nonce_header ?? dto.callback_nonce_header ?? '',
    ),
    callbackSignatureParam: String(
      dto.config?.callback_signature_param ?? dto.callback_signature_param ?? '',
    ),
    callbackTimestampParam: String(
      dto.config?.callback_timestamp_param ?? dto.callback_timestamp_param ?? '',
    ),
    callbackNonceParam: String(
      dto.config?.callback_nonce_param ?? dto.callback_nonce_param ?? '',
    ),
    callbackTTLSeconds: Number(
      dto.config?.callback_ttl_seconds ?? dto.callback_ttl_seconds ?? 0,
    ),
    callbackSignSource:
      dto.config?.callback_sign_source ?? dto.callback_sign_source ?? 'body',
    refundProviderKey: String(
      dto.config?.refund_provider_key ?? dto.refund_provider_key ?? '',
    ),
    refundActionKey: String(
      dto.config?.refund_action_key ?? dto.refund_action_key ?? '',
    ),
    refundStatusPath: String(
      dto.config?.refund_status_path ?? dto.refund_status_path ?? '',
    ),
    refundReceiptPath: String(
      dto.config?.refund_receipt_path ?? dto.refund_receipt_path ?? '',
    ),
  }
}

function mapProviderDto(dto: ProviderDto): AdminIntegrationProvider {
  const providerKey = String(dto.provider_key ?? dto.id ?? '')

  return {
    key: providerKey,
    providerKey,
    providerName: String(dto.provider_name ?? providerKey),
    baseUrl: String(dto.base_url ?? ''),
    authType: normalizeAuthType(dto.auth_type),
    authConfig: normalizeObjectRecord(dto.auth_config),
    retryTimes: Number(dto.retry_times ?? 0),
    timeoutMs: Number(dto.timeout_ms ?? 10000),
    health: normalizeProviderHealth(dto.health),
    enabled: dto.enabled !== false,
    lastCheckedAt: String(dto.last_checked_at ?? ''),
  }
}

function mapActionDto(dto: ActionDto): AdminIntegrationAction {
  const actionKey = String(dto.action_key ?? dto.id ?? '')

  return {
    key: actionKey,
    providerKey: String(dto.provider_key ?? ''),
    actionKey,
    method: normalizeHttpMethod(dto.http_method ?? dto.method),
    pathTemplate: String(dto.path_template ?? ''),
    successPath: String(dto.success_path ?? 'success'),
    messagePath: String(dto.message_path ?? ''),
    codeListPath: String(dto.code_list_path ?? ''),
    headerTemplate: normalizeObjectRecord(dto.header_template),
    queryTemplate: normalizeObjectRecord(dto.query_template),
    bodyTemplate: normalizeObjectRecord(dto.body_template),
    enabled: dto.enabled !== false,
  }
}

function mapFulfillmentStrategyDto(dto: FulfillmentStrategyDto) {
  const strategyKey = String(dto.strategy_key ?? dto.id ?? '')

  return {
    key: strategyKey,
    strategyKey,
    strategyName: String(dto.strategy_name ?? strategyKey),
    fulfillmentType: String(dto.fulfillment_type ?? 'issue_code'),
    providerKey: String(dto.provider_key ?? ''),
    actionKey: String(dto.action_key ?? ''),
    requestTemplate: normalizeObjectRecord(dto.request_template),
    resultSchema: normalizeObjectRecord(dto.result_schema),
    deliveryTemplate: normalizeObjectRecord(dto.delivery_template),
    retryPolicy: normalizeObjectRecord(dto.retry_policy),
    enabled: dto.enabled !== false,
  }
}

function mapDeliveryStrategyDto(dto: DeliveryStrategyDto) {
  const strategyKey = String(dto.strategy_key ?? dto.id ?? '')

  return {
    key: strategyKey,
    strategyKey,
    strategyName: String(dto.strategy_name ?? strategyKey),
    channelType: normalizeDeliveryChannel(dto.channel_type),
    maskPolicy: String(dto.mask_policy ?? ''),
    resendAllowed: Boolean(dto.resend_allowed),
    messageTemplate: normalizeObjectRecord(dto.message_template),
    enabled: dto.enabled !== false,
  }
}

function mapTelegramConfigDto(dto: TelegramConfigDto) {
  const botKey = String(dto.bot_key ?? dto.id ?? '')

  return {
    key: botKey,
    botKey,
    botUsername: String(dto.bot_username ?? ''),
    botToken: String(dto.bot_token ?? ''),
    botTokenMasked: String(dto.bot_token_masked ?? ''),
    webhookSecret: String(dto.webhook_secret ?? ''),
    webhookMasked: String(dto.webhook_masked ?? ''),
    webhookUrl: String(dto.webhook_url ?? ''),
    webhookUrlResolved: String(dto.webhook_url_resolved ?? ''),
    webhookIP: String(dto.webhook_ip ?? ''),
    allowedUpdates: Array.isArray(dto.allowed_updates)
      ? dto.allowed_updates.map((item) => String(item)).filter(Boolean).join(',')
      : '',
    maxConnections: Number(dto.max_connections ?? 40),
    dropPendingUpdates: Boolean(dto.drop_pending_updates),
    enabled: dto.enabled !== false,
    source: dto.source === 'config' ? 'config' : 'db',
  } satisfies AdminSystemDraft['telegramConfigs'][number]
}

function mapInternalClientKeyDto(dto: InternalClientKeyDto) {
  const clientKey = String(dto.client_key ?? dto.id ?? '')
  const status = normalizeInternalClientKeyStatus(dto.status)

  return {
    key: clientKey,
    clientKey,
    clientName: String(dto.client_name ?? ''),
    clientSecret: String(dto.client_secret ?? ''),
    clientSecretMasked: String(dto.client_secret_masked ?? ''),
    scopes: String(dto.scopes ?? ''),
    allowedIPs: String(dto.allowed_ips ?? ''),
    status,
    enabled: dto.enabled ?? status === 'active',
  } satisfies AdminSystemDraft['internalClientKeys'][number]
}

function mapRuntimeSettingDto(dto: RuntimeSettingDto) {
  return {
    key: String(dto.key ?? dto.name ?? ''),
    module: String(dto.module ?? ''),
    name: String(dto.name ?? ''),
    value: String(dto.value ?? ''),
    scope: dto.scope === 'env' ? 'env' : 'db',
    effectiveValue: String(dto.effective_value ?? dto.value ?? ''),
    valueSource:
      dto.value_source === 'env' || dto.value_source === 'db' ? dto.value_source : 'default',
    appliesLive: dto.applies_live !== false,
    description: String(dto.description ?? ''),
    envKey: String(dto.env_key ?? ''),
  } satisfies AdminSystemDraft['runtimeSettings'][number]
}

function mapAuditLogDto(dto: Record<string, unknown>) {
  return {
    key: String(dto.key ?? dto.id ?? ''),
    operator: String(dto.operator ?? ''),
    module: String(dto.module ?? ''),
    action: String(dto.action ?? ''),
    targetId: String(dto.targetId ?? dto.target_id ?? ''),
    createdAt: String(dto.createdAt ?? dto.created_at ?? ''),
    targetType: String(dto.targetType ?? dto.target_type ?? ''),
    requestIp: String(dto.requestIp ?? dto.request_ip ?? ''),
    requestPayload:
      dto.requestPayload ?? dto.request_payload ?? dto.payload ?? null,
  } satisfies AdminSystemDraft['auditLogs'][number]
}

function buildPaymentChannelPayload(values: Record<string, unknown>) {
  return {
    channel_key: String(values.channelKey ?? ''),
    channel_name: String(values.channelName ?? ''),
    channel_type: String(values.channelType ?? 'wechat_qr'),
    provider_name: String(values.providerName ?? ''),
    currency: String(values.currency ?? 'RMB'),
    settlement_mode: values.settlementMode === 'auto' ? 'auto' : 'manual',
    enabled: Boolean(values.enabled),
    config: {
      qr_content: String(values.qrValue ?? ''),
      display_name_zh: String(values.displayNameZh ?? ''),
      display_name_en: String(values.displayNameEn ?? ''),
      mode_label_zh: String(values.modeLabelZh ?? ''),
      mode_label_en: String(values.modeLabelEn ?? ''),
      reference: String(values.reference ?? ''),
      auto_fulfill: Boolean(values.autoFulfill),
      auto_deliver: Boolean(values.autoDeliver),
      callback_auth_type:
        values.callbackAuthType === 'static_header' || values.callbackAuthType === 'hmac_sha256'
          ? values.callbackAuthType
          : 'none',
      callback_secret: String(values.callbackSecret ?? ''),
      callback_key: String(values.callbackKey ?? ''),
      callback_header_name: String(values.callbackHeaderName ?? ''),
      callback_sign_header: String(values.callbackSignHeader ?? ''),
      callback_timestamp_header: String(values.callbackTimestampHeader ?? ''),
      callback_nonce_header: String(values.callbackNonceHeader ?? ''),
      callback_signature_param: String(values.callbackSignatureParam ?? ''),
      callback_timestamp_param: String(values.callbackTimestampParam ?? ''),
      callback_nonce_param: String(values.callbackNonceParam ?? ''),
      callback_ttl_seconds: Number(values.callbackTTLSeconds ?? 0),
      callback_sign_source:
        values.callbackSignSource === 'body_sha256' ||
        values.callbackSignSource === 'timestamp_body' ||
        values.callbackSignSource === 'method_path_timestamp_nonce_body_sha256'
          ? values.callbackSignSource
          : 'body',
      refund_provider_key: String(values.refundProviderKey ?? ''),
      refund_action_key: String(values.refundActionKey ?? ''),
      refund_status_path: String(values.refundStatusPath ?? ''),
      refund_receipt_path: String(values.refundReceiptPath ?? ''),
    },
  }
}

function buildProviderPayload(values: Record<string, unknown>) {
  return {
    provider_key: String(values.providerKey ?? ''),
    provider_name: String(values.providerName ?? ''),
    base_url: String(values.baseUrl ?? ''),
    auth_type: normalizeAuthType(values.authType),
    auth_config: normalizeObjectRecord(values.authConfig),
    retry_times: Number(values.retryTimes ?? 0),
    timeout_ms: Number(values.timeoutMs ?? 10000),
    health: normalizeProviderHealth(values.health),
    enabled: Boolean(values.enabled),
  }
}

function buildActionPayload(values: Record<string, unknown>) {
  return {
    provider_key: String(values.providerKey ?? ''),
    action_key: String(values.actionKey ?? ''),
    http_method: normalizeHttpMethod(values.method),
    path_template: String(values.pathTemplate ?? ''),
    success_path: String(values.successPath ?? 'success'),
    message_path: String(values.messagePath ?? ''),
    code_list_path: String(values.codeListPath ?? ''),
    header_template: normalizeObjectRecord(values.headerTemplate),
    query_template: normalizeObjectRecord(values.queryTemplate),
    body_template: normalizeObjectRecord(values.bodyTemplate),
    enabled: Boolean(values.enabled),
  }
}

function buildFulfillmentPayload(values: Record<string, unknown>) {
  return {
    strategy_key: String(values.strategyKey ?? ''),
    strategy_name: String(values.strategyName ?? ''),
    fulfillment_type: String(values.fulfillmentType ?? 'issue_code'),
    provider_key: String(values.providerKey ?? ''),
    action_key: String(values.actionKey ?? ''),
    request_template: normalizeObjectRecord(values.requestTemplate),
    result_schema: normalizeObjectRecord(values.resultSchema),
    delivery_template: normalizeObjectRecord(values.deliveryTemplate),
    retry_policy: normalizeObjectRecord(values.retryPolicy),
    enabled: Boolean(values.enabled),
  }
}

function buildDeliveryPayload(values: Record<string, unknown>) {
  return {
    strategy_key: String(values.strategyKey ?? ''),
    strategy_name: String(values.strategyName ?? ''),
    channel_type: normalizeDeliveryChannel(values.channelType),
    mask_policy: String(values.maskPolicy ?? ''),
    resend_allowed: Boolean(values.resendAllowed),
    message_template: normalizeObjectRecord(values.messageTemplate),
    enabled: Boolean(values.enabled),
  }
}

function buildTelegramConfigPayload(values: Record<string, unknown>) {
  return {
    bot_key: String(values.botKey ?? ''),
    bot_username: String(values.botUsername ?? ''),
    bot_token: String(values.botToken ?? ''),
    webhook_secret: String(values.webhookSecret ?? ''),
    webhook_url: String(values.webhookUrl ?? ''),
    webhook_ip: String(values.webhookIP ?? ''),
    allowed_updates: normalizeStringList(values.allowedUpdates),
    max_connections: Number(values.maxConnections ?? 40),
    drop_pending_updates: Boolean(values.dropPendingUpdates),
    enabled: Boolean(values.enabled),
  }
}

function buildInternalClientKeyPayload(values: Record<string, unknown>) {
  const status =
    typeof values.enabled === 'boolean'
      ? values.enabled
        ? 'active'
        : 'disabled'
      : normalizeInternalClientKeyStatus(values.status)

  return {
    client_key: String(values.clientKey ?? ''),
    client_name: String(values.clientName ?? ''),
    client_secret: String(values.clientSecret ?? ''),
    scopes: String(values.scopes ?? ''),
    allowed_ips: String(values.allowedIPs ?? ''),
    status,
  }
}

function normalizeAuthType(value: unknown): AdminIntegrationProvider['authType'] {
  switch (value) {
    case 'bearer_token':
    case 'static_header':
    case 'hmac_sha256':
    case 'query_signature':
      return value
    default:
      return 'none'
  }
}

function normalizeProviderHealth(value: unknown): AdminIntegrationProvider['health'] {
  switch (value) {
    case 'healthy':
    case 'degraded':
    case 'failed':
      return value
    default:
      return 'unknown'
  }
}

function normalizeHttpMethod(value: unknown): AdminIntegrationAction['method'] {
  switch (value) {
    case 'GET':
    case 'PUT':
    case 'PATCH':
    case 'DELETE':
      return value
    default:
      return 'POST'
  }
}

function normalizeDeliveryChannel(value: unknown): AdminDeliveryStrategy['channelType'] {
  switch (value) {
    case 'telegram':
    case 'email':
    case 'manual':
      return value
    default:
      return 'web'
  }
}

function normalizeObjectRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function normalizeInternalClientKeyStatus(value: unknown): AdminSystemDraft['internalClientKeys'][number]['status'] {
  switch (value) {
    case 'disabled':
    case 'revoked':
      return value
    default:
      return 'active'
  }
}

function normalizeStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(/[\n,;]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}
