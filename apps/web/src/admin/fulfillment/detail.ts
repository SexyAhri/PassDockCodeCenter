import type { AdminDeliveryRecord, AdminRemoteCodeIssueRecord } from '../../api/adminFulfillment'
import type { AdminFulfillmentRecord } from '../../data/admin'
import { getAdminConsoleText } from '../../i18n/adminConsole'
import type { Locale } from '../../i18n/copy'

export function buildLocalFulfillmentDetail(
  record: AdminFulfillmentRecord,
  locale: Locale,
) {
  const text = getAdminConsoleText(locale)

  return {
    recordId: record.key,
    orderNo: record.orderNo,
    strategy: record.strategy,
    fulfillmentType:
      text.enums.fulfillmentType[record.fulfillmentType] ?? record.fulfillmentType,
    provider: record.provider,
    actionKey: record.actionKey,
    status: text.enums.fulfillmentStatus[record.status] ?? record.status,
    deliveryChannel:
      text.enums.deliveryChannel[record.deliveryChannel] ?? record.deliveryChannel,
    target: record.target,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
  }
}

export function buildLocalDeliveryDetail(
  record: AdminDeliveryRecord,
  locale: Locale,
) {
  const text = getAdminConsoleText(locale)

  return {
    recordId: record.key,
    orderNo: record.orderNo,
    deliveryChannel:
      text.enums.deliveryChannel[record.deliveryChannel] ?? record.deliveryChannel,
    target: record.target,
    status: text.enums.deliveryStatus[record.status] ?? record.status,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
  }
}

export function buildLocalCodeIssueDetail(
  record: AdminRemoteCodeIssueRecord,
  locale: Locale,
) {
  return {
    recordId: record.key,
    orderNo: record.orderNo,
    codeType: record.codeType,
    issueStatus: getCodeIssueStatusLabel(record.issueStatus, locale),
    provider: record.provider,
    actionKey: record.actionKey,
    issuedCount: record.issuedCount,
    maskedPreview: record.maskedPreview || '-',
    errorMessage: record.errorMessage || '-',
    issuedAt: record.issuedAt || '-',
  }
}

export function getFulfillmentDetailLabels(locale: Locale) {
  const text = getAdminConsoleText(locale)

  return {
    recordId: locale === 'zh-CN' ? '记录 ID' : 'Record ID',
    record_id: locale === 'zh-CN' ? '记录 ID' : 'Record ID',
    orderNo: text.table.orderNo,
    order_no: text.table.orderNo,
    strategy: text.table.strategy,
    strategy_name: text.table.strategy,
    fulfillmentType: text.table.fulfillmentType,
    fulfillment_type: text.table.fulfillmentType,
    provider: text.table.provider,
    provider_name: text.table.provider,
    provider_key: text.table.providerKey,
    actionKey: text.table.actionKey,
    action_key: text.table.actionKey,
    codeType: locale === 'zh-CN' ? '码类型' : 'Code type',
    code_type: locale === 'zh-CN' ? '码类型' : 'Code type',
    issueStatus: locale === 'zh-CN' ? '发码状态' : 'Issue status',
    issue_status: locale === 'zh-CN' ? '发码状态' : 'Issue status',
    issuedCount: locale === 'zh-CN' ? '发码数量' : 'Issued count',
    issued_count: locale === 'zh-CN' ? '发码数量' : 'Issued count',
    maskedPreview: locale === 'zh-CN' ? '掩码预览' : 'Masked preview',
    issued_code_masked: locale === 'zh-CN' ? '掩码预览' : 'Masked preview',
    masked_preview: locale === 'zh-CN' ? '掩码预览' : 'Masked preview',
    fulfillment_record_id: locale === 'zh-CN' ? '履约记录 ID' : 'Fulfillment record ID',
    errorMessage: locale === 'zh-CN' ? '错误信息' : 'Error message',
    error_message: locale === 'zh-CN' ? '错误信息' : 'Error message',
    issuedAt: locale === 'zh-CN' ? '发码时间' : 'Issued at',
    issued_at: locale === 'zh-CN' ? '发码时间' : 'Issued at',
    status: text.table.status,
    bot_key: locale === 'zh-CN' ? '机器人标识' : 'Bot key',
    deliveryChannel: text.table.deliveryChannel,
    delivery_channel: text.table.deliveryChannel,
    channel_type: text.table.deliveryChannel,
    target: text.table.target,
    startedAt: text.table.startedAt,
    started_at: text.table.startedAt,
    finishedAt: locale === 'zh-CN' ? '完成时间' : 'Finished at',
    finished_at: locale === 'zh-CN' ? '完成时间' : 'Finished at',
    note: locale === 'zh-CN' ? '备注' : 'Note',
  }
}

export function getFulfillmentDetailPreferredKeys() {
  return [
    'recordId',
    'record_id',
    'orderNo',
    'order_no',
    'strategy',
    'strategy_name',
    'fulfillmentType',
    'fulfillment_type',
    'provider',
    'provider_name',
    'provider_key',
    'actionKey',
    'action_key',
    'codeType',
    'code_type',
    'issueStatus',
    'issue_status',
    'issuedCount',
    'issued_count',
    'maskedPreview',
    'issued_code_masked',
    'masked_preview',
    'fulfillment_record_id',
    'errorMessage',
    'error_message',
    'issuedAt',
    'issued_at',
    'status',
    'bot_key',
    'deliveryChannel',
    'delivery_channel',
    'channel_type',
    'target',
    'startedAt',
    'started_at',
    'finishedAt',
    'finished_at',
    'note',
  ]
}

function getCodeIssueStatusLabel(status: string, locale: Locale) {
  if (locale === 'zh-CN') {
    return {
      pending: '待发码',
      success: '已发码',
      failed: '发码失败',
    }[status] ?? status
  }

  return {
    pending: 'Pending',
    success: 'Issued',
    failed: 'Failed',
  }[status] ?? status
}
