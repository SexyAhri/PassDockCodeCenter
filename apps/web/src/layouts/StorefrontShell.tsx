import type { ReactNode } from 'react'

import { StorefrontFooter } from '../components/layout/StorefrontFooter'
import { StorefrontHeader } from '../components/layout/StorefrontHeader'
import type { AppCopy, Locale } from '../i18n/copy'

type StorefrontShellProps = {
  copy: AppCopy
  locale: Locale
  setLocale: (locale: Locale) => void
  onNavigate: (to: string) => void
  adminEntryPath: string
  children: ReactNode
}

export function StorefrontShell(props: StorefrontShellProps) {
  const { copy, locale, setLocale, onNavigate, adminEntryPath, children } = props

  return (
    <div className="store-shell">
      <StorefrontHeader
        copy={copy}
        locale={locale}
        setLocale={setLocale}
        onNavigate={onNavigate}
        adminEntryPath={adminEntryPath}
      />
      <main className="store-main">
        <div className="store-workspace">{children}</div>
      </main>
      <StorefrontFooter copy={copy} />
    </div>
  )
}
