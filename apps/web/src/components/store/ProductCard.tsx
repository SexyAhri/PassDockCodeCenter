import { Button, Card, Tag } from 'antd'

import type { StorefrontProduct } from '../../data/catalog'
import type { AppCopy } from '../../i18n/copy'
import { ProductVisual } from './ProductVisual'

type ProductCardProps = {
  copy: AppCopy
  paymentCount: number
  product: StorefrontProduct
  onCheckout: (sku: string) => void
}

export function ProductCard(props: ProductCardProps) {
  const { copy, paymentCount, product, onCheckout } = props
  const visibleTags = product.tags.filter((tag) => tag.trim())

  return (
    <Card
      hoverable
      className="product-card"
      cover={
        <div className="product-card__cover">
          {product.badge ? <span className="product-card__badge">{product.badge}</span> : null}
          <ProductVisual variant={product.artVariant} />
        </div>
      }
    >
      <div className="product-card__header">
        <span className="product-card__sku">{product.sku}</span>
        {product.statusLabel ? <Tag color="blue">{product.statusLabel}</Tag> : null}
      </div>

      <h3>{product.name}</h3>

      {visibleTags.length ? (
        <div className="product-card__tags">
          {visibleTags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      ) : null}

      <div className="product-card__specs">
        <div>
          <span>{copy.store.specLabels.billing}</span>
          <strong>{product.cycleLabel}</strong>
        </div>
        <div>
          <span>{copy.store.specLabels.delivery}</span>
          <strong>{product.deliveryLabel}</strong>
        </div>
        <div>
          <span>{copy.store.specLabels.payment}</span>
          <strong>{paymentCount}</strong>
        </div>
        <div>
          <span>{copy.store.specLabels.stock}</span>
          <strong>{product.stockLabel}</strong>
        </div>
      </div>

      <div className="product-card__footer">
        <div className="product-card__price">
          <strong>
            {product.price} {product.currency}
          </strong>
          <small>
            {product.originalPrice} {product.currency}
          </small>
        </div>

        <Button size="small" type="primary" onClick={() => onCheckout(product.sku)}>
          {copy.store.buyNow}
        </Button>
      </div>
    </Card>
  )
}
