import type { AdminCustomerFiltersValue } from './customers/aggregate'
import type { AdminOrderListFilters } from '../api/adminOrders'
import type { AdminFulfillmentFiltersValue } from '../components/admin/fulfillment/AdminFulfillmentFilters'
import type { AdminTicketFiltersValue } from '../components/admin/support/AdminTicketFilters'

type QueryValue = string | number | boolean | null | undefined

export function buildAdminQueryPath(
  pathname: string,
  query: Record<string, QueryValue>,
) {
  const params = new URLSearchParams()

  Object.entries(query).forEach(([key, value]) => {
    const normalized = String(value ?? '').trim()

    if (normalized) {
      params.set(key, normalized)
    }
  })

  const search = params.toString()
  return search ? `${pathname}?${search}` : pathname
}

export function readAdminOrderFiltersFromSearch(search: string): AdminOrderListFilters {
  const params = new URLSearchParams(search)

  return {
    orderNo: readParam(params, 'orderNo'),
    orderStatus: readParam(params, 'orderStatus') as AdminOrderListFilters['orderStatus'],
    paymentStatus: readParam(params, 'paymentStatus') as AdminOrderListFilters['paymentStatus'],
    reviewStatus: readParam(params, 'reviewStatus') as AdminOrderListFilters['reviewStatus'],
    deliveryStatus: readParam(params, 'deliveryStatus') as AdminOrderListFilters['deliveryStatus'],
    paymentMethod: readParam(params, 'paymentMethod') as AdminOrderListFilters['paymentMethod'],
    sourceChannel: readParam(params, 'sourceChannel') as AdminOrderListFilters['sourceChannel'],
  }
}

export function areAdminOrderFiltersEqual(
  left: AdminOrderListFilters,
  right: AdminOrderListFilters,
) {
  return (
    normalizeFilterValue(left.orderNo) === normalizeFilterValue(right.orderNo) &&
    normalizeFilterValue(left.orderStatus) === normalizeFilterValue(right.orderStatus) &&
    normalizeFilterValue(left.paymentStatus) === normalizeFilterValue(right.paymentStatus) &&
    normalizeFilterValue(left.reviewStatus) === normalizeFilterValue(right.reviewStatus) &&
    normalizeFilterValue(left.deliveryStatus) === normalizeFilterValue(right.deliveryStatus) &&
    normalizeFilterValue(left.paymentMethod) === normalizeFilterValue(right.paymentMethod) &&
    normalizeFilterValue(left.sourceChannel) === normalizeFilterValue(right.sourceChannel)
  )
}

export function readAdminTicketFiltersFromSearch(search: string): AdminTicketFiltersValue {
  const params = new URLSearchParams(search)

  return {
    ticketNo: readParam(params, 'ticketNo'),
    status: readParam(params, 'status'),
    priority: readParam(params, 'priority'),
    assignedTo: readParam(params, 'assignedTo'),
  }
}

export function areAdminTicketFiltersEqual(
  left: AdminTicketFiltersValue,
  right: AdminTicketFiltersValue,
) {
  return (
    left.ticketNo === right.ticketNo &&
    left.status === right.status &&
    left.priority === right.priority &&
    left.assignedTo === right.assignedTo
  )
}

export function readAdminFulfillmentFiltersFromSearch(
  search: string,
): AdminFulfillmentFiltersValue {
  const params = new URLSearchParams(search)

  return {
    orderNo: readParam(params, 'orderNo'),
    fulfillmentStatus: readParam(params, 'fulfillmentStatus'),
    deliveryStatus: readParam(params, 'deliveryStatus'),
    deliveryChannel: readParam(params, 'deliveryChannel'),
    fulfillmentType: readParam(params, 'fulfillmentType'),
  }
}

export function areAdminFulfillmentFiltersEqual(
  left: AdminFulfillmentFiltersValue,
  right: AdminFulfillmentFiltersValue,
) {
  return (
    left.orderNo === right.orderNo &&
    left.fulfillmentStatus === right.fulfillmentStatus &&
    left.deliveryStatus === right.deliveryStatus &&
    left.deliveryChannel === right.deliveryChannel &&
    left.fulfillmentType === right.fulfillmentType
  )
}

export function readAdminCustomerFiltersFromSearch(
  search: string,
): AdminCustomerFiltersValue {
  const params = new URLSearchParams(search)

  return {
    keyword: readParam(params, 'keyword'),
    region: readParam(params, 'region'),
    tier: readParam(params, 'tier') as AdminCustomerFiltersValue['tier'],
    ticketStatus: readParam(params, 'ticketStatus') as AdminCustomerFiltersValue['ticketStatus'],
    assignedTo: readParam(params, 'assignedTo'),
  }
}

export function areAdminCustomerFiltersEqual(
  left: AdminCustomerFiltersValue,
  right: AdminCustomerFiltersValue,
) {
  return (
    left.keyword === right.keyword &&
    left.region === right.region &&
    left.tier === right.tier &&
    left.ticketStatus === right.ticketStatus &&
    left.assignedTo === right.assignedTo
  )
}

function readParam(params: URLSearchParams, key: string) {
  return params.get(key)?.trim() ?? ''
}

function normalizeFilterValue(value: QueryValue) {
  return String(value ?? '').trim()
}
