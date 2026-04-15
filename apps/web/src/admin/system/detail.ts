import { getAdminConsoleText } from '../../i18n/adminConsole'
import type { Locale } from '../../i18n/copy'
import type { AdminSystemDraft } from './types'

export type AdminSystemAuditDetailDrawerState = {
  open: boolean
  title: string
  loading: boolean
  error: string | null
  data: Record<string, unknown> | null
}

export type AdminTelegramWebhookDetailDrawerState = {
  open: boolean
  title: string
  botKey: string
  loading: boolean
  syncing: boolean
  deleting: boolean
  error: string | null
  data: Record<string, unknown> | null
}

export const emptyAdminSystemAuditDetailDrawerState: AdminSystemAuditDetailDrawerState = {
  open: false,
  title: '',
  loading: false,
  error: null,
  data: null,
}

export const emptyAdminTelegramWebhookDetailDrawerState: AdminTelegramWebhookDetailDrawerState = {
  open: false,
  title: '',
  botKey: '',
  loading: false,
  syncing: false,
  deleting: false,
  error: null,
  data: null,
}

export function getSystemAuditDetailTitle(locale: Locale) {
  return locale === 'zh-CN' ? '审计日志详情' : 'Audit log detail'
}

export function getTelegramWebhookDetailTitle(locale: Locale, botKey: string) {
  const suffix = botKey.trim() || '-'
  return locale === 'zh-CN'
    ? `Telegram 回调配置 - ${suffix}`
    : `Telegram webhook - ${suffix}`
}

export function buildLocalSystemAuditDetail(record: AdminSystemDraft['auditLogs'][number]) {
  return {
    logId: record.key,
    operator: record.operator,
    module: record.module,
    action: record.action,
    targetId: record.targetId,
    targetType: record.targetType ?? '',
    requestIp: record.requestIp ?? '',
    requestPayload: record.requestPayload ?? null,
    createdAt: record.createdAt,
  }
}

export function isPersistedAuditLogKey(value: unknown) {
  return /^\d+$/.test(String(value ?? '').trim())
}

export function getSystemAuditDetailLabels(locale: Locale) {
  const text = getAdminConsoleText(locale)
  const isZh = locale === 'zh-CN'

  return {
    logId: isZh ? '日志 ID' : 'Log ID',
    log_id: isZh ? '日志 ID' : 'Log ID',
    admin_user_id: isZh ? '管理员 ID' : 'Admin user ID',
    operator: text.table.operator,
    operator_email: isZh ? '操作人邮箱' : 'Operator email',
    operator_role: isZh ? '操作人角色' : 'Operator role',
    module: text.table.module,
    action: text.table.action,
    targetId: text.table.targetId,
    target_id: text.table.targetId,
    targetType: isZh ? '目标类型' : 'Target type',
    target_type: isZh ? '目标类型' : 'Target type',
    requestIp: isZh ? '请求 IP' : 'Request IP',
    request_ip: isZh ? '请求 IP' : 'Request IP',
    requestPayload: isZh ? '请求载荷' : 'Request payload',
    request_payload: isZh ? '请求载荷' : 'Request payload',
    createdAt: text.table.createdAt,
    created_at: text.table.createdAt,
  } satisfies Record<string, string>
}

export function getSystemAuditDetailPreferredKeys() {
  return [
    'logId',
    'log_id',
    'operator',
    'admin_user_id',
    'operator_email',
    'operator_role',
    'module',
    'action',
    'targetId',
    'target_id',
    'targetType',
    'target_type',
    'requestIp',
    'request_ip',
    'createdAt',
    'created_at',
    'requestPayload',
    'request_payload',
  ]
}

export function buildTelegramWebhookDetailData(
  setup: Record<string, unknown>,
  info?: Record<string, unknown> | null,
) {
  return {
    bot_key: String(setup.bot_key ?? info?.bot_key ?? ''),
    enabled: Boolean(setup.enabled),
    source: String(setup.source ?? ''),
    bot_username: String(setup.bot_username ?? ''),
    bot_token_masked: String(setup.bot_token_masked ?? ''),
    configured_webhook_url: String(setup.webhook_url_resolved ?? setup.webhook_url ?? ''),
    configured_webhook_path: String(setup.webhook_path ?? ''),
    configured_webhook_secret: String(setup.webhook_secret_masked ?? ''),
    configured_webhook_secret_header: String(setup.webhook_secret_header ?? ''),
    configured_webhook_ip: String(setup.webhook_ip ?? ''),
    configured_allowed_updates: normalizeWebhookList(setup.allowed_updates),
    configured_max_connections: Number(setup.max_connections ?? 0),
    configured_drop_pending_updates: Boolean(setup.drop_pending_updates),
    requires_app_base_url: Boolean(setup.requires_app_base_url),
    token_configured: Boolean(setup.token_configured),
    webhook_secret_present: Boolean(setup.webhook_secret_present),
    telegram_current_url: String(info?.url ?? ''),
    telegram_expected_url: String(info?.expected_webhook_url ?? ''),
    telegram_ip_address: String(info?.ip_address ?? ''),
    telegram_allowed_updates: normalizeWebhookList(info?.allowed_updates),
    telegram_max_connections: Number(info?.max_connections ?? 0),
    telegram_pending_update_count: Number(info?.pending_update_count ?? 0),
    telegram_has_custom_certificate: Boolean(info?.has_custom_certificate),
    telegram_last_error_date: normalizeWebhookTimestamp(info?.last_error_date),
    telegram_last_error_message: String(info?.last_error_message ?? ''),
    telegram_last_sync_error_date: normalizeWebhookTimestamp(info?.last_synchronization_error_date),
    expected_secret_header: String(info?.expected_secret_header ?? ''),
  } satisfies Record<string, unknown>
}

export function getTelegramWebhookDetailFieldLabels(locale: Locale) {
  const isZh = locale === 'zh-CN'

  return {
    bot_key: isZh ? '机器人标识' : 'Bot key',
    enabled: isZh ? '启用' : 'Enabled',
    source: isZh ? '来源' : 'Source',
    bot_username: isZh ? '机器人用户名' : 'Bot username',
    bot_token_masked: isZh ? '机器人令牌' : 'Token',
    configured_webhook_url: isZh ? '配置的回调地址' : 'Configured webhook URL',
    configured_webhook_path: isZh ? '回调路径' : 'Webhook path',
    configured_webhook_secret: isZh ? '配置的回调密钥' : 'Configured secret',
    configured_webhook_secret_header: isZh ? '密钥请求头' : 'Secret header',
    configured_webhook_ip: isZh ? '配置的回调 IP' : 'Configured webhook IP',
    configured_allowed_updates: isZh ? '配置的更新类型' : 'Configured updates',
    configured_max_connections: isZh ? '配置的最大连接数' : 'Configured max connections',
    configured_drop_pending_updates: isZh ? '同步时清空积压' : 'Drop pending on sync',
    requires_app_base_url: isZh ? '依赖 APP_BASE_URL' : 'Requires APP_BASE_URL',
    token_configured: isZh ? '机器人令牌已配置' : 'Token configured',
    webhook_secret_present: isZh ? '回调密钥已配置' : 'Secret configured',
    telegram_current_url: isZh ? 'Telegram 当前地址' : 'Telegram current URL',
    telegram_expected_url: isZh ? 'Telegram 预期地址' : 'Telegram expected URL',
    telegram_ip_address: isZh ? 'Telegram 当前 IP' : 'Telegram current IP',
    telegram_allowed_updates: isZh ? 'Telegram 当前更新类型' : 'Telegram current updates',
    telegram_max_connections: isZh ? 'Telegram 当前最大连接数' : 'Telegram current max connections',
    telegram_pending_update_count: isZh ? '待处理更新数' : 'Pending update count',
    telegram_has_custom_certificate: isZh ? '自定义证书' : 'Custom certificate',
    telegram_last_error_date: isZh ? '最近错误时间' : 'Last error date',
    telegram_last_error_message: isZh ? '最近错误信息' : 'Last error message',
    telegram_last_sync_error_date: isZh ? '最近同步错误时间' : 'Last sync error date',
    expected_secret_header: isZh ? '预期密钥请求头' : 'Expected secret header',
  } satisfies Record<string, string>
}

export function getTelegramWebhookDetailPreferredKeys() {
  return [
    'bot_key',
    'enabled',
    'source',
    'bot_username',
    'bot_token_masked',
    'configured_webhook_url',
    'configured_webhook_path',
    'configured_webhook_secret',
    'configured_webhook_secret_header',
    'configured_webhook_ip',
    'configured_allowed_updates',
    'configured_max_connections',
    'configured_drop_pending_updates',
    'requires_app_base_url',
    'token_configured',
    'webhook_secret_present',
    'telegram_current_url',
    'telegram_expected_url',
    'telegram_ip_address',
    'telegram_allowed_updates',
    'telegram_max_connections',
    'telegram_pending_update_count',
    'telegram_has_custom_certificate',
    'telegram_last_error_date',
    'telegram_last_error_message',
    'telegram_last_sync_error_date',
    'expected_secret_header',
  ]
}

export function getTelegramWebhookActionLabels(locale: Locale) {
  const isZh = locale === 'zh-CN'

  return {
    entry: isZh ? '回调详情' : 'Webhook',
    refresh: isZh ? '刷新状态' : 'Refresh',
    sync: isZh ? '同步回调' : 'Sync webhook',
    delete: isZh ? '删除回调' : 'Delete webhook',
    deleteAndDrop: isZh ? '删除并清空积压' : 'Delete and drop pending',
    syncSuccess: isZh ? '回调已同步' : 'Webhook synced',
    deleteSuccess: isZh ? '回调已删除' : 'Webhook deleted',
    syncConfirmTitle: isZh ? '同步 Telegram 回调' : 'Sync Telegram webhook',
    syncConfirmBody: isZh
      ? '将把当前机器人配置同步到 Telegram 回调设置。'
      : 'This will sync the current bot config to Telegram setWebhook.',
    deleteConfirmTitle: isZh ? '删除 Telegram 回调' : 'Delete Telegram webhook',
    deleteConfirmBody: isZh
      ? '将从 Telegram 端移除当前回调配置，默认保留待处理更新。'
      : 'This removes the current webhook from Telegram and keeps pending updates by default.',
    deleteAndDropConfirmBody: isZh
      ? '将从 Telegram 端移除当前回调配置，并清空待处理更新。'
      : 'This removes the current webhook from Telegram and drops pending updates.',
    infoWarningPrefix: isZh ? '回调配置已加载，但 Telegram 实时状态读取失败：' : 'Webhook config loaded, but Telegram live info failed: ',
  }
}

function normalizeWebhookList(value: unknown) {
  if (!Array.isArray(value)) {
    return ''
  }

  return value.map((item) => String(item).trim()).filter(Boolean).join(', ')
}

function normalizeWebhookTimestamp(value: unknown) {
  if (!value) {
    return ''
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return String(value)
}
