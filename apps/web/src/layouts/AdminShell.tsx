import { Layout } from 'antd'
import type { ReactNode } from 'react'

import { AdminFooter } from '../components/layout/AdminFooter'
import { AdminHeader } from '../components/layout/AdminHeader'
import { AdminSidebar } from '../components/layout/AdminSidebar'
import type { AppCopy, Locale } from '../i18n/copy'
import type { AdminSession } from '../hooks/useAdminSession'

type AdminShellProps = {
  copy: AppCopy
  pathname: string
  locale: Locale
  setLocale: (locale: Locale) => void
  session: AdminSession
  onNavigate: (to: string) => void
  onLogout: () => void
  children: ReactNode
}

export function AdminShell(props: AdminShellProps) {
  const { copy, pathname, locale, setLocale, session, onNavigate, onLogout, children } = props

  return (
    <Layout className="admin-shell">
      <AdminSidebar copy={copy} pathname={pathname} locale={locale} onNavigate={onNavigate} />

      <Layout className="admin-shell__main">
        <AdminHeader
          copy={copy}
          pathname={pathname}
          locale={locale}
          setLocale={setLocale}
          session={session}
          onNavigate={onNavigate}
          onLogout={onLogout}
        />

        <Layout.Content className="admin-shell__content">
          <div className="admin-shell__canvas">{children}</div>
        </Layout.Content>
        <AdminFooter copy={copy} />
      </Layout>
    </Layout>
  )
}
