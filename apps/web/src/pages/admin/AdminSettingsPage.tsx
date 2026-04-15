import type { Locale } from '../../i18n/copy'

import { AdminSystemPage } from './AdminSystemPage'

type AdminSettingsPageProps = {
  locale: Locale
  operatorName?: string
}

export function AdminSettingsPage(props: AdminSettingsPageProps) {
  return <AdminSystemPage locale={props.locale} operatorName={props.operatorName} />
}
