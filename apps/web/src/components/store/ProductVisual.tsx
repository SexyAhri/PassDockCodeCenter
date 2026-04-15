import type { StorefrontProduct } from '../../data/catalog'

export function ProductVisual(props: { variant: StorefrontProduct['artVariant'] }) {
  const { variant } = props

  return (
    <div className={`product-visual product-visual--${variant}`}>
      <div className="product-visual__frame" />
      <div className="product-visual__core" />
      <div className="product-visual__signal" />
    </div>
  )
}
