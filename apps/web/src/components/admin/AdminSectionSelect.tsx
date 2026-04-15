import { Select } from 'antd'

type AdminSectionSelectProps<TKey extends string> = {
  value: TKey
  items: Array<{
    key: TKey
    label: string
  }>
  onChange: (value: TKey) => void
}

export function AdminSectionSelect<TKey extends string>(props: AdminSectionSelectProps<TKey>) {
  const { value, items, onChange } = props

  return (
    <Select
      value={value}
      className="admin-section-select"
      options={items.map((item) => ({
        label: item.label,
        value: item.key,
      }))}
      onChange={(nextValue) => onChange(nextValue as TKey)}
    />
  )
}
