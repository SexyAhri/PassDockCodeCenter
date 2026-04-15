import type { AdminOrderListFilters } from '../../api/adminOrders'
import { buildAdminQueryPath } from '../routeFilters'

export const emptyAdminOrderFilters: AdminOrderListFilters = {
  orderNo: '',
  orderStatus: '',
  paymentStatus: '',
  deliveryStatus: '',
  paymentMethod: '',
  sourceChannel: '',
}

export function buildAdminOrdersLocation(filters: AdminOrderListFilters) {
  return buildAdminQueryPath('/admin/orders', {
    orderNo: filters.orderNo,
    orderStatus: filters.orderStatus,
    paymentStatus: filters.paymentStatus,
    deliveryStatus: filters.deliveryStatus,
    paymentMethod: filters.paymentMethod,
    sourceChannel: filters.sourceChannel,
  })
}
