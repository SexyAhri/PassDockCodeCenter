import type { ReactNode } from 'react'

import { CheckoutSection } from './CheckoutSection'

type CheckoutFlowProps = {
  title: string
  steps: Array<{ title: string; detail: string }>
  action?: ReactNode
}

export function CheckoutFlow(props: CheckoutFlowProps) {
  const { title, steps, action } = props

  return (
    <CheckoutSection title={title} extra={action}>
      <div className="checkout-flow">
        {steps.map((step, index) => (
          <article key={step.title} className="checkout-flow__item">
            <span className="checkout-flow__index">{index + 1}</span>
            <div className="checkout-flow__copy">
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </CheckoutSection>
  )
}
