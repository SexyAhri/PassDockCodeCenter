import { Alert, App, Button, Empty, Tag } from 'antd'

import { PageHeader } from '../../components/common/PageHeader'
import { CheckoutCompactList } from '../../components/store/CheckoutCompactList'
import { CheckoutKeyValueGrid } from '../../components/store/CheckoutKeyValueGrid'
import { CheckoutSection } from '../../components/store/CheckoutSection'
import { DetailRecordSection } from '../../components/store/DetailRecordSection'
import { OrderLookupSection } from '../../components/store/OrderLookupSection'
import { StorefrontPaymentProofList } from '../../components/store/StorefrontPaymentProofList'
import { StorefrontSupportPanel } from '../../components/store/StorefrontSupportPanel'
import type { StorefrontProduct } from '../../data/catalog'
import type { PaymentChannel } from '../../data/paymentChannels'
import { useStorefrontOrdersCenter } from '../../hooks/useStorefrontOrdersCenter'
import { useStorefrontSupport } from '../../hooks/useStorefrontSupport'
import type { Locale, PaymentMethodKey } from '../../i18n/copy'
import {
  formatStorefrontDateTime,
  formatStorefrontDeliveryStatus,
  formatStorefrontOrderStatus,
  formatStorefrontPaymentStatus,
  getStorefrontDeliveryResultFieldLabels,
  getStorefrontDeliveryResultPreferredKeys,
} from '../../storefront/orders/presentation'

type StorefrontOrdersPageProps = {
  locale: Locale
  products: StorefrontProduct[]
  paymentChannelMap: Record<PaymentMethodKey, PaymentChannel>
  onNavigate: (to: string) => void
}

export function StorefrontOrdersPage(props: StorefrontOrdersPageProps) {
  const { locale, products, paymentChannelMap, onNavigate } = props
  const { message } = App.useApp()
  const labels = getOrdersPageLabels(locale)
  const ordersCenter = useStorefrontOrdersCenter({ products })
  const selectedOrder = ordersCenter.selectedEntry?.order ?? null
  const support = useStorefrontSupport(selectedOrder?.orderNo, selectedOrder?.orderAccessToken)

  const stats = [
    {
      key: 'total',
      label: labels.stats.total,
      value: String(ordersCenter.entries.length).padStart(2, '0'),
    },
    {
      key: 'awaiting',
      label: labels.stats.awaiting,
      value: String(
        ordersCenter.entries.filter((entry) => entry.order.orderStatus === 'awaiting_payment').length,
      ).padStart(2, '0'),
    },
    {
      key: 'review',
      label: labels.stats.review,
      value: String(
        ordersCenter.entries.filter((entry) => entry.order.paymentStatus === 'pending_review').length,
      ).padStart(2, '0'),
    },
    {
      key: 'delivered',
      label: labels.stats.delivered,
      value: String(
        ordersCenter.entries.filter((entry) =>
          ['sent'].includes(entry.order.deliveryStatus) || ['delivered', 'completed'].includes(entry.order.orderStatus),
        ).length,
      ).padStart(2, '0'),
    },
  ]

  const orderListItems = ordersCenter.entries.map((entry) => {
    const order = entry.order
    const product = products.find((item) => item.sku === entry.productSku)

    return {
      id: order.orderNo,
      title: product?.name ?? order.orderNo,
      meta: `${order.orderNo} | ${formatStorefrontPaymentStatus(order.paymentStatus, locale)}`,
      action: () => ordersCenter.selectOrder(order.orderNo),
      active: entry.order.orderNo === selectedOrder?.orderNo,
      aside: (
        <span className="checkout-compact-list__badge">
          {formatStorefrontOrderStatus(order.orderStatus, locale)}
        </span>
      ),
    }
  })

  const selectedProductName = selectedOrder
    ? products.find((item) => item.sku === ordersCenter.selectedEntry?.productSku)?.name ?? '-'
    : '-'

  const orderItems = selectedOrder
    ? [
        { label: labels.fields.orderNo, value: selectedOrder.orderNo },
        { label: labels.fields.accessToken, value: selectedOrder.orderAccessToken || '-' },
        { label: labels.fields.product, value: selectedProductName },
        {
          label: labels.fields.amount,
          value: `${selectedOrder.displayAmount || '-'} ${selectedOrder.currency || ''}`.trim(),
        },
        { label: labels.fields.orderStatus, value: formatStorefrontOrderStatus(selectedOrder.orderStatus, locale) },
        {
          label: labels.fields.paymentStatus,
          value: formatStorefrontPaymentStatus(selectedOrder.paymentStatus, locale),
        },
        {
          label: labels.fields.deliveryStatus,
          value: formatStorefrontDeliveryStatus(selectedOrder.deliveryStatus, locale),
        },
        {
          label: labels.fields.paymentMethod,
          value: paymentChannelMap[selectedOrder.paymentMethod]?.label ?? selectedOrder.paymentMethod,
        },
        { label: labels.fields.buyerRef, value: selectedOrder.buyerRef || '-' },
      ]
    : []

  const canLoadDeliveryResult = Boolean(
    selectedOrder &&
      (
        ['sent', 'sending'].includes(selectedOrder.deliveryStatus) ||
        ['delivered', 'completed'].includes(selectedOrder.orderStatus)
      ),
  )

  async function handleSubmitSupportTicket(values: {
    subject: string
    content: string
    priority: 'low' | 'normal' | 'high' | 'urgent'
  }) {
    try {
      await support.createTicket(values)
      message.success(labels.supportTicketCreated)
    } catch {
      // The hook already exposes request errors inline.
    }
  }

  return (
    <div className="store-page store-page--orders">
      <PageHeader
        title={labels.title}
        subtitle={labels.subtitle}
        onBack={() => onNavigate('/shop')}
        extra={<Button onClick={() => onNavigate('/shop')}>{labels.backToShop}</Button>}
      />

      <section className="store-orders-summary">
        {stats.map((item) => (
          <article key={item.key} className="store-orders-summary__card">
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </article>
        ))}
      </section>

      <section className="store-orders-lead">
        <div className="store-orders-lead__copy">
          <strong>{labels.workspaceTitle}</strong>
          <p>{labels.workspaceDescription}</p>
        </div>

        <div className="store-orders-lead__aside">
          {selectedOrder ? (
            <>
              <div className="store-orders-lead__meta">
                <span>{selectedProductName}</span>
                <strong>{selectedOrder.orderNo}</strong>
              </div>

              <div className="store-orders-lead__tags">
                <Tag>{formatStorefrontOrderStatus(selectedOrder.orderStatus, locale)}</Tag>
                <Tag color="processing">{formatStorefrontPaymentStatus(selectedOrder.paymentStatus, locale)}</Tag>
                <Tag color="success">{formatStorefrontDeliveryStatus(selectedOrder.deliveryStatus, locale)}</Tag>
                <Tag color={getOrderSourceColor(ordersCenter.selectedSource)}>
                  {getOrderSourceLabel(labels, ordersCenter.selectedSource)}
                </Tag>
              </div>

              <div className="checkout-order__actions">
                <Button size="small" loading={ordersCenter.loading} onClick={() => void ordersCenter.refreshSelectedOrder()}>
                  {labels.refresh}
                </Button>
                {canLoadDeliveryResult ? (
                  <Button
                    size="small"
                    loading={ordersCenter.loading}
                    onClick={() => void ordersCenter.loadSelectedDeliveryResult()}
                  >
                    {labels.loadDeliveryResult}
                  </Button>
                ) : null}
              </div>
            </>
          ) : (
            <div className="store-orders-lead__empty">{labels.selectHint}</div>
          )}
        </div>
      </section>

      {ordersCenter.error ? (
        <Alert showIcon type="warning" message={ordersCenter.error} closable onClose={ordersCenter.clearError} />
      ) : null}

      <div className="store-orders-workbench">
        <div className="store-orders-sidebar">
          <OrderLookupSection
            locale={locale}
            loading={ordersCenter.loading}
            defaultValue={{
              orderNo: selectedOrder?.orderNo ?? '',
              accessToken: selectedOrder?.orderAccessToken ?? '',
            }}
            onLookup={async (values) => {
              await ordersCenter.lookupOrder(values)
            }}
          />

          <CheckoutSection title={labels.orderListTitle}>
            {orderListItems.length ? (
              <CheckoutCompactList items={orderListItems} />
            ) : (
              <div className="store-orders-empty">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={labels.empty} />
              </div>
            )}
          </CheckoutSection>
        </div>

        <div className="store-orders-main">
          <CheckoutSection title={labels.detailTitle}>
            {selectedOrder ? (
              <CheckoutKeyValueGrid items={orderItems} compact />
            ) : (
              <div className="store-orders-empty store-orders-empty--inline">{labels.selectHint}</div>
            )}
          </CheckoutSection>

          {selectedOrder ? (
            <CheckoutSection title={labels.timelineTitle}>
              <CheckoutKeyValueGrid
                items={[
                  {
                    label: labels.fields.createdAt,
                    value: formatStorefrontDateTime(String(ordersCenter.selectedEntry?.updatedAt ?? ''), locale),
                  },
                  {
                    label: labels.fields.orderStatus,
                    value: formatStorefrontOrderStatus(selectedOrder.orderStatus, locale),
                  },
                  {
                    label: labels.fields.paymentStatus,
                    value: formatStorefrontPaymentStatus(selectedOrder.paymentStatus, locale),
                  },
                  {
                    label: labels.fields.deliveryStatus,
                    value: formatStorefrontDeliveryStatus(selectedOrder.deliveryStatus, locale),
                  },
                ]}
                compact
              />
            </CheckoutSection>
          ) : null}

          {selectedOrder ? (
            <DetailRecordSection
              title={labels.deliveryResult}
              emptyText={labels.deliveryResultEmpty}
              data={ordersCenter.selectedDeliveryResult}
              fieldLabels={getStorefrontDeliveryResultFieldLabels(locale)}
              preferredKeys={getStorefrontDeliveryResultPreferredKeys()}
            />
          ) : null}

          {selectedOrder?.paymentProofs.length ? (
            <CheckoutSection title={labels.paymentProofs}>
              <StorefrontPaymentProofList locale={locale} proofs={selectedOrder.paymentProofs} subtle />
            </CheckoutSection>
          ) : null}

          {selectedOrder ? (
            <StorefrontSupportPanel
              locale={locale}
              loading={support.loading}
              submitting={support.submitting}
              disabled={!support.remoteEnabled}
              tickets={support.tickets}
              error={support.error}
              onSubmit={handleSubmitSupportTicket}
            />
          ) : null}

        </div>
      </div>
    </div>
  )
}

function getOrdersPageLabels(locale: Locale) {
  const isZh = locale === 'zh-CN'

  return {
    title: isZh ? '订单中心' : 'Order center',
    subtitle:
      isZh
        ? '订单查询、付款凭证、交付结果和售后支持都在这里处理。'
        : 'Handle order lookup, payment proofs, delivery results, and support here.',
    backToShop: isZh ? '返回商品' : 'Back to products',
    workspaceTitle: isZh ? '订单工作台' : 'Order workspace',
    workspaceDescription:
      isZh
        ? '左侧负责查单和切换订单，右侧统一处理状态、交付结果、付款凭证和售后支持。'
        : 'Use the left side for lookup and order switching, then manage status, delivery results, payment proofs, and support on the right.',
    orderListTitle: isZh ? '订单列表' : 'Order list',
    detailTitle: isZh ? '订单详情' : 'Order detail',
    deliveryResult: isZh ? '交付结果' : 'Delivery result',
    deliveryResultEmpty: isZh ? '当前还没有可展示的交付结果。' : 'No delivery result is available yet.',
    paymentProofs: isZh ? '付款凭证' : 'Payment proofs',
    timelineTitle: isZh ? '状态快照' : 'Status snapshot',
    empty:
      isZh
        ? '当前浏览器还没有保存订单，可用订单号和查单码查询。'
        : 'No saved orders in this browser yet. Use the order number and access token to look one up.',
    selectHint: isZh ? '从左侧选择一个订单查看详情。' : 'Select an order from the left to inspect it.',
    refresh: isZh ? '刷新' : 'Refresh',
    loadDeliveryResult: isZh ? '拉取结果' : 'Load result',
    supportTicketCreated: isZh ? '工单已提交，支持团队会继续跟进。' : 'Support ticket submitted.',
    remoteReady: isZh ? '远程接口' : 'Remote API',
    localDraft: isZh ? '本地草稿' : 'Local draft',
    remoteUnavailable: isZh ? '远程不可用' : 'Remote unavailable',
    stats: {
      total: isZh ? '本机订单' : 'Saved orders',
      awaiting: isZh ? '待支付' : 'Awaiting payment',
      review: isZh ? '待审核' : 'Pending review',
      delivered: isZh ? '已交付' : 'Delivered',
    },
    fields: {
      orderNo: isZh ? '订单号' : 'Order no.',
      accessToken: isZh ? '查单码' : 'Access token',
      product: isZh ? '商品' : 'Product',
      amount: isZh ? '金额' : 'Amount',
      orderStatus: isZh ? '订单状态' : 'Order status',
      paymentStatus: isZh ? '支付状态' : 'Payment status',
      deliveryStatus: isZh ? '交付状态' : 'Delivery status',
      paymentMethod: isZh ? '支付方式' : 'Payment method',
      buyerRef: isZh ? '买家标识' : 'Buyer ref',
      createdAt: isZh ? '最近更新时间' : 'Last updated',
    },
  }
}

function getOrderSourceLabel(
  labels: ReturnType<typeof getOrdersPageLabels>,
  source: 'local' | 'remote' | 'remote-error',
) {
  if (source === 'remote') {
    return labels.remoteReady
  }

  if (source === 'remote-error') {
    return labels.remoteUnavailable
  }

  return labels.localDraft
}

function getOrderSourceColor(source: 'local' | 'remote' | 'remote-error') {
  if (source === 'remote') {
    return 'blue'
  }

  if (source === 'remote-error') {
    return 'volcano'
  }

  return 'default'
}
