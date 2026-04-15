import { createAdminAuditLog } from '../audit'
import type {
  AdminManagedPaymentChannel,
  AdminSystemDraft,
  SystemSectionKey,
} from './types'
import type {
  AdminDeliveryStrategy,
  AdminIntegrationAction,
  AdminInternalClientKey,
  AdminIntegrationProvider,
  AdminRuntimeSetting,
  AdminTelegramConfig,
} from '../../data/admin'

export function saveSectionRecord(
  draft: AdminSystemDraft,
  section: SystemSectionKey,
  mode: 'create' | 'edit',
  values: Record<string, unknown>,
  operator: string,
  module: string,
  getTargetId: (record: Record<string, unknown>) => string,
) {
  switch (section) {
    case 'paymentChannels': {
      const record = {
        key: String(values.key ?? values.channelKey ?? createRowKey('channel')),
        channelKey: String(values.channelKey ?? ''),
        channelName: String(values.channelName ?? ''),
        displayNameZh: String(values.displayNameZh ?? ''),
        displayNameEn: String(values.displayNameEn ?? ''),
        modeLabelZh: String(values.modeLabelZh ?? ''),
        modeLabelEn: String(values.modeLabelEn ?? ''),
        channelType: String(values.channelType ?? 'wechat_qr') as AdminManagedPaymentChannel['channelType'],
        providerName: String(values.providerName ?? ''),
        currency: String(values.currency ?? 'RMB'),
        settlementMode: (values.settlementMode === 'auto' ? 'auto' : 'manual') as AdminManagedPaymentChannel['settlementMode'],
        enabled: Boolean(values.enabled),
        qrValue: String(values.qrValue ?? ''),
        reference: String(values.reference ?? ''),
        autoFulfill: Boolean(values.autoFulfill),
        autoDeliver: Boolean(values.autoDeliver),
        callbackAuthType: String(values.callbackAuthType ?? 'none') as AdminManagedPaymentChannel['callbackAuthType'],
        callbackSecret: String(values.callbackSecret ?? ''),
        callbackSecretMasked: String(values.callbackSecretMasked ?? values.callbackSecret ?? ''),
        callbackKey: String(values.callbackKey ?? ''),
        callbackHeaderName: String(values.callbackHeaderName ?? ''),
        callbackSignHeader: String(values.callbackSignHeader ?? ''),
        callbackTimestampHeader: String(values.callbackTimestampHeader ?? ''),
        callbackNonceHeader: String(values.callbackNonceHeader ?? ''),
        callbackSignatureParam: String(values.callbackSignatureParam ?? ''),
        callbackTimestampParam: String(values.callbackTimestampParam ?? ''),
        callbackNonceParam: String(values.callbackNonceParam ?? ''),
        callbackTTLSeconds: Number(values.callbackTTLSeconds ?? 0),
        callbackSignSource: String(values.callbackSignSource ?? 'body') as AdminManagedPaymentChannel['callbackSignSource'],
        refundProviderKey: String(values.refundProviderKey ?? ''),
        refundActionKey: String(values.refundActionKey ?? ''),
        refundStatusPath: String(values.refundStatusPath ?? ''),
        refundReceiptPath: String(values.refundReceiptPath ?? ''),
      }

      return prependAudit(
        {
          ...draft,
          paymentChannels: upsertRow(draft.paymentChannels, record),
        },
        createAdminAuditLog(module, mode === 'create' ? 'create_channel' : 'update_channel', getTargetId(record), operator),
      )
    }
    case 'providers': {
      const record = {
        key: String(values.key ?? values.providerKey ?? createRowKey('provider')),
        providerKey: String(values.providerKey ?? ''),
        providerName: String(values.providerName ?? ''),
        baseUrl: String(values.baseUrl ?? ''),
        authType: String(values.authType ?? 'none') as AdminIntegrationProvider['authType'],
        authConfig: toPlainObject(values.authConfig),
        retryTimes: Number(values.retryTimes ?? 0),
        timeoutMs: Number(values.timeoutMs ?? 10000),
        health: String(values.health ?? 'unknown') as AdminIntegrationProvider['health'],
        enabled: Boolean(values.enabled),
        lastCheckedAt: String(values.lastCheckedAt ?? ''),
      }

      return prependAudit(
        {
          ...draft,
          providers: upsertRow(draft.providers, record),
        },
        createAdminAuditLog(module, mode === 'create' ? 'create_provider' : 'update_provider', getTargetId(record), operator),
      )
    }
    case 'actions': {
      const record = {
        key: String(values.key ?? values.actionKey ?? createRowKey('action')),
        providerKey: String(values.providerKey ?? ''),
        actionKey: String(values.actionKey ?? ''),
        method: String(values.method ?? 'POST') as AdminIntegrationAction['method'],
        pathTemplate: String(values.pathTemplate ?? ''),
        successPath: String(values.successPath ?? 'success'),
        messagePath: String(values.messagePath ?? ''),
        codeListPath: String(values.codeListPath ?? ''),
        headerTemplate: toPlainObject(values.headerTemplate),
        queryTemplate: toPlainObject(values.queryTemplate),
        bodyTemplate: toPlainObject(values.bodyTemplate),
        enabled: Boolean(values.enabled),
      }

      return prependAudit(
        {
          ...draft,
          actions: upsertRow(draft.actions, record),
        },
        createAdminAuditLog(module, mode === 'create' ? 'create_action' : 'update_action', getTargetId(record), operator),
      )
    }
    case 'fulfillmentStrategies': {
      const record = {
        key: String(values.key ?? values.strategyKey ?? createRowKey('fulfillment')),
        strategyKey: String(values.strategyKey ?? ''),
        strategyName: String(values.strategyName ?? ''),
        fulfillmentType: String(values.fulfillmentType ?? 'issue_code'),
        providerKey: String(values.providerKey ?? ''),
        actionKey: String(values.actionKey ?? ''),
        requestTemplate: toPlainObject(values.requestTemplate),
        resultSchema: toPlainObject(values.resultSchema),
        deliveryTemplate: toPlainObject(values.deliveryTemplate),
        retryPolicy: toPlainObject(values.retryPolicy),
        enabled: Boolean(values.enabled),
      }

      return prependAudit(
        {
          ...draft,
          fulfillmentStrategies: upsertRow(draft.fulfillmentStrategies, record),
        },
        createAdminAuditLog(module, mode === 'create' ? 'create_strategy' : 'update_strategy', getTargetId(record), operator),
      )
    }
    case 'deliveryStrategies': {
      const record = {
        key: String(values.key ?? values.strategyKey ?? createRowKey('delivery')),
        strategyKey: String(values.strategyKey ?? ''),
        strategyName: String(values.strategyName ?? ''),
        channelType: String(values.channelType ?? 'web') as AdminDeliveryStrategy['channelType'],
        maskPolicy: String(values.maskPolicy ?? ''),
        resendAllowed: Boolean(values.resendAllowed),
        messageTemplate: toPlainObject(values.messageTemplate),
        enabled: Boolean(values.enabled),
      }

      return prependAudit(
        {
          ...draft,
          deliveryStrategies: upsertRow(draft.deliveryStrategies, record),
        },
        createAdminAuditLog(module, mode === 'create' ? 'create_strategy' : 'update_strategy', getTargetId(record), operator),
      )
    }
    case 'telegramConfigs': {
      const record = {
        key: String(values.key ?? values.botKey ?? createRowKey('telegram')),
        botKey: String(values.botKey ?? ''),
        botUsername: String(values.botUsername ?? ''),
        botToken: String(values.botToken ?? ''),
        botTokenMasked: String(values.botTokenMasked ?? values.botToken ?? ''),
        webhookSecret: String(values.webhookSecret ?? ''),
        webhookMasked: String(values.webhookMasked ?? values.webhookSecret ?? ''),
        webhookUrl: String(values.webhookUrl ?? ''),
        webhookUrlResolved: String(values.webhookUrlResolved ?? values.webhookUrl ?? ''),
        webhookIP: String(values.webhookIP ?? ''),
        allowedUpdates: String(values.allowedUpdates ?? ''),
        maxConnections: Number(values.maxConnections ?? 40),
        dropPendingUpdates: Boolean(values.dropPendingUpdates),
        enabled: Boolean(values.enabled),
        source: String(values.source ?? 'db') === 'config' ? 'config' : 'db',
      } satisfies AdminTelegramConfig

      return prependAudit(
        {
          ...draft,
          telegramConfigs: upsertRow(draft.telegramConfigs, record),
        },
        createAdminAuditLog(module, mode === 'create' ? 'create_telegram_config' : 'update_telegram_config', getTargetId(record), operator),
      )
    }
    case 'internalClientKeys': {
      const status = normalizeInternalClientStatus(values.status, values.enabled)
      const record = {
        key: String(values.key ?? values.clientKey ?? createRowKey('internal_client')),
        clientKey: String(values.clientKey ?? ''),
        clientName: String(values.clientName ?? ''),
        clientSecret: String(values.clientSecret ?? ''),
        clientSecretMasked: String(values.clientSecretMasked ?? values.clientSecret ?? ''),
        scopes: String(values.scopes ?? ''),
        allowedIPs: String(values.allowedIPs ?? ''),
        status,
        enabled: status === 'active',
      } satisfies AdminInternalClientKey

      return prependAudit(
        {
          ...draft,
          internalClientKeys: upsertRow(draft.internalClientKeys, record),
        },
        createAdminAuditLog(module, mode === 'create' ? 'create_internal_client_key' : 'update_internal_client_key', getTargetId(record), operator),
      )
    }
    case 'runtimeSettings': {
      const record = {
        key: String(values.key ?? values.name ?? createRowKey('runtime')),
        module: String(values.module ?? ''),
        name: String(values.name ?? ''),
        value: String(values.value ?? ''),
        scope: (values.scope === 'env' ? 'env' : 'db') as AdminRuntimeSetting['scope'],
        effectiveValue: String(values.value ?? ''),
        valueSource: (values.scope === 'env' ? 'env' : 'db') as AdminRuntimeSetting['valueSource'],
        appliesLive: Boolean(values.appliesLive ?? false),
        description: String(values.description ?? ''),
        envKey: String(values.envKey ?? ''),
      }

      return prependAudit(
        {
          ...draft,
          runtimeSettings: upsertRow(draft.runtimeSettings, record),
        },
        createAdminAuditLog(module, mode === 'create' ? 'create_setting' : 'update_setting', getTargetId(record), operator),
      )
    }
    default:
      return draft
  }
}

export function deleteSectionRecord(
  draft: AdminSystemDraft,
  section: SystemSectionKey,
  targetId: string,
  operator: string,
  module: string,
) {
  switch (section) {
    case 'paymentChannels':
      return prependAudit(
        {
          ...draft,
          paymentChannels: draft.paymentChannels.filter((item) => item.channelKey !== targetId),
        },
        createAdminAuditLog(module, 'delete_channel', targetId, operator),
      )
    case 'providers':
      return prependAudit(
        {
          ...draft,
          providers: draft.providers.filter((item) => item.providerKey !== targetId),
        },
        createAdminAuditLog(module, 'delete_provider', targetId, operator),
      )
    case 'actions':
      return prependAudit(
        {
          ...draft,
          actions: draft.actions.filter((item) => item.actionKey !== targetId),
        },
        createAdminAuditLog(module, 'delete_action', targetId, operator),
      )
    case 'fulfillmentStrategies':
      return prependAudit(
        {
          ...draft,
          fulfillmentStrategies: draft.fulfillmentStrategies.filter((item) => item.strategyKey !== targetId),
        },
        createAdminAuditLog(module, 'delete_strategy', targetId, operator),
      )
    case 'deliveryStrategies':
      return prependAudit(
        {
          ...draft,
          deliveryStrategies: draft.deliveryStrategies.filter((item) => item.strategyKey !== targetId),
        },
        createAdminAuditLog(module, 'delete_strategy', targetId, operator),
      )
    case 'telegramConfigs':
      return prependAudit(
        {
          ...draft,
          telegramConfigs: draft.telegramConfigs.filter((item) => item.botKey !== targetId),
        },
        createAdminAuditLog(module, 'delete_telegram_config', targetId, operator),
      )
    case 'internalClientKeys':
      return prependAudit(
        {
          ...draft,
          internalClientKeys: draft.internalClientKeys.filter((item) => item.clientKey !== targetId),
        },
        createAdminAuditLog(module, 'delete_internal_client_key', targetId, operator),
      )
    case 'runtimeSettings':
      return prependAudit(
        {
          ...draft,
          runtimeSettings: draft.runtimeSettings.filter((item) => item.name !== targetId),
        },
        createAdminAuditLog(module, 'delete_setting', targetId, operator),
      )
    default:
      return draft
  }
}

export function deleteSectionRecords(
  draft: AdminSystemDraft,
  section: SystemSectionKey,
  targetIds: string[],
  operator: string,
  module: string,
) {
  const idSet = new Set(targetIds)

  switch (section) {
    case 'paymentChannels':
      return prependAudit(
        {
          ...draft,
          paymentChannels: draft.paymentChannels.filter((item) => !idSet.has(item.channelKey)),
        },
        createAdminAuditLog(module, 'batch_delete', targetIds.join(','), operator),
      )
    case 'providers':
      return prependAudit(
        {
          ...draft,
          providers: draft.providers.filter((item) => !idSet.has(item.providerKey)),
        },
        createAdminAuditLog(module, 'batch_delete', targetIds.join(','), operator),
      )
    case 'actions':
      return prependAudit(
        {
          ...draft,
          actions: draft.actions.filter((item) => !idSet.has(item.actionKey)),
        },
        createAdminAuditLog(module, 'batch_delete', targetIds.join(','), operator),
      )
    case 'fulfillmentStrategies':
      return prependAudit(
        {
          ...draft,
          fulfillmentStrategies: draft.fulfillmentStrategies.filter((item) => !idSet.has(item.strategyKey)),
        },
        createAdminAuditLog(module, 'batch_delete', targetIds.join(','), operator),
      )
    case 'deliveryStrategies':
      return prependAudit(
        {
          ...draft,
          deliveryStrategies: draft.deliveryStrategies.filter((item) => !idSet.has(item.strategyKey)),
        },
        createAdminAuditLog(module, 'batch_delete', targetIds.join(','), operator),
      )
    case 'telegramConfigs':
      return prependAudit(
        {
          ...draft,
          telegramConfigs: draft.telegramConfigs.filter((item) => !idSet.has(item.botKey)),
        },
        createAdminAuditLog(module, 'batch_delete', targetIds.join(','), operator),
      )
    case 'internalClientKeys':
      return prependAudit(
        {
          ...draft,
          internalClientKeys: draft.internalClientKeys.filter((item) => !idSet.has(item.clientKey)),
        },
        createAdminAuditLog(module, 'batch_delete', targetIds.join(','), operator),
      )
    case 'runtimeSettings':
      return prependAudit(
        {
          ...draft,
          runtimeSettings: draft.runtimeSettings.filter((item) => !idSet.has(item.name)),
        },
        createAdminAuditLog(module, 'batch_delete', targetIds.join(','), operator),
      )
    default:
      return draft
  }
}

export function updateSectionEnabled(
  draft: AdminSystemDraft,
  section: SystemSectionKey,
  targetIds: string[],
  enabled: boolean,
  operator: string,
  module: string,
) {
  const idSet = new Set(targetIds)

  switch (section) {
    case 'paymentChannels':
      return prependAudit(
        {
          ...draft,
          paymentChannels: draft.paymentChannels.map((item) =>
            idSet.has(item.channelKey)
              ? {
                  ...item,
                  enabled,
                }
              : item,
          ),
        },
        createAdminAuditLog(module, enabled ? 'batch_enable' : 'batch_disable', targetIds.join(','), operator),
      )
    case 'providers':
      return prependAudit(
        {
          ...draft,
          providers: draft.providers.map((item) =>
            idSet.has(item.providerKey)
              ? {
                  ...item,
                  enabled,
                }
              : item,
          ),
        },
        createAdminAuditLog(module, enabled ? 'batch_enable' : 'batch_disable', targetIds.join(','), operator),
      )
    case 'actions':
      return prependAudit(
        {
          ...draft,
          actions: draft.actions.map((item) =>
            idSet.has(item.actionKey)
              ? {
                  ...item,
                  enabled,
                }
              : item,
          ),
        },
        createAdminAuditLog(module, enabled ? 'batch_enable' : 'batch_disable', targetIds.join(','), operator),
      )
    case 'fulfillmentStrategies':
      return prependAudit(
        {
          ...draft,
          fulfillmentStrategies: draft.fulfillmentStrategies.map((item) =>
            idSet.has(item.strategyKey)
              ? {
                  ...item,
                  enabled,
                }
              : item,
          ),
        },
        createAdminAuditLog(module, enabled ? 'batch_enable' : 'batch_disable', targetIds.join(','), operator),
      )
    case 'deliveryStrategies':
      return prependAudit(
        {
          ...draft,
          deliveryStrategies: draft.deliveryStrategies.map((item) =>
            idSet.has(item.strategyKey)
              ? {
                  ...item,
                  enabled,
                }
              : item,
          ),
        },
        createAdminAuditLog(module, enabled ? 'batch_enable' : 'batch_disable', targetIds.join(','), operator),
      )
    case 'telegramConfigs':
      return prependAudit(
        {
          ...draft,
          telegramConfigs: draft.telegramConfigs.map((item) =>
            idSet.has(item.botKey)
              ? {
                  ...item,
                  enabled,
                }
              : item,
          ),
        },
        createAdminAuditLog(module, enabled ? 'batch_enable' : 'batch_disable', targetIds.join(','), operator),
      )
    case 'internalClientKeys':
      return prependAudit(
        {
          ...draft,
          internalClientKeys: draft.internalClientKeys.map((item) =>
            idSet.has(item.clientKey)
              ? {
                  ...item,
                  enabled,
                  status: enabled ? 'active' : 'disabled',
                }
              : item,
          ),
        },
        createAdminAuditLog(module, enabled ? 'batch_enable' : 'batch_disable', targetIds.join(','), operator),
      )
    default:
      return draft
  }
}

export function prependAudit(draft: AdminSystemDraft, auditLog: AdminSystemDraft['auditLogs'][number]) {
  return {
    ...draft,
    auditLogs: [auditLog, ...draft.auditLogs],
  }
}

function upsertRow<T extends { key: string }>(rows: T[], nextRow: T) {
  const existed = rows.some((row) => row.key === nextRow.key)

  if (!existed) {
    return [nextRow, ...rows]
  }

  return rows.map((row) => (row.key === nextRow.key ? nextRow : row))
}

function createRowKey(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`
}

function toPlainObject(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function normalizeInternalClientStatus(value: unknown, enabled?: unknown): AdminInternalClientKey['status'] {
  if (typeof enabled === 'boolean') {
    return enabled ? 'active' : 'disabled'
  }

  switch (value) {
    case 'disabled':
    case 'revoked':
      return value
    default:
      return 'active'
  }
}
