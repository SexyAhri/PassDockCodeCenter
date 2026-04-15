import { Alert, Button } from 'antd'

import { ProductCard } from '../../components/store/ProductCard'
import type { StorefrontProduct } from '../../data/catalog'
import type { PaymentChannel } from '../../data/paymentChannels'
import type { AppCopy, Locale, PaymentMethodKey } from '../../i18n/copy'

type StorefrontPageProps = {
  copy: AppCopy
  locale: Locale
  products: StorefrontProduct[]
  paymentChannelMap: Record<PaymentMethodKey, PaymentChannel>
  paymentChannelCount: number
  loading?: boolean
  error?: string | null
  onNavigate: (to: string) => void
  adminEntryPath: string
}

export function StorefrontPage(props: StorefrontPageProps) {
  const { copy, products, paymentChannelMap, paymentChannelCount, loading = false, error, onNavigate, adminEntryPath } =
    props
  const bannerStats = copy.store.stats.map((item, index) =>
    index === 1 ? { ...item, value: String(paymentChannelCount).padStart(2, '0') } : item,
  )

  return (
    <div className="store-page">
      <section className="store-banner">
        <div className="store-banner__copy">
          <span className="store-banner__eyebrow">{copy.store.bannerBadge}</span>
          <h1>{copy.store.bannerTitle}</h1>
          <p>{copy.store.bannerLead}</p>
        </div>

        <div className="store-banner__stats">
          {bannerStats.map((item) => (
            <div key={item.label} className="store-banner__stat-card">
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="store-notice">
        <Alert
          type="info"
          showIcon
          message={copy.store.noticeTitle}
          description={copy.store.noticeLead}
          action={
            <div className="store-notice__actions">
              <Button type="primary" onClick={() => onNavigate('/shop')}>
                {copy.store.noticePrimary}
              </Button>
              <Button onClick={() => onNavigate(adminEntryPath)}>
                {copy.store.noticeSecondary}
              </Button>
            </div>
          }
        />

        {error ? (
          <Alert
            type="warning"
            showIcon
            message={loading ? 'Loading...' : error}
            style={{ marginTop: 12 }}
          />
        ) : null}

        <div className="store-notice__steps">
          {copy.store.noticeSteps.map((step, index) => (
            <div key={step} className="store-step">
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="catalog-panel">
        <div className="catalog-panel__head">
          <div>
            <span className="catalog-panel__eyebrow">{copy.store.featuredEyebrow}</span>
            <h2>{copy.store.featuredTitle}</h2>
            <p>{copy.store.featuredLead}</p>
          </div>

          <Button type="link" onClick={() => onNavigate('/shop')}>
            {copy.store.viewAll}
          </Button>
        </div>

        <div className="catalog-panel__body">
          <div className="catalog-grid">
            {products.map((product) => (
              <div key={product.sku}>
                <ProductCard
                  copy={copy}
                  paymentCount={
                    product.paymentMethods.filter((method) => paymentChannelMap[method]?.enabled).length
                  }
                  product={product}
                  onCheckout={(sku) => onNavigate(`/products/${sku}`)}
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
