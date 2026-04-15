import type { Locale } from '../i18n/copy'
import { requestJson } from './http'

type SessionPayload = {
  token?: string
  user_id?: number
  email?: string
  name?: string
  role?: string
  expires_at?: string
}

type MePayload = {
  id?: number
  email?: string
  display_name?: string
  role?: string
  status?: string
  locale?: string
  last_login_at?: string
}

export type RemoteSession = {
  token: string
  userId: number
  email: string
  name: string
  role: string
  expiresAt: string
}

export type RemoteCurrentUser = {
  userId: number
  email: string
  name: string
  role: string
  status: string
  locale: string
  lastLoginAt: string
}

export async function loginAdminRemote(email: string, password: string) {
  const payload = await requestJson<SessionPayload>('/api/v1/auth/login', {
    method: 'POST',
    includeAdminAuth: false,
    body: {
      email,
      password,
      scope: 'admin',
    },
  })

  return normalizeSessionPayload(payload, email)
}

export async function loginStorefrontRemote(email: string, password: string) {
  const payload = await requestJson<SessionPayload>('/api/v1/auth/login', {
    method: 'POST',
    includeAdminAuth: false,
    body: {
      email,
      password,
      scope: 'user',
    },
  })

  return normalizeSessionPayload(payload, email)
}

export async function registerStorefrontRemote(input: {
  email: string
  password: string
  displayName?: string
  locale: Locale
}) {
  const payload = await requestJson<SessionPayload>('/api/v1/auth/register', {
    method: 'POST',
    includeAdminAuth: false,
    body: {
      email: input.email,
      password: input.password,
      display_name: input.displayName,
      locale: input.locale,
    },
  })

  return normalizeSessionPayload(payload, input.email)
}

export async function getRemoteCurrentUser(authToken?: string) {
  const payload = await requestJson<MePayload>('/api/v1/me', {
    authToken,
  })

  return {
    userId: Number(payload.id ?? 0),
    email: String(payload.email ?? ''),
    name: String(payload.display_name ?? ''),
    role: String(payload.role ?? ''),
    status: String(payload.status ?? ''),
    locale: String(payload.locale ?? ''),
    lastLoginAt: String(payload.last_login_at ?? ''),
  } satisfies RemoteCurrentUser
}

export async function logoutRemoteSession(authToken?: string) {
  await requestJson('/api/v1/auth/logout', {
    method: 'POST',
    authToken,
  })
}

function normalizeSessionPayload(payload: SessionPayload, email: string) {
  return {
    token: String(payload.token ?? ''),
    userId: Number(payload.user_id ?? 0),
    email: String(payload.email ?? email),
    name: String(payload.name ?? email.split('@')[0] ?? 'user'),
    role: String(payload.role ?? 'user'),
    expiresAt: String(payload.expires_at ?? ''),
  } satisfies RemoteSession
}
