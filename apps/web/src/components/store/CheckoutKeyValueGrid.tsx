type CheckoutKeyValueGridProps = {
  items: Array<{ label: string; value: string }>
  compact?: boolean
}

export function CheckoutKeyValueGrid(props: CheckoutKeyValueGridProps) {
  const { items, compact = false } = props

  return (
    <div className={`checkout-kv-grid${compact ? ' checkout-kv-grid--compact' : ''}`}>
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`} className="checkout-kv-grid__item">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  )
}
