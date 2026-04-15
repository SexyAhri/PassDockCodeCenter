import { Alert, App, Button, Empty, Form, Input, Select, Tag } from 'antd'

import { PageHeader } from '../../components/common/PageHeader'
import { CheckoutCompactList } from '../../components/store/CheckoutCompactList'
import { CheckoutKeyValueGrid } from '../../components/store/CheckoutKeyValueGrid'
import { CheckoutSection } from '../../components/store/CheckoutSection'
import { DetailRecordSection } from '../../components/store/DetailRecordSection'
import { StorefrontPaymentProofList } from '../../components/store/StorefrontPaymentProofList'
import { useStorefrontAccountCenter } from '../../hooks/useStorefrontAccountCenter'
import type { StorefrontSession } from '../../hooks/useStorefrontSession'
import type { Locale } from '../../i18n/copy'
import {
  formatStorefrontDateTime,
  formatStorefrontDeliveryStatus,
  formatStorefrontOrderStatus,
  formatStorefrontPaymentStatus,
  getStorefrontDeliveryResultFieldLabels,
  getStorefrontDeliveryResultPreferredKeys,
} from '../../storefront/orders/presentation'

type StorefrontAccountPageProps = {
  locale: Locale
  session: StorefrontSession | null
  onNavigate: (to: string) => void
  onLogout: () => void
}

type TicketFormValues = {
  orderNo?: string
  subject: string
  content: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
}

export function StorefrontAccountPage(props: StorefrontAccountPageProps) {
  const { locale, session, onNavigate, onLogout } = props
  const { message } = App.useApp()
  const [ticketForm] = Form.useForm<TicketFormValues>()
  const labels = getLabels(locale)
  const account = useStorefrontAccountCenter(session)
  const selectedOrderSummary = account.orders.find((item) => item.orderNo === account.selectedOrderNo) ?? null

  const stats = [
    { key: 'orders', label: labels.stats.orders, value: String(account.orders.length).padStart(2, '0') },
    {
      key: 'awaiting',
      label: labels.stats.awaiting,
      value: String(account.orders.filter((item) => item.paymentStatus === 'unpaid').length).padStart(2, '0'),
    },
    {
      key: 'tickets',
      label: labels.stats.tickets,
      value: String(account.tickets.filter((item) => item.status !== 'closed').length).padStart(2, '0'),
    },
    {
      key: 'delivered',
      label: labels.stats.delivered,
      value: String(
        account.orders.filter((item) =>
          ['sent'].includes(item.deliveryStatus) || ['completed', 'delivered'].includes(item.orderStatus),
        ).length,
      ).padStart(2, '0'),
    },
  ]

  const profileItems = [
    { label: labels.fields.name, value: account.profile?.name || session?.name || '-' },
    { label: labels.fields.email, value: account.profile?.email || session?.email || '-' },
    { label: labels.fields.role, value: account.profile?.role || session?.role || '-' },
    { label: labels.fields.status, value: formatAccountStatus(account.profile?.status, locale) },
    { label: labels.fields.locale, value: account.profile?.locale || locale },
    {
      label: labels.fields.lastLogin,
      value: formatStorefrontDateTime(account.profile?.lastLoginAt || '', locale),
    },
  ]

  const orderItems = account.orders.map((order) => ({
    id: order.orderNo,
    title: order.productName || order.orderNo,
    meta: [
      order.orderNo,
      formatStorefrontPaymentStatus(order.paymentStatus, locale),
      `${order.displayAmount} ${order.currency}`.trim(),
    ]
      .filter(Boolean)
      .join(' | '),
    action: () => void account.selectOrder(order.orderNo),
    active: order.orderNo === account.selectedOrderNo,
    aside: (
      <span className="checkout-compact-list__badge">
        {formatStorefrontOrderStatus(order.orderStatus, locale)}
      </span>
    ),
  }))

  const ticketItems = account.tickets.map((ticket) => ({
    id: ticket.ticketNo,
    title: `${ticket.ticketNo} | ${ticket.subject}`,
    meta: [
      ticket.orderNo || labels.noOrder,
      formatTicketPriority(ticket.priority, locale),
      ticket.resolutionNote || ticket.updatedAt || ticket.createdAt,
    ]
      .filter(Boolean)
      .join(' | '),
    aside: <span className="checkout-compact-list__badge">{formatTicketStatus(ticket.status, locale)}</span>,
  }))

  const orderDetailItems = account.selectedOrder
    ? [
        { label: labels.fields.orderNo, value: account.selectedOrder.orderNo },
        { label: labels.fields.product, value: selectedOrderSummary?.productName || '-' },
        {
          label: labels.fields.amount,
          value: `${account.selectedOrder.displayAmount} ${account.selectedOrder.currency}`.trim(),
        },
        {
          label: labels.fields.orderStatus,
          value: formatStorefrontOrderStatus(account.selectedOrder.orderStatus, locale),
        },
        {
          label: labels.fields.paymentStatus,
          value: formatStorefrontPaymentStatus(account.selectedOrder.paymentStatus, locale),
        },
        {
          label: labels.fields.deliveryStatus,
          value: formatStorefrontDeliveryStatus(account.selectedOrder.deliveryStatus, locale),
        },
        {
          label: labels.fields.billing,
          value: account.selectedOrder.templateName || account.selectedOrder.billingCycle || '-',
        },
        {
          label: labels.fields.buyerRef,
          value: account.selectedOrder.buyerRef || '-',
        },
      ]
    : []

  async function handleSubmitTicket(values: TicketFormValues) {
    try {
      await account.createTicket(values)
      ticketForm.resetFields()
      ticketForm.setFieldValue('priority', 'normal')
      message.success(labels.ticketCreated)
    } catch {
      // The hook already exposes the error.
    }
  }

  return (
    <div className="store-page store-page--account">
      <PageHeader
        title={labels.title}
        subtitle={labels.subtitle}
        extra={
          <div className="checkout-order__actions">
            <Button onClick={() => onNavigate('/orders')}>{labels.orderCenter}</Button>
            <Button onClick={onLogout}>{labels.logout}</Button>
          </div>
        }
      />

      <section className="store-orders-summary">
        {stats.map((item) => (
          <article key={item.key} className="store-orders-summary__card">
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </article>
        ))}
      </section>

      {account.error ? (
        <Alert showIcon type="warning" message={account.error} closable onClose={account.clearError} />
      ) : null}

      {!account.remoteEnabled ? <Alert showIcon type="info" message={labels.previewMode} /> : null}

      <div className="store-orders-workbench">
        <div className="store-orders-sidebar">
          <CheckoutSection
            title={labels.profileTitle}
            extra={
              <Button size="small" loading={account.loading} onClick={() => void account.reload()}>
                {labels.refresh}
              </Button>
            }
          >
            <CheckoutKeyValueGrid items={profileItems} compact />
          </CheckoutSection>

          <CheckoutSection title={labels.ticketComposerTitle}>
            <Form<TicketFormValues>
              form={ticketForm}
              layout="vertical"
              size="small"
              className="checkout-form"
              disabled={!account.remoteEnabled || account.submitting}
              initialValues={{ priority: 'normal' }}
              onFinish={handleSubmitTicket}
            >
              <Form.Item name="orderNo" label={labels.fields.orderLink}>
                <Select
                  allowClear
                  placeholder={labels.orderPlaceholder}
                  options={account.orders.map((order) => ({
                    value: order.orderNo,
                    label: `${order.orderNo} | ${order.productName || order.productSku || '-'}`,
                  }))}
                />
              </Form.Item>

              <div className="checkout-form__grid">
                <Form.Item
                  name="subject"
                  label={labels.fields.subject}
                  rules={[{ required: true, message: labels.subjectRequired }]}
                >
                  <Input placeholder={labels.subjectPlaceholder} />
                </Form.Item>

                <Form.Item
                  name="priority"
                  label={labels.fields.priority}
                  rules={[{ required: true, message: labels.priorityRequired }]}
                >
                  <Select options={buildPriorityOptions(locale)} />
                </Form.Item>
              </div>

              <Form.Item
                name="content"
                label={labels.fields.content}
                rules={[{ required: true, message: labels.contentRequired }]}
              >
                <Input.TextArea rows={4} placeholder={labels.contentPlaceholder} />
              </Form.Item>

              <div className="checkout-form__actions">
                <Button type="primary" htmlType="submit" loading={account.submitting}>
                  {labels.submitTicket}
                </Button>
              </div>
            </Form>
          </CheckoutSection>

          <CheckoutSection title={labels.ticketHistoryTitle}>
            {ticketItems.length ? (
              <CheckoutCompactList items={ticketItems} />
            ) : (
              <div className="store-orders-empty store-orders-empty--inline">{labels.noTickets}</div>
            )}
          </CheckoutSection>
        </div>

        <div className="store-orders-main">
          <CheckoutSection title={labels.orderListTitle}>
            {orderItems.length ? (
              <CheckoutCompactList items={orderItems} />
            ) : (
              <div className="store-orders-empty">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={labels.noOrders} />
              </div>
            )}
          </CheckoutSection>

          <CheckoutSection
            title={labels.orderDetailTitle}
            extra={
              account.selectedOrder ? (
                <div className="checkout-order__actions">
                  <Tag color="blue">{selectedOrderSummary?.productSku || '-'}</Tag>
                  <Button size="small" loading={account.loading} onClick={() => void account.reload()}>
                    {labels.refresh}
                  </Button>
                  <Button size="small" loading={account.loading} onClick={() => void account.loadDeliveryResult()}>
                    {labels.loadDeliveryResult}
                  </Button>
                </div>
              ) : null
            }
          >
            {account.selectedOrder ? (
              <CheckoutKeyValueGrid items={orderDetailItems} compact />
            ) : (
              <div className="store-orders-empty store-orders-empty--inline">{labels.selectOrder}</div>
            )}
          </CheckoutSection>

          {account.selectedOrder ? (
            <DetailRecordSection
              title={labels.deliveryResultTitle}
              emptyText={labels.deliveryResultEmpty}
              data={account.deliveryResult}
              fieldLabels={getStorefrontDeliveryResultFieldLabels(locale)}
              preferredKeys={getStorefrontDeliveryResultPreferredKeys()}
            />
          ) : null}

          {account.selectedOrder?.paymentProofs.length ? (
            <CheckoutSection title={labels.paymentProofsTitle}>
              <StorefrontPaymentProofList locale={locale} proofs={account.selectedOrder.paymentProofs} subtle />
            </CheckoutSection>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function getLabels(locale: Locale) {
  const isZh = locale === 'zh-CN'

  return {
    title: isZh ? '账户中心' : 'Account center',
    subtitle: isZh ? '统一查看我的订单、凭证和售后记录。' : 'Review your orders, payment proofs, and support records.',
    orderCenter: isZh ? '订单查询页' : 'Order center',
    logout: isZh ? '退出登录' : 'Log out',
    refresh: isZh ? '刷新' : 'Refresh',
    previewMode: isZh ? '当前为本地预览模式，真实账户数据需要远程 API。' : 'You are in local preview mode. Real account data requires the remote API.',
    profileTitle: isZh ? '账户资料' : 'Profile',
    orderListTitle: isZh ? '我的订单' : 'My orders',
    orderDetailTitle: isZh ? '订单详情' : 'Order detail',
    ticketComposerTitle: isZh ? '提交工单' : 'Create ticket',
    ticketHistoryTitle: isZh ? '支持记录' : 'Support history',
    paymentProofsTitle: isZh ? '付款凭证' : 'Payment proofs',
    deliveryResultTitle: isZh ? '交付结果' : 'Delivery result',
    deliveryResultEmpty: isZh ? '当前还没有可展示的交付结果。' : 'No delivery result is available yet.',
    loadDeliveryResult: isZh ? '拉取结果' : 'Load result',
    selectOrder: isZh ? '从上方订单列表选择一笔订单查看详情。' : 'Select an order above to inspect the detail.',
    noOrders: isZh ? '当前账户还没有订单。' : 'No orders for this account yet.',
    noTickets: isZh ? '当前账户还没有支持记录。' : 'No support records for this account yet.',
    noOrder: isZh ? '未关联订单' : 'No linked order',
    submitTicket: isZh ? '提交工单' : 'Submit ticket',
    ticketCreated: isZh ? '工单已提交。' : 'Support ticket submitted.',
    orderPlaceholder: isZh ? '可选，关联到某笔订单' : 'Optional linked order',
    subjectRequired: isZh ? '请输入工单标题' : 'Please enter a subject',
    priorityRequired: isZh ? '请选择优先级' : 'Please select a priority',
    contentRequired: isZh ? '请输入问题描述' : 'Please enter a description',
    subjectPlaceholder: isZh ? '例如：付款后未自动发码' : 'For example: delivery did not arrive after payment',
    contentPlaceholder: isZh ? '描述问题现象、预期结果以及你已经尝试过的操作。' : 'Describe the issue, expected result, and what you have tried.',
    stats: {
      orders: isZh ? '累计订单' : 'Orders',
      awaiting: isZh ? '待支付' : 'Awaiting payment',
      tickets: isZh ? '处理中工单' : 'Active tickets',
      delivered: isZh ? '已交付' : 'Delivered',
    },
    fields: {
      name: isZh ? '名称' : 'Name',
      email: isZh ? '邮箱' : 'Email',
      role: isZh ? '角色' : 'Role',
      status: isZh ? '状态' : 'Status',
      locale: isZh ? '语言' : 'Locale',
      lastLogin: isZh ? '最近登录' : 'Last login',
      orderNo: isZh ? '订单号' : 'Order no.',
      product: isZh ? '商品' : 'Product',
      amount: isZh ? '金额' : 'Amount',
      orderStatus: isZh ? '订单状态' : 'Order status',
      paymentStatus: isZh ? '支付状态' : 'Payment status',
      deliveryStatus: isZh ? '交付状态' : 'Delivery status',
      billing: isZh ? '方案' : 'Plan',
      buyerRef: isZh ? '买家标识' : 'Buyer ref',
      orderLink: isZh ? '关联订单' : 'Order link',
      subject: isZh ? '标题' : 'Subject',
      priority: isZh ? '优先级' : 'Priority',
      content: isZh ? '内容' : 'Content',
    },
  }
}

function buildPriorityOptions(locale: Locale) {
  return [
    { value: 'normal', label: formatTicketPriority('normal', locale) },
    { value: 'high', label: formatTicketPriority('high', locale) },
    { value: 'urgent', label: formatTicketPriority('urgent', locale) },
    { value: 'low', label: formatTicketPriority('low', locale) },
  ]
}

function formatTicketPriority(value: TicketFormValues['priority'], locale: Locale) {
  if (locale === 'zh-CN') {
    return {
      low: '低',
      normal: '普通',
      high: '高',
      urgent: '紧急',
    }[value]
  }

  return {
    low: 'Low',
    normal: 'Normal',
    high: 'High',
    urgent: 'Urgent',
  }[value]
}

function formatTicketStatus(value: 'open' | 'processing' | 'resolved' | 'closed', locale: Locale) {
  if (locale === 'zh-CN') {
    return {
      open: '待处理',
      processing: '处理中',
      resolved: '已解决',
      closed: '已关闭',
    }[value]
  }

  return {
    open: 'Open',
    processing: 'Processing',
    resolved: 'Resolved',
    closed: 'Closed',
  }[value]
}

function formatAccountStatus(value: string | undefined, locale: Locale) {
  switch ((value ?? '').trim().toLowerCase()) {
    case 'active':
      return locale === 'zh-CN' ? '正常' : 'Active'
    case 'preview':
      return locale === 'zh-CN' ? '预览模式' : 'Preview'
    default:
      return value || (locale === 'zh-CN' ? '未设置' : 'Unknown')
  }
}
