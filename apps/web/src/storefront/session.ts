export type StorefrontSession = {
  name: string
  email: string
  role?: string
  userId?: number
  token?: string
  expiresAt?: string
}

const persistentSessionKey = 'passdock.storefront.session'
const sessionSessionKey = 'passdock.storefront.session.temp'

export function readStoredStorefrontSession() {
  const raw =
    window.localStorage.getItem(persistentSessionKey) ??
    window.sessionStorage.getItem(sessionSessionKey)

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as StorefrontSession
  } catch {
    return null
  }
}

export function writeStorefrontSession(session: StorefrontSession, remember: boolean) {
  if (remember) {
    window.localStorage.setItem(persistentSessionKey, JSON.stringify(session))
    window.sessionStorage.removeItem(sessionSessionKey)
    return
  }

  window.sessionStorage.setItem(sessionSessionKey, JSON.stringify(session))
  window.localStorage.removeItem(persistentSessionKey)
}

export function clearStoredStorefrontSession() {
  window.localStorage.removeItem(persistentSessionKey)
  window.sessionStorage.removeItem(sessionSessionKey)
}

export function getStoredStorefrontAuthToken() {
  return readStoredStorefrontSession()?.token?.trim() ?? ''
}
