import { getAuditTimestamp } from '../audit'
import type { AdminOrderRecord } from '../../api/adminOrders'
import type { DeliveryStatusKey, OrderStatusKey, PaymentStatusKey } from '../../data/admin'

type ConfirmPaymentInput = {
  paymentMethod: string
  amount: string
  currency: string
}

export function confirmAdminOrderPaymentLocal(
  orders: AdminOrderRecord[],
  orderNo: string,
  input: ConfirmPaymentInput,
): AdminOrderRecord[] {
  const paidAt = getAuditTimestamp()

  return orders.map((order) =>
    order.orderNo === orderNo
      ? {
          ...order,
          paymentMethod: input.paymentMethod as AdminOrderRecord['paymentMethod'],
          amount: input.amount,
          currency: input.currency,
          paymentStatus: 'paid' as PaymentStatusKey,
          orderStatus: (
            order.orderStatus === 'paid_pending_review' || order.orderStatus === 'awaiting_payment'
              ? 'payment_confirmed'
              : order.orderStatus
          ) as OrderStatusKey,
          paidAt,
        }
      : order,
  )
}

export function applyAdminOrderActionLocal(
  orders: AdminOrderRecord[],
  orderNo: string,
  action:
    | 'reject_payment'
    | 'fulfill'
    | 'retry_fulfillment'
    | 'deliver'
    | 'complete_delivery'
    | 'retry_delivery'
    | 'cancel'
    | 'refund_mark'
    | 'refund_original'
    | 'resend',
): AdminOrderRecord[] {
  return orders.map((order) => {
    if (order.orderNo !== orderNo) {
      return order
    }

    switch (action) {
      case 'reject_payment':
        return {
          ...order,
          paymentStatus: 'unpaid' as PaymentStatusKey,
          orderStatus: 'awaiting_payment' as OrderStatusKey,
          deliveryStatus: 'pending' as DeliveryStatusKey,
        }
      case 'fulfill':
      case 'retry_fulfillment':
        return {
          ...order,
          orderStatus: 'issuing' as OrderStatusKey,
          deliveryStatus: 'pending' as DeliveryStatusKey,
        }
      case 'deliver':
        if (usesManualDeliveryCompletion(order)) {
          return {
            ...order,
            orderStatus: 'delivery_pending' as OrderStatusKey,
            deliveryStatus: 'pending' as DeliveryStatusKey,
            deliveryRecordId: order.deliveryRecordId ?? `delivery_${order.orderNo}`,
          }
        }

        return {
          ...order,
          orderStatus: 'delivered' as OrderStatusKey,
          deliveryStatus: 'sent' as DeliveryStatusKey,
        }
      case 'complete_delivery':
        return {
          ...order,
          orderStatus: 'completed' as OrderStatusKey,
          deliveryStatus: 'sent' as DeliveryStatusKey,
          deliveryRecordId: order.deliveryRecordId ?? `delivery_${order.orderNo}`,
        }
      case 'retry_delivery':
        if (usesManualDeliveryCompletion(order)) {
          return {
            ...order,
            orderStatus: 'delivery_pending' as OrderStatusKey,
            deliveryStatus: 'pending' as DeliveryStatusKey,
            deliveryRecordId: order.deliveryRecordId ?? `delivery_${order.orderNo}`,
          }
        }

        return {
          ...order,
          orderStatus: 'delivery_pending' as OrderStatusKey,
          deliveryStatus: 'sending' as DeliveryStatusKey,
        }
      case 'cancel':
        return {
          ...order,
          orderStatus: 'cancelled' as OrderStatusKey,
          deliveryStatus: 'cancelled' as DeliveryStatusKey,
        }
      case 'refund_mark':
      case 'refund_original':
        return {
          ...order,
          paymentStatus: 'refunded' as PaymentStatusKey,
          orderStatus: 'refunded' as OrderStatusKey,
          deliveryStatus: 'cancelled' as DeliveryStatusKey,
        }
      default:
        return {
          ...order,
          deliveryStatus: 'sent' as DeliveryStatusKey,
        }
    }
  })
}

function usesManualDeliveryCompletion(order: AdminOrderRecord) {
  return order.deliveryChannel === 'manual' || order.deliveryChannel === 'email'
}
