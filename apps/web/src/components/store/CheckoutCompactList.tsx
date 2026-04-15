import type { ReactNode } from 'react'

type CheckoutCompactListProps = {
  items: Array<{ id: string; title: string; meta?: string; action?: () => void; aside?: ReactNode; active?: boolean }>
  subtle?: boolean
}

export function CheckoutCompactList(props: CheckoutCompactListProps) {
  const { items, subtle = false } = props

  return (
    <div className={`checkout-compact-list${subtle ? ' checkout-compact-list--subtle' : ''}`}>
      {items.map((item) => (
        item.action ? (
          <button
            key={item.id}
            type="button"
            className={`checkout-compact-list__item checkout-compact-list__item--action${item.active ? ' checkout-compact-list__item--active' : ''}`}
            onClick={item.action}
          >
            <div className="checkout-compact-list__copy">
              <strong>{item.title}</strong>
              {item.meta ? <span>{item.meta}</span> : null}
            </div>
            {item.aside ? <div className="checkout-compact-list__aside">{item.aside}</div> : null}
          </button>
        ) : (
          <div key={item.id} className="checkout-compact-list__item">
            <div className="checkout-compact-list__copy">
              <strong>{item.title}</strong>
              {item.meta ? <span>{item.meta}</span> : null}
            </div>
            {item.aside ? <div className="checkout-compact-list__aside">{item.aside}</div> : null}
          </div>
        )
      ))}
    </div>
  )
}
