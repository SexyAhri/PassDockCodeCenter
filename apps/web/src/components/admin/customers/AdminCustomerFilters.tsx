import { Button, Input, Select } from 'antd'

import type { AdminCustomerFiltersValue } from '../../../admin/customers/aggregate'
import { getAdminConsoleText } from '../../../i18n/adminConsole'
import type { Locale } from '../../../i18n/copy'

type AdminCustomerFiltersProps = {
  locale: Locale
  value: AdminCustomerFiltersValue
  loading?: boolean
  onChange: (next: AdminCustomerFiltersValue) => void
  onReset: () => void
}

export function AdminCustomerFilters(props: AdminCustomerFiltersProps) {
  const { locale, value, loading = false, onChange, onReset } = props
  const text = getAdminConsoleText(locale)

  return (
    <div className="admin-order-filters">
      <Input
        allowClear
        className="admin-toolbar-field admin-toolbar-field--wide"
        value={value.keyword}
        placeholder={locale === 'zh-CN' ? '客户 / 订单 / 工单 / Buyer Ref' : 'Customer / order / ticket / buyer ref'}
        onChange={(event) => onChange({ ...value, keyword: event.target.value })}
      />

      <Input
        allowClear
        className="admin-toolbar-field admin-toolbar-field--regular"
        value={value.region}
        placeholder={text.table.region}
        onChange={(event) => onChange({ ...value, region: event.target.value })}
      />

      <Select
        allowClear
        className="admin-toolbar-field admin-toolbar-field--compact"
        value={value.tier || undefined}
        placeholder={text.table.tier}
        options={buildOptions(text.enums.userTier)}
        onChange={(nextValue) => onChange({ ...value, tier: nextValue ?? '' })}
      />

      <Select
        allowClear
        className="admin-toolbar-field admin-toolbar-field--compact"
        value={value.ticketStatus || undefined}
        placeholder={text.table.status}
        options={buildOptions(text.enums.ticketStatus)}
        onChange={(nextValue) => onChange({ ...value, ticketStatus: nextValue ?? '' })}
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
