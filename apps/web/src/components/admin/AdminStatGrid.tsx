import type { CSSProperties } from 'react'

type AdminStatGridProps = {
  items: Array<{
    key: string
    label: string
    value: string | number
    hint?: string
  }>
  columns?: number
}

export function AdminStatGrid(props: AdminStatGridProps) {
  const { items, columns } = props
  const style =
    columns && columns > 0
      ? ({ '--admin-stat-grid-columns': String(columns) } as CSSProperties)
      : undefined

  return (
    <div className="admin-stat-grid" style={style}>
      {items.map((item) => (
        <div key={item.key} className="admin-stat-grid__item">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.hint ? <small>{item.hint}</small> : null}
        </div>
      ))}
    </div>
  )
}
