import type { AdminOrderRecord } from '../../api/adminOrders'
import type { AdminTicketRecord } from '../../api/adminSupport'
import type { TicketStatusKey, UserTierKey } from '../../data/admin'
import { getAdminConsoleText } from '../../i18n/adminConsole'
import type { Locale } from '../../i18n/copy'

export type AdminCustomerFiltersValue = {
  keyword: string
  region: string
  tier: UserTierKey | ''
  ticketStatus: TicketStatusKey | ''
  assignedTo: string
}

export type AdminCustomerRecord = {
  key: string
  name: string
  region: string
  orders: number
  spend: string
  spendValue: number
  tier: UserTierKey
  lastOrder: string
  lastActivity: string
  openTickets: number
  urgentTickets: number
  resolvedTickets: number
  pendingReviewOrders: number
  buyerRefs: string[]
  orderNos: string[]
  ticketNos: string[]
  assignedTo: string[]
  ticketStatuses: TicketStatusKey[]
  latestOrderNo: string
  latestTicketNo: string
  topPaymentMethod: string
  topSourceChannel: string
}

type BuildAdminCustomerRecordsInput = {
  locale: Locale
  seedCustomers?: Array<{
    name: string
    region?: string
    spend?: string
    tier?: UserTierKey
    lastOrder?: string
  }>
  orders: AdminOrderRecord[]
  tickets: AdminTicketRecord[]
}

type MutableCustomerRecord = {
  key: string
  name: string
  region: string
  orders: number
  spendValue: number
  tier: UserTierKey
  lastOrderAt: string
  lastTicketAt: string
  openTickets: number
  urgentTickets: number
  resolvedTickets: number
  pendingReviewOrders: number
  buyerRefs: Set<string>
  orderNos: Set<string>
  ticketNos: Set<string>
  assignedTo: Set<string>
  ticketStatuses: Set<TicketStatusKey>
  latestOrderNo: string
  latestTicketNo: string
  paymentMethodCounts: Map<string, number>
  sourceChannelCounts: Map<string, number>
}

export function buildAdminCustomerRecords(input: BuildAdminCustomerRecordsInput) {
  const { locale, orders, tickets } = input
  const seedCustomers = input.seedCustomers ?? []
  const pendingRegionText = locale === 'zh-CN' ? '待补充' : 'Pending'
  const customerSeedMap = Object.fromEntries(seedCustomers.map((customer) => [customer.name, customer]))
  const customerMap = new Map<string, MutableCustomerRecord>()

  const getRecord = (name: string) => {
    const normalizedName = name || (locale === 'zh-CN' ? '未命名客户' : 'Unnamed customer')
    const existing = customerMap.get(normalizedName)

    if (existing) {
      return existing
    }

    const seed = customerSeedMap[normalizedName]
    const record: MutableCustomerRecord = {
      key: normalizedName.toLowerCase().replace(/[^a-z0-9]+/gi, '_'),
      name: normalizedName,
      region: seed?.region ?? pendingRegionText,
      orders: 0,
      spendValue: parseAmount(seed?.spend ?? '0'),
      tier: seed?.tier ?? 'active',
      lastOrderAt: seed?.lastOrder ?? '',
      lastTicketAt: '',
      openTickets: 0,
      urgentTickets: 0,
      resolvedTickets: 0,
      pendingReviewOrders: 0,
      buyerRefs: new Set<string>(),
      orderNos: new Set<string>(),
      ticketNos: new Set<string>(),
      assignedTo: new Set<string>(),
      ticketStatuses: new Set<TicketStatusKey>(),
      latestOrderNo: '',
      latestTicketNo: '',
      paymentMethodCounts: new Map<string, number>(),
      sourceChannelCounts: new Map<string, number>(),
    }

    customerMap.set(normalizedName, record)
    return record
  }

  seedCustomers.forEach((customer) => {
    getRecord(customer.name)
  })

  orders.forEach((order) => {
    const record = getRecord(order.customer || order.buyerRef || order.orderNo)

    record.orders += 1
    record.spendValue += parseAmount(order.amount)
    record.orderNos.add(order.orderNo)

    if (order.buyerRef) {
      record.buyerRefs.add(order.buyerRef)
    }

    bumpCounter(record.paymentMethodCounts, order.paymentMethod)
    bumpCounter(record.sourceChannelCounts, order.sourceChannel)

    if (order.paymentStatus === 'pending_review' || order.orderStatus === 'paid_pending_review') {
      record.pendingReviewOrders += 1
    }

    if (record.lastOrderAt <= order.createdAt) {
      record.lastOrderAt = order.createdAt
      record.latestOrderNo = order.orderNo
    }
  })

  tickets.forEach((ticket) => {
    const record = getRecord(ticket.customer || ticket.ticketNo)

    record.ticketNos.add(ticket.ticketNo)
    record.ticketStatuses.add(ticket.status)

    if (ticket.assignedTo) {
      record.assignedTo.add(ticket.assignedTo)
    }

    if (ticket.status === 'open' || ticket.status === 'processing') {
      record.openTickets += 1
    }

    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      record.resolvedTickets += 1
    }

    if (ticket.priority === 'high' || ticket.priority === 'urgent') {
      record.urgentTickets += 1
    }

    if (record.lastTicketAt <= ticket.createdAt) {
      record.lastTicketAt = ticket.createdAt
      record.latestTicketNo = ticket.ticketNo
    }
  })

  return Array.from(customerMap.values())
    .map<AdminCustomerRecord>((record) => {
      const computedTier =
        record.tier === 'vip' || record.orders >= 5 || record.spendValue >= 500 ? 'vip' : 'active'
      const lastActivity = record.lastOrderAt > record.lastTicketAt ? record.lastOrderAt : record.lastTicketAt

      return {
        key: record.key,
        name: record.name,
        region: record.region,
        orders: record.orders,
        spend: `${record.spendValue.toFixed(2)} MIXED`,
        spendValue: record.spendValue,
        tier: computedTier,
        lastOrder: record.lastOrderAt.slice(0, 10),
        lastActivity: lastActivity.slice(0, 16),
        openTickets: record.openTickets,
        urgentTickets: record.urgentTickets,
        resolvedTickets: record.resolvedTickets,
        pendingReviewOrders: record.pendingReviewOrders,
        buyerRefs: Array.from(record.buyerRefs),
        orderNos: Array.from(record.orderNos),
        ticketNos: Array.from(record.ticketNos),
        assignedTo: Array.from(record.assignedTo),
        ticketStatuses: Array.from(record.ticketStatuses),
        latestOrderNo: record.latestOrderNo,
        latestTicketNo: record.latestTicketNo,
        topPaymentMethod: pickTopCounterKey(record.paymentMethodCounts),
        topSourceChannel: pickTopCounterKey(record.sourceChannelCounts),
      }
    })
    .sort((left, right) => {
      if (left.lastActivity !== right.lastActivity) {
        return right.lastActivity.localeCompare(left.lastActivity)
      }

      if (left.spendValue !== right.spendValue) {
        return right.spendValue - left.spendValue
      }

      return right.orders - left.orders
    })
}

export function matchesAdminCustomerFilters(
  customer: AdminCustomerRecord,
  filters: AdminCustomerFiltersValue,
) {
  const keyword = filters.keyword.trim().toLowerCase()

  if (keyword) {
    const haystacks = [
      customer.name,
      customer.region,
      customer.latestOrderNo,
      customer.latestTicketNo,
      ...customer.buyerRefs,
      ...customer.orderNos,
      ...customer.ticketNos,
    ]

    if (!haystacks.some((value) => value.toLowerCase().includes(keyword))) {
      return false
    }
  }

  if (filters.region && !customer.region.toLowerCase().includes(filters.region.toLowerCase())) {
    return false
  }

  if (filters.tier && customer.tier !== filters.tier) {
    return false
  }

  if (filters.ticketStatus && !customer.ticketStatuses.includes(filters.ticketStatus)) {
    return false
  }

  if (
    filters.assignedTo &&
    !customer.assignedTo.some((value) => value.toLowerCase().includes(filters.assignedTo.toLowerCase()))
  ) {
    return false
  }

  return true
}

export function buildAdminCustomerDetail(customer: AdminCustomerRecord, locale: Locale) {
  const text = getAdminConsoleText(locale)

  return {
    customer: customer.name,
    region: customer.region,
    tier: text.enums.userTier[customer.tier] ?? customer.tier,
    orders: customer.orders,
    spend: customer.spend,
    pendingReviewOrders: customer.pendingReviewOrders,
    openTickets: customer.openTickets,
    urgentTickets: customer.urgentTickets,
    resolvedTickets: customer.resolvedTickets,
    lastOrder: customer.lastOrder,
    lastActivity: customer.lastActivity,
    latestOrderNo: customer.latestOrderNo,
    latestTicketNo: customer.latestTicketNo,
    topPaymentMethod:
      text.enums.paymentMethod[customer.topPaymentMethod] ?? customer.topPaymentMethod ?? '-',
    topSourceChannel:
      text.enums.sourceChannel[customer.topSourceChannel] ?? customer.topSourceChannel ?? '-',
    buyerRefs: customer.buyerRefs,
    assignedTo: customer.assignedTo,
    orderNos: customer.orderNos,
    ticketNos: customer.ticketNos,
  }
}

export function getCustomerDetailLabels(locale: Locale) {
  const text = getAdminConsoleText(locale)

  return {
    customer: text.table.customer,
    region: text.table.region,
    tier: text.table.tier,
    orders: text.table.orders,
    spend: text.table.spend,
    pendingReviewOrders: locale === 'zh-CN' ? '待审核订单' : 'Pending reviews',
    openTickets: locale === 'zh-CN' ? '处理中工单' : 'Open tickets',
    urgentTickets: locale === 'zh-CN' ? '高优工单' : 'Urgent tickets',
    resolvedTickets: locale === 'zh-CN' ? '已解决工单' : 'Resolved tickets',
    lastOrder: text.table.lastOrder,
    lastActivity: locale === 'zh-CN' ? '最近活跃' : 'Last activity',
    latestOrderNo: text.table.orderNo,
    latestTicketNo: text.table.ticketNo,
    topPaymentMethod: text.table.paymentMethod,
    topSourceChannel: text.table.sourceChannel,
    email: locale === 'zh-CN' ? '邮箱' : 'Email',
    locale: locale === 'zh-CN' ? '语言区域' : 'Locale',
    user_role: locale === 'zh-CN' ? '用户角色' : 'User role',
    user_status: locale === 'zh-CN' ? '用户状态' : 'User status',
    last_login_at: locale === 'zh-CN' ? '最近登录' : 'Last login',
    telegram_user_id: locale === 'zh-CN' ? 'Telegram 用户 ID' : 'Telegram user id',
    telegram_username: locale === 'zh-CN' ? 'Telegram 用户名' : 'Telegram username',
    buyerRefs: text.table.buyerRef,
    assignedTo: text.table.assignedTo,
    orderNos: locale === 'zh-CN' ? '订单列表' : 'Orders',
    ticketNos: locale === 'zh-CN' ? '工单列表' : 'Tickets',
  }
}

export function getCustomerDetailPreferredKeys() {
  return [
    'customer',
    'region',
    'tier',
    'orders',
    'spend',
    'pendingReviewOrders',
    'openTickets',
    'urgentTickets',
    'resolvedTickets',
    'lastOrder',
    'lastActivity',
    'latestOrderNo',
    'latestTicketNo',
    'topPaymentMethod',
    'topSourceChannel',
    'email',
    'locale',
    'user_role',
    'user_status',
    'last_login_at',
    'telegram_user_id',
    'telegram_username',
    'buyerRefs',
    'assignedTo',
    'orderNos',
    'ticketNos',
    'telegram_bindings',
    'order_history',
    'ticket_history',
  ]
}

function parseAmount(value: string) {
  const match = String(value ?? '').match(/^([0-9]+(?:\.[0-9]+)?)/)
  return Number(match?.[1] ?? 0)
}

function bumpCounter(map: Map<string, number>, key: string) {
  if (!key) {
    return
  }

  map.set(key, (map.get(key) ?? 0) + 1)
}

function pickTopCounterKey(map: Map<string, number>) {
  let currentKey = ''
  let currentValue = -1

  map.forEach((value, key) => {
    if (value > currentValue) {
      currentKey = key
      currentValue = value
    }
  })

  return currentKey
}
