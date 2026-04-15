import { Button, Input, Select } from 'antd'

import { getAdminConsoleText } from '../../../i18n/adminConsole'
import type { Locale } from '../../../i18n/copy'

export type AdminFulfillmentFiltersValue = {
  orderNo: string
  fulfillmentStatus: string
  deliveryStatus: string
  deliveryChannel: string
  fulfillmentType: string
}

type AdminFulfillmentFilterField =
  | 'orderNo'
  | 'fulfillmentStatus'
  | 'deliveryStatus'
  | 'deliveryChannel'
  | 'fulfillmentType'

type AdminFulfillmentFiltersProps = {
  locale: Locale
  value: AdminFulfillmentFiltersValue
  fields: AdminFulfillmentFilterField[]
  loading?: boolean
  onChange: (next: AdminFulfillmentFiltersValue) => void
  onReset: () => void
}

export function AdminFulfillmentFilters(props: AdminFulfillmentFiltersProps) {
  const { locale, value, fields, loading = false, onChange, onReset } = props
  const text = getAdminConsoleText(locale)
  const enabledFields = new Set(fields)

  return (
    <div className="admin-order-filters">
      {enabledFields.has('orderNo') ? (
        <Input
          allowClear
          className="admin-toolbar-field admin-toolbar-field--regular"
          value={value.orderNo}
          placeholder={locale === 'zh-CN' ? '订单号' : 'Order no.'}
          onChange={(event) => onChange({ ...value, orderNo: event.target.value })}
        />
      ) : null}

      {enabledFields.has('fulfillmentStatus') ? (
        <Select
          allowClear
          className="admin-toolbar-field admin-toolbar-field--compact"
          value={value.fulfillmentStatus || undefined}
          placeholder={locale === 'zh-CN' ? '履约状态' : 'Fulfillment status'}
          options={buildOptions(text.enums.fulfillmentStatus)}
          onChange={(nextValue) => onChange({ ...value, fulfillmentStatus: nextValue ?? '' })}
        />
      ) : null}

      {enabledFields.has('deliveryStatus') ? (
        <Select
          allowClear
          className="admin-toolbar-field admin-toolbar-field--compact"
          value={value.deliveryStatus || undefined}
          placeholder={text.table.deliveryStatus}
          options={buildOptions(text.enums.deliveryStatus)}
          onChange={(nextValue) => onChange({ ...value, deliveryStatus: nextValue ?? '' })}
        />
      ) : null}

      {enabledFields.has('deliveryChannel') ? (
        <Select
          allowClear
          className="admin-toolbar-field admin-toolbar-field--compact"
          value={value.deliveryChannel || undefined}
          placeholder={text.table.deliveryChannel}
          options={buildOptions(text.enums.deliveryChannel)}
          onChange={(nextValue) => onChange({ ...value, deliveryChannel: nextValue ?? '' })}
        />
      ) : null}

      {enabledFields.has('fulfillmentType') ? (
        <Select
          allowClear
          className="admin-toolbar-field admin-toolbar-field--regular"
          value={value.fulfillmentType || undefined}
          placeholder={text.table.fulfillmentType}
          options={buildOptions(text.enums.fulfillmentType)}
          onChange={(nextValue) => onChange({ ...value, fulfillmentType: nextValue ?? '' })}
        />
      ) : null}

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
