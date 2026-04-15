import {
  CheckCircleOutlined,
  DeploymentUnitOutlined,
  SendOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { App, Tag } from 'antd'
import { useEffect, useMemo, useState } from 'react'

import {
  buildLocalCodeIssueDetail,
  buildLocalDeliveryDetail,
  buildLocalFulfillmentDetail,
  getFulfillmentDetailLabels,
  getFulfillmentDetailPreferredKeys,
} from '../../admin/fulfillment/detail'
import { getAdminDetailSeedData } from '../../admin/detailDrawer'
import {
  buildAdminFulfillmentLocation,
  emptyAdminFulfillmentFilters,
  matchesCodeIssueFilters,
  matchesDeliveryFilters,
  matchesFulfillmentFilters,
} from '../../admin/fulfillment/filters'
import { getFulfillmentSections } from '../../admin/fulfillment/sections'
import {
  areAdminFulfillmentFiltersEqual,
  buildAdminQueryPath,
  readAdminFulfillmentFiltersFromSearch,
} from '../../admin/routeFilters'
import { combineAdminSources, getAdminSourceTagColor } from '../../admin/source'
import {
  getAdminCodeIssueRecordDetail,
  getAdminDeliveryRecordDetail,
  getAdminFulfillmentRecordDetail,
  retryAdminCodeIssueRecord,
  type AdminDeliveryRecord,
  type AdminRemoteCodeIssueRecord,
} from '../../api/adminFulfillment'
import {
  resendAdminOrderDelivery,
  retryAdminOrderDelivery,
  retryAdminOrderFulfillment,
} from '../../api/adminOrders'
import type { AdminFulfillmentRecord } from '../../data/admin'
import { AdminDetailDrawer } from '../../components/admin/AdminDetailDrawer'
import {
  AdminFulfillmentFilters,
  type AdminFulfillmentFiltersValue,
} from '../../components/admin/fulfillment/AdminFulfillmentFilters'
import { AdminMetricStrip } from '../../components/admin/AdminMetricStrip'
import { AdminTabbedWorkbench } from '../../components/admin/AdminTabbedWorkbench'
import { ActionButtons } from '../../components/common/ActionButtons'
import { PageHeader } from '../../components/common/PageHeader'
import { useAdminFulfillmentData } from '../../hooks/useAdminFulfillmentData'
import { useAdminSystemConfig } from '../../hooks/useAdminSystemConfig'
import { getAdminConsoleText } from '../../i18n/adminConsole'
import type { Locale } from '../../i18n/copy'
import { navigateTo, replaceTo, useLocationSearch } from '../../router'

type AdminFulfillmentPageProps = {
  locale: Locale
}

type DetailDrawerState = {
  open: boolean
  title: string
  loading: boolean
  error: string | null
  data: Record<string, unknown> | null
}

const emptyDetailDrawerState: DetailDrawerState = {
  open: false,
  title: '',
  loading: false,
  error: null,
  data: null,
}

export function AdminFulfillmentPage(props: AdminFulfillmentPageProps) {
  const { locale } = props
  const text = getAdminConsoleText(locale)
  const { modal, message } = App.useApp()
  const locationSearch = useLocationSearch()
  const routeFilters = useMemo(
    () => readAdminFulfillmentFiltersFromSearch(locationSearch),
    [locationSearch],
  )
  const {
    fulfillmentRecords,
    codeIssueRecords,
    deliveryRecords,
    loading: fulfillmentLoading,
    error: fulfillmentError,
    source: fulfillmentSource,
    reload: reloadFulfillment,
  } = useAdminFulfillmentData(locale)
  const {
    draft: systemDraft,
    loading: systemLoading,
    error: systemError,
    source: systemSource,
    reload: reloadSystem,
  } = useAdminSystemConfig()
  const [detailDrawer, setDetailDrawer] = useState<DetailDrawerState>(
    emptyDetailDrawerState,
  )
  const [recordFilters, setRecordFilters] = useState<AdminFulfillmentFiltersValue>(
    () => readAdminFulfillmentFiltersFromSearch(window.location.search),
  )

  const labels = {
    viewDetail: locale === 'zh-CN' ? '详情' : 'Details',
    reload: locale === 'zh-CN' ? '刷新' : 'Reload',
    remoteReady: locale === 'zh-CN' ? '远程接口' : 'Remote API',
    localFallback: locale === 'zh-CN' ? '本地兜底' : 'Local fallback',
    localDraft: locale === 'zh-CN' ? '本地草稿' : 'Local draft',
    remoteUnavailable: locale === 'zh-CN' ? '远程不可用' : 'Remote unavailable',
    running: locale === 'zh-CN' ? '执行中' : 'Running',
    pending: locale === 'zh-CN' ? '待执行' : 'Pending',
    failedDelivery: locale === 'zh-CN' ? '发货失败' : 'Failed delivery',
    finishedAt: locale === 'zh-CN' ? '完成时间' : 'Finished at',
    actionSuccess: locale === 'zh-CN' ? '操作已完成' : 'Action completed.',
    actionFailed:
      locale === 'zh-CN'
        ? '请求失败，请稍后重试。'
        : 'Request failed. Please try again.',
    remoteOnly:
      locale === 'zh-CN'
        ? '当前远程接口不可用，重试和补发需要连接后端接口。'
        : 'Remote API unavailable. Retry and resend actions require a backend connection.',
    retryFulfillment: locale === 'zh-CN' ? '重试履约' : 'Retry fulfillment',
    retryCodeIssue: locale === 'zh-CN' ? '重试发码' : 'Retry code issue',
    retryDelivery: locale === 'zh-CN' ? '重试发货' : 'Retry delivery',
    resendDelivery: locale === 'zh-CN' ? '补发内容' : 'Resend delivery',
  } as const

  useEffect(() => {
    setRecordFilters((prev) =>
      areAdminFulfillmentFiltersEqual(prev, routeFilters) ? prev : routeFilters,
    )
  }, [routeFilters])

  useEffect(() => {
    replaceTo(buildAdminFulfillmentLocation(recordFilters))
  }, [recordFilters])

  const filteredFulfillmentRecords = useMemo(
    () =>
      fulfillmentRecords.filter((record) =>
        matchesFulfillmentFilters(record, recordFilters),
      ),
    [fulfillmentRecords, recordFilters],
  )
  const filteredCodeIssueRecords = useMemo(
    () =>
      codeIssueRecords.filter((record) =>
        matchesCodeIssueFilters(record, recordFilters),
      ),
    [codeIssueRecords, recordFilters],
  )
  const filteredDeliveryRecords = useMemo(
    () =>
      deliveryRecords.filter((record) =>
        matchesDeliveryFilters(record, recordFilters),
      ),
    [deliveryRecords, recordFilters],
  )

  const resetFilters = () => setRecordFilters(emptyAdminFulfillmentFilters)

  const fulfillmentFiltersToolbar = (
    <AdminFulfillmentFilters
      locale={locale}
      value={recordFilters}
      fields={['orderNo', 'fulfillmentStatus', 'deliveryChannel', 'fulfillmentType']}
      loading={fulfillmentLoading || systemLoading}
      onChange={setRecordFilters}
      onReset={resetFilters}
    />
  )

  const codeIssueFiltersToolbar = (
    <AdminFulfillmentFilters
      locale={locale}
      value={recordFilters}
      fields={['orderNo']}
      loading={fulfillmentLoading}
      onChange={setRecordFilters}
      onReset={resetFilters}
    />
  )

  const deliveryFiltersToolbar = (
    <AdminFulfillmentFilters
      locale={locale}
      value={recordFilters}
      fields={['orderNo', 'deliveryStatus', 'deliveryChannel']}
      loading={fulfillmentLoading || systemLoading}
      onChange={setRecordFilters}
      onReset={resetFilters}
    />
  )

  const sections = getFulfillmentSections({
    locale,
    text,
    systemDraft,
    filteredFulfillmentRecords,
    filteredCodeIssueRecords,
    filteredDeliveryRecords,
    fulfillmentFiltersToolbar,
    codeIssueFiltersToolbar,
    deliveryFiltersToolbar,
    labels: {
      finishedAt: labels.finishedAt,
      orderAction: text.nav.orders,
    },
    actions: {
      onOpenFulfillmentDetail: (record) => {
        void openFulfillmentDetail(record)
      },
      onOpenCodeIssueDetail: (record) => {
        void openCodeIssueDetail(record)
      },
      onOpenDeliveryDetail: (record) => {
        void openDeliveryDetail(record)
      },
      onOpenOrder: (orderNo) =>
        navigateTo(
          buildAdminQueryPath('/admin/orders', {
            orderNo,
          }),
        ),
      onRetryFulfillment: (orderNo) => {
        confirmRemoteAction(labels.retryFulfillment, async () => {
          await retryAdminOrderFulfillment(orderNo)
          await reloadFulfillment()
        })
      },
      onRetryCodeIssue: (record) => {
        confirmRemoteAction(labels.retryCodeIssue, async () => {
          await retryAdminCodeIssueRecord(record.key)
          await reloadFulfillment()
        })
      },
      onRetryDelivery: (orderNo) => {
        confirmRemoteAction(labels.retryDelivery, async () => {
          await retryAdminOrderDelivery(orderNo)
          await reloadFulfillment()
        })
      },
      onResendDelivery: (orderNo) => {
        confirmRemoteAction(labels.resendDelivery, async () => {
          await resendAdminOrderDelivery(orderNo)
          await reloadFulfillment()
        })
      },
    },
  })

  const source = combineAdminSources(fulfillmentSource, systemSource)
  const loading = fulfillmentLoading || systemLoading
  const error = fulfillmentError || systemError
  const fulfillmentSuccess = Math.round(
    (fulfillmentRecords.filter((record) => record.status === 'success').length /
      Math.max(fulfillmentRecords.length, 1)) *
      100,
  )
  const deliverySuccess = Math.round(
    (deliveryRecords.filter((record) => record.status === 'sent').length /
      Math.max(deliveryRecords.length, 1)) *
      100,
  )

  const sourceTag = (
    <Tag color={getAdminSourceTagColor(source)}>
      {source === 'remote'
        ? labels.remoteReady
        : source === 'remote-error'
          ? labels.remoteUnavailable
        : source === 'local-fallback'
          ? labels.localFallback
          : labels.localDraft}
    </Tag>
  )

  return (
    <div className="admin-page">
      <PageHeader
        title={text.pages.fulfillment.title}
        subtitle={text.pages.fulfillment.subtitle}
        extra={sourceTag}
      />

      <AdminMetricStrip
        items={[
          {
            key: 'fulfillment_success',
            title: text.metrics.fulfillmentSuccess,
            value: fulfillmentSuccess,
            suffix: '%',
            percent: fulfillmentSuccess,
            color: '#0f9f6e',
            icon: <CheckCircleOutlined />,
          },
          {
            key: 'delivery_success',
            title: text.metrics.deliverySuccess,
            value: deliverySuccess,
            suffix: '%',
            percent: deliverySuccess,
            color: '#2563eb',
            icon: <SendOutlined />,
          },
          {
            key: 'running',
            title: labels.running,
            value: fulfillmentRecords.filter((record) => record.status === 'running').length,
            percent: 64,
            color: '#d97706',
            icon: <SyncOutlined />,
          },
          {
            key: 'pending',
            title: labels.pending,
            value: fulfillmentRecords.filter((record) => record.status === 'pending').length,
            percent: 36,
            color: '#5b8cff',
            icon: <DeploymentUnitOutlined />,
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
                key: 'running',
                label: labels.running,
                onClick: () =>
                  setRecordFilters((prev) => ({
                    ...prev,
                    fulfillmentStatus: 'running',
                  })),
              },
              {
                key: 'pending',
                label: labels.pending,
                onClick: () =>
                  setRecordFilters((prev) => ({
                    ...prev,
                    fulfillmentStatus: 'pending',
                  })),
              },
              {
                key: 'failed_delivery',
                label: labels.failedDelivery,
                onClick: () =>
                  setRecordFilters((prev) => ({
                    ...prev,
                    deliveryStatus: 'failed',
                  })),
              },
              {
                key: 'reload',
                label: labels.reload,
                onClick: () => {
                  void Promise.all([reloadFulfillment(), reloadSystem()]).catch(
                    (nextError) => {
                      message.error(getErrorMessage(nextError, labels.actionFailed))
                    },
                  )
                },
              },
            ]}
          />
        }
      />

      <AdminDetailDrawer
        locale={locale}
        open={detailDrawer.open}
        title={detailDrawer.title}
        loading={detailDrawer.loading}
        error={detailDrawer.error}
        data={detailDrawer.data}
        fieldLabels={getFulfillmentDetailLabels(locale)}
        preferredKeys={getFulfillmentDetailPreferredKeys()}
        onClose={() => setDetailDrawer(emptyDetailDrawerState)}
      />
    </div>
  )

  function confirmRemoteAction(title: string, action: () => Promise<void>) {
    if (fulfillmentSource !== 'remote') {
      message.info(labels.remoteOnly)
      return
    }

    modal.confirm({
      title,
      onOk: async () => {
        try {
          await action()
          message.success(labels.actionSuccess)
        } catch (nextError) {
          message.error(getErrorMessage(nextError, labels.actionFailed))
        }
      },
    })
  }

  async function openFulfillmentDetail(record: AdminFulfillmentRecord) {
    const remoteDetailReady = fulfillmentSource === 'remote'
    const fallbackDetail = buildLocalFulfillmentDetail(record, locale)
    const title = `${labels.viewDetail} - ${record.orderNo}`

    setDetailDrawer({
      open: true,
      title,
      loading: remoteDetailReady,
      error: null,
      data: getAdminDetailSeedData(remoteDetailReady, fallbackDetail),
    })

    if (!remoteDetailReady) {
      return
    }

    try {
      const remoteDetail = await getAdminFulfillmentRecordDetail(record.key)
      setDetailDrawer({
        open: true,
        title,
        loading: false,
        error: null,
        data: remoteDetail,
      })
    } catch (nextError) {
      setDetailDrawer({
        open: true,
        title,
        loading: false,
        error: getErrorMessage(nextError, labels.actionFailed),
        data: getAdminDetailSeedData(remoteDetailReady, fallbackDetail),
      })
    }
  }

  async function openCodeIssueDetail(record: AdminRemoteCodeIssueRecord) {
    const remoteDetailReady = fulfillmentSource === 'remote'
    const fallbackDetail = buildLocalCodeIssueDetail(record, locale)
    const title = `${labels.viewDetail} - ${record.orderNo}`

    setDetailDrawer({
      open: true,
      title,
      loading: remoteDetailReady,
      error: null,
      data: getAdminDetailSeedData(remoteDetailReady, fallbackDetail),
    })

    if (!remoteDetailReady) {
      return
    }

    try {
      const remoteDetail = await getAdminCodeIssueRecordDetail(record.key)
      setDetailDrawer({
        open: true,
        title,
        loading: false,
        error: null,
        data: remoteDetail,
      })
    } catch (nextError) {
      setDetailDrawer({
        open: true,
        title,
        loading: false,
        error: getErrorMessage(nextError, labels.actionFailed),
        data: getAdminDetailSeedData(remoteDetailReady, fallbackDetail),
      })
    }
  }

  async function openDeliveryDetail(record: AdminDeliveryRecord) {
    const remoteDetailReady = fulfillmentSource === 'remote'
    const fallbackDetail = buildLocalDeliveryDetail(record, locale)
    const title = `${labels.viewDetail} - ${record.orderNo}`

    setDetailDrawer({
      open: true,
      title,
      loading: remoteDetailReady,
      error: null,
      data: getAdminDetailSeedData(remoteDetailReady, fallbackDetail),
    })

    if (!remoteDetailReady) {
      return
    }

    try {
      const remoteDetail = await getAdminDeliveryRecordDetail(record.key)
      setDetailDrawer({
        open: true,
        title,
        loading: false,
        error: null,
        data: remoteDetail,
      })
    } catch (nextError) {
      setDetailDrawer({
        open: true,
        title,
        loading: false,
        error: getErrorMessage(nextError, labels.actionFailed),
        data: getAdminDetailSeedData(remoteDetailReady, fallbackDetail),
      })
    }
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}
