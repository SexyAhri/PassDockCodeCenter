import { useEffect, useState } from 'react'

import {
  getRemoteCurrentUser,
  loginStorefrontRemote,
  logoutRemoteSession,
  registerStorefrontRemote,
} from '../api/auth'
import { isRemoteApiEnabled } from '../api/config'
import type { Locale } from '../i18n/copy'
import {
  clearStoredStorefrontSession,
  readStoredStorefrontSession,
  type StorefrontSession,
  writeStorefrontSession,
} from '../storefront/session'

export type { StorefrontSession } from '../storefront/session'

type SignInInput = {
  email: string
  password: string
  remember: boolean
}

type RegisterInput = {
  email: string
  password: string
  displayName?: string
  remember: boolean
  locale: Locale
}

export function useStorefrontSession() {
  const remoteEnabled = isRemoteApiEnabled()
  const [session, setSession] = useState<StorefrontSession | null>(() => readStoredStorefrontSession())

  useEffect(() => {
    if (remoteEnabled && session && !session.token) {
      clearStoredStorefrontSession()
      setSession(null)
    }
  }, [remoteEnabled, session])

  useEffect(() => {
    if (!remoteEnabled || !session?.token) {
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const currentUser = await getRemoteCurrentUser(session.token)

        if (cancelled) {
          return
        }

        const nextSession: StorefrontSession = {
          ...session,
          userId: currentUser.userId || session.userId,
          email: currentUser.email || session.email,
          name: currentUser.name || session.name,
          role: currentUser.role || session.role,
        }

        writeStorefrontSession(nextSession, true)
        setSession(nextSession)
      } catch {
        if (cancelled) {
          return
        }

        clearStoredStorefrontSession()
        setSession(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [remoteEnabled, session?.token])

  async function signIn(input: SignInInput) {
    if (!input.email.trim() || !input.password.trim()) {
      throw new Error('Missing credentials')
    }

    if (!remoteEnabled) {
      const nextSession: StorefrontSession = {
        name: input.email.split('@')[0] || 'buyer',
        email: input.email.trim(),
        role: 'user',
      }

      writeStorefrontSession(nextSession, input.remember)
      setSession(nextSession)
      return nextSession
    }

    const remoteSession = await loginStorefrontRemote(input.email.trim(), input.password)

    const nextSession: StorefrontSession = {
      name: remoteSession.name,
      email: remoteSession.email,
      role: remoteSession.role,
      userId: remoteSession.userId,
      token: remoteSession.token,
      expiresAt: remoteSession.expiresAt,
    }

    writeStorefrontSession(nextSession, input.remember)
    setSession(nextSession)
    return nextSession
  }

  async function signUp(input: RegisterInput) {
    if (!input.email.trim() || !input.password.trim()) {
      throw new Error('Missing credentials')
    }

    if (!remoteEnabled) {
      const nextSession: StorefrontSession = {
        name: input.displayName?.trim() || input.email.split('@')[0] || 'buyer',
        email: input.email.trim(),
        role: 'user',
      }

      writeStorefrontSession(nextSession, input.remember)
      setSession(nextSession)
      return nextSession
    }

    const remoteSession = await registerStorefrontRemote({
      email: input.email.trim(),
      password: input.password,
      displayName: input.displayName?.trim(),
      locale: input.locale,
    })

    const nextSession: StorefrontSession = {
      name: remoteSession.name,
      email: remoteSession.email,
      role: remoteSession.role,
      userId: remoteSession.userId,
      token: remoteSession.token,
      expiresAt: remoteSession.expiresAt,
    }

    writeStorefrontSession(nextSession, input.remember)
    setSession(nextSession)
    return nextSession
  }

  async function signOut() {
    if (remoteEnabled && session?.token) {
      try {
        await logoutRemoteSession(session.token)
      } catch {
        // Keep local cleanup even if remote revoke fails.
      }
    }

    clearStoredStorefrontSession()
    setSession(null)
  }

  return {
    session,
    signIn,
    signUp,
    signOut,
  }
}
