import type {
  AdminCodeIssueRecord,
  AdminFulfillmentRecord,
  CodeIssueStatusKey,
  DeliveryChannelKey,
  DeliveryStatusKey,
  FulfillmentStatusKey,
  FulfillmentTypeKey,
} from '../data/admin'
import { requestJson, unwrapListData } from './http'

export type AdminDeliveryRecord = {
  key: string
  orderNo: string
  deliveryChannel: DeliveryChannelKey
  target: string
  status: DeliveryStatusKey
  startedAt: string
  finishedAt: string
}

export type AdminRemoteCodeIssueRecord = AdminCodeIssueRecord

type FulfillmentRecordDto = {
  id?: string | number
  record_id?: string | number
  order_no?: string
  strategy_name?: string
  strategy_key?: string
  fulfillment_type?: string
  provider_name?: string
  provider_key?: string
  action_key?: string
  status?: string
  delivery_channel?: string
  channel_type?: string
  target?: string
  started_at?: string
  finished_at?: string
}

type CodeIssueRecordDto = {
  id?: string | number
  record_id?: string | number
  order_no?: string
  code_type?: string
  issue_status?: string
  provider_key?: string
  action_key?: string
  issued_count?: number
  issued_code_masked?: string
  error_message?: string
  issued_at?: string
}

type DeliveryRecordDto = {
  id?: string | number
  record_id?: string | number
  order_no?: string
  delivery_channel?: string
  channel_type?: string
  target?: string
  status?: string
  started_at?: string
  finished_at?: string
}

export async function loadAdminFulfillmentRemoteSnapshot() {
  const [fulfillmentPayload, codeIssuePayload, deliveryPayload] = await Promise.all([
    requestJson<unknown>('/api/v1/admin/fulfillment-records'),
    requestJson<unknown>('/api/v1/admin/code-issue-records'),
    requestJson<unknown>('/api/v1/admin/delivery-records'),
  ])

  return {
    fulfillmentRecords: unwrapListData<FulfillmentRecordDto>(fulfillmentPayload).map(mapFulfillmentRecordDto),
    codeIssueRecords: unwrapListData<CodeIssueRecordDto>(codeIssuePayload).map(mapCodeIssueRecordDto),
    deliveryRecords: unwrapListData<DeliveryRecordDto>(deliveryPayload).map(mapDeliveryRecordDto),
  }
}

export async function getAdminFulfillmentRecordDetail(recordId: string) {
  const payload = await requestJson<unknown>(
    `/api/v1/admin/fulfillment-records/${encodeURIComponent(recordId)}`,
  )
  return normalizeDetailPayload(payload)
}

export async function getAdminDeliveryRecordDetail(recordId: string) {
  const payload = await requestJson<unknown>(
    `/api/v1/admin/delivery-records/${encodeURIComponent(recordId)}`,
  )
  return normalizeDetailPayload(payload)
}

export async function getAdminCodeIssueRecordDetail(recordId: string) {
  const payload = await requestJson<unknown>(
    `/api/v1/admin/code-issue-records/${encodeURIComponent(recordId)}`,
  )
  return normalizeDetailPayload(payload)
}

export async function retryAdminCodeIssueRecord(recordId: string) {
  await requestJson(`/api/v1/admin/code-issue-records/${encodeURIComponent(recordId)}/retry`, {
    method: 'POST',
  })
}

function mapFulfillmentRecordDto(dto: FulfillmentRecordDto): AdminFulfillmentRecord {
  return {
    key: String(dto.id ?? dto.record_id ?? dto.order_no ?? ''),
    orderNo: String(dto.order_no ?? ''),
    strategy: String(dto.strategy_name ?? dto.strategy_key ?? ''),
    fulfillmentType: normalizeFulfillmentType(dto.fulfillment_type),
    provider: String(dto.provider_name ?? dto.provider_key ?? ''),
    actionKey: String(dto.action_key ?? ''),
    status: normalizeFulfillmentStatus(dto.status),
    deliveryChannel: normalizeDeliveryChannel(dto.delivery_channel ?? dto.channel_type),
    target: String(dto.target ?? ''),
    startedAt: String(dto.started_at ?? ''),
    finishedAt: String(dto.finished_at ?? ''),
  }
}

function mapCodeIssueRecordDto(dto: CodeIssueRecordDto): AdminRemoteCodeIssueRecord {
  return {
    key: String(dto.id ?? dto.record_id ?? dto.order_no ?? ''),
    orderNo: String(dto.order_no ?? ''),
    codeType: String(dto.code_type ?? ''),
    issueStatus: normalizeCodeIssueStatus(dto.issue_status),
    provider: String(dto.provider_key ?? ''),
    actionKey: String(dto.action_key ?? ''),
    issuedCount: Number(dto.issued_count ?? 0),
    maskedPreview: String(dto.issued_code_masked ?? ''),
    errorMessage: String(dto.error_message ?? ''),
    issuedAt: String(dto.issued_at ?? ''),
  }
}

function mapDeliveryRecordDto(dto: DeliveryRecordDto): AdminDeliveryRecord {
  return {
    key: String(dto.id ?? dto.record_id ?? dto.order_no ?? ''),
    orderNo: String(dto.order_no ?? ''),
    deliveryChannel: normalizeDeliveryChannel(dto.delivery_channel ?? dto.channel_type),
    target: String(dto.target ?? ''),
    status: normalizeDeliveryStatus(dto.status),
    startedAt: String(dto.started_at ?? ''),
    finishedAt: String(dto.finished_at ?? ''),
  }
}

function normalizeCodeIssueStatus(value: unknown): CodeIssueStatusKey {
  switch (value) {
    case 'pending':
    case 'failed':
      return value
    default:
      return 'success'
  }
}

function normalizeFulfillmentType(value: unknown): FulfillmentTypeKey {
  switch (value) {
    case 'issue_subscription':
    case 'issue_license':
    case 'credit_account':
    case 'call_webhook':
    case 'manual_delivery':
      return value
    default:
      return 'issue_code'
  }
}

function normalizeFulfillmentStatus(value: unknown): FulfillmentStatusKey {
  switch (value) {
    case 'running':
    case 'success':
    case 'failed':
    case 'cancelled':
      return value
    default:
      return 'pending'
  }
}

function normalizeDeliveryChannel(value: unknown): DeliveryChannelKey {
  switch (value) {
    case 'telegram':
    case 'email':
    case 'manual':
      return value
    default:
      return 'web'
  }
}

function normalizeDeliveryStatus(value: unknown): DeliveryStatusKey {
  switch (value) {
    case 'sending':
    case 'sent':
    case 'failed':
    case 'cancelled':
      return value
    default:
      return 'pending'
  }
}

function normalizeDetailPayload(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value == null ? null : { value }
  }

  return value as Record<string, unknown>
}
