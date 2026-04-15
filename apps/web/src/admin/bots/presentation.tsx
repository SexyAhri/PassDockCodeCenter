import {
  ApiOutlined,
  CheckCircleOutlined,
  RobotOutlined,
  WarningOutlined,
} from '@ant-design/icons'

import type {
  AdminDeliveryRecord,
  AdminTelegramBindingRecord,
} from '../../api/adminBots'
import type { AdminDraftSource } from '../../hooks/useAdminSystemConfig'
import type { Locale } from '../../i18n/copy'
import type { StatusTone } from '../status'

export function getAdminBotsText(locale: Locale) {
  const isZh = locale === 'zh-CN'

  return {
    page: {
      title: isZh ? 'Telegram 机器人管理' : 'Bot / Telegram operations',
      subtitle: isZh
        ? '集中管理机器人绑定、测试消息、回调演练和 Telegram 交付重试。'
        : 'Manage bot bindings, test sends, webhook simulations, and Telegram delivery retries.',
    },
    source: {
      remoteReady: isZh ? '远程接口' : 'Remote API',
      localFallback: isZh ? '本地兜底' : 'Local fallback',
      localDraft: isZh ? '本地草稿' : 'Local draft',
      remoteUnavailable: isZh ? '远程不可用' : 'Remote unavailable',
      remoteRequired: isZh
        ? '需要配置 VITE_API_BASE_URL 后，才能启用真实 Telegram 机器人管理接口。'
        : 'Configure VITE_API_BASE_URL to enable real Bot / Telegram operations.',
    },
    metrics: {
      bindings: isZh ? '绑定账户' : 'Bindings',
      deliveries: isZh ? 'Telegram 交付' : 'Telegram deliveries',
      sent: isZh ? '已发送' : 'Sent',
      failed: isZh ? '失败/待处理' : 'Failed / pending',
    },
    sections: {
      bindings: isZh ? '绑定记录' : 'Bindings',
      deliveries: isZh ? 'Telegram 交付' : 'Telegram deliveries',
      bindingsTitle: isZh ? '机器人绑定记录' : 'Bot binding records',
      deliveriesTitle: isZh ? 'Telegram 交付记录' : 'Telegram delivery records',
      bindingsDescription: isZh
        ? '当前机器人标识下的 Telegram 账户绑定关系，可直接查看绑定详情。'
        : 'Telegram account bindings under the current bot key.',
      deliveriesDescription: isZh
        ? '系统内 Telegram 交付执行记录，可查看详情并对失败记录执行补发。'
        : 'Telegram delivery execution records with detail and retry actions.',
    },
    cards: {
      scope: {
        title: isZh ? '机器人范围与绑定' : 'Bot scope and binding',
        description: isZh
          ? '所有测试、绑定和重试动作都作用于当前机器人标识。'
          : 'All binding, test, and retry actions apply to the current bot key.',
      },
      testSend: {
        title: isZh ? '测试发送' : 'Test send',
        description: isZh
          ? '直接对指定会话 ID 发送测试消息，验证通道和操作日志。'
          : 'Send a test message to validate the channel and audit trail.',
      },
      webhook: {
        title: isZh ? '回调演练' : 'Webhook simulation',
        description: isZh
          ? '模拟 Telegram 回调请求，检查命令响应链路。'
          : 'Simulate Telegram webhook requests and inspect the command response.',
      },
      retry: {
        title: isZh ? '交付补发' : 'Retry delivery',
        description: isZh
          ? '按记录 ID 触发单条补发，也支持下方表格批量重试。'
          : 'Retry a single delivery by record id or use batch retry from the table.',
      },
    },
    fields: {
      botKey: isZh ? '机器人标识' : 'Bot key',
      email: isZh ? '邮箱' : 'Email',
      displayName: isZh ? '显示名称' : 'Display name',
      telegramUserId: isZh ? 'Telegram 用户 ID' : 'Telegram user id',
      telegramUsername: isZh ? 'Telegram 用户名' : 'Telegram username',
      chatId: isZh ? '会话 ID' : 'Chat id',
      message: isZh ? '消息内容' : 'Message',
      operator: isZh ? '操作人' : 'Operator',
      text: isZh ? '命令文本' : 'Command text',
      deliveryRecordId: isZh ? '交付记录 ID' : 'Delivery record id',
    },
    placeholders: {
      botKey: isZh ? '例如 default' : 'For example: default',
      email: isZh ? '可选，已有用户可直接绑定' : 'Optional. Bind to an existing user by email.',
      displayName: isZh ? '未填写时将自动生成' : 'Generated automatically if omitted.',
      telegramUserId: isZh ? '例如 7123456789' : 'For example: 7123456789',
      telegramUsername: isZh ? '例如 passdock_ops' : 'For example: passdock_ops',
      chatId: isZh ? '例如 7123456789' : 'For example: 7123456789',
      message: isZh ? '输入测试消息内容' : 'Type a test message',
      operator: isZh ? '填写当前操作人' : 'Operator name',
      text: isZh ? '例如 /orders' : 'For example: /orders',
      deliveryRecordId: isZh ? '输入交付记录 ID' : 'Enter a delivery record id',
    },
    actions: {
      applyBotKey: isZh ? '切换机器人' : 'Load bot',
      bind: isZh ? '绑定用户' : 'Bind user',
      send: isZh ? '发送测试' : 'Send test',
      simulate: isZh ? '模拟回调' : 'Simulate',
      retry: isZh ? '重试补发' : 'Retry',
      reload: isZh ? '刷新' : 'Reload',
      details: isZh ? '详情' : 'Details',
      ordersPage: isZh ? '订单中心' : 'Orders',
      batchRetry: isZh ? '批量补发' : 'Batch retry',
      clearSelection: isZh ? '清空选择' : 'Clear',
    },
    selection: {
      title: isZh ? '批量操作' : 'Bulk actions',
      single: isZh ? '条记录已选中' : 'record selected',
      plural: isZh ? '条记录已选中' : 'records selected',
    },
    feedback: {
      bindingSaved: isZh ? 'Telegram 绑定已保存' : 'Telegram binding saved.',
      testSent: isZh ? '测试消息已发送' : 'Test message sent.',
      webhookSimulated: isZh ? '回调演练已完成' : 'Webhook simulation completed.',
      retryDone: isZh ? '交付补发已触发' : 'Delivery retry triggered.',
      batchRetryDone: isZh ? '批量补发已完成' : 'Batch retry completed.',
      actionFailed: isZh
        ? '请求失败，请稍后重试。'
        : 'Request failed. Please try again.',
    },
    detail: {
      bindingTitle: isZh ? '绑定详情' : 'Binding details',
      deliveryTitle: isZh ? '交付详情' : 'Delivery details',
      resultTitle: isZh ? '执行结果' : 'Operation result',
    },
  } as const
}

export function normalizeBotKey(value: string) {
  const normalized = value.trim()
  return normalized || 'default'
}

export function getAdminBotSourceLabel(
  source: AdminDraftSource,
  labels: ReturnType<typeof getAdminBotsText>,
) {
  if (source === 'remote') {
    return labels.source.remoteReady
  }

  if (source === 'remote-error') {
    return labels.source.remoteUnavailable
  }

  if (source === 'local-fallback') {
    return labels.source.localFallback
  }

  return labels.source.localDraft
}

export function buildAdminBotMetricItems(
  locale: Locale,
  bindings: AdminTelegramBindingRecord[],
  deliveryRecords: AdminDeliveryRecord[],
) {
  const text = getAdminBotsText(locale)
  const sentCount = deliveryRecords.filter((record) => record.status === 'sent').length
  const failedCount = deliveryRecords.filter((record) => record.status !== 'sent').length

  return [
    {
      key: 'bindings',
      title: text.metrics.bindings,
      value: bindings.length,
      percent: 100,
      color: '#2563eb',
      icon: <RobotOutlined />,
    },
    {
      key: 'deliveries',
      title: text.metrics.deliveries,
      value: deliveryRecords.length,
      percent: Math.min(100, Math.max(deliveryRecords.length, 1) * 10),
      color: '#7c3aed',
      icon: <ApiOutlined />,
    },
    {
      key: 'sent',
      title: text.metrics.sent,
      value: sentCount,
      percent: Math.round((sentCount / Math.max(deliveryRecords.length, 1)) * 100),
      color: '#0f9f6e',
      icon: <CheckCircleOutlined />,
    },
    {
      key: 'failed',
      title: text.metrics.failed,
      value: failedCount,
      percent: Math.round((failedCount / Math.max(deliveryRecords.length, 1)) * 100),
      color: '#d97706',
      icon: <WarningOutlined />,
    },
  ]
}

export function getTelegramBindingStatusTone(status: string): StatusTone {
  switch (status) {
    case 'active':
      return 'success'
    case 'pending':
      return 'warning'
    case 'disabled':
    case 'blocked':
    case 'deleted':
      return 'error'
    default:
      return 'default'
  }
}

export function getTelegramBindingStatusLabel(locale: Locale, status: string) {
  const isZh = locale === 'zh-CN'

  switch (status) {
    case 'active':
      return isZh ? '正常' : 'Active'
    case 'pending':
      return isZh ? '待激活' : 'Pending'
    case 'disabled':
      return isZh ? '已停用' : 'Disabled'
    case 'blocked':
      return isZh ? '已封禁' : 'Blocked'
    case 'deleted':
      return isZh ? '已删除' : 'Deleted'
    default:
      return status || '-'
  }
}

export function getTelegramRoleLabel(locale: Locale, role: string) {
  const isZh = locale === 'zh-CN'

  switch (role) {
    case 'admin':
      return isZh ? '管理员' : 'Admin'
    case 'operator':
      return isZh ? '运营' : 'Operator'
    case 'user':
      return isZh ? '用户' : 'User'
    default:
      return role || '-'
  }
}

export function getTelegramCommandPreset(locale: Locale) {
  return locale === 'zh-CN' ? '/orders' : '/orders'
}
