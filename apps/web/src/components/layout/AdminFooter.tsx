import type { AppCopy } from '../../i18n/copy'

export function AdminFooter(props: { copy: AppCopy }) {
  const { copy } = props

  return (
    <footer className="admin-footer">
      Copyright {new Date().getFullYear()} {copy.common.brandName} {copy.common.brandMeta}
    </footer>
  )
}
