import { getStoredAdminAuthToken } from '../admin/session'
import { apiConfig, buildApiUrl, isRemoteApiEnabled } from './config'

type ApiEnvelope<T> = {
  success?: boolean
  message?: string
  data?: T
}

type QueryValue = string | number | boolean | null | undefined

type RequestBaseOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: Record<string, QueryValue>
  headers?: Record<string, string>
  idempotencyKey?: string
  includeAdminAuth?: boolean
  authToken?: string | null | undefined
}

type RequestJsonOptions = RequestBaseOptions & {
  body?: unknown
}

type RequestFormDataOptions = RequestBaseOptions & {
  body: FormData
}

type RequestBlobOptions = RequestBaseOptions

export type BlobResponse = {
  blob: Blob
  contentType: string
  contentLength: number | null
  fileName: string
}

export class ApiError extends Error {
  readonly status: number
  readonly payload: unknown

  constructor(message: string, status: number, payload?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

export function createIdempotencyKey(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
}

export async function requestJson<T>(path: string, options: RequestJsonOptions = {}) {
  if (!isRemoteApiEnabled()) {
    throw new Error('Remote API is not configured')
  }

  const { method = 'GET', body, query, headers, idempotencyKey, includeAdminAuth = true, authToken } = options
  const url = createRequestUrl(path)

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value == null || value === '') {
        return
      }

      url.searchParams.set(key, String(value))
    })
  }

  const response = await fetch(url.toString(), {
    method,
    headers: buildRequestHeaders({
      headers,
      includeAdminAuth,
      authToken,
      idempotencyKey,
      hasJsonBody: body !== undefined,
    }),
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  return unwrapResponse<T>(response)
}

export async function requestFormData<T>(path: string, options: RequestFormDataOptions) {
  if (!isRemoteApiEnabled()) {
    throw new Error('Remote API is not configured')
  }

  const { method = 'POST', body, query, headers, idempotencyKey, includeAdminAuth = true, authToken } = options
  const url = createRequestUrl(path)

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value == null || value === '') {
        return
      }

      url.searchParams.set(key, String(value))
    })
  }

  const response = await fetch(url.toString(), {
    method,
    headers: buildRequestHeaders({
      headers,
      includeAdminAuth,
      authToken,
      idempotencyKey,
      hasJsonBody: false,
    }),
    body,
  })

  return unwrapResponse<T>(response)
}

export async function requestBlob(path: string, options: RequestBlobOptions = {}) {
  if (!isRemoteApiEnabled()) {
    throw new Error('Remote API is not configured')
  }

  const { method = 'GET', query, headers, idempotencyKey, includeAdminAuth = true, authToken } = options
  const url = createRequestUrl(path)

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value == null || value === '') {
        return
      }

      url.searchParams.set(key, String(value))
    })
  }

  const response = await fetch(url.toString(), {
    method,
    headers: buildRequestHeaders({
      headers,
      includeAdminAuth,
      authToken,
      idempotencyKey,
      hasJsonBody: false,
    }),
  })

  return unwrapBlobResponse(response)
}

export function unwrapListData<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[]
  }

  if (!value || typeof value !== 'object') {
    return []
  }

  const objectValue = value as Record<string, unknown>

  if (Array.isArray(objectValue.items)) {
    return objectValue.items as T[]
  }

  if (Array.isArray(objectValue.list)) {
    return objectValue.list as T[]
  }

  if (Array.isArray(objectValue.records)) {
    return objectValue.records as T[]
  }

  return []
}

async function unwrapResponse<T>(response: Response) {
  const rawText = await response.text()
  const payload = rawText ? safeParseJson(rawText) : null

  if (!response.ok) {
    throw new ApiError(
      getErrorMessage(payload) ?? `Request failed with status ${response.status}`,
      response.status,
      payload,
    )
  }

  if (payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
    const envelope = payload as ApiEnvelope<T>

    if (envelope.success === false) {
      throw new ApiError(envelope.message || 'API request failed', response.status, payload)
    }

    return envelope.data as T
  }

  return payload as T
}

async function unwrapBlobResponse(response: Response) {
  if (!response.ok) {
    const rawText = await response.text()
    const payload = rawText ? safeParseJson(rawText) : null

    throw new ApiError(
      getErrorMessage(payload) ?? `Request failed with status ${response.status}`,
      response.status,
      payload,
    )
  }

  const blob = await response.blob()
  const contentType = response.headers.get('Content-Type')?.trim() ?? blob.type ?? ''
  const contentLength = parseContentLength(response.headers.get('Content-Length'))

  return {
    blob,
    contentType,
    contentLength,
    fileName: parseFileName(response.headers.get('Content-Disposition')),
  } satisfies BlobResponse
}

function buildRequestHeaders(input: {
  headers?: Record<string, string>
  includeAdminAuth: boolean
  authToken?: string | null | undefined
  idempotencyKey?: string
  hasJsonBody: boolean
}) {
  const finalHeaders = new Headers(input.headers)
  finalHeaders.set('Accept', 'application/json')

  if (input.hasJsonBody) {
    finalHeaders.set('Content-Type', 'application/json')
  }

  const explicitAuthToken = String(input.authToken ?? '').trim()
  if (explicitAuthToken) {
    finalHeaders.set('Authorization', `Bearer ${explicitAuthToken}`)
  } else if (input.includeAdminAuth) {
    const adminAuthToken = apiConfig.adminBearerToken || getStoredAdminAuthToken()

    if (adminAuthToken) {
      finalHeaders.set('Authorization', `Bearer ${adminAuthToken}`)
    }
  }

  if (input.idempotencyKey) {
    finalHeaders.set('X-Idempotency-Key', input.idempotencyKey)
  }

  return finalHeaders
}

function createRequestUrl(path: string) {
  const target = buildApiUrl(path)
  const base =
    typeof window === 'undefined' ? 'http://localhost' : window.location.origin

  return new URL(target, base)
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

function getErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return typeof payload === 'string' ? payload : null
  }

  const objectValue = payload as Record<string, unknown>

  if (typeof objectValue.message === 'string' && objectValue.message.trim()) {
    return objectValue.message
  }

  if (typeof objectValue.error === 'string' && objectValue.error.trim()) {
    return objectValue.error
  }

  return null
}

function parseContentLength(value: string | null) {
  if (!value) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function parseFileName(value: string | null) {
  if (!value) {
    return ''
  }

  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]).trim()
    } catch {
      return utf8Match[1].trim()
    }
  }

  const asciiMatch = value.match(/filename="?([^";]+)"?/i)
  return asciiMatch?.[1]?.trim() ?? ''
}
