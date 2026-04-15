import { Button, Input } from 'antd'
import { useEffect, useState } from 'react'

import { CheckoutSection } from './CheckoutSection'
import type { Locale } from '../../i18n/copy'

export type OrderLookupValues = {
  orderNo: string
  accessToken: string
}

type OrderLookupSectionProps = {
  locale: Locale
  loading?: boolean
  defaultValue?: Partial<OrderLookupValues>
  onLookup: (values: OrderLookupValues) => void | Promise<void>
}

export function OrderLookupSection(props: OrderLookupSectionProps) {
  const { locale, loading = false, defaultValue, onLookup } = props
  const [orderNo, setOrderNo] = useState(defaultValue?.orderNo ?? '')
  const [accessToken, setAccessToken] = useState(defaultValue?.accessToken ?? '')
  const labels = {
    title: locale === 'zh-CN' ? '订单查询' : 'Order lookup',
    orderNoPlaceholder: locale === 'zh-CN' ? '输入订单号' : 'Enter order number',
    accessTokenPlaceholder: locale === 'zh-CN' ? '输入查单码 / 访问令牌' : 'Enter access token',
    action: locale === 'zh-CN' ? '查询订单' : 'Lookup order',
    hint:
      locale === 'zh-CN'
        ? '查单、看交付结果、上传凭证都需要订单号和查单码。'
        : 'Order lookup, delivery results, and proof upload all require the order number and access token.',
  }

  useEffect(() => {
    setOrderNo(defaultValue?.orderNo ?? '')
    setAccessToken(defaultValue?.accessToken ?? '')
  }, [defaultValue?.orderNo, defaultValue?.accessToken])

  return (
    <CheckoutSection title={labels.title}>
      <div className="checkout-form">
        <div className="checkout-form__grid">
          <Input
            allowClear
            placeholder={labels.orderNoPlaceholder}
            value={orderNo}
            disabled={loading}
            onChange={(event) => setOrderNo(event.target.value)}
            onPressEnter={() => void handleLookup()}
          />
          <Input
            allowClear
            placeholder={labels.accessTokenPlaceholder}
            value={accessToken}
            disabled={loading}
            onChange={(event) => setAccessToken(event.target.value)}
            onPressEnter={() => void handleLookup()}
          />
        </div>

        <div className="checkout-form__actions">
          <Button type="primary" loading={loading} onClick={() => void handleLookup()}>
            {labels.action}
          </Button>
        </div>

        <div className="checkout-form__history-title">{labels.hint}</div>
      </div>
    </CheckoutSection>
  )

  async function handleLookup() {
    const nextValues = {
      orderNo: orderNo.trim(),
      accessToken: accessToken.trim(),
    } satisfies OrderLookupValues

    if (!nextValues.orderNo || !nextValues.accessToken) {
      return
    }

    await onLookup(nextValues)
  }
}
