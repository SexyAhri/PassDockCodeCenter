import type { AdminOrderRecord } from '../../api/adminOrders'
import type { AdminConsoleText } from '../../i18n/adminConsole-types'
import type { Locale } from '../../i18n/copy'
import type { DrawerFieldSchema } from '../system/types'
import type { OrderActionKey } from './actions'

export type AdminOrderConfirmDrawerState = {
  open: boolean
  order: AdminOrderRecord | null
}

export type AdminOrderDetailDrawerState = {
  open: boolean
  title: string
  loading: boolean
  error: string | null
  data: Record<string, unknown> | null
}

export const emptyAdminOrderConfirmDrawerState: AdminOrderConfirmDrawerState = {
  open: false,
  order: null,
}

export const emptyAdminOrderDetailDrawerState: AdminOrderDetailDrawerState = {
  open: false,
  title: '',
  loading: false,
  error: null,
  data: null,
}

export function getOrderPageLabels(locale: Locale) {
  return {
    viewDetail: locale === 'zh-CN' ? '查看详情' : 'Details',
    confirmPayment: locale === 'zh-CN' ? '确认支付' : 'Confirm payment',
    rejectPayment: locale === 'zh-CN' ? '驳回支付' : 'Reject payment',
    fulfill: locale === 'zh-CN' ? '触发履约' : 'Fulfill',
    retryFulfillment:
      locale === 'zh-CN' ? '重试履约' : 'Retry fulfillment',
    deliver: locale === 'zh-CN' ? '触发交付' : 'Deliver',
    completeDelivery: locale === 'zh-CN' ? '完成交付' : 'Complete delivery',
    retryDelivery: locale === 'zh-CN' ? '重试交付' : 'Retry delivery',
    cancel: locale === 'zh-CN' ? '取消订单' : 'Cancel order',
    markRefund: locale === 'zh-CN' ? '标记退款' : 'Mark refunded',
    originalRefund: locale === 'zh-CN' ? '发起原路退款' : 'Original refund',
    resend: locale === 'zh-CN' ? '补发结果' : 'Resend',
    reload: locale === 'zh-CN' ? '刷新' : 'Reload',
    remoteReady: locale === 'zh-CN' ? '远程接口' : 'Remote API',
    localFallback: locale === 'zh-CN' ? '本地兜底' : 'Local fallback',
    localDraft: locale === 'zh-CN' ? '本地草稿' : 'Local draft',
    remoteUnavailable:
      locale === 'zh-CN' ? '远程不可用' : 'Remote unavailable',
    confirmDrawerTitle:
      locale === 'zh-CN' ? '确认订单支付' : 'Confirm order payment',
    save: locale === 'zh-CN' ? '提交确认' : 'Submit',
    cancelText: locale === 'zh-CN' ? '取消' : 'Cancel',
    actionSuccess:
      locale === 'zh-CN' ? '订单状态已更新' : 'Order status updated',
    actionFailed:
      locale === 'zh-CN'
        ? '请求失败，请稍后重试。'
        : 'Request failed. Please try again.',
    paymentMethod: locale === 'zh-CN' ? '支付方式' : 'Payment method',
    amount: locale === 'zh-CN' ? '金额' : 'Amount',
    currency: locale === 'zh-CN' ? '币种' : 'Currency',
    note: locale === 'zh-CN' ? '备注' : 'Note',
    operationalStatus:
      locale === 'zh-CN' ? '运营状态' : 'Operational status',
    batchTitle: locale === 'zh-CN' ? '批量操作' : 'Bulk actions',
    clearSelection: locale === 'zh-CN' ? '清空选择' : 'Clear',
    selectedOne: locale === 'zh-CN' ? '条记录已选中' : 'record selected',
    selectedMany:
      locale === 'zh-CN' ? '条记录已选中' : 'records selected',
    batchActionHint:
      locale === 'zh-CN'
        ? '仅处理符合当前状态规则的已选订单，其余记录会自动跳过。'
        : 'Only selected orders that match the current status rules will be processed.',
    ordersDescription:
      locale === 'zh-CN'
        ? '按文档接口接入订单查询与人工操作，支持支付确认、履约、交付、取消、标记退款和原路退款。'
        : 'Connected to documented order APIs with payment confirmation, fulfillment, delivery, cancel, mark-refund, and original-refund actions.',
    reviewQueueDescription:
      locale === 'zh-CN'
        ? '聚焦需要人工确认付款的订单。'
        : 'Focused queue for orders waiting on manual payment review.',
  } as const
}

export function getOrderSourceLabel(
  source: string,
  labels: ReturnType<typeof getOrderPageLabels>,
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

export function getOrderActionLabelMap(
  labels: ReturnType<typeof getOrderPageLabels>,
): Record<OrderActionKey, string> {
  return {
    reject_payment: labels.rejectPayment,
    fulfill: labels.fulfill,
    retry_fulfillment: labels.retryFulfillment,
    deliver: labels.deliver,
    complete_delivery: labels.completeDelivery,
    retry_delivery: labels.retryDelivery,
    cancel: labels.cancel,
    refund_mark: labels.markRefund,
    refund_original: labels.originalRefund,
    resend: labels.resend,
  }
}

export function getBatchActionContent(
  locale: Locale,
  eligibleCount: number,
  selectedCount: number,
  fallback: string,
) {
  if (eligibleCount === selectedCount) {
    return fallback
  }

  if (locale === 'zh-CN') {
    return `将处理 ${eligibleCount} / ${selectedCount} 条可执行记录，其余会因状态不匹配而跳过。`
  }

  return `Will process ${eligibleCount} of ${selectedCount} selected records. Others will be skipped.`
}

export function getConfirmPaymentFields(
  text: AdminConsoleText,
  labels: ReturnType<typeof getOrderPageLabels>,
): DrawerFieldSchema[] {
  return [
    {
      name: 'paymentMethod',
      label: labels.paymentMethod,
      type: 'select',
      required: true,
      options: [
        { value: 'wechat_qr', label: text.enums.paymentMethod.wechat_qr },
        { value: 'alipay_qr', label: text.enums.paymentMethod.alipay_qr },
        { value: 'okx_usdt', label: text.enums.paymentMethod.okx_usdt },
      ],
    },
    { name: 'amount', label: labels.amount, type: 'text', required: true },
    {
      name: 'currency',
      label: labels.currency,
      type: 'text',
      required: true,
    },
    { name: 'note', label: labels.note, type: 'textarea', rows: 3 },
  ]
}

export function getConfirmPaymentInitialValues(order: AdminOrderRecord | null) {
  return {
    paymentMethod: order?.paymentMethod ?? 'wechat_qr',
    amount: order?.amount ?? '',
    currency: order?.currency ?? 'RMB',
    note: '',
  }
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}
