import { normalizeStorefrontOrder } from './storefrontOrders'
import { requestJson, unwrapListData } from './http'
import { getStoredStorefrontAuthToken } from '../storefront/session'

export type StorefrontAccountProfile = {
  userId: number
  email: string
  name: string
  role: string
  status: string
  locale: string
  lastLoginAt: string
}

export type StorefrontAccountOrder = {
  orderNo: string
  productName: string
  productSku: string
  orderStatus: string
  paymentStatus: string
  deliveryStatus: string
  templateName: string
  billingCycle: string
  paymentMethod: string
  currency: string
  displayAmount: string
  buyerRef: string
  createdAt: string
  paidAt: string
  updatedAt: string
}

export type StorefrontAccountTicket = {
  ticketNo: string
  orderNo: string
  subject: string
  content: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'open' | 'processing' | 'resolved' | 'closed'
  resolutionNote: string
  createdAt: string
  updatedAt: string
}

export type CreateStorefrontAccountTicketInput = {
  orderNo?: string
  subject: string
  content: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
}

type StorefrontAccountProfileDto = {
  id?: number
  email?: string
  display_name?: string
  role?: string
  status?: string
  locale?: string
  last_login_at?: string
}

type StorefrontAccountOrderDto = {
  order_no?: string
  product_name?: string
  product_sku?: string
  order_status?: string
  payment_status?: string
  delivery_status?: string
  template_name?: string
  billing_cycle?: string
  payment_method?: string
  currency?: string
  display_amount?: string | number
  buyer_ref?: string
  created_at?: string
  paid_at?: string
  updated_at?: string
}

type StorefrontAccountTicketDto = {
  ticket_no?: string
  order_no?: string
  subject?: string
  content?: string
  priority?: string
  status?: string
  resolution_note?: string
  created_at?: string
  updated_at?: string
}

export async function getStorefrontAccountProfile() {
  const payload = await requestJson<StorefrontAccountProfileDto>('/api/v1/me', {
    authToken: requireUserAuthToken(),
    includeAdminAuth: false,
  })

  return {
    userId: Number(payload.id ?? 0),
    email: String(payload.email ?? ''),
    name: String(payload.display_name ?? ''),
    role: String(payload.role ?? ''),
    status: String(payload.status ?? ''),
    locale: String(payload.locale ?? ''),
    lastLoginAt: String(payload.last_login_at ?? ''),
  } satisfies StorefrontAccountProfile
}

export async function listStorefrontAccountOrders() {
  const payload = await requestJson<unknown>('/api/v1/me/orders', {
    authToken: requireUserAuthToken(),
    includeAdminAuth: false,
  })

  return unwrapListData<StorefrontAccountOrderDto>(payload).map(
    (item) =>
      ({
        orderNo: String(item.order_no ?? ''),
        productName: String(item.product_name ?? ''),
        productSku: String(item.product_sku ?? ''),
        orderStatus: String(item.order_status ?? ''),
        paymentStatus: String(item.payment_status ?? ''),
        deliveryStatus: String(item.delivery_status ?? ''),
        templateName: String(item.template_name ?? ''),
        billingCycle: String(item.billing_cycle ?? ''),
        paymentMethod: String(item.payment_method ?? ''),
        currency: String(item.currency ?? ''),
        displayAmount: String(item.display_amount ?? ''),
        buyerRef: String(item.buyer_ref ?? ''),
        createdAt: String(item.created_at ?? ''),
        paidAt: String(item.paid_at ?? ''),
        updatedAt: String(item.updated_at ?? ''),
      }) satisfies StorefrontAccountOrder,
  )
}

export async function getStorefrontAccountOrderDetail(orderNo: string) {
  const payload = await requestJson<unknown>(`/api/v1/me/orders/${encodeURIComponent(orderNo)}`, {
    authToken: requireUserAuthToken(),
    includeAdminAuth: false,
  })

  return normalizeStorefrontOrder(payload)
}

export async function listStorefrontAccountTickets() {
  const payload = await requestJson<unknown>('/api/v1/me/tickets', {
    authToken: requireUserAuthToken(),
    includeAdminAuth: false,
  })

  return unwrapListData<StorefrontAccountTicketDto>(payload).map((item) => ({
    ticketNo: String(item.ticket_no ?? ''),
    orderNo: String(item.order_no ?? ''),
    subject: String(item.subject ?? ''),
    content: String(item.content ?? ''),
    priority: normalizePriority(item.priority),
    status: normalizeStatus(item.status),
    resolutionNote: String(item.resolution_note ?? ''),
    createdAt: String(item.created_at ?? ''),
    updatedAt: String(item.updated_at ?? ''),
  }) satisfies StorefrontAccountTicket)
}

export async function createStorefrontAccountTicket(input: CreateStorefrontAccountTicketInput) {
  const payload = await requestJson<StorefrontAccountTicketDto>('/api/v1/me/tickets', {
    method: 'POST',
    authToken: requireUserAuthToken(),
    includeAdminAuth: false,
    body: {
      order_no: input.orderNo,
      subject: input.subject,
      content: input.content,
      priority: input.priority,
    },
  })

  return {
    ticketNo: String(payload.ticket_no ?? ''),
    orderNo: String(payload.order_no ?? input.orderNo ?? ''),
    subject: String(payload.subject ?? input.subject),
    content: String(payload.content ?? input.content),
    priority: normalizePriority(payload.priority ?? input.priority),
    status: normalizeStatus(payload.status ?? 'open'),
    resolutionNote: String(payload.resolution_note ?? ''),
    createdAt: String(payload.created_at ?? ''),
    updatedAt: String(payload.updated_at ?? ''),
  } satisfies StorefrontAccountTicket
}

function requireUserAuthToken() {
  const token = getStoredStorefrontAuthToken()
  if (!token) {
    throw new Error('User session is required')
  }

  return token
}

function normalizePriority(value: unknown): StorefrontAccountTicket['priority'] {
  switch (value) {
    case 'low':
    case 'high':
    case 'urgent':
      return value
    default:
      return 'normal'
  }
}

function normalizeStatus(value: unknown): StorefrontAccountTicket['status'] {
  switch (value) {
    case 'processing':
    case 'resolved':
    case 'closed':
      return value
    default:
      return 'open'
  }
}
