import type { Locale } from '../i18n/copy'

type LocalizedText = Record<Locale, string>

export type OrderStatusKey =
  | 'created'
  | 'awaiting_payment'
  | 'paid_pending_review'
  | 'payment_confirmed'
  | 'issuing'
  | 'issued'
  | 'delivery_pending'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'failed'
  | 'refunded'

export type PaymentStatusKey = 'unpaid' | 'pending_review' | 'paid' | 'failed' | 'refunded'
export type PaymentProofReviewStatusKey = 'pending' | 'approved' | 'rejected'
export type DeliveryStatusKey = 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled'
export type SourceChannelKey = 'web' | 'telegram' | 'admin' | 'api'
export type DeliveryChannelKey = 'web' | 'telegram' | 'email' | 'manual'
export type CodeIssueStatusKey = 'pending' | 'success' | 'failed'
export type FulfillmentTypeKey =
  | 'issue_code'
  | 'issue_subscription'
  | 'issue_license'
  | 'credit_account'
  | 'call_webhook'
  | 'manual_delivery'
export type FulfillmentStatusKey = 'pending' | 'running' | 'success' | 'failed' | 'cancelled'
export type TicketStatusKey = 'open' | 'processing' | 'resolved' | 'closed'
export type TicketPriorityKey = 'low' | 'normal' | 'high' | 'urgent'
export type UserTierKey = 'active' | 'vip'

type OrderConfig = {
  id: string
  orderNo: string
  product: LocalizedText
  customer: string
  amount: string
  paymentMethod: 'wechat_qr' | 'alipay_qr' | 'okx_usdt'
  paymentStatus: PaymentStatusKey
  orderStatus: OrderStatusKey
  deliveryStatus: DeliveryStatusKey
  deliveryChannel?: DeliveryChannelKey
  deliveryRecordId?: string
  sourceChannel: SourceChannelKey
  buyerRef: string
  createdAt: string
  paidAt?: string
}

type PaymentRecordConfig = {
  id: string
  orderNo: string
  paymentMethod: 'wechat_qr' | 'alipay_qr' | 'okx_usdt'
  channelKey: string
  amount: string
  currency: string
  status: PaymentStatusKey
  payerAccount: string
  confirmedAt: string
}

type PaymentProofConfig = {
  id: string
  orderNo: string
  proofType: string
  objectUrl: string
  reviewStatus: PaymentProofReviewStatusKey
  note: string
  paymentMethod: 'wechat_qr' | 'alipay_qr' | 'okx_usdt'
  amount: string
  currency: string
  sourceChannel: SourceChannelKey
  buyerRef: string
  createdAt: string
  reviewedAt: string
}

type CallbackLogConfig = {
  id: string
  channelKey: string
  orderNo: string
  status: 'success' | 'warning' | 'error'
  message: LocalizedText
  createdAt: string
}

type WatcherRecordConfig = {
  id: string
  orderNo: string
  hash: string
  amount: string
  status: 'pending' | 'matched' | 'manual_review'
  confirmedAt: string
}

type FulfillmentRecordConfig = {
  id: string
  orderNo: string
  strategy: string
  fulfillmentType: FulfillmentTypeKey
  provider: string
  actionKey: string
  status: FulfillmentStatusKey
  deliveryChannel: DeliveryChannelKey
  target: string
  startedAt: string
  finishedAt: string
}

type CodeIssueRecordConfig = {
  id: string
  orderNo: string
  codeType: string
  issueStatus: CodeIssueStatusKey
  provider: string
  actionKey: string
  issuedCount: number
  maskedPreview: string
  errorMessage: string
  issuedAt: string
}

type CustomerConfig = {
  id: string
  name: string
  region: LocalizedText
  orders: number
  spend: string
  tier: UserTierKey
  lastOrder: string
}

type TicketConfig = {
  id: string
  ticketNo: string
  subject: LocalizedText
  customer: string
  priority: TicketPriorityKey
  status: TicketStatusKey
  assignedTo: string
  createdAt: string
}

type ChannelRevenueConfig = {
  key: string
  label: LocalizedText
  value: string
  trend: string
}

export type AdminOrder = {
  key: string
  orderNo: string
  product: string
  customer: string
  amount: string
  paymentMethod: OrderConfig['paymentMethod']
  paymentStatus: PaymentStatusKey
  orderStatus: OrderStatusKey
  deliveryStatus: DeliveryStatusKey
  deliveryChannel?: DeliveryChannelKey
  deliveryRecordId?: string
  sourceChannel: SourceChannelKey
  buyerRef: string
  createdAt: string
  paidAt: string
}

export type AdminPaymentRecord = {
  key: string
  orderNo: string
  paymentMethod: PaymentRecordConfig['paymentMethod']
  channelKey: string
  amount: string
  currency: string
  status: PaymentStatusKey
  payerAccount: string
  confirmedAt: string
}

export type AdminPaymentProof = {
  key: string
  orderNo: string
  proofType: string
  objectUrl: string
  reviewStatus: PaymentProofReviewStatusKey
  note: string
  paymentMethod: PaymentProofConfig['paymentMethod']
  amount: string
  currency: string
  sourceChannel: SourceChannelKey
  buyerRef: string
  createdAt: string
  reviewedAt: string
}

export type AdminCallbackLog = {
  key: string
  channelKey: string
  orderNo: string
  status: CallbackLogConfig['status']
  message: string
  createdAt: string
}

export type AdminWatcherRecord = {
  key: string
  orderNo: string
  hash: string
  amount: string
  status: WatcherRecordConfig['status']
  confirmedAt: string
}

export type AdminFulfillmentRecord = {
  key: string
  orderNo: string
  strategy: string
  fulfillmentType: FulfillmentTypeKey
  provider: string
  actionKey: string
  status: FulfillmentStatusKey
  deliveryChannel: DeliveryChannelKey
  target: string
  startedAt: string
  finishedAt: string
}

export type AdminCodeIssueRecord = {
  key: string
  orderNo: string
  codeType: string
  issueStatus: CodeIssueStatusKey
  provider: string
  actionKey: string
  issuedCount: number
  maskedPreview: string
  errorMessage: string
  issuedAt: string
}

export type AdminCustomer = {
  key: string
  name: string
  region: string
  orders: number
  spend: string
  tier: UserTierKey
  lastOrder: string
}

export type AdminTicket = {
  key: string
  ticketNo: string
  subject: string
  customer: string
  priority: TicketPriorityKey
  status: TicketStatusKey
  assignedTo: string
  createdAt: string
}

export type AdminChannelRevenue = {
  key: string
  label: string
  value: string
  trend: string
}

export const dashboardSnapshot = {
  revenueToday: '8,420',
  paidOrders: 126,
  paymentReviews: 7,
  fulfillmentSuccess: 98.4,
  deliverySuccess: 96.8,
  activeChannels: 3,
  providerHealth: 3,
  openTickets: 5,
} as const

const orderConfigs: OrderConfig[] = [
  {
    id: 'ord_10001',
    orderNo: 'PD-240412-1001',
    product: { 'zh-CN': '专业月卡', 'en-US': 'Pro Monthly' },
    customer: 'Aster Group',
    amount: '5.49 USDT',
    paymentMethod: 'okx_usdt',
    paymentStatus: 'paid',
    orderStatus: 'completed',
    deliveryStatus: 'sent',
    deliveryChannel: 'telegram',
    sourceChannel: 'web',
    buyerRef: 'tg:1023001',
    createdAt: '2026-04-12 10:18',
    paidAt: '2026-04-12 10:22',
  },
  {
    id: 'ord_10002',
    orderNo: 'PD-240412-1002',
    product: { 'zh-CN': '团队季卡', 'en-US': 'Team Quarterly' },
    customer: 'Northwind Ops',
    amount: '88.00 RMB',
    paymentMethod: 'alipay_qr',
    paymentStatus: 'paid',
    orderStatus: 'issuing',
    deliveryStatus: 'sending',
    deliveryChannel: 'web',
    sourceChannel: 'telegram',
    buyerRef: 'tg:2031889',
    createdAt: '2026-04-12 09:42',
    paidAt: '2026-04-12 09:55',
  },
  {
    id: 'ord_10003',
    orderNo: 'PD-240412-1003',
    product: { 'zh-CN': '企业年包', 'en-US': 'Enterprise Annual' },
    customer: 'Orbital Commerce',
    amount: '168.00 RMB',
    paymentMethod: 'wechat_qr',
    paymentStatus: 'pending_review',
    orderStatus: 'paid_pending_review',
    deliveryStatus: 'pending',
    deliveryChannel: 'manual',
    sourceChannel: 'web',
    buyerRef: 'web:orbital-commerce',
    createdAt: '2026-04-12 08:56',
    paidAt: '2026-04-12 09:01',
  },
  {
    id: 'ord_10004',
    orderNo: 'PD-240412-1004',
    product: { 'zh-CN': '试用充值包', 'en-US': 'Trial Credit Pack' },
    customer: 'Nova Lab',
    amount: '0.15 USDT',
    paymentMethod: 'okx_usdt',
    paymentStatus: 'pending_review',
    orderStatus: 'awaiting_payment',
    deliveryStatus: 'pending',
    deliveryChannel: 'web',
    sourceChannel: 'web',
    buyerRef: 'web:nova-lab',
    createdAt: '2026-04-12 11:08',
    paidAt: '',
  },
  {
    id: 'ord_10005',
    orderNo: 'PD-240412-1005',
    product: { 'zh-CN': '入门月卡', 'en-US': 'Starter Monthly' },
    customer: 'Signal Forge',
    amount: '15.00 RMB',
    paymentMethod: 'wechat_qr',
    paymentStatus: 'refunded',
    orderStatus: 'refunded',
    deliveryStatus: 'cancelled',
    deliveryChannel: 'web',
    sourceChannel: 'admin',
    buyerRef: 'crm:signal-forge',
    createdAt: '2026-04-12 07:34',
    paidAt: '2026-04-12 07:48',
  },
]

const paymentRecordConfigs: PaymentRecordConfig[] = [
  {
    id: 'pay_10001',
    orderNo: 'PD-240412-1001',
    paymentMethod: 'okx_usdt',
    channelKey: 'okx_usdt_watch',
    amount: '5.49',
    currency: 'USDT',
    status: 'paid',
    payerAccount: '0x98...19d2',
    confirmedAt: '2026-04-12 10:22',
  },
  {
    id: 'pay_10002',
    orderNo: 'PD-240412-1002',
    paymentMethod: 'alipay_qr',
    channelKey: 'alipay_qr_main',
    amount: '88.00',
    currency: 'RMB',
    status: 'paid',
    payerAccount: 'northwind@alipay',
    confirmedAt: '2026-04-12 09:55',
  },
  {
    id: 'pay_10003',
    orderNo: 'PD-240412-1003',
    paymentMethod: 'wechat_qr',
    channelKey: 'wechat_qr_main',
    amount: '168.00',
    currency: 'RMB',
    status: 'pending_review',
    payerAccount: 'wxid_orbital',
    confirmedAt: '2026-04-12 09:01',
  },
  {
    id: 'pay_10004',
    orderNo: 'PD-240412-1004',
    paymentMethod: 'okx_usdt',
    channelKey: 'okx_usdt_watch',
    amount: '0.15',
    currency: 'USDT',
    status: 'pending_review',
    payerAccount: 'TRC20 memo pending',
    confirmedAt: '2026-04-12 11:10',
  },
  {
    id: 'pay_10005',
    orderNo: 'PD-240412-1005',
    paymentMethod: 'wechat_qr',
    channelKey: 'wechat_qr_main',
    amount: '15.00',
    currency: 'RMB',
    status: 'refunded',
    payerAccount: 'signalforge@wechat',
    confirmedAt: '2026-04-12 07:48',
  },
]

const paymentProofConfigs: PaymentProofConfig[] = [
  {
    id: 'proof_1001',
    orderNo: 'PD-240412-1003',
    proofType: 'screenshot',
    objectUrl: 'https://assets.example.com/proofs/orbital-commerce.png',
    reviewStatus: 'pending',
    note: 'Buyer uploaded a bank screenshot for manual review.',
    paymentMethod: 'wechat_qr',
    amount: '168.00',
    currency: 'RMB',
    sourceChannel: 'web',
    buyerRef: 'web:orbital-commerce',
    createdAt: '2026-04-12 09:01',
    reviewedAt: '',
  },
  {
    id: 'proof_1002',
    orderNo: 'PD-240412-1004',
    proofType: 'tx_hash',
    objectUrl: 'https://assets.example.com/proofs/nova-lab-usdt.txt',
    reviewStatus: 'pending',
    note: 'Buyer submitted a TRC20 transfer reference.',
    paymentMethod: 'okx_usdt',
    amount: '0.15',
    currency: 'USDT',
    sourceChannel: 'web',
    buyerRef: 'web:nova-lab',
    createdAt: '2026-04-12 11:09',
    reviewedAt: '',
  },
  {
    id: 'proof_1003',
    orderNo: 'PD-240412-1002',
    proofType: 'receipt',
    objectUrl: 'https://assets.example.com/proofs/northwind-alipay.png',
    reviewStatus: 'approved',
    note: 'Operator validated the Alipay receipt.',
    paymentMethod: 'alipay_qr',
    amount: '88.00',
    currency: 'RMB',
    sourceChannel: 'telegram',
    buyerRef: 'tg:2031889',
    createdAt: '2026-04-12 09:53',
    reviewedAt: '2026-04-12 09:55',
  },
]

const callbackLogConfigs: CallbackLogConfig[] = [
  {
    id: 'cb_1001',
    channelKey: 'okx_usdt_watch',
    orderNo: 'PD-240412-1001',
    status: 'success',
    message: {
      'zh-CN': '链上确认成功，已进入履约队列。',
      'en-US': 'On-chain confirmation succeeded and moved to fulfillment queue.',
    },
    createdAt: '2026-04-12 10:22',
  },
  {
    id: 'cb_1002',
    channelKey: 'alipay_qr_main',
    orderNo: 'PD-240412-1002',
    status: 'success',
    message: {
      'zh-CN': '人工审核通过，订单进入发码流程。',
      'en-US': 'Manual review approved and the order moved to issuance.',
    },
    createdAt: '2026-04-12 09:56',
  },
  {
    id: 'cb_1003',
    channelKey: 'wechat_qr_main',
    orderNo: 'PD-240412-1003',
    status: 'warning',
    message: {
      'zh-CN': '用户已标记付款，等待运营确认截图。',
      'en-US': 'Buyer marked paid and is waiting for operator proof review.',
    },
    createdAt: '2026-04-12 09:02',
  },
  {
    id: 'cb_1004',
    channelKey: 'okx_usdt_watch',
    orderNo: 'PD-240412-1004',
    status: 'error',
    message: {
      'zh-CN': '金额未匹配，已推送人工复核。',
      'en-US': 'Amount mismatch detected and escalated for manual review.',
    },
    createdAt: '2026-04-12 11:12',
  },
]

const watcherRecordConfigs: WatcherRecordConfig[] = [
  {
    id: 'watch_1001',
    orderNo: 'PD-240412-1001',
    hash: '0x2a3f...91c4',
    amount: '5.49 USDT',
    status: 'matched',
    confirmedAt: '2026-04-12 10:22',
  },
  {
    id: 'watch_1002',
    orderNo: 'PD-240412-1004',
    hash: 'TQ72...88fd',
    amount: '0.14 USDT',
    status: 'manual_review',
    confirmedAt: '2026-04-12 11:12',
  },
  {
    id: 'watch_1003',
    orderNo: 'PD-240412-1010',
    hash: '0x8bc1...0aa9',
    amount: '12.39 USDT',
    status: 'pending',
    confirmedAt: '2026-04-12 11:20',
  },
]

const fulfillmentRecordConfigs: FulfillmentRecordConfig[] = [
  {
    id: 'ful_1001',
    orderNo: 'PD-240412-1001',
    strategy: 'subscription_code_standard',
    fulfillmentType: 'issue_subscription',
    provider: 'new_api_prod',
    actionKey: 'issue_subscription_code',
    status: 'success',
    deliveryChannel: 'telegram',
    target: '@aster_ops',
    startedAt: '2026-04-12 10:23',
    finishedAt: '2026-04-12 10:24',
  },
  {
    id: 'ful_1002',
    orderNo: 'PD-240412-1002',
    strategy: 'subscription_code_standard',
    fulfillmentType: 'issue_subscription',
    provider: 'new_api_prod',
    actionKey: 'issue_subscription_code',
    status: 'running',
    deliveryChannel: 'web',
    target: 'order detail',
    startedAt: '2026-04-12 09:56',
    finishedAt: '2026-04-12 09:58',
  },
  {
    id: 'ful_1003',
    orderNo: 'PD-240412-1003',
    strategy: 'manual_review_delivery',
    fulfillmentType: 'manual_delivery',
    provider: 'operator_queue',
    actionKey: 'manual_review_delivery',
    status: 'pending',
    deliveryChannel: 'manual',
    target: 'ops queue',
    startedAt: '2026-04-12 09:02',
    finishedAt: '',
  },
  {
    id: 'ful_1004',
    orderNo: 'PD-240412-1005',
    strategy: 'subscription_code_standard',
    fulfillmentType: 'issue_subscription',
    provider: 'new_api_prod',
    actionKey: 'issue_subscription_code',
    status: 'cancelled',
    deliveryChannel: 'web',
    target: 'order detail',
    startedAt: '2026-04-12 07:49',
    finishedAt: '2026-04-12 07:50',
  },
]

const codeIssueRecordConfigs: CodeIssueRecordConfig[] = [
  {
    id: 'issue_1001',
    orderNo: 'PD-240412-1001',
    codeType: 'subscription_code',
    issueStatus: 'success',
    provider: 'new_api_prod',
    actionKey: 'issue_subscription_code',
    issuedCount: 1,
    maskedPreview: '************9XK2L1',
    errorMessage: '',
    issuedAt: '2026-04-12 10:24',
  },
  {
    id: 'issue_1002',
    orderNo: 'PD-240412-1002',
    codeType: 'subscription_code',
    issueStatus: 'success',
    provider: 'new_api_prod',
    actionKey: 'issue_subscription_code',
    issuedCount: 1,
    maskedPreview: '************3QF8J7',
    errorMessage: '',
    issuedAt: '2026-04-12 09:58',
  },
  {
    id: 'issue_1003',
    orderNo: 'PD-240412-1012',
    codeType: 'recharge_code',
    issueStatus: 'failed',
    provider: 'new_api_prod',
    actionKey: 'issue_recharge_code',
    issuedCount: 0,
    maskedPreview: '',
    errorMessage: 'Upstream provider timed out during issuance.',
    issuedAt: '',
  },
]

const customerConfigs: CustomerConfig[] = [
  {
    id: 'cus_1001',
    name: 'Aster Group',
    region: { 'zh-CN': '新加坡', 'en-US': 'Singapore' },
    orders: 14,
    spend: '1,268 MIXED',
    tier: 'vip',
    lastOrder: '2026-04-12',
  },
  {
    id: 'cus_1002',
    name: 'Northwind Ops',
    region: { 'zh-CN': '中国香港', 'en-US': 'Hong Kong' },
    orders: 9,
    spend: '792 MIXED',
    tier: 'active',
    lastOrder: '2026-04-12',
  },
  {
    id: 'cus_1003',
    name: 'Orbital Commerce',
    region: { 'zh-CN': '阿联酋', 'en-US': 'UAE' },
    orders: 4,
    spend: '672 MIXED',
    tier: 'vip',
    lastOrder: '2026-04-11',
  },
]

const ticketConfigs: TicketConfig[] = [
  {
    id: 'ticket_1001',
    ticketNo: 'TK-240412-001',
    subject: {
      'zh-CN': '付款成功但尚未收到订阅码',
      'en-US': 'Payment completed but subscription code not delivered',
    },
    customer: 'Northwind Ops',
    priority: 'urgent',
    status: 'processing',
    assignedTo: 'Ava',
    createdAt: '2026-04-12 10:06',
  },
  {
    id: 'ticket_1002',
    ticketNo: 'TK-240412-002',
    subject: {
      'zh-CN': '希望补发 Telegram 交付消息',
      'en-US': 'Need Telegram delivery resend',
    },
    customer: 'Aster Group',
    priority: 'high',
    status: 'open',
    assignedTo: 'Mika',
    createdAt: '2026-04-12 09:31',
  },
  {
    id: 'ticket_1003',
    ticketNo: 'TK-240412-003',
    subject: {
      'zh-CN': 'USDT 金额不匹配如何处理',
      'en-US': 'Need help on a USDT amount mismatch',
    },
    customer: 'Nova Lab',
    priority: 'urgent',
    status: 'processing',
    assignedTo: 'Lina',
    createdAt: '2026-04-12 11:14',
  },
  {
    id: 'ticket_1004',
    ticketNo: 'TK-240412-004',
    subject: {
      'zh-CN': '企业订单希望改为邮件交付',
      'en-US': 'Enterprise order requests email delivery',
    },
    customer: 'Orbital Commerce',
    priority: 'normal',
    status: 'resolved',
    assignedTo: 'Noah',
    createdAt: '2026-04-11 17:40',
  },
]

const channelRevenueConfigs: ChannelRevenueConfig[] = [
  {
    key: 'wechat',
    label: { 'zh-CN': '微信收款码', 'en-US': 'WeChat QR' },
    value: '2,780 RMB',
    trend: '+12%',
  },
  {
    key: 'alipay',
    label: { 'zh-CN': '支付宝收款码', 'en-US': 'Alipay QR' },
    value: '3,140 RMB',
    trend: '+8%',
  },
  {
    key: 'okx',
    label: { 'zh-CN': 'OKX USDT', 'en-US': 'OKX USDT' },
    value: '1,960 USDT',
    trend: '+21%',
  },
]

export function getAdminOrders(locale: Locale): AdminOrder[] {
  return orderConfigs.map((order) => ({
    key: order.id,
    orderNo: order.orderNo,
    product: order.product[locale],
    customer: order.customer,
    amount: order.amount,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    deliveryStatus: order.deliveryStatus,
    deliveryChannel: order.deliveryChannel,
    deliveryRecordId: order.deliveryRecordId,
    sourceChannel: order.sourceChannel,
    buyerRef: order.buyerRef,
    createdAt: order.createdAt,
    paidAt: order.paidAt ?? '',
  }))
}

export function getAdminPayments(): AdminPaymentRecord[] {
  return paymentRecordConfigs.map((record) => ({
    key: record.id,
    orderNo: record.orderNo,
    paymentMethod: record.paymentMethod,
    channelKey: record.channelKey,
    amount: record.amount,
    currency: record.currency,
    status: record.status,
    payerAccount: record.payerAccount,
    confirmedAt: record.confirmedAt,
  }))
}

export function getAdminPaymentProofs(): AdminPaymentProof[] {
  return paymentProofConfigs.map((record) => ({
    key: record.id,
    orderNo: record.orderNo,
    proofType: record.proofType,
    objectUrl: record.objectUrl,
    reviewStatus: record.reviewStatus,
    note: record.note,
    paymentMethod: record.paymentMethod,
    amount: record.amount,
    currency: record.currency,
    sourceChannel: record.sourceChannel,
    buyerRef: record.buyerRef,
    createdAt: record.createdAt,
    reviewedAt: record.reviewedAt,
  }))
}

export function getAdminCallbackLogs(locale: Locale): AdminCallbackLog[] {
  return callbackLogConfigs.map((record) => ({
    key: record.id,
    channelKey: record.channelKey,
    orderNo: record.orderNo,
    status: record.status,
    message: record.message[locale],
    createdAt: record.createdAt,
  }))
}

export function getAdminWatcherRecords(): AdminWatcherRecord[] {
  return watcherRecordConfigs.map((record) => ({
    key: record.id,
    orderNo: record.orderNo,
    hash: record.hash,
    amount: record.amount,
    status: record.status,
    confirmedAt: record.confirmedAt,
  }))
}

export function getAdminFulfillmentRecords(): AdminFulfillmentRecord[] {
  return fulfillmentRecordConfigs.map((record) => ({
    key: record.id,
    orderNo: record.orderNo,
    strategy: record.strategy,
    fulfillmentType: record.fulfillmentType,
    provider: record.provider,
    actionKey: record.actionKey,
    status: record.status,
    deliveryChannel: record.deliveryChannel,
    target: record.target,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
  }))
}

export function getAdminCodeIssueRecords(): AdminCodeIssueRecord[] {
  return codeIssueRecordConfigs.map((record) => ({
    key: record.id,
    orderNo: record.orderNo,
    codeType: record.codeType,
    issueStatus: record.issueStatus,
    provider: record.provider,
    actionKey: record.actionKey,
    issuedCount: record.issuedCount,
    maskedPreview: record.maskedPreview,
    errorMessage: record.errorMessage,
    issuedAt: record.issuedAt,
  }))
}

export function getAdminCustomers(locale: Locale): AdminCustomer[] {
  return customerConfigs.map((customer) => ({
    key: customer.id,
    name: customer.name,
    region: customer.region[locale],
    orders: customer.orders,
    spend: customer.spend,
    tier: customer.tier,
    lastOrder: customer.lastOrder,
  }))
}

export function getAdminTickets(locale: Locale): AdminTicket[] {
  return ticketConfigs.map((ticket) => ({
    key: ticket.id,
    ticketNo: ticket.ticketNo,
    subject: ticket.subject[locale],
    customer: ticket.customer,
    priority: ticket.priority,
    status: ticket.status,
    assignedTo: ticket.assignedTo,
    createdAt: ticket.createdAt,
  }))
}

export function getAdminChannelRevenue(locale: Locale): AdminChannelRevenue[] {
  return channelRevenueConfigs.map((item) => ({
    key: item.key,
    label: item.label[locale],
    value: item.value,
    trend: item.trend,
  }))
}
