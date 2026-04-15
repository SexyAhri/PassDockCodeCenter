import type { PaymentMethodKey } from '../i18n/copy'
import { getStoredStorefrontAuthToken } from '../storefront/session'
import { createIdempotencyKey, requestJson } from './http'

export type StorefrontPaymentInstruction = {
  channelKey: string
  type: string
  displayAmount: string
  currency: string
  qrContent: string
  expireAt: string
  reference: string
}

export type StorefrontPaymentProof = {
  proofType: string
  objectKey: string
  objectUrl: string
  reviewStatus: string
  reviewedAt: string
  note: string
  createdAt: string
}

export type StorefrontOrderSnapshot = {
  orderNo: string
  orderAccessToken: string
  orderStatus: string
  paymentStatus: string
  deliveryStatus: string
  paymentMethod: PaymentMethodKey
  sourceChannel: string
  botKey: string
  buyerRef: string
  quantity: number
  currency: string
  displayAmount: string
  priceId: string
  templateName: string
  billingCycle: string
  paymentInstruction: StorefrontPaymentInstruction | null
  paymentProofs: StorefrontPaymentProof[]
  deliveryResult: StorefrontDeliveryResult | null
}

export type StorefrontDeliveryResult = Record<string, unknown>

export type CreateStorefrontOrderInput = {
  productId: number
  priceId?: string
  templateName?: string
  billingCycle?: string
  paymentMethod: PaymentMethodKey
  buyerRef?: string
  botKey?: string
  quantity?: number
  currency?: string
  sourceChannel?: 'web' | 'telegram' | 'admin' | 'api'
}

export type UploadPaymentProofInput = {
  proofType?: string
  objectKey?: string
  objectUrl?: string
  note?: string
  file?: File | null
}

type PaymentInstructionDto = {
  channel_key?: string
  type?: string
  display_amount?: string | number
  currency?: string
  qr_content?: string
  qr_value?: string
  expire_at?: string
  reference?: string
}

type PaymentProofDto = {
  proof_type?: string
  object_key?: string
  object_url?: string
  review_status?: string
  reviewed_at?: string
  note?: string
  created_at?: string
}

type OrderDto = {
  order_no?: string
  order_access_token?: string
  status?: string
  order_status?: string
  payment_status?: string
  delivery_status?: string
  payment_method?: string
  source_channel?: string
  bot_key?: string
  buyer_ref?: string
  quantity?: number
  currency?: string
  display_amount?: string | number
  total_amount?: string | number
  price_id?: string | number
  template_name?: string
  billing_cycle?: string
  payment_instruction?: PaymentInstructionDto | null
  payment_proofs?: PaymentProofDto[]
  delivery_result?: Record<string, unknown> | null
}

export async function createStorefrontOrder(input: CreateStorefrontOrderInput) {
  const payload = await requestJson<unknown>('/api/v1/orders', {
    method: 'POST',
    includeAdminAuth: false,
    authToken: getStoredStorefrontAuthToken(),
    idempotencyKey: createIdempotencyKey('store_order'),
    body: {
      product_id: input.productId,
      price_id: input.priceId,
      payment_method: input.paymentMethod,
      source_channel: input.sourceChannel ?? 'web',
      bot_key: input.botKey,
      buyer_ref: input.buyerRef,
      quantity: input.quantity ?? 1,
      currency: input.currency ?? 'RMB',
    },
  })

  return normalizeStorefrontOrder(payload, input)
}

export async function getStorefrontOrderDetail(orderNo: string, orderAccessToken?: string) {
  const payload = await requestJson<unknown>(`/api/v1/orders/${encodeURIComponent(orderNo)}`, {
    includeAdminAuth: false,
    authToken: getStoredStorefrontAuthToken(),
    headers: buildStorefrontOrderHeaders(orderAccessToken),
  })

  return normalizeStorefrontOrder(payload)
}

export async function markStorefrontOrderPaid(orderNo: string, orderAccessToken?: string) {
  await requestJson(`/api/v1/orders/${encodeURIComponent(orderNo)}/mark-paid`, {
    method: 'POST',
    includeAdminAuth: false,
    authToken: getStoredStorefrontAuthToken(),
    headers: buildStorefrontOrderHeaders(orderAccessToken),
  })
}

export async function cancelStorefrontOrder(orderNo: string, orderAccessToken?: string) {
  await requestJson(`/api/v1/orders/${encodeURIComponent(orderNo)}/cancel`, {
    method: 'POST',
    includeAdminAuth: false,
    authToken: getStoredStorefrontAuthToken(),
    headers: buildStorefrontOrderHeaders(orderAccessToken),
  })
}

export async function uploadStorefrontPaymentProof(
  orderNo: string,
  input: UploadPaymentProofInput,
  orderAccessToken?: string,
) {
  await requestJson(`/api/v1/orders/${encodeURIComponent(orderNo)}/payment-proofs`, {
    method: 'POST',
    includeAdminAuth: false,
    authToken: getStoredStorefrontAuthToken(),
    headers: buildStorefrontOrderHeaders(orderAccessToken),
    body: {
      proof_type: input.proofType ?? 'screenshot',
      object_key: input.objectKey,
      object_url: input.objectUrl ?? '',
      note: input.note,
    },
  })
}

export async function getStorefrontOrderDelivery(orderNo: string, orderAccessToken?: string) {
  const payload = await requestJson<unknown>(`/api/v1/orders/${encodeURIComponent(orderNo)}/delivery`, {
    includeAdminAuth: false,
    authToken: getStoredStorefrontAuthToken(),
    headers: buildStorefrontOrderHeaders(orderAccessToken),
  })

  return normalizeDetailPayload(payload)
}

export function normalizeStorefrontOrder(value: unknown, fallback?: Partial<CreateStorefrontOrderInput>) {
  const dto = toRecord(value)
  const paymentInstruction = normalizePaymentInstruction(
    dto.payment_instruction,
    fallback?.paymentMethod,
    String(dto.order_no ?? ''),
  )

  return {
    orderNo: String(dto.order_no ?? ''),
    orderAccessToken: String(dto.order_access_token ?? ''),
    orderStatus: String(dto.order_status ?? dto.status ?? 'awaiting_payment'),
    paymentStatus: String(dto.payment_status ?? 'unpaid'),
    deliveryStatus: String(dto.delivery_status ?? 'pending'),
    paymentMethod: normalizePaymentMethod(dto.payment_method ?? fallback?.paymentMethod),
    sourceChannel: String(dto.source_channel ?? fallback?.sourceChannel ?? 'web'),
    botKey: String(dto.bot_key ?? fallback?.botKey ?? ''),
    buyerRef: String(dto.buyer_ref ?? fallback?.buyerRef ?? ''),
    quantity: Number(dto.quantity ?? fallback?.quantity ?? 1),
    currency: String(
      dto.currency ??
        paymentInstruction?.currency ??
        fallback?.currency ??
        'RMB',
    ),
    displayAmount: toText(dto.display_amount ?? dto.total_amount ?? paymentInstruction?.displayAmount ?? ''),
    priceId: String(dto.price_id ?? fallback?.priceId ?? ''),
    templateName: String(dto.template_name ?? fallback?.templateName ?? ''),
    billingCycle: String(dto.billing_cycle ?? fallback?.billingCycle ?? ''),
    paymentInstruction,
    paymentProofs: normalizePaymentProofs(dto.payment_proofs),
    deliveryResult: normalizeDetailPayload(dto.delivery_result),
  } satisfies StorefrontOrderSnapshot
}

function buildStorefrontOrderHeaders(orderAccessToken?: string) {
  const token = String(orderAccessToken ?? '').trim()
  if (!token) {
    return undefined
  }

  return {
    'X-PassDock-Order-Token': token,
  }
}

function normalizePaymentInstruction(
  value: unknown,
  fallbackMethod?: PaymentMethodKey,
  orderNo?: string,
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const dto = value as PaymentInstructionDto

  return {
    channelKey: String(dto.channel_key ?? fallbackMethod ?? ''),
    type: String(dto.type ?? 'qr'),
    displayAmount: toText(dto.display_amount ?? ''),
    currency: String(dto.currency ?? ''),
    qrContent: String(dto.qr_content ?? dto.qr_value ?? ''),
    expireAt: String(dto.expire_at ?? ''),
    reference: String(dto.reference ?? dto.channel_key ?? orderNo ?? ''),
  } satisfies StorefrontPaymentInstruction
}

function normalizePaymentMethod(value: unknown): PaymentMethodKey {
  switch (value) {
    case 'alipay_qr':
    case 'okx_usdt':
      return value
    default:
      return 'wechat_qr'
  }
}

function normalizePaymentProofs(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as StorefrontPaymentProof[]
  }

  return value.map((item) => {
    const dto = item as PaymentProofDto

    return {
      proofType: String(dto.proof_type ?? 'screenshot'),
      objectKey: String(dto.object_key ?? ''),
      objectUrl: String(dto.object_url ?? ''),
      reviewStatus: String(dto.review_status ?? 'pending'),
      reviewedAt: String(dto.reviewed_at ?? ''),
      note: String(dto.note ?? ''),
      createdAt: String(dto.created_at ?? ''),
    } satisfies StorefrontPaymentProof
  })
}

function normalizeDetailPayload(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value == null ? null : { value }
  }

  return value as StorefrontDeliveryResult
}

function toRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {} as OrderDto
  }

  return value as OrderDto
}

function toText(value: unknown) {
  if (value == null) {
    return ''
  }

  return String(value)
}
