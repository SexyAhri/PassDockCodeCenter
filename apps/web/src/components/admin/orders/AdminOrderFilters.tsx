import { Button, Input, Select } from 'antd'

import type { AdminOrderListFilters } from '../../../api/adminOrders'
import { getAdminConsoleText } from '../../../i18n/adminConsole'
import type { Locale } from '../../../i18n/copy'

type AdminOrderFilterField =
  | 'orderNo'
  | 'orderStatus'
  | 'paymentStatus'
  | 'reviewStatus'
  | 'deliveryStatus'
  | 'paymentMethod'
  | 'sourceChannel'

type AdminOrderFiltersProps = {
  locale: Locale
  value: AdminOrderListFilters
  loading?: boolean
  fields?: AdminOrderFilterField[]
  onChange: (next: AdminOrderListFilters) => void
  onReset: () => void
}

const defaultFields: AdminOrderFilterField[] = [
  'orderNo',
  'orderStatus',
  'paymentStatus',
  'deliveryStatus',
  'paymentMethod',
  'sourceChannel',
]

export function AdminOrderFilters(props: AdminOrderFiltersProps) {
  const { locale, value, loading = false, fields = defaultFields, onChange, onReset } = props
  const text = getAdminConsoleText(locale)
  const enabledFields = new Set(fields)
  const reviewStatusOptions = buildReviewStatusOptions(locale)

  return (
    <div className="admin-order-filters">
      {enabledFields.has('orderNo') ? (
        <Input
          allowClear
          className="admin-toolbar-field admin-toolbar-field--regular"
          value={value.orderNo ?? ''}
          placeholder={locale === 'zh-CN' ? '订单号' : 'Order no.'}
          onChange={(event) => onChange({ ...value, orderNo: event.target.value })}
        />
      ) : null}

      {enabledFields.has('orderStatus') ? (
        <Select
          allowClear
          className="admin-toolbar-field admin-toolbar-field--regular"
          value={value.orderStatus || undefined}
          placeholder={text.table.orderStatus}
          options={buildOptions(text.enums.orderStatus)}
          onChange={(nextValue) => onChange({ ...value, orderStatus: nextValue ?? '' })}
        />
      ) : null}

      {enabledFields.has('paymentStatus') ? (
        <Select
          allowClear
          className="admin-toolbar-field admin-toolbar-field--compact"
          value={value.paymentStatus || undefined}
          placeholder={text.table.paymentStatus}
          options={buildOptions(text.enums.paymentStatus)}
          onChange={(nextValue) => onChange({ ...value, paymentStatus: nextValue ?? '' })}
        />
      ) : null}

      {enabledFields.has('reviewStatus') ? (
        <Select
          allowClear
          className="admin-toolbar-field admin-toolbar-field--compact"
          value={value.reviewStatus || undefined}
          placeholder={locale === 'zh-CN' ? '审核状态' : 'Review status'}
          options={reviewStatusOptions}
          onChange={(nextValue) => onChange({ ...value, reviewStatus: nextValue ?? '' })}
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

      {enabledFields.has('paymentMethod') ? (
        <Select
          allowClear
          className="admin-toolbar-field admin-toolbar-field--regular"
          value={value.paymentMethod || undefined}
          placeholder={text.table.paymentMethod}
          options={buildOptions(text.enums.paymentMethod)}
          onChange={(nextValue) => onChange({ ...value, paymentMethod: nextValue ?? '' })}
        />
      ) : null}

      {enabledFields.has('sourceChannel') ? (
        <Select
          allowClear
          className="admin-toolbar-field admin-toolbar-field--compact"
          value={value.sourceChannel || undefined}
          placeholder={text.table.sourceChannel}
          options={buildOptions(text.enums.sourceChannel)}
          onChange={(nextValue) => onChange({ ...value, sourceChannel: nextValue ?? '' })}
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

function buildReviewStatusOptions(locale: Locale) {
  if (locale === 'zh-CN') {
    return [
      { value: 'pending', label: '待审核' },
      { value: 'approved', label: '已通过' },
      { value: 'rejected', label: '已驳回' },
    ]
  }

  return [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ]
}
