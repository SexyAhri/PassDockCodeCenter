import type { ReactNode } from 'react'

type CheckoutSectionProps = {
  title: string
  extra?: ReactNode
  children: ReactNode
}

export function CheckoutSection(props: CheckoutSectionProps) {
  const { title, extra, children } = props

  return (
    <section className="checkout-section">
      <div className="checkout-section__head">
        <strong>{title}</strong>
        {extra ? <div>{extra}</div> : null}
      </div>
      <div className="checkout-section__body">{children}</div>
    </section>
  )
}
