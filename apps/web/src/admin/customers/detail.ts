import type { Locale } from '../../i18n/copy'

export type AdminCustomersDetailKind = 'customer' | 'ticket'

export type AdminCustomersDetailDrawerState = {
  open: boolean
  kind: AdminCustomersDetailKind
  title: string
  loading: boolean
  error: string | null
  data: Record<string, unknown> | null
}

export const emptyAdminCustomersDetailDrawerState: AdminCustomersDetailDrawerState =
  {
    open: false,
    kind: 'customer',
    title: '',
    loading: false,
    error: null,
    data: null,
  }

export function getCustomerPageLabels(locale: Locale) {
  return {
    details: locale === 'zh-CN' ? '详情' : 'Details',
    ordersPage: locale === 'zh-CN' ? '订单中心' : 'Orders',
    supportPage: locale === 'zh-CN' ? '工单中心' : 'Support',
    reload: locale === 'zh-CN' ? '刷新' : 'Reload',
    actionFailed:
      locale === 'zh-CN'
        ? '请求失败，请稍后重试。'
        : 'Request failed. Please try again.',
    attentionAccounts: locale === 'zh-CN' ? '重点跟进客户' : 'Attention accounts',
    recentTickets: locale === 'zh-CN' ? '关联工单' : 'Related tickets',
    lastActivity: locale === 'zh-CN' ? '最近活跃' : 'Last activity',
    pendingReviews: locale === 'zh-CN' ? '待审核订单' : 'Pending reviews',
    openTickets: locale === 'zh-CN' ? '处理中工单' : 'Open tickets',
    urgentTickets: locale === 'zh-CN' ? '高优工单' : 'Urgent tickets',
    customerTotal: locale === 'zh-CN' ? '客户总数' : 'Customers',
    customersDescription:
      locale === 'zh-CN'
        ? '客户画像由订单与工单聚合生成，后续可无缝切换到独立客户接口。'
        : 'Customer profiles now load from the backend aggregate API with synced orders, tickets, and Telegram bindings.',
    attentionDescription:
      locale === 'zh-CN'
        ? '把待审核订单、处理中工单和高优异常统一收敛到一个跟进清单。'
        : 'Follow-up list combining pending reviews, open tickets, and urgent customer signals.',
    ticketsDescription:
      locale === 'zh-CN'
        ? '这里只展示当前筛选客户对应的工单，便于销售与客服协同。'
        : 'Support tickets scoped to the currently filtered customer set for faster coordination.',
    remoteReady: locale === 'zh-CN' ? '远程接口' : 'Remote API',
    localFallback: locale === 'zh-CN' ? '本地兜底' : 'Local fallback',
    localDraft: locale === 'zh-CN' ? '本地草稿' : 'Local draft',
    remoteUnavailable:
      locale === 'zh-CN' ? '远程不可用' : 'Remote unavailable',
  } as const
}

export function getCustomersSourceLabel(
  source: string,
  labels: ReturnType<typeof getCustomerPageLabels>,
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
