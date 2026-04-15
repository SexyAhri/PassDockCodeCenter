import { useEffect, useState } from 'react'

import { clearStoredAdminSession, readStoredAdminSession, type AdminSession, writeAdminSession } from '../admin/session'
import { getRemoteCurrentUser, loginAdminRemote, logoutRemoteSession } from '../api/auth'
import { isRemoteApiEnabled } from '../api/config'

export type { AdminSession } from '../admin/session'

type SignInInput = {
  email: string
  password: string
  remember: boolean
}

export function useAdminSession() {
  const remoteEnabled = isRemoteApiEnabled()
  const [session, setSession] = useState<AdminSession | null>(() => readStoredAdminSession())

  useEffect(() => {
    if (remoteEnabled && session && !session.token) {
      clearStoredAdminSession()
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
        const currentUser = await getRemoteCurrentUser()

        if (cancelled) {
          return
        }

        const nextSession: AdminSession = {
          ...session,
          userId: currentUser.userId || session.userId,
          email: currentUser.email || session.email,
          name: currentUser.name || session.name,
          role: currentUser.role || session.role,
        }

        writeAdminSession(nextSession, true)
        setSession(nextSession)
      } catch {
        if (cancelled) {
          return
        }

        clearStoredAdminSession()
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
      const nextSession = {
        name: input.email.split('@')[0] || 'operator',
        email: input.email.trim(),
      }

      writeAdminSession(nextSession, input.remember)
      setSession(nextSession)
      return
    }

    const remoteSession = await loginAdminRemote(input.email.trim(), input.password)

    const nextSession: AdminSession = {
      name: remoteSession.name,
      email: remoteSession.email,
      role: remoteSession.role,
      userId: remoteSession.userId,
      token: remoteSession.token,
      expiresAt: remoteSession.expiresAt,
    }

    writeAdminSession(nextSession, input.remember)
    setSession(nextSession)
  }

  async function signOut() {
    if (remoteEnabled && session?.token) {
      try {
        await logoutRemoteSession()
      } catch {
        // keep local cleanup even if remote session revoke fails
      }
    }

    clearStoredAdminSession()
    setSession(null)
  }

  return {
    session,
    signIn,
    signOut,
  }
}
