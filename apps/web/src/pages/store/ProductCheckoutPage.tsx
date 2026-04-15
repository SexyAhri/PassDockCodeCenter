import { Alert, App, Button, Tag } from 'antd'
import { useEffect, useState } from 'react'

import { type StorefrontOrderSnapshot, type UploadPaymentProofInput } from '../../api/storefrontOrders'
import { PageHeader } from '../../components/common/PageHeader'
import { CheckoutCompactList } from '../../components/store/CheckoutCompactList'
import { DetailRecordSection } from '../../components/store/DetailRecordSection'
import { CheckoutFlow } from '../../components/store/CheckoutFlow'
import { CheckoutKeyValueGrid } from '../../components/store/CheckoutKeyValueGrid'
import { CheckoutSection } from '../../components/store/CheckoutSection'
import { OrderLookupSection } from '../../components/store/OrderLookupSection'
import { PaymentCodeModal } from '../../components/store/PaymentCodeModal'
import { PaymentProofForm } from '../../components/store/PaymentProofForm'
import { StorefrontSupportPanel } from '../../components/store/StorefrontSupportPanel'
import { ProductVisual } from '../../components/store/ProductVisual'
import type { StorefrontProduct, StorefrontProductPriceOption } from '../../data/catalog'
import type { PaymentChannel } from '../../data/paymentChannels'
import { useStorefrontOrder } from '../../hooks/useStorefrontOrder'
import { useStorefrontSupport } from '../../hooks/useStorefrontSupport'
import type { AppCopy, Locale, PaymentMethodKey } from '../../i18n/copy'
import {
  formatStorefrontDateTime,
  formatStorefrontDeliveryStatus,
  formatStorefrontOrderStatus,
  formatStorefrontPaymentStatus,
  getStorefrontDeliveryResultFieldLabels,
  getStorefrontDeliveryResultPreferredKeys,
} from '../../storefront/orders/presentation'

type ProductCheckoutPageProps = {
  copy: AppCopy
  locale: Locale
  product: StorefrontProduct
  paymentChannelMap: Record<PaymentMethodKey, PaymentChannel>
  loading?: boolean
  error?: string | null
  onBack: () => void
}

export function ProductCheckoutPage(props: ProductCheckoutPageProps) {
  const { copy, locale, product, paymentChannelMap, loading = false, error, onBack } = props
  const { message } = App.useApp()
  const checkoutOrder = useStorefrontOrder({ product, paymentChannelMap })
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [selectedPriceKey, setSelectedPriceKey] = useState(() => product.priceOptions[0]?.key ?? '')
  const labels = getCheckoutLabels(locale)
  const currentOrder = checkoutOrder.order
  const deliveryResult = checkoutOrder.deliveryResult
  const support = useStorefrontSupport(currentOrder?.orderNo, currentOrder?.orderAccessToken)
  const selectedPriceOption = resolveSelectedPriceOption(product.priceOptions, selectedPriceKey)
  const enabledPaymentMethods = getEnabledPaymentMethods(product, selectedPriceOption, paymentChannelMap)

  useEffect(() => {
    setSelectedPriceKey(product.priceOptions[0]?.key ?? '')
  }, [product.priceOptions, product.sku])

  const summaryItems = [
    { label: copy.checkout.summaryLabels.sku, value: product.sku },
    {
      label: copy.checkout.summaryLabels.billing,
      value: formatBillingCycleLabel(selectedPriceOption?.billingCycle, selectedPriceOption?.cycleLabel, locale),
    },
    { label: copy.checkout.summaryLabels.delivery, value: product.deliveryLabel },
    { label: copy.checkout.summaryLabels.stock, value: product.stockLabel },
    {
      label: copy.checkout.summaryLabels.price,
      value: `${selectedPriceOption?.amount ?? product.price} ${selectedPriceOption?.currency ?? product.currency}`,
    },
    { label: copy.store.specLabels.payment, value: String(enabledPaymentMethods.length) },
  ]

  const pricePlanItems = product.priceOptions.map((option) => ({
    id: option.key,
    title: formatBillingCycleLabel(option.billingCycle, option.cycleLabel, locale),
    meta: `${option.amount} ${option.currency}`,
    active: option.key === selectedPriceOption?.key,
    action: () => setSelectedPriceKey(option.key),
    aside:
      option.originalAmount && option.originalAmount !== option.amount ? (
        <span className="checkout-compact-list__badge">{option.originalAmount}</span>
      ) : undefined,
  }))

  const paymentItems = enabledPaymentMethods.map((method) => ({
    id: method,
    title: paymentChannelMap[method].label,
    meta:
      currentOrder?.paymentMethod === method
        ? `${paymentChannelMap[method].mode} | ${formatStorefrontPaymentStatus(currentOrder.paymentStatus, locale)}`
        : paymentChannelMap[method].mode,
    action: () => void handleSelectPayment(method),
    aside: (
      <span className="checkout-compact-list__badge">
        {currentOrder?.paymentMethod === method ? labels.activePayment : 'QR'}
      </span>
    ),
  }))

  const noteItems = product.checkoutNotes.map((note, index) => ({
    id: `${product.sku}-note-${index + 1}`,
    title: note,
  }))

  const orderItems = buildOrderItems(currentOrder, product, paymentChannelMap, locale, labels)
  const modalDetails = buildModalDetails(currentOrder, product, locale, labels)
  const showPaymentProof = Boolean(
    currentOrder &&
      currentOrder.orderStatus !== 'cancelled' &&
      currentOrder.paymentStatus !== 'paid' &&
      currentOrder.paymentStatus !== 'refunded',
  )
  const canLoadDeliveryResult = Boolean(
    currentOrder &&
      (
        ['sent', 'sending'].includes(currentOrder.deliveryStatus) ||
        ['delivered', 'completed'].includes(currentOrder.orderStatus)
      ),
  )

  return (
    <div className="checkout-page">
      <PageHeader
        title={product.name}
        subtitle={copy.checkout.eyebrow}
        onBack={onBack}
        tags={[
          { label: product.badge, color: 'blue' },
          { label: product.statusLabel, color: 'green' },
        ]}
      />

      <div className="checkout-workbench">
        <section className="checkout-card checkout-overview">
          <div className="checkout-overview__visual">
            <ProductVisual variant={product.artVariant} />
          </div>

          <div className="checkout-overview__body">
            <div className="checkout-card__price">
              <strong>
                {selectedPriceOption?.amount ?? product.price} {selectedPriceOption?.currency ?? product.currency}
              </strong>
              <small>
                {selectedPriceOption?.originalAmount ?? product.originalPrice}{' '}
                {selectedPriceOption?.currency ?? product.currency}
              </small>
            </div>

            <CheckoutKeyValueGrid items={summaryItems.slice(0, 4)} />

            {pricePlanItems.length > 1 ? <CheckoutCompactList items={pricePlanItems} subtle /> : null}

            <div className="checkout-card__tags">
              {product.tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
          </div>
        </section>

        <div className="checkout-console">
          <CheckoutSection title={copy.checkout.snapshotTitle}>
            <CheckoutKeyValueGrid items={summaryItems} compact />
          </CheckoutSection>

          <OrderLookupSection
            locale={locale}
            loading={checkoutOrder.loading}
            defaultValue={{
              orderNo: currentOrder?.orderNo ?? '',
              accessToken: currentOrder?.orderAccessToken ?? '',
            }}
            onLookup={(values) => void handleLookupOrder(values)}
          />

          {error ? (
            <Alert showIcon type="warning" message={loading ? labels.loadingCatalog : error} />
          ) : null}

          {checkoutOrder.error ? (
            <Alert
              showIcon
              type="warning"
              message={checkoutOrder.error}
              closable
              onClose={checkoutOrder.clearError}
            />
          ) : null}

          {currentOrder ? (
            <CheckoutSection
              title={labels.currentOrder}
              extra={
                <div className="checkout-order__toolbar">
                  <Tag color={getOrderSourceColor(checkoutOrder.source)}>
                    {getOrderSourceLabel(labels, checkoutOrder.source)}
                  </Tag>
                  <div className="checkout-order__actions">
                    <Button size="small" loading={checkoutOrder.loading} onClick={() => void handleRefreshOrder()}>
                      {labels.refresh}
                    </Button>
                    {canMarkPaid(currentOrder) ? (
                      <Button
                        size="small"
                        type="primary"
                        loading={checkoutOrder.loading}
                        onClick={() => void handleMarkPaid()}
                      >
                        {labels.markPaid}
                      </Button>
                    ) : null}
                    {canCancel(currentOrder) ? (
                      <Button
                        size="small"
                        danger
                        loading={checkoutOrder.loading}
                        onClick={() => void handleCancelOrder()}
                      >
                        {labels.cancelOrder}
                      </Button>
                    ) : null}
                  </div>
                </div>
              }
            >
              <CheckoutKeyValueGrid items={orderItems} compact />
            </CheckoutSection>
          ) : null}

          {showPaymentProof ? (
            <PaymentProofForm
              locale={locale}
              loading={checkoutOrder.loading}
              proofs={currentOrder?.paymentProofs}
              onSubmit={handleSubmitPaymentProof}
            />
          ) : null}

          {currentOrder ? (
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

          {currentOrder && (deliveryResult || canLoadDeliveryResult) ? (
            <DetailRecordSection
              title={labels.deliveryResult}
              emptyText={labels.deliveryResultEmpty}
              data={deliveryResult}
              fieldLabels={getStorefrontDeliveryResultFieldLabels(locale)}
              preferredKeys={getStorefrontDeliveryResultPreferredKeys()}
              extra={
                canLoadDeliveryResult ? (
                  <Button size="small" loading={checkoutOrder.loading} onClick={() => void handleLoadDeliveryResult()}>
                    {labels.loadDeliveryResult}
                  </Button>
                ) : null
              }
            />
          ) : null}

          <div className="checkout-console__grid">
            <CheckoutSection title={copy.checkout.paymentTitle}>
              <CheckoutCompactList items={paymentItems} />
            </CheckoutSection>

            <CheckoutSection title={copy.checkout.notesTitle}>
              <CheckoutCompactList items={noteItems} subtle />
            </CheckoutSection>
          </div>

          <CheckoutFlow
            title={copy.checkout.flowTitle}
            steps={copy.checkout.flowSteps}
            action={
              <Button type="primary" size="small" onClick={onBack}>
                {copy.checkout.backToShop}
              </Button>
            }
          />
        </div>
      </div>

      {currentOrder?.paymentInstruction ? (
        <PaymentCodeModal
          open={paymentModalOpen}
          title={paymentChannelMap[currentOrder.paymentMethod]?.label ?? currentOrder.paymentMethod}
          mode={paymentChannelMap[currentOrder.paymentMethod]?.mode ?? labels.paymentReady}
          reference={currentOrder.paymentInstruction.reference || currentOrder.orderNo}
          qrValue={currentOrder.paymentInstruction.qrContent || currentOrder.orderNo}
          loading={checkoutOrder.loading}
          details={modalDetails}
          footer={
            <div className="payment-code-modal__actions">
              {canMarkPaid(currentOrder) ? (
                <Button type="primary" loading={checkoutOrder.loading} onClick={() => void handleMarkPaid()}>
                  {labels.markPaid}
                </Button>
              ) : null}
              {canCancel(currentOrder) ? (
                <Button danger loading={checkoutOrder.loading} onClick={() => void handleCancelOrder()}>
                  {labels.cancelOrder}
                </Button>
              ) : null}
            </div>
          }
          onClose={() => setPaymentModalOpen(false)}
        />
      ) : null}
    </div>
  )

  async function handleSelectPayment(method: PaymentMethodKey) {
    if (checkoutOrder.loading) {
      return
    }

    const nextOrder = await checkoutOrder.createOrder({
      paymentMethod: method,
      priceOption: selectedPriceOption,
    })

    if (nextOrder) {
      setPaymentModalOpen(true)
    }
  }

  async function handleLookupOrder(values: { orderNo: string; accessToken: string }) {
    const nextOrder = await checkoutOrder.lookupOrder(values)

    if (nextOrder) {
      setPaymentModalOpen(Boolean(nextOrder.paymentInstruction))
      message.success(labels.lookupSuccess)
    }
  }

  async function handleRefreshOrder() {
    const nextOrder = await checkoutOrder.refreshOrder()

    if (nextOrder) {
      message.success(labels.orderUpdated)
    }
  }

  async function handleMarkPaid() {
    const nextOrder = await checkoutOrder.markPaid()

    if (nextOrder) {
      message.success(labels.paymentMarked)
    }
  }

  async function handleSubmitPaymentProof(values: UploadPaymentProofInput) {
    const nextOrder = await checkoutOrder.submitPaymentProof(values)

    if (nextOrder) {
      message.success(labels.paymentProofUploaded)
    }
  }

  async function handleSubmitSupportTicket(values: {
    subject: string
    content: string
    priority: 'low' | 'normal' | 'high' | 'urgent'
  }) {
    try {
      await support.createTicket(values)
      message.success(labels.supportTicketCreated)
    } catch {
      // The support panel already surfaces request errors inline.
    }
  }

  async function handleCancelOrder() {
    const nextOrder = await checkoutOrder.cancelOrder()

    if (nextOrder) {
      message.success(labels.orderCancelled)
      setPaymentModalOpen(false)
    }
  }

  async function handleLoadDeliveryResult() {
    const nextResult = await checkoutOrder.loadDeliveryResult()

    if (nextResult) {
      message.success(labels.deliveryResultLoaded)
    }
  }
}

function buildOrderItems(
  order: StorefrontOrderSnapshot | null,
  product: StorefrontProduct,
  paymentChannelMap: Record<PaymentMethodKey, PaymentChannel>,
  locale: Locale,
  labels: ReturnType<typeof getCheckoutLabels>,
) {
  if (!order) {
    return []
  }

  return [
    { label: labels.orderNo, value: order.orderNo },
    { label: labels.accessToken, value: order.orderAccessToken || '-' },
    { label: labels.orderStatus, value: formatStorefrontOrderStatus(order.orderStatus, locale) },
    { label: labels.paymentStatus, value: formatStorefrontPaymentStatus(order.paymentStatus, locale) },
    { label: labels.deliveryStatus, value: formatStorefrontDeliveryStatus(order.deliveryStatus, locale) },
    {
      label: labels.amount,
      value: `${order.displayAmount || product.price} ${order.currency || product.currency}`,
    },
    ...(order.billingCycle
      ? [
          {
            label: getBillingFieldLabel(locale),
            value: formatBillingCycleLabel(order.billingCycle, order.templateName, locale),
          },
        ]
      : []),
    {
      label: labels.channel,
      value: paymentChannelMap[order.paymentMethod]?.label ?? order.paymentMethod,
    },
  ]
}

function buildModalDetails(
  order: StorefrontOrderSnapshot | null,
  product: StorefrontProduct,
  locale: Locale,
  labels: ReturnType<typeof getCheckoutLabels>,
) {
  if (!order) {
    return []
  }

  return [
    { key: 'orderNo', label: labels.orderNo, value: order.orderNo },
    { key: 'accessToken', label: labels.accessToken, value: order.orderAccessToken || '-' },
    {
      key: 'amount',
      label: labels.amount,
      value: `${order.displayAmount || product.price} ${order.currency || product.currency}`,
    },
    ...(order.billingCycle
      ? [
          {
            key: 'billingCycle',
            label: getBillingFieldLabel(locale),
            value: formatBillingCycleLabel(order.billingCycle, order.templateName, locale),
          },
        ]
      : []),
    {
      key: 'paymentStatus',
      label: labels.paymentStatus,
      value: formatStorefrontPaymentStatus(order.paymentStatus, locale),
    },
    {
      key: 'expiresAt',
      label: labels.expiresAt,
      value: formatStorefrontDateTime(order.paymentInstruction?.expireAt ?? '', locale),
    },
  ]
}

function canMarkPaid(order: Pick<StorefrontOrderSnapshot, 'paymentStatus' | 'orderStatus'>) {
  return order.paymentStatus === 'unpaid' && order.orderStatus !== 'cancelled'
}

function canCancel(order: Pick<StorefrontOrderSnapshot, 'orderStatus'>) {
  return !['cancelled', 'completed', 'refunded'].includes(order.orderStatus)
}

function getCheckoutLabels(locale: Locale) {
  return {
    currentOrder: locale === 'zh-CN' ? '当前订单' : 'Current order',
    refresh: locale === 'zh-CN' ? '刷新状态' : 'Refresh',
    markPaid: locale === 'zh-CN' ? '我已付款' : 'I have paid',
    cancelOrder: locale === 'zh-CN' ? '取消订单' : 'Cancel order',
    orderNo: locale === 'zh-CN' ? '订单号' : 'Order no.',
    accessToken: locale === 'zh-CN' ? '查单码' : 'Access token',
    orderStatus: locale === 'zh-CN' ? '订单状态' : 'Order status',
    paymentStatus: locale === 'zh-CN' ? '支付状态' : 'Payment status',
    deliveryStatus: locale === 'zh-CN' ? '交付状态' : 'Delivery status',
    amount: locale === 'zh-CN' ? '金额' : 'Amount',
    channel: locale === 'zh-CN' ? '支付渠道' : 'Payment channel',
    expiresAt: locale === 'zh-CN' ? '过期时间' : 'Expires at',
    activePayment: locale === 'zh-CN' ? '订单中' : 'Live',
    loadingCatalog: locale === 'zh-CN' ? '加载中...' : 'Loading...',
    paymentReady: locale === 'zh-CN' ? '扫码支付' : 'QR payment',
    orderUpdated: locale === 'zh-CN' ? '订单状态已刷新' : 'Order status refreshed',
    paymentMarked: locale === 'zh-CN' ? '已标记为已付款' : 'Marked as paid',
    paymentProofUploaded: locale === 'zh-CN' ? '付款凭证已提交' : 'Payment proof submitted',
    lookupSuccess: locale === 'zh-CN' ? '订单已载入' : 'Order loaded',
    orderCancelled: locale === 'zh-CN' ? '订单已取消' : 'Order cancelled',
    supportTicketCreated: locale === 'zh-CN' ? '工单已提交，支持中心会继续跟进。' : 'Support ticket submitted.',
    deliveryResult: locale === 'zh-CN' ? '交付结果' : 'Delivery result',
    loadDeliveryResult: locale === 'zh-CN' ? '拉取结果' : 'Load result',
    deliveryResultLoaded: locale === 'zh-CN' ? '交付结果已刷新' : 'Delivery result loaded',
    deliveryResultEmpty: locale === 'zh-CN' ? '当前还没有可展示的交付结果。' : 'No delivery result is available yet.',
    remoteReady: locale === 'zh-CN' ? '远程接口' : 'Remote API',
    localFallback: locale === 'zh-CN' ? '本地兜底' : 'Local fallback',
    localDraft: locale === 'zh-CN' ? '本地草稿' : 'Local draft',
    remoteUnavailable: locale === 'zh-CN' ? '远程不可用' : 'Remote unavailable',
  }
}

function getOrderSourceLabel(
  labels: ReturnType<typeof getCheckoutLabels>,
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

function resolveSelectedPriceOption(priceOptions: StorefrontProductPriceOption[], selectedKey: string) {
  return priceOptions.find((option) => option.key === selectedKey) ?? priceOptions[0] ?? null
}

function getEnabledPaymentMethods(
  product: StorefrontProduct,
  selectedPriceOption: StorefrontProductPriceOption | null,
  paymentChannelMap: Record<PaymentMethodKey, PaymentChannel>,
) {
  const allowedMethods =
    selectedPriceOption?.paymentMethods.length ? selectedPriceOption.paymentMethods : product.paymentMethods

  return product.paymentMethods.filter(
    (method) => allowedMethods.includes(method) && paymentChannelMap[method]?.enabled,
  )
}

function formatBillingCycleLabel(value: string | undefined, fallback: string | undefined, locale: Locale) {
  switch ((value ?? '').trim().toLowerCase()) {
    case 'monthly':
      return locale === 'zh-CN' ? '按月' : 'Monthly'
    case 'quarterly':
      return locale === 'zh-CN' ? '按季度' : 'Quarterly'
    case 'yearly':
    case 'annual':
      return locale === 'zh-CN' ? '按年' : 'Yearly'
    case 'one_time':
    case 'one-time':
      return locale === 'zh-CN' ? '一次性' : 'One-time'
    case 'default':
      return fallback || (locale === 'zh-CN' ? '默认方案' : 'Default plan')
    default:
      return fallback || value || (locale === 'zh-CN' ? '默认方案' : 'Default plan')
  }
}

function getBillingFieldLabel(locale: Locale) {
  return locale === 'zh-CN' ? '计费周期' : 'Billing'
}
