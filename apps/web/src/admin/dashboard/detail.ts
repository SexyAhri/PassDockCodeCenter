import type { Locale } from '../../i18n/copy'

export type AdminDashboardDetailKind = 'order' | 'ticket'

export type AdminDashboardDetailDrawerState = {
  open: boolean
  kind: AdminDashboardDetailKind
  title: string
  loading: boolean
  error: string | null
  data: Record<string, unknown> | null
}

export const emptyDashboardDetailDrawerState: AdminDashboardDetailDrawerState = {
  open: false,
  kind: 'order',
  title: '',
  loading: false,
  error: null,
  data: null,
}

export function getDashboardLabels(locale: Locale) {
  const isZh = locale === 'zh-CN'

  return {
    details: isZh ? '详情' : 'Details',
    ordersPage: isZh ? '订单中心' : 'Orders',
    supportPage: isZh ? '工单中心' : 'Support',
    systemPage: isZh ? '系统配置' : 'System',
    reviewQueuePage: isZh ? '审核队列' : 'Review queue',
    urgentTicketsPage: isZh ? '紧急工单' : 'Urgent tickets',
    paymentReviewPage: isZh ? '待审核支付' : 'Pending payments',
    runningFulfillmentPage: isZh ? '运行中履约' : 'Running fulfillment',
    reload: isZh ? '刷新' : 'Reload',
    actionFailed: isZh
      ? '请求失败，请稍后重试。'
      : 'Request failed. Please try again.',
    recentOrdersDescription: isZh
      ? '展示最近订单流，可直接下钻详情或跳转订单中心。'
      : 'Live order feed with direct detail drill-down and order-center routing.',
    reviewQueueDescription: isZh
      ? '统一查看支付截图、链上异常与人工确认订单。'
      : 'Manual review workload for proof checks, chain mismatches, and operator approval.',
    urgentTicketsDescription: isZh
      ? '集中展示高优先级与紧急工单，方便值班处理。'
      : 'High-priority customer tickets grouped for operator triage.',
    integrationHealthDescription: isZh
      ? '查看支付渠道与上游服务方的整体健康状态。'
      : 'Health view for payment channels and upstream providers.',
    revenueChannelsDescription: isZh
      ? '按支付方式汇总已支付收入，快速观察渠道表现。'
      : 'Paid revenue grouped by payment method for quick channel readouts.',
    remoteReady: isZh ? '远程接口' : 'Remote API',
    localFallback: isZh ? '本地兜底' : 'Local fallback',
    localDraft: isZh ? '本地草稿' : 'Local draft',
    remoteUnavailable: isZh ? '远程不可用' : 'Remote unavailable',
  } as const
}

export function getDashboardSourceLabel(
  source: string,
  labels: ReturnType<typeof getDashboardLabels>,
) {
  if (source === 'remote') {
    return labels.remoteReady
  }

  if (source === 'remote-error') {
    return labels.remoteUnavailable
  }

  if (source === 'local-fallback') {
    return labels.localFallback
  }

  return labels.localDraft
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}
