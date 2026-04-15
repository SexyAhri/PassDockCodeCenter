import type {
  DeliveryStatusKey,
  FulfillmentStatusKey,
  IntegrationHealthKey,
  OrderStatusKey,
  PaymentStatusKey,
  TicketPriorityKey,
  TicketStatusKey,
} from '../data/admin'

export type StatusTone = 'success' | 'processing' | 'warning' | 'error' | 'default'

export function getPaymentStatusTone(status: PaymentStatusKey): StatusTone {
  switch (status) {
    case 'paid':
      return 'success'
    case 'pending_review':
      return 'warning'
    case 'failed':
    case 'refunded':
      return 'error'
    default:
      return 'default'
  }
}

export function getOrderStatusTone(status: OrderStatusKey): StatusTone {
  switch (status) {
    case 'completed':
    case 'delivered':
    case 'payment_confirmed':
    case 'issued':
      return 'success'
    case 'paid_pending_review':
    case 'awaiting_payment':
    case 'delivery_pending':
    case 'issuing':
      return 'warning'
    case 'failed':
    case 'cancelled':
    case 'expired':
    case 'refunded':
      return 'error'
    default:
      return 'processing'
  }
}

export function getDeliveryStatusTone(status: DeliveryStatusKey): StatusTone {
  switch (status) {
    case 'sent':
      return 'success'
    case 'sending':
      return 'processing'
    case 'failed':
    case 'cancelled':
      return 'error'
    default:
      return 'warning'
  }
}

export function getFulfillmentStatusTone(status: FulfillmentStatusKey): StatusTone {
  switch (status) {
    case 'success':
      return 'success'
    case 'running':
      return 'processing'
    case 'failed':
    case 'cancelled':
      return 'error'
    default:
      return 'warning'
  }
}

export function getHealthTone(status: IntegrationHealthKey): StatusTone {
  switch (status) {
    case 'healthy':
      return 'success'
    case 'degraded':
      return 'warning'
    case 'failed':
      return 'error'
    default:
      return 'default'
  }
}

export function getTicketStatusTone(status: TicketStatusKey): StatusTone {
  switch (status) {
    case 'resolved':
      return 'success'
    case 'processing':
      return 'processing'
    case 'closed':
      return 'default'
    default:
      return 'warning'
  }
}

export function getTicketPriorityTone(priority: TicketPriorityKey): StatusTone {
  switch (priority) {
    case 'urgent':
      return 'error'
    case 'high':
      return 'warning'
    case 'normal':
      return 'processing'
    default:
      return 'default'
  }
}
