import type {
  AdminDeliveryRecord,
  AdminRemoteCodeIssueRecord,
} from '../../api/adminFulfillment'
import type { AdminFulfillmentRecord } from '../../data/admin'
import type { AdminFulfillmentFiltersValue } from '../../components/admin/fulfillment/AdminFulfillmentFilters'
import { buildAdminQueryPath } from '../routeFilters'

export const emptyAdminFulfillmentFilters: AdminFulfillmentFiltersValue = {
  orderNo: '',
  fulfillmentStatus: '',
  deliveryStatus: '',
  deliveryChannel: '',
  fulfillmentType: '',
}

export function matchesFulfillmentFilters(
  record: AdminFulfillmentRecord,
  filters: AdminFulfillmentFiltersValue,
) {
  if (
    filters.orderNo &&
    !record.orderNo.toLowerCase().includes(filters.orderNo.toLowerCase())
  ) {
    return false
  }

  if (filters.fulfillmentStatus && record.status !== filters.fulfillmentStatus) {
    return false
  }

  if (filters.deliveryChannel && record.deliveryChannel !== filters.deliveryChannel) {
    return false
  }

  if (filters.fulfillmentType && record.fulfillmentType !== filters.fulfillmentType) {
    return false
  }

  return true
}

export function matchesDeliveryFilters(
  record: AdminDeliveryRecord,
  filters: AdminFulfillmentFiltersValue,
) {
  if (
    filters.orderNo &&
    !record.orderNo.toLowerCase().includes(filters.orderNo.toLowerCase())
  ) {
    return false
  }

  if (filters.deliveryStatus && record.status !== filters.deliveryStatus) {
    return false
  }

  if (filters.deliveryChannel && record.deliveryChannel !== filters.deliveryChannel) {
    return false
  }

  return true
}

export function matchesCodeIssueFilters(
  record: AdminRemoteCodeIssueRecord,
  filters: AdminFulfillmentFiltersValue,
) {
  if (
    filters.orderNo &&
    !record.orderNo.toLowerCase().includes(filters.orderNo.toLowerCase())
  ) {
    return false
  }

  return true
}

export function buildAdminFulfillmentLocation(
  filters: AdminFulfillmentFiltersValue,
) {
  return buildAdminQueryPath('/admin/fulfillment', {
    orderNo: filters.orderNo,
    fulfillmentStatus: filters.fulfillmentStatus,
    deliveryStatus: filters.deliveryStatus,
    deliveryChannel: filters.deliveryChannel,
    fulfillmentType: filters.fulfillmentType,
  })
}
