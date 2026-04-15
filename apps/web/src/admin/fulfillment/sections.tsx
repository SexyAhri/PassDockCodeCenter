import type { ReactNode } from 'react'

import type { TableColumnsType } from 'antd'

import type {
  AdminDeliveryRecord,
  AdminRemoteCodeIssueRecord,
} from '../../api/adminFulfillment'
import type { AdminFulfillmentRecord } from '../../data/admin'
import type { AdminConsoleText } from '../../i18n/adminConsole-types'
import type { Locale } from '../../i18n/copy'
import type { AdminWorkbenchSection } from '../../components/admin/AdminTabbedWorkbench'
import { StatusTag } from '../../components/admin/StatusTag'
import { ActionButtons } from '../../components/common/ActionButtons'
import { getDeliveryStatusTone, getFulfillmentStatusTone } from '../status'
import type { AdminSystemDraft } from '../system/types'

type FulfillmentSectionHandlers = {
  onOpenFulfillmentDetail: (record: AdminFulfillmentRecord) => void
  onOpenCodeIssueDetail: (record: AdminRemoteCodeIssueRecord) => void
  onOpenDeliveryDetail: (record: AdminDeliveryRecord) => void
  onOpenOrder: (orderNo: string) => void
  onRetryFulfillment: (orderNo: string) => void
  onRetryCodeIssue: (record: AdminRemoteCodeIssueRecord) => void
  onRetryDelivery: (orderNo: string) => void
  onResendDelivery: (orderNo: string) => void
}

type FulfillmentSectionLabels = {
  finishedAt: string
  orderAction: string
}

type FulfillmentSectionParams = {
  locale: Locale
  text: AdminConsoleText
  systemDraft: AdminSystemDraft
  filteredFulfillmentRecords: AdminFulfillmentRecord[]
  filteredCodeIssueRecords: AdminRemoteCodeIssueRecord[]
  filteredDeliveryRecords: AdminDeliveryRecord[]
  fulfillmentFiltersToolbar: ReactNode
  codeIssueFiltersToolbar: ReactNode
  deliveryFiltersToolbar: ReactNode
  labels: FulfillmentSectionLabels
  actions: FulfillmentSectionHandlers
}

export function getFulfillmentSections(
  params: FulfillmentSectionParams,
): AdminWorkbenchSection[] {
  const {
    locale,
    text,
    systemDraft,
    filteredFulfillmentRecords,
    filteredCodeIssueRecords,
    filteredDeliveryRecords,
    fulfillmentFiltersToolbar,
    codeIssueFiltersToolbar,
    deliveryFiltersToolbar,
    labels,
    actions,
  } = params

  const fulfillmentColumns: TableColumnsType<Record<string, unknown>> = [
    { title: text.table.orderNo, dataIndex: 'orderNo', width: 170 },
    { title: text.table.strategy, dataIndex: 'strategy', width: 190 },
    {
      title: text.table.fulfillmentType,
      dataIndex: 'fulfillmentType',
      width: 150,
      render: (value: string) => text.enums.fulfillmentType[value] ?? value,
    },
    { title: text.table.provider, dataIndex: 'provider', width: 150 },
    { title: text.table.actionKey, dataIndex: 'actionKey', width: 190 },
    {
      title: text.table.status,
      dataIndex: 'status',
      width: 132,
      render: (value: string) => (
        <StatusTag
          label={text.enums.fulfillmentStatus[value] ?? value}
          tone={getFulfillmentStatusTone(value as never)}
        />
      ),
    },
    {
      title: text.table.deliveryChannel,
      dataIndex: 'deliveryChannel',
      width: 136,
      render: (value: string) => text.enums.deliveryChannel[value] ?? value,
    },
    { title: text.table.target, dataIndex: 'target' },
    { title: text.table.startedAt, dataIndex: 'startedAt', width: 156 },
    {
      title: locale === 'zh-CN' ? '操作' : 'Actions',
      key: 'actions',
      width: 248,
      fixed: 'right',
      render: (_value, record) => {
        const fulfillmentRecord = record as AdminFulfillmentRecord

        return (
          <ActionButtons
            actions={[
              {
                key: 'retry',
                label: locale === 'zh-CN' ? '重试' : 'Retry',
                hidden: fulfillmentRecord.status !== 'failed',
                onClick: () => actions.onRetryFulfillment(fulfillmentRecord.orderNo),
              },
              {
                key: 'detail',
                label: locale === 'zh-CN' ? '详情' : 'Details',
                onClick: () => actions.onOpenFulfillmentDetail(fulfillmentRecord),
              },
              {
                key: 'order',
                label: labels.orderAction,
                onClick: () => actions.onOpenOrder(fulfillmentRecord.orderNo),
              },
            ]}
          />
        )
      },
    },
  ]

  const codeIssueColumns: TableColumnsType<Record<string, unknown>> = [
    { title: text.table.orderNo, dataIndex: 'orderNo', width: 170 },
    { title: locale === 'zh-CN' ? '码类型' : 'Code type', dataIndex: 'codeType', width: 150 },
    {
      title: locale === 'zh-CN' ? '发码状态' : 'Issue status',
      dataIndex: 'issueStatus',
      width: 132,
      render: (value: string) => (
        <StatusTag label={getCodeIssueStatusLabel(value, locale)} tone={getCodeIssueStatusTone(value)} />
      ),
    },
    { title: text.table.provider, dataIndex: 'provider', width: 170 },
    { title: text.table.actionKey, dataIndex: 'actionKey', width: 190 },
    { title: locale === 'zh-CN' ? '发码数量' : 'Issued count', dataIndex: 'issuedCount', width: 112 },
    { title: locale === 'zh-CN' ? '掩码预览' : 'Masked preview', dataIndex: 'maskedPreview', ellipsis: true },
    { title: locale === 'zh-CN' ? '错误信息' : 'Error message', dataIndex: 'errorMessage', ellipsis: true },
    { title: locale === 'zh-CN' ? '发码时间' : 'Issued at', dataIndex: 'issuedAt', width: 156 },
    {
      title: locale === 'zh-CN' ? '操作' : 'Actions',
      key: 'actions',
      width: 248,
      fixed: 'right',
      render: (_value, record) => {
        const issueRecord = record as AdminRemoteCodeIssueRecord

        return (
          <ActionButtons
            actions={[
              {
                key: 'retry',
                label: locale === 'zh-CN' ? '重试' : 'Retry',
                hidden: issueRecord.issueStatus !== 'failed',
                onClick: () => actions.onRetryCodeIssue(issueRecord),
              },
              {
                key: 'detail',
                label: locale === 'zh-CN' ? '详情' : 'Details',
                onClick: () => actions.onOpenCodeIssueDetail(issueRecord),
              },
              {
                key: 'order',
                label: labels.orderAction,
                onClick: () => actions.onOpenOrder(issueRecord.orderNo),
              },
            ]}
          />
        )
      },
    },
  ]

  const deliveryColumns: TableColumnsType<Record<string, unknown>> = [
    { title: text.table.orderNo, dataIndex: 'orderNo', width: 170 },
    {
      title: text.table.deliveryChannel,
      dataIndex: 'deliveryChannel',
      width: 140,
      render: (value: string) => text.enums.deliveryChannel[value] ?? value,
    },
    { title: text.table.target, dataIndex: 'target' },
    {
      title: text.table.status,
      dataIndex: 'status',
      width: 132,
      render: (value: string) => (
        <StatusTag
          label={text.enums.deliveryStatus[value] ?? value}
          tone={getDeliveryStatusTone(value as never)}
        />
      ),
    },
    { title: text.table.startedAt, dataIndex: 'startedAt', width: 156 },
    { title: labels.finishedAt, dataIndex: 'finishedAt', width: 156 },
    {
      title: locale === 'zh-CN' ? '操作' : 'Actions',
      key: 'actions',
      width: 300,
      fixed: 'right',
      render: (_value, record) => {
        const deliveryRecord = record as AdminDeliveryRecord

        return (
          <ActionButtons
            actions={[
              {
                key: 'retry',
                label: locale === 'zh-CN' ? '重试' : 'Retry',
                hidden: deliveryRecord.status !== 'failed',
                onClick: () => actions.onRetryDelivery(deliveryRecord.orderNo),
              },
              {
                key: 'resend',
                label: text.labels.resend,
                hidden: deliveryRecord.status !== 'sent',
                onClick: () => actions.onResendDelivery(deliveryRecord.orderNo),
              },
              {
                key: 'detail',
                label: locale === 'zh-CN' ? '详情' : 'Details',
                onClick: () => actions.onOpenDeliveryDetail(deliveryRecord),
              },
              {
                key: 'order',
                label: labels.orderAction,
                onClick: () => actions.onOpenOrder(deliveryRecord.orderNo),
              },
            ]}
          />
        )
      },
    },
  ]

  const strategyColumns: TableColumnsType<Record<string, unknown>> = [
    { title: text.table.strategy, dataIndex: 'strategyName', width: 220 },
    { title: text.table.targetId, dataIndex: 'strategyKey', width: 220 },
    {
      title: text.table.fulfillmentType,
      dataIndex: 'fulfillmentType',
      width: 150,
      render: (value: string) => text.enums.fulfillmentType[value] ?? value,
    },
    { title: text.table.providerKey, dataIndex: 'providerKey', width: 170 },
    { title: text.table.actionKey, dataIndex: 'actionKey', width: 190 },
    {
      title: text.table.enabled,
      dataIndex: 'enabled',
      width: 112,
      render: (value: boolean) => (
        <StatusTag label={value ? text.labels.auto : text.labels.manual} tone={value ? 'success' : 'default'} />
      ),
    },
  ]

  const deliveryStrategyColumns: TableColumnsType<Record<string, unknown>> = [
    { title: text.table.strategy, dataIndex: 'strategyName', width: 220 },
    { title: text.table.targetId, dataIndex: 'strategyKey', width: 220 },
    {
      title: text.table.deliveryChannel,
      dataIndex: 'channelType',
      width: 140,
      render: (value: string) => text.enums.deliveryChannel[value] ?? value,
    },
    { title: text.table.status, dataIndex: 'maskPolicy', width: 180 },
    {
      title: text.labels.resend,
      dataIndex: 'resendAllowed',
      width: 120,
      render: (value: boolean) => (
        <StatusTag label={value ? text.labels.retry : text.labels.manual} tone={value ? 'processing' : 'default'} />
      ),
    },
    {
      title: text.table.enabled,
      dataIndex: 'enabled',
      width: 112,
      render: (value: boolean) => (
        <StatusTag label={value ? text.labels.auto : text.labels.manual} tone={value ? 'success' : 'default'} />
      ),
    },
  ]

  return [
    {
      key: 'fulfillment_records',
      label: text.sections.fulfillmentRecords,
      title: text.sections.fulfillmentRecords,
      description:
        locale === 'zh-CN'
          ? '查看履约执行状态、失败记录与重试入口。'
          : 'Monitor fulfillment execution status, failure records, and retry entry points.',
      dataSource: filteredFulfillmentRecords,
      columns: fulfillmentColumns,
      scrollX: 1560,
      toolbarExtra: fulfillmentFiltersToolbar,
    },
    {
      key: 'code_issue_records',
      label: locale === 'zh-CN' ? '发码记录' : 'Issue records',
      title: locale === 'zh-CN' ? '发码记录' : 'Issue records',
      description:
        locale === 'zh-CN'
          ? '集中查看发码结果、掩码预览和失败诊断。'
          : 'Inspect issuance results, masked previews, and failed issuance diagnostics.',
      dataSource: filteredCodeIssueRecords,
      columns: codeIssueColumns,
      scrollX: 1460,
      showPagination: false,
      toolbarExtra: codeIssueFiltersToolbar,
    },
    {
      key: 'delivery_records',
      label: text.sections.deliveryRecords,
      title: text.sections.deliveryRecords,
      description:
        locale === 'zh-CN'
          ? '查看交付记录、失败重试和已发结果补发。'
          : 'Inspect delivery records, failed retries, and resend operations.',
      dataSource: filteredDeliveryRecords,
      columns: deliveryColumns,
      scrollX: 1360,
      showPagination: false,
      toolbarExtra: deliveryFiltersToolbar,
    },
    {
      key: 'strategy_catalog',
      label: text.sections.strategyCatalog,
      title: text.sections.strategyCatalog,
      dataSource: systemDraft.fulfillmentStrategies,
      columns: strategyColumns,
      scrollX: 1220,
      showPagination: false,
    },
    {
      key: 'delivery_strategies',
      label: text.sections.deliveryStrategies,
      title: text.sections.deliveryStrategies,
      dataSource: systemDraft.deliveryStrategies,
      columns: deliveryStrategyColumns,
      scrollX: 1180,
      showPagination: false,
    },
  ]
}

function getCodeIssueStatusTone(status: string) {
  switch (status) {
    case 'success':
      return 'success' as const
    case 'failed':
      return 'error' as const
    default:
      return 'warning' as const
  }
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
