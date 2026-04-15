import {
  CreditCardOutlined,
  SafetyCertificateOutlined,
  SyncOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { App, Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import type { Key } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { buildActionNoteFields, getActionNoteInitialValues } from '../../admin/common/actionNote'
import { getAdminDetailSeedData } from '../../admin/detailDrawer'
import {
  buildLocalCallbackLogDetail,
  buildLocalPaymentProofDetail,
  buildLocalPaymentRecordDetail,
  buildLocalWatcherRecordDetail,
  buildProofReviewOrder,
  getPaymentDetailLabels,
  getPaymentDetailPreferredKeys,
  getPaymentPageLabels,
  getProofReviewLabel,
  type AdminPaymentDetailKind,
} from '../../admin/payments/detail'
import { getPaymentStatusTone } from '../../admin/status'
import {
  areAdminOrderFiltersEqual,
  buildAdminQueryPath,
  readAdminOrderFiltersFromSearch,
} from '../../admin/routeFilters'
import { combineAdminSources, getAdminSourceTagColor } from '../../admin/source'
import {
  getConfirmPaymentFields,
  getConfirmPaymentInitialValues,
  getErrorMessage as getOrderErrorMessage,
  getOrderPageLabels,
} from '../../admin/orders/presentation'
import type { AdminOrderListFilters, AdminOrderRecord } from '../../api/adminOrders'
import { confirmAdminOrderPayment, rejectAdminOrderPayment } from '../../api/adminOrders'
import {
  fetchAdminPaymentProofFile,
  getAdminCallbackLogDetail,
  getAdminPaymentProofDetail,
  getAdminPaymentRecordDetail,
  getAdminWatcherRecordDetail,
} from '../../api/adminPayments'
import { AdminFilePreviewDrawer } from '../../components/admin/AdminFilePreviewDrawer'
import { AdminDetailDrawer } from '../../components/admin/AdminDetailDrawer'
import { AdminMetricStrip } from '../../components/admin/AdminMetricStrip'
import { AdminTabbedWorkbench, type AdminWorkbenchSection } from '../../components/admin/AdminTabbedWorkbench'
import { StatusTag } from '../../components/admin/StatusTag'
import { SystemEditorDrawer } from '../../components/admin/system/SystemEditorDrawer'
import { ActionButtons } from '../../components/common/ActionButtons'
import { PageHeader } from '../../components/common/PageHeader'
import { SelectionSummaryBar } from '../../components/common/SelectionSummaryBar'
import { AdminOrderFilters } from '../../components/admin/orders/AdminOrderFilters'
import type {
  AdminCallbackLog,
  AdminPaymentProof,
  AdminPaymentRecord,
  AdminWatcherRecord,
} from '../../data/admin'
import { useAdminPaymentsData } from '../../hooks/useAdminPaymentsData'
import { useAdminSystemConfig } from '../../hooks/useAdminSystemConfig'
import { getAdminConsoleText } from '../../i18n/adminConsole'
import type { Locale } from '../../i18n/copy'
import { replaceTo, useLocationSearch } from '../../router'

type AdminPaymentsPageProps = {
  locale: Locale
}

type PaymentConfirmDrawerState = {
  open: boolean
  order: AdminOrderRecord | null
}

type RejectProofDrawerState = {
  open: boolean
  proofs: AdminPaymentProof[]
}

type DetailDrawerState = {
  open: boolean
  kind: AdminPaymentDetailKind
  title: string
  loading: boolean
  error: string | null
  data: Record<string, unknown> | null
}

type ProofPreviewDrawerState = {
  open: boolean
  title: string
  loading: boolean
  error: string | null
  previewUrl: string
  contentType: string
  revocable: boolean
}

const emptyConfirmDrawerState: PaymentConfirmDrawerState = {
  open: false,
  order: null,
}

const emptyRejectProofDrawerState: RejectProofDrawerState = {
  open: false,
  proofs: [],
}

const emptyDetailDrawerState: DetailDrawerState = {
  open: false,
  kind: 'payment',
  title: '',
  loading: false,
  error: null,
  data: null,
}

const emptyProofPreviewDrawerState: ProofPreviewDrawerState = {
  open: false,
  title: '',
  loading: false,
  error: null,
  previewUrl: '',
  contentType: '',
  revocable: false,
}

const callbackToneMap: Record<string, 'success' | 'warning' | 'error'> = {
  success: 'success',
  warning: 'warning',
  error: 'error',
}

const watcherToneMap: Record<string, 'warning' | 'success' | 'processing'> = {
  pending: 'processing',
  matched: 'success',
  manual_review: 'warning',
}

const proofToneMap: Record<AdminPaymentProof['reviewStatus'], 'warning' | 'success' | 'error'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
}

export function AdminPaymentsPage(props: AdminPaymentsPageProps) {
  const { locale } = props
  const text = getAdminConsoleText(locale)
  const labels = getPaymentPageLabels(locale)
  const orderLabels = getOrderPageLabels(locale)
  const { modal, message } = App.useApp()
  const locationSearch = useLocationSearch()
  const routeFilters = useMemo(
    () => readAdminOrderFiltersFromSearch(locationSearch),
    [locationSearch],
  )
  const [listFilters, setListFilters] = useState<AdminOrderListFilters>(() =>
    readAdminOrderFiltersFromSearch(window.location.search),
  )
  const [confirmDrawer, setConfirmDrawer] = useState<PaymentConfirmDrawerState>(emptyConfirmDrawerState)
  const [rejectProofDrawer, setRejectProofDrawer] = useState<RejectProofDrawerState>(emptyRejectProofDrawerState)
  const [detailDrawer, setDetailDrawer] = useState<DetailDrawerState>(emptyDetailDrawerState)
  const [proofPreviewDrawer, setProofPreviewDrawer] = useState<ProofPreviewDrawerState>(
    emptyProofPreviewDrawerState,
  )
  const [selectedProofKeys, setSelectedProofKeys] = useState<Key[]>([])
  const proofPreviewBlobUrlRef = useRef('')
  const {
    paymentRecords,
    paymentProofs,
    callbackLogs,
    watcherRecords,
    loading: paymentsLoading,
    error: paymentsError,
    source: paymentsSource,
    remoteEnabled: paymentsRemoteEnabled,
    reload: reloadPayments,
  } = useAdminPaymentsData(locale, listFilters)
  const {
    draft: systemDraft,
    loading: systemLoading,
    error: systemError,
    source: systemSource,
    reload: reloadSystem,
  } = useAdminSystemConfig()

  useEffect(() => {
    setSelectedProofKeys([])
  }, [listFilters])

  useEffect(
    () => () => {
      revokeProofPreviewBlobUrl()
    },
    [],
  )

  useEffect(() => {
    setListFilters((prev) => (areAdminOrderFiltersEqual(prev, routeFilters) ? prev : routeFilters))
  }, [routeFilters])

  useEffect(() => {
    replaceTo(buildAdminPaymentsLocation(listFilters))
  }, [listFilters])

  const paymentChannelMap = Object.fromEntries(
    systemDraft.paymentChannels.map((channel) => [channel.channelType, channel]),
  )
  const payments = paymentRecords.map((record) => ({
    ...record,
    channelKey: paymentChannelMap[record.paymentMethod]?.channelKey ?? record.channelKey ?? record.paymentMethod,
  }))
  const selectedProofs = useMemo(
    () => paymentProofs.filter((proof) => selectedProofKeys.includes(proof.key)),
    [paymentProofs, selectedProofKeys],
  )
  const proofReviewQueueSize = useMemo(
    () => new Set(paymentProofs.filter((proof) => proof.reviewStatus === 'pending').map((proof) => proof.orderNo)).size,
    [paymentProofs],
  )
  const detailProofPreviewTarget = useMemo(
    () => (detailDrawer.kind === 'proof' ? getProofPreviewTargetFromDetail(detailDrawer.data) : null),
    [detailDrawer.data, detailDrawer.kind],
  )
  const remoteReady = paymentsSource === 'remote'
  const source = combineAdminSources(paymentsSource, systemSource)
  const loading = paymentsLoading || systemLoading
  const error = paymentsError || systemError

  const paymentColumns: TableColumnsType<Record<string, unknown>> = [
    { title: text.table.orderNo, dataIndex: 'orderNo', width: 172, ellipsis: true },
    {
      title: text.table.paymentMethod,
      dataIndex: 'paymentMethod',
      width: 144,
      render: (value: string) => text.enums.paymentMethod[value] ?? value,
    },
    { title: text.table.channelKey, dataIndex: 'channelKey', width: 168, ellipsis: true },
    {
      title: text.table.amount,
      dataIndex: 'amount',
      width: 128,
      render: (value: string, record) => `${value} ${String(record.currency ?? '')}`,
    },
    { title: locale === 'zh-CN' ? '付款账号' : 'Payer account', dataIndex: 'payerAccount', ellipsis: true },
    {
      title: text.table.status,
      dataIndex: 'status',
      width: 132,
      render: (value: string) => (
        <StatusTag label={text.enums.paymentStatus[value] ?? value} tone={getPaymentStatusTone(value as never)} />
      ),
    },
    { title: text.table.confirmedAt, dataIndex: 'confirmedAt', width: 156 },
    {
      title: locale === 'zh-CN' ? '操作' : 'Actions',
      key: 'actions',
      width: 108,
      fixed: 'right',
      render: (_value, record) => (
        <ActionButtons
          actions={[
            {
              key: 'detail',
              label: labels.viewDetail,
              onClick: () => void openPaymentDetail(record as unknown as AdminPaymentRecord),
            },
          ]}
        />
      ),
    },
  ]

  const proofColumns: TableColumnsType<Record<string, unknown>> = [
    { title: text.table.orderNo, dataIndex: 'orderNo', width: 172, ellipsis: true },
    {
      title: locale === 'zh-CN' ? '证明类型' : 'Proof type',
      dataIndex: 'proofType',
      width: 120,
      ellipsis: true,
    },
    {
      title: text.table.paymentMethod,
      dataIndex: 'paymentMethod',
      width: 144,
      render: (value: string) => text.enums.paymentMethod[value] ?? value,
    },
    {
      title: text.table.amount,
      dataIndex: 'amount',
      width: 128,
      render: (value: string, record) => `${value} ${String(record.currency ?? '')}`,
    },
    {
      title: text.table.sourceChannel,
      dataIndex: 'sourceChannel',
      width: 112,
      render: (value: string) => text.enums.sourceChannel[value] ?? value,
    },
    { title: text.table.buyerRef, dataIndex: 'buyerRef', width: 156, ellipsis: true },
    { title: locale === 'zh-CN' ? '备注' : 'Note', dataIndex: 'note', ellipsis: true },
    {
      title: locale === 'zh-CN' ? '审核状态' : 'Review status',
      dataIndex: 'reviewStatus',
      width: 124,
      render: (value: AdminPaymentProof['reviewStatus']) => (
        <StatusTag label={getProofReviewLabel(value, locale)} tone={proofToneMap[value]} />
      ),
    },
    { title: text.table.createdAt, dataIndex: 'createdAt', width: 156 },
    {
      title: locale === 'zh-CN' ? '操作' : 'Actions',
      key: 'actions',
      width: 304,
      fixed: 'right',
      render: (_value, record) => {
        const proof = record as unknown as AdminPaymentProof

        return (
          <ActionButtons
            actions={[
              {
                key: 'confirm',
                label: labels.confirmPayment,
                type: 'primary',
                hidden: !remoteReady || proof.reviewStatus !== 'pending',
                onClick: () => setConfirmDrawer({ open: true, order: buildProofReviewOrder(proof) }),
              },
              {
                key: 'reject',
                label: labels.rejectPayment,
                hidden: !remoteReady || proof.reviewStatus !== 'pending',
                onClick: () =>
                  setRejectProofDrawer({
                    open: true,
                    proofs: [proof],
                  }),
              },
              {
                key: 'preview',
                label: labels.previewProof,
                onClick: () => void openProofPreview(proof),
              },
              {
                key: 'detail',
                label: labels.viewDetail,
                onClick: () => void openProofDetail(proof),
              },
            ]}
          />
        )
      },
    },
  ]

  const callbackColumns: TableColumnsType<Record<string, unknown>> = [
    { title: text.table.channelKey, dataIndex: 'channelKey', width: 170, ellipsis: true },
    { title: text.table.orderNo, dataIndex: 'orderNo', width: 164, ellipsis: true },
    { title: locale === 'zh-CN' ? '消息' : 'Message', dataIndex: 'message', ellipsis: true },
    {
      title: text.table.status,
      dataIndex: 'status',
      width: 112,
      render: (value: string) => <StatusTag label={value.toUpperCase()} tone={callbackToneMap[value]} />,
    },
    { title: text.table.createdAt, dataIndex: 'createdAt', width: 156 },
    {
      title: locale === 'zh-CN' ? '操作' : 'Actions',
      key: 'actions',
      width: 108,
      fixed: 'right',
      render: (_value, record) => (
        <ActionButtons
          actions={[
            {
              key: 'detail',
              label: labels.viewDetail,
              onClick: () => void openCallbackDetail(record as unknown as AdminCallbackLog),
            },
          ]}
        />
      ),
    },
  ]

  const watcherColumns: TableColumnsType<Record<string, unknown>> = [
    { title: text.table.orderNo, dataIndex: 'orderNo', width: 170, ellipsis: true },
    { title: locale === 'zh-CN' ? '链上哈希' : 'Chain tx hash', dataIndex: 'hash', ellipsis: true },
    { title: text.table.amount, dataIndex: 'amount', width: 130 },
    {
      title: text.table.status,
      dataIndex: 'status',
      width: 132,
      render: (value: string) => (
        <StatusTag
          label={
            locale === 'zh-CN'
              ? {
                  pending: '待确认',
                  matched: '已匹配',
                  manual_review: '人工复核',
                }[value] ?? value
              : {
                  pending: 'Pending',
                  matched: 'Matched',
                  manual_review: 'Manual review',
                }[value] ?? value
          }
          tone={watcherToneMap[value]}
        />
      ),
    },
    { title: text.table.confirmedAt, dataIndex: 'confirmedAt', width: 156 },
    {
      title: locale === 'zh-CN' ? '操作' : 'Actions',
      key: 'actions',
      width: 108,
      fixed: 'right',
      render: (_value, record) => (
        <ActionButtons
          actions={[
            {
              key: 'detail',
              label: labels.viewDetail,
              onClick: () => void openWatcherDetail(record as unknown as AdminWatcherRecord),
            },
          ]}
        />
      ),
    },
  ]

  const paymentFilters = (
    <AdminOrderFilters
      locale={locale}
      value={listFilters}
      fields={['orderNo', 'paymentStatus', 'paymentMethod', 'sourceChannel']}
      loading={loading}
      onChange={setListFilters}
      onReset={() =>
        setListFilters({
          orderNo: '',
          paymentStatus: '',
          reviewStatus: '',
          paymentMethod: '',
          sourceChannel: '',
        })
      }
    />
  )

  const proofFilters = (
    <AdminOrderFilters
      locale={locale}
      value={listFilters}
      fields={['orderNo', 'reviewStatus', 'paymentMethod', 'sourceChannel']}
      loading={loading}
      onChange={setListFilters}
      onReset={() =>
        setListFilters({
          orderNo: '',
          reviewStatus: '',
          paymentStatus: '',
          paymentMethod: '',
          sourceChannel: '',
        })
      }
    />
  )

  const proofSelectionBar = (
    <SelectionSummaryBar
      selectedCount={selectedProofs.length}
      title={labels.batchTitle}
      itemLabelSingular={labels.selectedOne}
      itemLabelPlural={labels.selectedMany}
      clearText={labels.clearSelection}
      onClear={() => setSelectedProofKeys([])}
      actions={[
        {
          key: 'batch_confirm',
          label: labels.confirmPayment,
          type: 'primary',
          hidden: !remoteReady || !selectedProofs.some((proof) => proof.reviewStatus === 'pending'),
          onClick: () => void handleBatchProofConfirm(),
        },
        {
          key: 'batch_reject',
          label: labels.rejectPayment,
          hidden: !remoteReady || !selectedProofs.some((proof) => proof.reviewStatus === 'pending'),
          onClick: () => void handleBatchProofReject(),
        },
      ]}
    />
  )

  const sections: AdminWorkbenchSection[] = [
    {
      key: 'payment_records',
      label: text.sections.paymentRecords,
      title: text.sections.paymentRecords,
      dataSource: payments as unknown as Array<Record<string, unknown>>,
      columns: paymentColumns,
      scrollX: 1280,
      toolbarExtra: paymentFilters,
    },
    {
      key: 'proof_reviews',
      label: labels.proofReviews,
      title: labels.proofReviews,
      dataSource: paymentProofs as unknown as Array<Record<string, unknown>>,
      columns: proofColumns,
      rowSelection: {
        selectedRowKeys: selectedProofKeys,
        onChange: (keys: Key[]) => setSelectedProofKeys(keys),
        preserveSelectedRowKeys: true,
      },
      scrollX: 1480,
      toolbarExtra: proofFilters,
      selectionBar: proofSelectionBar,
    },
    {
      key: 'callback_logs',
      label: text.sections.callbackLogs,
      title: text.sections.callbackLogs,
      dataSource: callbackLogs as unknown as Array<Record<string, unknown>>,
      columns: callbackColumns,
      scrollX: 1120,
      showPagination: false,
    },
    {
      key: 'watcher_records',
      label: text.sections.watcherRecords,
      title: text.sections.watcherRecords,
      dataSource: watcherRecords as unknown as Array<Record<string, unknown>>,
      columns: watcherColumns,
      scrollX: 1080,
      showPagination: false,
    },
  ]

  const revenueToday = payments
    .filter((record) => record.status === 'paid')
    .reduce((sum, record) => sum + Number(record.amount || 0), 0)

  const sourceTag = (
    <Tag color={getAdminSourceTagColor(source)}>
      {getSourceLabel(source, locale)}
    </Tag>
  )

  return (
    <div className="admin-page">
      <PageHeader title={text.pages.payments.title} subtitle={text.pages.payments.subtitle} extra={sourceTag} />

      <AdminMetricStrip
        items={[
          {
            key: 'revenue_today',
            title: text.metrics.revenueToday,
            value: revenueToday.toFixed(2),
            suffix: 'RMB',
            percent: 82,
            icon: <CreditCardOutlined />,
          },
          {
            key: 'payment_reviews',
            title: text.metrics.paymentReviews,
            value: proofReviewQueueSize,
            percent: 42,
            color: '#d97706',
            icon: <ThunderboltOutlined />,
          },
          {
            key: 'active_channels',
            title: text.metrics.activeChannels,
            value: systemDraft.paymentChannels.filter((channel) => channel.enabled).length,
            percent: 100,
            color: '#2563eb',
            icon: <SafetyCertificateOutlined />,
          },
          {
            key: 'provider_health',
            title: text.metrics.providerHealth,
            value: systemDraft.providers.filter((provider) => provider.health === 'healthy').length,
            percent: 88,
            color: '#0f9f6e',
            icon: <SyncOutlined />,
          },
        ]}
      />

      <AdminTabbedWorkbench
        locale={locale}
        sections={sections}
        loading={loading}
        error={error}
        toolbarExtra={
          <ActionButtons
            actions={[
              {
                key: 'reload',
                label: labels.reload,
                onClick: () => {
                  void Promise.all([reloadPayments(), reloadSystem()]).catch((nextError) => {
                    message.error(getOrderErrorMessage(nextError, labels.actionFailed))
                  })
                  setSelectedProofKeys([])
                },
              },
            ]}
          />
        }
      />

      <SystemEditorDrawer
        locale={locale}
        open={confirmDrawer.open}
        title={labels.confirmDrawerTitle}
        fields={getConfirmPaymentFields(text, orderLabels)}
        initialValues={getConfirmPaymentInitialValues(confirmDrawer.order)}
        submitText={labels.save}
        cancelText={labels.cancelText}
        onCancel={() => setConfirmDrawer(emptyConfirmDrawerState)}
        onSubmit={async (values) => {
          if (!confirmDrawer.order) {
            return
          }

          try {
            await confirmAdminOrderPayment(confirmDrawer.order.orderNo, {
              paymentMethod: String(values.paymentMethod ?? 'wechat_qr') as AdminOrderRecord['paymentMethod'],
              amount: String(values.amount ?? ''),
              currency: String(values.currency ?? 'RMB'),
              note: String(values.note ?? ''),
            })
            await reloadPayments()
            setConfirmDrawer(emptyConfirmDrawerState)
            setSelectedProofKeys([])
            message.success(labels.actionSuccess)
          } catch (nextError) {
            message.error(getOrderErrorMessage(nextError, labels.actionFailed))
            throw nextError
          }
        }}
      />

      <SystemEditorDrawer
        locale={locale}
        open={rejectProofDrawer.open}
        title={
          rejectProofDrawer.proofs.length > 1
            ? `${labels.rejectPayment} (${rejectProofDrawer.proofs.length})`
            : labels.rejectPayment
        }
        fields={buildActionNoteFields(locale, {
          label: orderLabels.note,
          placeholderZh: '请输入驳回原因或需要补充的支付说明',
          placeholderEn: 'Enter the rejection reason or the payment note required from the buyer',
          helpZh: '该备注会记录到订单支付审核流程中。',
          helpEn: 'This note will be recorded in the order payment review flow.',
        })}
        initialValues={getActionNoteInitialValues()}
        submitText={labels.save}
        cancelText={labels.cancelText}
        onCancel={() => setRejectProofDrawer(emptyRejectProofDrawerState)}
        onSubmit={async (values) => {
          if (!rejectProofDrawer.proofs.length) {
            return
          }

          try {
            const note = String(values.note ?? '')

            await Promise.all(
              dedupeProofOrders(rejectProofDrawer.proofs).map((proof) =>
                rejectAdminOrderPayment(proof.orderNo, note),
              ),
            )
            await reloadPayments()
            setRejectProofDrawer(emptyRejectProofDrawerState)
            setSelectedProofKeys([])
            message.success(labels.actionSuccess)
          } catch (nextError) {
            message.error(getOrderErrorMessage(nextError, labels.actionFailed))
            throw nextError
          }
        }}
      />

      <AdminDetailDrawer
        locale={locale}
        open={detailDrawer.open}
        title={detailDrawer.title}
        loading={detailDrawer.loading}
        error={detailDrawer.error}
        data={detailDrawer.data}
        extra={
          detailDrawer.kind === 'proof'
            ? (
                <ActionButtons
                  actions={[
                    {
                      key: 'preview_detail_proof',
                      label: labels.previewProof,
                      onClick: () => {
                        const target = detailProofPreviewTarget
                        if (target) {
                          void openProofPreview(target)
                        }
                      },
                      disabled: !detailProofPreviewTarget,
                    },
                  ]}
                />
              )
            : null
        }
        fieldLabels={getPaymentDetailLabels(locale)}
        preferredKeys={getPaymentDetailPreferredKeys(detailDrawer.kind)}
        onClose={() => setDetailDrawer(emptyDetailDrawerState)}
      />

      <AdminFilePreviewDrawer
        open={proofPreviewDrawer.open}
        title={proofPreviewDrawer.title}
        loading={proofPreviewDrawer.loading}
        error={proofPreviewDrawer.error}
        previewUrl={proofPreviewDrawer.previewUrl}
        contentType={proofPreviewDrawer.contentType}
        emptyText={labels.proofPreviewEmpty}
        unsupportedText={labels.proofPreviewUnsupported}
        extra={
          proofPreviewDrawer.previewUrl ? (
            <ActionButtons
              actions={[
                {
                  key: 'open_proof_new_tab',
                  label: labels.openInNewTab,
                  onClick: () => {
                    window.open(proofPreviewDrawer.previewUrl, '_blank', 'noopener,noreferrer')
                  },
                },
              ]}
              wrap={false}
            />
          ) : null
        }
        onClose={() => replaceProofPreviewDrawer(emptyProofPreviewDrawerState)}
      />
    </div>
  )

  async function handleBatchProofConfirm() {
    const eligibleProofs = dedupeProofOrders(selectedProofs.filter((proof) => proof.reviewStatus === 'pending'))
    if (!eligibleProofs.length) {
      return
    }

    modal.confirm({
      title: `${labels.confirmPayment} (${eligibleProofs.length})`,
      content: labels.batchActionHint,
      onOk: async () => {
        try {
          await Promise.all(
            eligibleProofs.map((proof) =>
              confirmAdminOrderPayment(proof.orderNo, {
                paymentMethod: proof.paymentMethod,
                amount: proof.amount,
                currency: proof.currency,
                note: '',
              }),
            ),
          )
          await reloadPayments()
          setSelectedProofKeys([])
          message.success(labels.actionSuccess)
        } catch (nextError) {
          message.error(getOrderErrorMessage(nextError, labels.actionFailed))
        }
      },
    })
  }

  async function handleBatchProofReject() {
    const eligibleProofs = dedupeProofOrders(selectedProofs.filter((proof) => proof.reviewStatus === 'pending'))
    if (!eligibleProofs.length) {
      return
    }

    setRejectProofDrawer({
      open: true,
      proofs: eligibleProofs,
    })
  }

  async function openPaymentDetail(record: AdminPaymentRecord) {
    await openDetailDrawer(
      'payment',
      `${labels.paymentDetailTitle} - ${record.orderNo}`,
      buildLocalPaymentRecordDetail(record, locale),
      () => getAdminPaymentRecordDetail(record.key),
    )
  }

  async function openProofDetail(record: AdminPaymentProof) {
    await openDetailDrawer(
      'proof',
      `${labels.proofDetailTitle} - ${record.orderNo}`,
      buildLocalPaymentProofDetail(record, locale),
      () => getAdminPaymentProofDetail(record.key),
    )
  }

  async function openProofPreview(record: Pick<AdminPaymentProof, 'key' | 'orderNo' | 'proofType' | 'objectUrl'>) {
    const title = buildProofPreviewTitle(labels.proofPreviewTitle, record)

    replaceProofPreviewDrawer({
      open: true,
      title,
      loading: true,
      error: null,
      previewUrl: '',
      contentType: '',
      revocable: false,
    })

    try {
      if (paymentsRemoteEnabled && isPersistedPaymentProofKey(record.key)) {
        const file = await fetchAdminPaymentProofFile(String(record.key))
        const previewUrl = URL.createObjectURL(file.blob)

        replaceProofPreviewDrawer({
          open: true,
          title,
          loading: false,
          error: null,
          previewUrl,
          contentType: file.contentType || inferProofPreviewContentType(record.proofType, record.objectUrl),
          revocable: true,
        })
        return
      }

      const fallbackUrl = String(record.objectUrl ?? '').trim()
      if (!fallbackUrl) {
        replaceProofPreviewDrawer({
          open: true,
          title,
          loading: false,
          error: labels.proofPreviewEmpty,
          previewUrl: '',
          contentType: '',
          revocable: false,
        })
        return
      }

      replaceProofPreviewDrawer({
        open: true,
        title,
        loading: false,
        error: null,
        previewUrl: fallbackUrl,
        contentType: inferProofPreviewContentType(record.proofType, fallbackUrl),
        revocable: false,
      })
    } catch (nextError) {
      replaceProofPreviewDrawer({
        open: true,
        title,
        loading: false,
        error: getOrderErrorMessage(nextError, labels.actionFailed),
        previewUrl: '',
        contentType: '',
        revocable: false,
      })
    }
  }

  async function openCallbackDetail(record: AdminCallbackLog) {
    await openDetailDrawer(
      'callback',
      `${labels.callbackDetailTitle} - ${record.orderNo || record.key}`,
      buildLocalCallbackLogDetail(record, locale),
      () => getAdminCallbackLogDetail(record.key),
    )
  }

  async function openWatcherDetail(record: AdminWatcherRecord) {
    await openDetailDrawer(
      'watcher',
      `${labels.watcherDetailTitle} - ${record.orderNo || record.key}`,
      buildLocalWatcherRecordDetail(record, locale),
      () => getAdminWatcherRecordDetail(record.key),
    )
  }

  async function openDetailDrawer(
    kind: AdminPaymentDetailKind,
    title: string,
    fallbackData: Record<string, unknown>,
    loadRemote: () => Promise<Record<string, unknown> | null>,
  ) {
    setDetailDrawer({
      open: true,
      kind,
      title,
      loading: remoteReady,
      error: null,
      data: getAdminDetailSeedData(remoteReady, fallbackData),
    })

    if (!remoteReady) {
      return
    }

    try {
      const remoteDetail = await loadRemote()
      setDetailDrawer({
        open: true,
        kind,
        title,
        loading: false,
        error: null,
        data: remoteDetail,
      })
    } catch (nextError) {
      setDetailDrawer({
        open: true,
        kind,
        title,
        loading: false,
        error: getOrderErrorMessage(nextError, labels.actionFailed),
        data: getAdminDetailSeedData(remoteReady, fallbackData),
      })
    }
  }

  function replaceProofPreviewDrawer(next: ProofPreviewDrawerState) {
    if (next.revocable) {
      revokeProofPreviewBlobUrl()
      proofPreviewBlobUrlRef.current = next.previewUrl
    } else {
      revokeProofPreviewBlobUrl()
    }

    setProofPreviewDrawer(next)
  }

  function revokeProofPreviewBlobUrl() {
    if (!proofPreviewBlobUrlRef.current) {
      return
    }

    URL.revokeObjectURL(proofPreviewBlobUrlRef.current)
    proofPreviewBlobUrlRef.current = ''
  }
}

function buildAdminPaymentsLocation(filters: AdminOrderListFilters) {
  return buildAdminQueryPath('/admin/payments', {
    orderNo: filters.orderNo,
    paymentStatus: filters.paymentStatus,
    reviewStatus: filters.reviewStatus,
    paymentMethod: filters.paymentMethod,
    sourceChannel: filters.sourceChannel,
  })
}

function dedupeProofOrders(proofs: AdminPaymentProof[]) {
  return Array.from(new Map(proofs.map((proof) => [proof.orderNo, proof])).values())
}

function getSourceLabel(source: string, locale: Locale) {
  if (locale === 'zh-CN') {
    return {
      remote: '远程接口',
      'remote-error': '远程不可用',
      'local-fallback': '本地兜底',
      local: '本地草稿',
    }[source] ?? '本地草稿'
  }

  return {
    remote: 'Remote API',
    'remote-error': 'Remote unavailable',
    'local-fallback': 'Local fallback',
    local: 'Local draft',
  }[source] ?? 'Local draft'
}

function isPersistedPaymentProofKey(value: unknown) {
  return /^\d+$/.test(String(value ?? '').trim())
}

function buildProofPreviewTitle(
  prefix: string,
  record: Pick<AdminPaymentProof, 'key' | 'orderNo'>,
) {
  return `${prefix} - ${String(record.orderNo ?? record.key ?? '').trim() || '-'}`
}

function inferProofPreviewContentType(proofType: string, objectUrl: string) {
  const normalizedType = String(proofType ?? '').trim().toLowerCase()
  const normalizedUrl = String(objectUrl ?? '').trim().toLowerCase()

  if (normalizedType === 'pdf' || /\.pdf(?:$|\?)/.test(normalizedUrl)) {
    return 'application/pdf'
  }

  if (/\.(png|jpe?g|gif|webp|bmp|svg)(?:$|\?)/.test(normalizedUrl)) {
    return 'image/*'
  }

  return ''
}

function getProofPreviewTargetFromDetail(data: Record<string, unknown> | null) {
  if (!data) {
    return null
  }

  const key = String(data.proofId ?? data.proof_id ?? '').trim()
  const objectUrl = String(data.objectUrl ?? data.object_url ?? '').trim()

  if (!key && !objectUrl) {
    return null
  }

  return {
    key: key || objectUrl,
    orderNo: String(data.orderNo ?? data.order_no ?? ''),
    proofType: String(data.proofType ?? data.proof_type ?? ''),
    objectUrl,
  } satisfies Pick<AdminPaymentProof, 'key' | 'orderNo' | 'proofType' | 'objectUrl'>
}
