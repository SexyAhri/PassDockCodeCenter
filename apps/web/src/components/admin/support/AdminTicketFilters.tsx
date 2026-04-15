import { Button, Input, Select } from 'antd'

import { getAdminConsoleText } from '../../../i18n/adminConsole'
import type { Locale } from '../../../i18n/copy'

export type AdminTicketFiltersValue = {
  ticketNo: string
  status: string
  priority: string
  assignedTo: string
}

type AdminTicketFiltersProps = {
  locale: Locale
  value: AdminTicketFiltersValue
  loading?: boolean
  onChange: (next: AdminTicketFiltersValue) => void
  onReset: () => void
}

export function AdminTicketFilters(props: AdminTicketFiltersProps) {
  const { locale, value, loading = false, onChange, onReset } = props
  const text = getAdminConsoleText(locale)

  return (
    <div className="admin-order-filters">
      <Input
        allowClear
        className="admin-toolbar-field admin-toolbar-field--regular"
        value={value.ticketNo}
        placeholder={locale === 'zh-CN' ? '工单号' : 'Ticket no.'}
        onChange={(event) => onChange({ ...value, ticketNo: event.target.value })}
      />

      <Select
        allowClear
        className="admin-toolbar-field admin-toolbar-field--compact"
        value={value.status || undefined}
        placeholder={text.table.status}
        options={buildOptions(text.enums.ticketStatus)}
        onChange={(nextValue) => onChange({ ...value, status: nextValue ?? '' })}
      />

      <Select
        allowClear
        className="admin-toolbar-field admin-toolbar-field--compact"
        value={value.priority || undefined}
        placeholder={text.table.priority}
        options={buildOptions(text.enums.ticketPriority)}
        onChange={(nextValue) => onChange({ ...value, priority: nextValue ?? '' })}
      />

      <Input
        allowClear
        className="admin-toolbar-field admin-toolbar-field--regular"
        value={value.assignedTo}
        placeholder={locale === 'zh-CN' ? '处理人' : 'Assigned to'}
        onChange={(event) => onChange({ ...value, assignedTo: event.target.value })}
      />

      <Button
        loading={loading}
        className="admin-toolbar-action"
        onClick={onReset}
      >
        {locale === 'zh-CN' ? '清空筛选' : 'Clear filters'}
      </Button>
    </div>
  )
}

function buildOptions(map: Record<string, string>) {
  return Object.entries(map).map(([optionValue, label]) => ({
    value: optionValue,
    label,
  }))
}
