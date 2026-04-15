import type { AdminDeliveryRecord } from './adminFulfillment'
import { getAdminDeliveryRecordDetail } from './adminFulfillment'
import { requestJson, unwrapListData } from './http'

export type AdminTelegramBindingRecord = {
  key: string
  bindingId: string
  botKey: string
  userId: string
  displayName: string
  email: string
  userStatus: string
  userRole: string
  telegramUserId: string
  telegramUsername: string
  chatId: string
  boundAt: string
  lastLoginAt: string
}

type TelegramBindingDto = {
  id?: string | number
  binding_id?: string | number
  bot_key?: string
  user_id?: string | number
  display_name?: string
  email?: string
  user_status?: string
  user_role?: string
  telegram_user_id?: string
  telegram_username?: string
  chat_id?: string
  bound_at?: string
  last_login_at?: string
}

type DeliveryRecordDto = {
  id?: string | number
  record_id?: string | number
  bot_key?: string
  order_no?: string
  delivery_channel?: string
  channel_type?: string
  target?: string
  status?: string
  message_id?: string
  started_at?: string
  finished_at?: string
}

type TelegramBindInput = {
  email?: string
  displayName?: string
  telegramUserId: string
  telegramUsername?: string
  chatId: string
}

type TelegramTestSendInput = {
  chatId: string
  message: string
  operator: string
}

type TelegramWebhookSimulationInput = {
  chatId: string
  text: string
  telegramUserId: string
  username?: string
  operator?: string
}

export async function loadAdminTelegramBindings(botKey: string) {
  const payload = await requestJson<unknown>(
    `/api/v1/admin/bots/${encodeURIComponent(botKey)}/telegram/bindings`,
  )

  return unwrapListData<TelegramBindingDto>(payload).map(mapTelegramBindingDto)
}

export async function loadAdminTelegramDeliveries(botKey: string) {
  const payload = await requestJson<unknown>(
    `/api/v1/admin/bots/${encodeURIComponent(botKey)}/telegram/deliveries`,
  )

  return unwrapListData<DeliveryRecordDto>(payload).map(mapDeliveryRecordDto)
}

export async function bindTelegramUser(botKey: string, input: TelegramBindInput) {
  return requestJson<Record<string, unknown>>(
    `/api/v1/bots/${encodeURIComponent(botKey)}/telegram/bind`,
    {
      method: 'POST',
      body: {
        email: input.email ?? '',
        display_name: input.displayName ?? '',
        telegram_user_id: input.telegramUserId,
        telegram_username: input.telegramUsername ?? '',
        chat_id: input.chatId,
      },
    },
  )
}

export async function testTelegramSend(botKey: string, input: TelegramTestSendInput) {
  return requestJson<Record<string, unknown>>(
    `/api/v1/admin/bots/${encodeURIComponent(botKey)}/telegram/test-send`,
    {
      method: 'POST',
      body: {
        chat_id: input.chatId,
        message: input.message,
        operator: input.operator,
      },
    },
  )
}

export async function simulateTelegramWebhook(
  botKey: string,
  input: TelegramWebhookSimulationInput,
) {
  return requestJson<Record<string, unknown>>(
    `/api/v1/admin/bots/${encodeURIComponent(botKey)}/telegram/simulate-webhook`,
    {
      method: 'POST',
      body: {
        chat_id: input.chatId,
        text: input.text,
        telegram_user_id: input.telegramUserId,
        username: input.username ?? '',
        operator: input.operator ?? '',
      },
    },
  )
}

export async function retryTelegramDelivery(botKey: string, deliveryRecordId: string) {
  return requestJson<Record<string, unknown>>(
    `/api/v1/admin/bots/${encodeURIComponent(botKey)}/telegram/deliveries/${encodeURIComponent(deliveryRecordId)}/retry`,
    {
      method: 'POST',
    },
  )
}

export async function loadAdminTelegramOperationsSnapshot(botKey: string) {
  const [bindings, deliveryRecords] = await Promise.all([
    loadAdminTelegramBindings(botKey),
    loadAdminTelegramDeliveries(botKey),
  ])

  return {
    bindings,
    deliveryRecords,
  }
}

export { getAdminDeliveryRecordDetail }

function mapTelegramBindingDto(dto: TelegramBindingDto): AdminTelegramBindingRecord {
  const bindingId = String(dto.binding_id ?? dto.id ?? '')

  return {
    key: bindingId,
    bindingId,
    botKey: String(dto.bot_key ?? 'default'),
    userId: String(dto.user_id ?? ''),
    displayName: String(dto.display_name ?? ''),
    email: String(dto.email ?? ''),
    userStatus: String(dto.user_status ?? ''),
    userRole: String(dto.user_role ?? ''),
    telegramUserId: String(dto.telegram_user_id ?? ''),
    telegramUsername: String(dto.telegram_username ?? ''),
    chatId: String(dto.chat_id ?? ''),
    boundAt: String(dto.bound_at ?? ''),
    lastLoginAt: String(dto.last_login_at ?? ''),
  }
}

function mapDeliveryRecordDto(dto: DeliveryRecordDto): AdminDeliveryRecord {
  return {
    key: String(dto.id ?? dto.record_id ?? dto.order_no ?? ''),
    orderNo: String(dto.order_no ?? ''),
    deliveryChannel: normalizeDeliveryChannel(dto.delivery_channel ?? dto.channel_type),
    target: String(dto.target ?? ''),
    status: normalizeDeliveryStatus(dto.status),
    startedAt: String(dto.started_at ?? ''),
    finishedAt: String(dto.finished_at ?? ''),
  }
}

export function buildTelegramBindingDetail(record: AdminTelegramBindingRecord) {
  return {
    bot_key: record.botKey,
    binding_id: record.bindingId,
    user_id: record.userId,
    display_name: record.displayName,
    email: record.email,
    user_status: record.userStatus,
    user_role: record.userRole,
    telegram_user_id: record.telegramUserId,
    telegram_username: record.telegramUsername,
    chat_id: record.chatId,
    bound_at: record.boundAt,
    last_login_at: record.lastLoginAt,
  }
}

export function buildTelegramBindingLabels(locale: 'zh-CN' | 'en-US') {
  return {
    bot_key: locale === 'zh-CN' ? '机器人标识' : 'Bot key',
    binding_id: locale === 'zh-CN' ? '绑定 ID' : 'Binding id',
    user_id: locale === 'zh-CN' ? '用户 ID' : 'User id',
    display_name: locale === 'zh-CN' ? '显示名称' : 'Display name',
    email: locale === 'zh-CN' ? '邮箱' : 'Email',
    user_status: locale === 'zh-CN' ? '用户状态' : 'User status',
    user_role: locale === 'zh-CN' ? '用户角色' : 'User role',
    telegram_user_id: locale === 'zh-CN' ? 'Telegram 用户 ID' : 'Telegram user id',
    telegram_username: locale === 'zh-CN' ? 'Telegram 用户名' : 'Telegram username',
    chat_id: locale === 'zh-CN' ? '会话 ID' : 'Chat id',
    bound_at: locale === 'zh-CN' ? '绑定时间' : 'Bound at',
    last_login_at: locale === 'zh-CN' ? '最近登录' : 'Last login',
  }
}

export type { AdminDeliveryRecord }

function normalizeDeliveryChannel(value: unknown): AdminDeliveryRecord['deliveryChannel'] {
  switch (value) {
    case 'telegram':
    case 'email':
    case 'manual':
      return value
    default:
      return 'web'
  }
}

function normalizeDeliveryStatus(value: unknown): AdminDeliveryRecord['status'] {
  switch (value) {
    case 'sending':
    case 'sent':
    case 'failed':
    case 'cancelled':
      return value
    default:
      return 'pending'
  }
}
