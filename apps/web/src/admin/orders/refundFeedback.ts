import type { AdminOrderRefundResult } from '../../api/adminOrders'
import type { Locale } from '../../i18n/copy'

type RefundFeedbackLevel = 'success' | 'warning' | 'error'

type NormalizedRefundFeedback = {
  status: string
  message: string
  receiptNo: string
}

export function normalizeOriginalRefundFeedback(
  result: AdminOrderRefundResult | void | undefined,
): NormalizedRefundFeedback {
  return {
    status: String(result?.status ?? '').trim().toLowerCase(),
    message: String(result?.message ?? '').trim(),
    receiptNo: String(result?.receipt_no ?? '').trim(),
  }
}

export function resolveOriginalRefundFeedbackLevel(
  result: NormalizedRefundFeedback,
): RefundFeedbackLevel {
  switch (result.status) {
    case 'succeeded':
      return 'success'
    case 'processing':
      return 'warning'
    default:
      return 'error'
  }
}

export function buildOriginalRefundFeedbackMessage(
  locale: Locale,
  result: NormalizedRefundFeedback,
) {
  const fallback = getOriginalRefundFallbackMessage(locale, result.status)
  const base = result.message || fallback

  if (!result.receiptNo) {
    return base
  }

  return locale === 'zh-CN'
    ? `${base}，回执号：${result.receiptNo}`
    : `${base} Receipt: ${result.receiptNo}`
}

function getOriginalRefundFallbackMessage(locale: Locale, status: string) {
  switch (status) {
    case 'succeeded':
      return locale === 'zh-CN'
        ? '原路退款已完成'
        : 'Original refund completed successfully.'
    case 'processing':
      return locale === 'zh-CN'
        ? '原路退款已提交，等待通道处理'
        : 'Original refund accepted and is processing.'
    default:
      return locale === 'zh-CN'
        ? '原路退款发起失败'
        : 'Original refund request failed.'
  }
}
