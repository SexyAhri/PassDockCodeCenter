import {
  cancelAdminOrder,
  completeAdminOrderDelivery,
  markAdminOrderRefund,
  requestAdminOrderOriginalRefund,
  rejectAdminOrderPayment,
  resendAdminOrderDelivery,
  retryAdminOrderDelivery,
  retryAdminOrderFulfillment,
  triggerAdminOrderDelivery,
  triggerAdminOrderFulfillment,
  type AdminOrderRefundResult,
  type AdminOrderRecord,
} from '../../api/adminOrders'

export type OrderActionKey =
  | 'reject_payment'
  | 'fulfill'
  | 'retry_fulfillment'
  | 'deliver'
  | 'complete_delivery'
  | 'retry_delivery'
  | 'cancel'
  | 'refund_mark'
  | 'refund_original'
  | 'resend'

export function canConfirmPayment(order: AdminOrderRecord) {
  return (
    order.paymentStatus === 'pending_review' ||
    order.orderStatus === 'paid_pending_review'
  )
}

export function canRejectPayment(order: AdminOrderRecord) {
  return order.paymentStatus === 'pending_review'
}

export function canFulfill(order: AdminOrderRecord) {
  return (
    order.paymentStatus === 'paid' &&
    ['payment_confirmed', 'paid_pending_review'].includes(order.orderStatus)
  )
}

export function canRetryFulfillment(order: AdminOrderRecord) {
  return order.orderStatus === 'failed' || order.orderStatus === 'issuing'
}

export function canDeliver(order: AdminOrderRecord) {
  if (hasPendingManualDelivery(order)) {
    return false
  }

  return (
    order.orderStatus === 'issued' || order.orderStatus === 'delivery_pending'
  )
}

export function canCompleteDelivery(order: AdminOrderRecord) {
  return hasPendingManualDelivery(order)
}

export function canRetryDelivery(order: AdminOrderRecord) {
  return order.deliveryStatus === 'failed'
}

export function canCancel(order: AdminOrderRecord) {
  return !['cancelled', 'completed', 'refunded', 'failed'].includes(
    order.orderStatus,
  )
}

export function canMarkRefund(order: AdminOrderRecord) {
  return order.paymentStatus === 'paid' && order.orderStatus !== 'refunded'
}

export function canOriginalRefund(order: AdminOrderRecord) {
  return order.paymentStatus === 'paid' && order.orderStatus !== 'refunded'
}

export function canResend(order: AdminOrderRecord) {
  if (usesManualDeliveryCompletion(order)) {
    return false
  }

  return (
    order.deliveryStatus === 'sent' ||
    order.orderStatus === 'delivered' ||
    order.orderStatus === 'completed'
  )
}

export function canRunOrderAction(
  order: AdminOrderRecord,
  action: OrderActionKey,
) {
  switch (action) {
    case 'reject_payment':
      return canRejectPayment(order)
    case 'fulfill':
      return canFulfill(order)
    case 'retry_fulfillment':
      return canRetryFulfillment(order)
    case 'deliver':
      return canDeliver(order)
    case 'complete_delivery':
      return canCompleteDelivery(order)
    case 'retry_delivery':
      return canRetryDelivery(order)
    case 'cancel':
      return canCancel(order)
    case 'refund_mark':
      return canMarkRefund(order)
    case 'refund_original':
      return canOriginalRefund(order)
    case 'resend':
      return canResend(order)
  }
}

export async function runRemoteOrderAction(
  orderNo: string,
  action: OrderActionKey,
  options?: {
    note?: string
  },
): Promise<void | AdminOrderRefundResult> {
  switch (action) {
    case 'reject_payment':
      await rejectAdminOrderPayment(orderNo, options?.note ?? '')
      return
    case 'fulfill':
      await triggerAdminOrderFulfillment(orderNo)
      return
    case 'retry_fulfillment':
      await retryAdminOrderFulfillment(orderNo)
      return
    case 'deliver':
      await triggerAdminOrderDelivery(orderNo)
      return
    case 'complete_delivery':
      await completeAdminOrderDelivery(orderNo, options?.note ?? '')
      return
    case 'retry_delivery':
      await retryAdminOrderDelivery(orderNo)
      return
    case 'cancel':
      await cancelAdminOrder(orderNo, options?.note ?? '')
      return
    case 'refund_mark':
      return markAdminOrderRefund(orderNo, options?.note ?? '')
    case 'refund_original':
      return requestAdminOrderOriginalRefund(orderNo, options?.note ?? '')
    case 'resend':
      await resendAdminOrderDelivery(orderNo)
      return
  }
}

function usesManualDeliveryCompletion(order: AdminOrderRecord) {
  return order.deliveryChannel === 'manual' || order.deliveryChannel === 'email'
}

function hasPendingManualDelivery(order: AdminOrderRecord) {
  return (
    usesManualDeliveryCompletion(order) &&
    order.orderStatus === 'delivery_pending' &&
    order.deliveryStatus === 'pending'
  )
}
