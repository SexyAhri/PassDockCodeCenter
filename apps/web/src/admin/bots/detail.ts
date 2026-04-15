import type { Locale } from '../../i18n/copy'

export type AdminBotsDetailKind = 'binding' | 'delivery' | 'result'

export type AdminBotsDetailDrawerState = {
  open: boolean
  kind: AdminBotsDetailKind
  title: string
  loading: boolean
  error: string | null
  data: Record<string, unknown> | null
}

export const emptyAdminBotsDetailDrawerState: AdminBotsDetailDrawerState = {
  open: false,
  kind: 'binding',
  title: '',
  loading: false,
  error: null,
  data: null,
}

export function getBotResultLabels(locale: Locale) {
  return {
    bot_key: locale === 'zh-CN' ? '机器人标识' : 'Bot key',
    chat_id: locale === 'zh-CN' ? '会话 ID' : 'Chat id',
    text: locale === 'zh-CN' ? '返回文本' : 'Response text',
    message: locale === 'zh-CN' ? '消息内容' : 'Message',
    message_id: locale === 'zh-CN' ? '消息 ID' : 'Message id',
    status: locale === 'zh-CN' ? '状态' : 'Status',
    operator: locale === 'zh-CN' ? '操作人' : 'Operator',
    user_id: locale === 'zh-CN' ? '用户 ID' : 'User id',
    display_name: locale === 'zh-CN' ? '显示名称' : 'Display name',
    telegram_user_id: locale === 'zh-CN' ? 'Telegram 用户 ID' : 'Telegram user id',
    telegram_username: locale === 'zh-CN' ? 'Telegram 用户名' : 'Telegram username',
    record_id: locale === 'zh-CN' ? '记录 ID' : 'Record id',
    delivery_status: locale === 'zh-CN' ? '交付状态' : 'Delivery status',
    delivered_at: locale === 'zh-CN' ? '发送时间' : 'Delivered at',
    bound_at: locale === 'zh-CN' ? '绑定时间' : 'Bound at',
  }
}

export function getTelegramBindingPreferredKeys() {
  return [
    'bot_key',
    'binding_id',
    'user_id',
    'display_name',
    'email',
    'user_status',
    'user_role',
    'telegram_user_id',
    'telegram_username',
    'chat_id',
    'bound_at',
    'last_login_at',
  ]
}

export function getBotResultPreferredKeys() {
  return [
    'bot_key',
    'user_id',
    'display_name',
    'telegram_user_id',
    'telegram_username',
    'chat_id',
    'message',
    'text',
    'message_id',
    'status',
    'operator',
    'record_id',
    'delivery_status',
    'delivered_at',
    'bound_at',
  ]
}
