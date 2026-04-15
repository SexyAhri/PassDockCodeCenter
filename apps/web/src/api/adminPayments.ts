import type {
  AdminCallbackLog,
  AdminPaymentProof,
  AdminPaymentRecord,
  AdminWatcherRecord,
  PaymentProofReviewStatusKey,
  PaymentStatusKey,
  SourceChannelKey,
} from '../data/admin'
import type { PaymentMethodKey } from '../i18n/copy'
import { requestBlob, requestJson, unwrapListData } from './http'

export type AdminPaymentListFilters = {
  orderNo?: string
  paymentStatus?: PaymentStatusKey | ''
  reviewStatus?: PaymentProofReviewStatusKey | ''
  paymentMethod?: PaymentMethodKey | ''
  sourceChannel?: SourceChannelKey | ''
  page?: number
  pageSize?: number
}

type PaymentRecordDto = {
  id?: string | number
  payment_id?: string | number
  order_no?: string
  payment_method?: string
  channel_key?: string
  amount?: string | number
  currency?: string
  status?: string
  payer_account?: string
  confirmed_at?: string
}

type PaymentProofDto = {
  id?: string | number
  proof_id?: string | number
  order_no?: string
  proof_type?: string
  object_url?: string
  review_status?: string
  note?: string
  payment_method?: string
  amount?: string | number
  currency?: string
  source_channel?: string
  buyer_ref?: string
  created_at?: string
  reviewed_at?: string
}

type CallbackLogDto = {
  id?: string | number
  log_id?: string | number
  channel_key?: string
  order_no?: string
  status?: string
  message?: string
  created_at?: string
}

type WatcherRecordDto = {
  id?: string | number
  record_id?: string | number
  order_no?: string
  hash?: string
  amount?: string | number
  status?: string
  confirmed_at?: string
}

export async function loadAdminPaymentsRemoteSnapshot(filters: AdminPaymentListFilters = {}) {
  const [paymentRecordsData, paymentProofsData, callbackLogsData, watcherRecordsData] = await Promise.all([
    requestJson<unknown>('/api/v1/admin/payment-records', {
      query: {
        order_no: filters.orderNo,
        payment_status: filters.paymentStatus,
        payment_method: filters.paymentMethod,
        source_channel: filters.sourceChannel,
        page: filters.page,
        page_size: filters.pageSize,
      },
    }),
    requestJson<unknown>('/api/v1/admin/payment-proofs', {
      query: {
        order_no: filters.orderNo,
        review_status: filters.reviewStatus,
        payment_method: filters.paymentMethod,
        source_channel: filters.sourceChannel,
        page: filters.page,
        page_size: filters.pageSize,
      },
    }),
    requestJson<unknown>('/api/v1/admin/callback-logs'),
    requestJson<unknown>('/api/v1/admin/watcher-records'),
  ])

  return {
    paymentRecords: unwrapListData<PaymentRecordDto>(paymentRecordsData).map(mapPaymentRecordDto),
    paymentProofs: unwrapListData<PaymentProofDto>(paymentProofsData).map(mapPaymentProofDto),
    callbackLogs: unwrapListData<CallbackLogDto>(callbackLogsData).map(mapCallbackLogDto),
    watcherRecords: unwrapListData<WatcherRecordDto>(watcherRecordsData).map(mapWatcherRecordDto),
  }
}

export async function getAdminPaymentRecordDetail(paymentId: string) {
  const payload = await requestJson<unknown>(`/api/v1/admin/payment-records/${encodeURIComponent(paymentId)}`)
  return normalizeDetailPayload(payload)
}

export async function getAdminPaymentProofDetail(proofId: string) {
  const payload = await requestJson<unknown>(`/api/v1/admin/payment-proofs/${encodeURIComponent(proofId)}`)
  return normalizeDetailPayload(payload)
}

export async function fetchAdminPaymentProofFile(proofId: string) {
  return requestBlob(`/api/v1/admin/payment-proofs/${encodeURIComponent(proofId)}/file`)
}

export async function getAdminCallbackLogDetail(logId: string) {
  const payload = await requestJson<unknown>(`/api/v1/admin/callback-logs/${encodeURIComponent(logId)}`)
  return normalizeDetailPayload(payload)
}

export async function getAdminWatcherRecordDetail(recordId: string) {
  const payload = await requestJson<unknown>(`/api/v1/admin/watcher-records/${encodeURIComponent(recordId)}`)
  return normalizeDetailPayload(payload)
}

function mapPaymentRecordDto(dto: PaymentRecordDto): AdminPaymentRecord {
  return {
    key: String(dto.id ?? dto.payment_id ?? dto.order_no ?? ''),
    orderNo: String(dto.order_no ?? ''),
    paymentMethod: normalizePaymentMethod(dto.payment_method),
    channelKey: String(dto.channel_key ?? ''),
    amount: String(dto.amount ?? ''),
    currency: String(dto.currency ?? 'RMB'),
    status: normalizePaymentStatus(dto.status),
    payerAccount: String(dto.payer_account ?? ''),
    confirmedAt: String(dto.confirmed_at ?? ''),
  }
}

function mapPaymentProofDto(dto: PaymentProofDto): AdminPaymentProof {
  return {
    key: String(dto.id ?? dto.proof_id ?? dto.order_no ?? ''),
    orderNo: String(dto.order_no ?? ''),
    proofType: String(dto.proof_type ?? ''),
    objectUrl: String(dto.object_url ?? ''),
    reviewStatus: normalizeProofReviewStatus(dto.review_status),
    note: String(dto.note ?? ''),
    paymentMethod: normalizePaymentMethod(dto.payment_method),
    amount: String(dto.amount ?? ''),
    currency: String(dto.currency ?? 'RMB'),
    sourceChannel: normalizeSourceChannel(dto.source_channel),
    buyerRef: String(dto.buyer_ref ?? ''),
    createdAt: String(dto.created_at ?? ''),
    reviewedAt: String(dto.reviewed_at ?? ''),
  }
}

function mapCallbackLogDto(dto: CallbackLogDto): AdminCallbackLog {
  return {
    key: String(dto.id ?? dto.log_id ?? ''),
    channelKey: String(dto.channel_key ?? ''),
    orderNo: String(dto.order_no ?? ''),
    status: normalizeCallbackStatus(dto.status),
    message: String(dto.message ?? ''),
    createdAt: String(dto.created_at ?? ''),
  }
}

function mapWatcherRecordDto(dto: WatcherRecordDto): AdminWatcherRecord {
  return {
    key: String(dto.id ?? dto.record_id ?? ''),
    orderNo: String(dto.order_no ?? ''),
    hash: String(dto.hash ?? ''),
    amount: String(dto.amount ?? ''),
    status: normalizeWatcherStatus(dto.status),
    confirmedAt: String(dto.confirmed_at ?? ''),
  }
}

function normalizeProofReviewStatus(value: unknown): PaymentProofReviewStatusKey {
  switch (value) {
    case 'approved':
    case 'rejected':
      return value
    default:
      return 'pending'
  }
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

function normalizeSourceChannel(value: unknown): SourceChannelKey {
  switch (value) {
    case 'telegram':
    case 'admin':
    case 'api':
      return value
    default:
      return 'web'
  }
}

function normalizePaymentStatus(value: unknown): PaymentStatusKey {
  switch (value) {
    case 'pending_review':
    case 'paid':
    case 'failed':
    case 'refunded':
      return value
    default:
      return 'unpaid'
  }
}

function normalizeDetailPayload(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value == null ? null : { value }
  }

  return value as Record<string, unknown>
}

function normalizeCallbackStatus(value: unknown): AdminCallbackLog['status'] {
  switch (value) {
    case 'warning':
    case 'error':
      return value
    default:
      return 'success'
  }
}

function normalizeWatcherStatus(value: unknown): AdminWatcherRecord['status'] {
  switch (value) {
    case 'matched':
    case 'manual_review':
      return value
    default:
      return 'pending'
  }
}
