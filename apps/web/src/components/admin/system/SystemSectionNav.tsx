import { Badge, theme } from 'antd'

type SystemSectionNavProps<TKey extends string> = {
  activeKey: TKey
  className?: string
  items: Array<{
    key: TKey
    label: string
    description: string
    count: number
  }>
  onChange: (key: TKey) => void
}

export function SystemSectionNav<TKey extends string>(props: SystemSectionNavProps<TKey>) {
  const { activeKey, className, items, onChange } = props
  const { token } = theme.useToken()

  return (
    <nav className={className ? `admin-section-nav ${className}` : 'admin-section-nav'}>
      {items.map((item) => {
        const isActive = item.key === activeKey

        return (
          <button
            key={item.key}
            type="button"
            className={`admin-section-nav__item${isActive ? ' admin-section-nav__item--active' : ''}`}
            onClick={() => onChange(item.key)}
          >
            <span className="admin-section-nav__copy">
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </span>
            <Badge
              count={item.count}
              color={isActive ? token.colorPrimary : token.colorTextTertiary}
              overflowCount={999}
              showZero
            />
          </button>
        )
      })}
    </nav>
  )
}
