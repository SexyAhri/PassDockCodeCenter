export type AdminSession = {
  name: string
  email: string
  role?: string
  userId?: number
  token?: string
  expiresAt?: string
}

const persistentSessionKey = 'passdock.admin.session'
const sessionSessionKey = 'passdock.admin.session.temp'

export function readStoredAdminSession() {
  const raw =
    window.localStorage.getItem(persistentSessionKey) ??
    window.sessionStorage.getItem(sessionSessionKey)

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as AdminSession
  } catch {
    return null
  }
}

export function writeAdminSession(session: AdminSession, remember: boolean) {
  if (remember) {
    window.localStorage.setItem(persistentSessionKey, JSON.stringify(session))
    window.sessionStorage.removeItem(sessionSessionKey)
    return
  }

  window.sessionStorage.setItem(sessionSessionKey, JSON.stringify(session))
  window.localStorage.removeItem(persistentSessionKey)
}

export function clearStoredAdminSession() {
  window.localStorage.removeItem(persistentSessionKey)
  window.sessionStorage.removeItem(sessionSessionKey)
}

export function getStoredAdminAuthToken() {
  return readStoredAdminSession()?.token?.trim() ?? ''
}
