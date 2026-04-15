import type { AdminOrderRecord } from '../../api/adminOrders'
import type {
  AdminCallbackLog,
  AdminPaymentProof,
  AdminPaymentRecord,
  AdminWatcherRecord,
} from '../../data/admin'
import { getAdminConsoleText } from '../../i18n/adminConsole'
import type { Locale } from '../../i18n/copy'

export type AdminPaymentDetailKind = 'payment' | 'proof' | 'callback' | 'watcher'

export function getPaymentPageLabels(locale: Locale) {
  return {
    viewDetail: locale === 'zh-CN' ? '查看详情' : 'Details',
    confirmPayment: locale === 'zh-CN' ? '确认付款' : 'Confirm payment',
    rejectPayment: locale === 'zh-CN' ? '驳回付款' : 'Reject payment',
    proofReviews: locale === 'zh-CN' ? '支付证明' : 'Proof review',
    previewProof: locale === 'zh-CN' ? '查看凭证' : 'Preview proof',
    openInNewTab: locale === 'zh-CN' ? '新窗口打开' : 'Open in new tab',
    reload: locale === 'zh-CN' ? '刷新' : 'Reload',
    confirmDrawerTitle: locale === 'zh-CN' ? '确认支付审核' : 'Confirm payment review',
    save: locale === 'zh-CN' ? '提交确认' : 'Submit',
    cancelText: locale === 'zh-CN' ? '取消' : 'Cancel',
    actionSuccess: locale === 'zh-CN' ? '支付流程已更新' : 'Payment workflow updated',
    actionFailed: locale === 'zh-CN' ? '请求失败，请稍后重试。' : 'Request failed. Please try again.',
    batchTitle: locale === 'zh-CN' ? '批量审核' : 'Bulk review',
    clearSelection: locale === 'zh-CN' ? '清空选择' : 'Clear',
    selectedOne: locale === 'zh-CN' ? '条审核记录已选中' : 'review selected',
    selectedMany: locale === 'zh-CN' ? '条审核记录已选中' : 'reviews selected',
    batchActionHint:
      locale === 'zh-CN'
        ? '仅处理当前仍处于待审核状态的支付证明，其余记录会自动跳过。'
        : 'Only payment proofs still pending review will be processed.',
    proofDetailTitle: locale === 'zh-CN' ? '支付证明详情' : 'Payment proof detail',
    paymentDetailTitle: locale === 'zh-CN' ? '支付记录详情' : 'Payment record detail',
    callbackDetailTitle: locale === 'zh-CN' ? '回调日志详情' : 'Callback log detail',
    watcherDetailTitle: locale === 'zh-CN' ? '链上记录详情' : 'Watcher record detail',
    proofPreviewTitle: locale === 'zh-CN' ? '付款凭证预览' : 'Payment proof preview',
    proofPreviewEmpty: locale === 'zh-CN' ? '当前凭证没有可预览文件。' : 'No preview file is available for this proof.',
    proofPreviewUnsupported:
      locale === 'zh-CN'
        ? '当前文件类型暂不支持内嵌预览，请使用右上角操作在新窗口中查看。'
        : 'This file type is not supported for inline preview. Use the top-right action to open it in a new tab.',
    proofReviewDescription:
      locale === 'zh-CN'
        ? '集中处理待审核付款证明，确认后直接推动订单进入履约流程。'
        : 'Review uploaded payment proofs and advance verified orders into fulfillment.',
    paymentRecordsDescription:
      locale === 'zh-CN'
        ? '统一查看支付记录、渠道状态与确认结果。'
        : 'Track payment records, settlement status, and confirmation results.',
    callbackLogsDescription:
      locale === 'zh-CN'
        ? '查看支付回调处理结果与脱敏载荷。'
        : 'Inspect payment callback outcomes and redacted payloads.',
    watcherRecordsDescription:
      locale === 'zh-CN'
        ? '查看链上确认结果与待人工复核记录。'
        : 'Inspect on-chain confirmations and manual review escalations.',
  } as const
}

export function buildProofReviewOrder(record: AdminPaymentProof): AdminOrderRecord {
  return {
    key: record.key,
    orderNo: record.orderNo,
    product: '',
    customer: '',
    amount: record.amount,
    currency: record.currency,
    paymentMethod: record.paymentMethod,
    paymentStatus: 'pending_review',
    orderStatus: 'paid_pending_review',
    deliveryStatus: 'pending',
    sourceChannel: record.sourceChannel,
    buyerRef: record.buyerRef,
    createdAt: record.createdAt,
    paidAt: record.createdAt,
  }
}

export function buildLocalPaymentRecordDetail(record: AdminPaymentRecord, locale: Locale) {
  const text = getAdminConsoleText(locale)

  return {
    paymentId: record.key,
    orderNo: record.orderNo,
    paymentMethod: text.enums.paymentMethod[record.paymentMethod] ?? record.paymentMethod,
    channelKey: record.channelKey,
    amount: record.amount,
    currency: record.currency,
    status: text.enums.paymentStatus[record.status] ?? record.status,
    payerAccount: record.payerAccount,
    confirmedAt: record.confirmedAt,
  }
}

export function buildLocalPaymentProofDetail(record: AdminPaymentProof, locale: Locale) {
  const text = getAdminConsoleText(locale)

  return {
    proofId: record.key,
    orderNo: record.orderNo,
    proofType: record.proofType,
    objectUrl: record.objectUrl,
    reviewStatus: getProofReviewLabel(record.reviewStatus, locale),
    paymentMethod: text.enums.paymentMethod[record.paymentMethod] ?? record.paymentMethod,
    amount: record.amount,
    currency: record.currency,
    sourceChannel: text.enums.sourceChannel[record.sourceChannel] ?? record.sourceChannel,
    buyerRef: record.buyerRef,
    note: record.note,
    createdAt: record.createdAt,
    reviewedAt: record.reviewedAt,
  }
}

export function buildLocalCallbackLogDetail(record: AdminCallbackLog, locale: Locale) {
  return {
    logId: record.key,
    orderNo: record.orderNo,
    channelKey: record.channelKey,
    status: record.status.toUpperCase(),
    message: record.message,
    createdAt: record.createdAt,
    sourceType: locale === 'zh-CN' ? '回调' : 'Callback',
  }
}

export function buildLocalWatcherRecordDetail(record: AdminWatcherRecord, locale: Locale) {
  return {
    recordId: record.key,
    orderNo: record.orderNo,
    chainTxHash: record.hash,
    amount: record.amount,
    status: getWatcherStatusLabel(record.status, locale),
    confirmedAt: record.confirmedAt,
  }
}

export function getPaymentDetailLabels(locale: Locale) {
  const text = getAdminConsoleText(locale)

  return {
    paymentId: locale === 'zh-CN' ? '支付 ID' : 'Payment ID',
    payment_id: locale === 'zh-CN' ? '支付 ID' : 'Payment ID',
    proofId: locale === 'zh-CN' ? '证明 ID' : 'Proof ID',
    proof_id: locale === 'zh-CN' ? '证明 ID' : 'Proof ID',
    logId: locale === 'zh-CN' ? '日志 ID' : 'Log ID',
    log_id: locale === 'zh-CN' ? '日志 ID' : 'Log ID',
    recordId: locale === 'zh-CN' ? '记录 ID' : 'Record ID',
    record_id: locale === 'zh-CN' ? '记录 ID' : 'Record ID',
    orderNo: text.table.orderNo,
    order_no: text.table.orderNo,
    product_name: text.table.product,
    customer_name: text.table.customer,
    paymentMethod: text.table.paymentMethod,
    payment_method: text.table.paymentMethod,
    channelKey: text.table.channelKey,
    channel_key: text.table.channelKey,
    amount: text.table.amount,
    currency: text.table.currency,
    status: text.table.status,
    payment_status: text.table.paymentStatus,
    order_status: text.table.orderStatus,
    sourceChannel: text.table.sourceChannel,
    source_channel: text.table.sourceChannel,
    buyerRef: text.table.buyerRef,
    buyer_ref: text.table.buyerRef,
    payerAccount: locale === 'zh-CN' ? '付款账号' : 'Payer account',
    payer_account: locale === 'zh-CN' ? '付款账号' : 'Payer account',
    merchant_order_no: locale === 'zh-CN' ? '商户单号' : 'Merchant order no.',
    third_party_txn_no: locale === 'zh-CN' ? '第三方流水号' : 'Third-party txn no.',
    chainTxHash: locale === 'zh-CN' ? '链上哈希' : 'Chain tx hash',
    chain_tx_hash: locale === 'zh-CN' ? '链上哈希' : 'Chain tx hash',
    proofType: locale === 'zh-CN' ? '证明类型' : 'Proof type',
    proof_type: locale === 'zh-CN' ? 'Proof type' : 'Proof type',
    objectUrl: locale === 'zh-CN' ? '证明地址' : 'Proof URL',
    object_url: locale === 'zh-CN' ? '证明地址' : 'Proof URL',
    object_key: locale === 'zh-CN' ? '对象键' : 'Object key',
    reviewStatus: locale === 'zh-CN' ? '审核状态' : 'Review status',
    review_status: locale === 'zh-CN' ? '审核状态' : 'Review status',
    reviewedAt: locale === 'zh-CN' ? '审核时间' : 'Reviewed at',
    reviewed_at: locale === 'zh-CN' ? '审核时间' : 'Reviewed at',
    reviewed_by: locale === 'zh-CN' ? '审核人' : 'Reviewed by',
    note: locale === 'zh-CN' ? '备注' : 'Note',
    message: locale === 'zh-CN' ? '消息' : 'Message',
    sourceType: locale === 'zh-CN' ? '来源类型' : 'Source type',
    source_type: locale === 'zh-CN' ? '来源类型' : 'Source type',
    raw_payload: locale === 'zh-CN' ? '脱敏载荷' : 'Redacted payload',
    processed_at: locale === 'zh-CN' ? '处理时间' : 'Processed at',
    confirmedAt: text.table.confirmedAt,
    confirmed_at: text.table.confirmedAt,
    createdAt: text.table.createdAt,
    created_at: text.table.createdAt,
    updated_at: locale === 'zh-CN' ? '更新时间' : 'Updated at',
    failed_at: locale === 'zh-CN' ? '失败时间' : 'Failed at',
  }
}

export function getPaymentDetailPreferredKeys(kind: AdminPaymentDetailKind) {
  switch (kind) {
    case 'proof':
      return [
        'proofId',
        'proof_id',
        'orderNo',
        'order_no',
        'product_name',
        'customer_name',
        'proofType',
        'proof_type',
        'reviewStatus',
        'review_status',
        'paymentMethod',
        'payment_method',
        'amount',
        'currency',
        'sourceChannel',
        'source_channel',
        'buyerRef',
        'buyer_ref',
        'note',
        'objectUrl',
        'object_url',
        'object_key',
        'createdAt',
        'created_at',
        'reviewedAt',
        'reviewed_at',
        'reviewed_by',
      ]
    case 'callback':
      return [
        'logId',
        'log_id',
        'orderNo',
        'order_no',
        'product_name',
        'customer_name',
        'channelKey',
        'channel_key',
        'status',
        'message',
        'sourceType',
        'source_type',
        'paymentMethod',
        'payment_method',
        'payment_status',
        'order_status',
        'createdAt',
        'created_at',
        'processed_at',
        'raw_payload',
      ]
    case 'watcher':
      return [
        'recordId',
        'record_id',
        'orderNo',
        'order_no',
        'product_name',
        'customer_name',
        'chainTxHash',
        'chain_tx_hash',
        'channelKey',
        'channel_key',
        'amount',
        'currency',
        'status',
        'paymentMethod',
        'payment_method',
        'payment_status',
        'order_status',
        'createdAt',
        'created_at',
        'confirmedAt',
        'confirmed_at',
        'raw_payload',
      ]
    default:
      return [
        'paymentId',
        'payment_id',
        'orderNo',
        'order_no',
        'product_name',
        'customer_name',
        'paymentMethod',
        'payment_method',
        'channelKey',
        'channel_key',
        'amount',
        'currency',
        'status',
        'payment_status',
        'order_status',
        'sourceChannel',
        'source_channel',
        'buyerRef',
        'buyer_ref',
        'payerAccount',
        'payer_account',
        'merchant_order_no',
        'third_party_txn_no',
        'chainTxHash',
        'chain_tx_hash',
        'confirmedAt',
        'confirmed_at',
        'failed_at',
        'createdAt',
        'created_at',
        'updated_at',
        'raw_payload',
      ]
  }
}

export function getProofReviewLabel(status: AdminPaymentProof['reviewStatus'], locale: Locale) {
  if (locale === 'zh-CN') {
    return {
      pending: '待审核',
      approved: '已通过',
      rejected: '已驳回',
    }[status]
  }

  return {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
  }[status]
}

function getWatcherStatusLabel(status: AdminWatcherRecord['status'], locale: Locale) {
  if (locale === 'zh-CN') {
    return {
      pending: '待确认',
      matched: '已匹配',
      manual_review: '人工复核',
    }[status]
  }

  return {
    pending: 'Pending',
    matched: 'Matched',
    manual_review: 'Manual review',
  }[status]
}
