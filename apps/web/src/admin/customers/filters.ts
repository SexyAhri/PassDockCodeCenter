import type { AdminCustomerFiltersValue } from './aggregate'
import { buildAdminQueryPath } from '../routeFilters'

export const emptyAdminCustomerFilters: AdminCustomerFiltersValue = {
  keyword: '',
  region: '',
  tier: '',
  ticketStatus: '',
  assignedTo: '',
}

export function buildAdminCustomersLocation(filters: AdminCustomerFiltersValue) {
  return buildAdminQueryPath('/admin/customers', {
    keyword: filters.keyword,
    region: filters.region,
    tier: filters.tier,
    ticketStatus: filters.ticketStatus,
    assignedTo: filters.assignedTo,
  })
}
