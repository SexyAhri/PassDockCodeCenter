import { App, Tag } from 'antd'
import type { Key } from 'react'
import { useEffect, useMemo, useState } from 'react'

import { buildActionNoteFields, getActionNoteInitialValues } from '../../admin/common/actionNote'
import {
  canCancel,
  canCompleteDelivery,
  canDeliver,
  canFulfill,
  canMarkRefund,
  canRejectPayment,
  canResend,
  canRetryDelivery,
  canRetryFulfillment,
  canRunOrderAction,
  runRemoteOrderAction,
  type OrderActionKey,
} from '../../admin/orders/actions'
import {
  buildLocalOrderDetail,
  getOrderDetailLabels,
  getOrderDetailPreferredKeys,
} from '../../admin/orders/detail'
import {
  applyAdminOrderActionLocal,
  confirmAdminOrderPaymentLocal,
} from '../../admin/orders/draft'
import {
  buildAdminOrdersLocation,
  emptyAdminOrderFilters,
} from '../../admin/orders/filters'
import {
  buildOriginalRefundFeedbackMessage,
  normalizeOriginalRefundFeedback,
  resolveOriginalRefundFeedbackLevel,
} from '../../admin/orders/refundFeedback'
import { getAdminDetailSeedData } from '../../admin/detailDrawer'
import {
  buildOrderMetricItems,
  buildOrderStatusRows,
} from '../../admin/orders/metrics'
import { canMutateLocalAdminDraft, getAdminSourceTagColor } from '../../admin/source'
import {
  emptyAdminOrderConfirmDrawerState,
  emptyAdminOrderDetailDrawerState,
  getBatchActionContent,
  getConfirmPaymentFields,
  getConfirmPaymentInitialValues,
  getErrorMessage,
  getOrderActionLabelMap,
  getOrderPageLabels,
  getOrderSourceLabel,
  type AdminOrderConfirmDrawerState,
  type AdminOrderDetailDrawerState,
} from '../../admin/orders/presentation'
import { getOrderSections } from '../../admin/orders/sections'
import {
  areAdminOrderFiltersEqual,
  readAdminOrderFiltersFromSearch,
} from '../../admin/routeFilters'
import {
  confirmAdminOrderPayment,
  getAdminOrderDetail,
  type AdminOrderRecord,
} from '../../api/adminOrders'
import { AdminDetailDrawer } from '../../components/admin/AdminDetailDrawer'
import { AdminMetricStrip } from '../../components/admin/AdminMetricStrip'
import { AdminTabbedWorkbench } from '../../components/admin/AdminTabbedWorkbench'
import { AdminOrderFilters } from '../../components/admin/orders/AdminOrderFilters'
import { SystemEditorDrawer } from '../../components/admin/system/SystemEditorDrawer'
import { ActionButtons } from '../../components/common/ActionButtons'
import { PageHeader } from '../../components/common/PageHeader'
import { SelectionSummaryBar } from '../../components/common/SelectionSummaryBar'
import { useAdminOrdersData } from '../../hooks/useAdminOrdersData'
import { getAdminConsoleText } from '../../i18n/adminConsole'
import type { Locale } from '../../i18n/copy'
import { replaceTo, useLocationSearch } from '../../router'

type AdminOrdersPageProps = {
  locale: Locale
}

type OrderActionNoteKey = Extract<
  OrderActionKey,
  | 'reject_payment'
  | 'complete_delivery'
  | 'cancel'
  | 'refund_mark'
  | 'refund_original'
>

type OrderActionNoteDrawerState = {
  open: boolean
  action: OrderActionNoteKey
  orders: AdminOrderRecord[]
}

const emptyOrderActionNoteDrawerState: OrderActionNoteDrawerState = {
  open: false,
  action: 'reject_payment',
  orders: [],
}

export function AdminOrdersPage(props: AdminOrdersPageProps) {
  const { locale } = props
  const text = getAdminConsoleText(locale)
  const labels = getOrderPageLabels(locale)
  const actionLabelMap = getOrderActionLabelMap(labels)
  const { modal, message } = App.useApp()
  const locationSearch = useLocationSearch()
  const routeFilters = useMemo(
    () => readAdminOrderFiltersFromSearch(locationSearch),
    [locationSearch],
  )
  const [listFilters, setListFilters] = useState(() =>
    readAdminOrderFiltersFromSearch(window.location.search),
  )
  const { orders, setOrders, loading, error, source, remoteEnabled, reload } =
    useAdminOrdersData(locale, listFilters)
  const [confirmDrawer, setConfirmDrawer] =
    useState<AdminOrderConfirmDrawerState>(emptyAdminOrderConfirmDrawerState)
  const [actionNoteDrawer, setActionNoteDrawer] =
    useState<OrderActionNoteDrawerState>(emptyOrderActionNoteDrawerState)
  const [detailDrawer, setDetailDrawer] =
    useState<AdminOrderDetailDrawerState>(emptyAdminOrderDetailDrawerState)
  const [selectedOrderKeys, setSelectedOrderKeys] = useState<Key[]>([])
  const remoteOnlyMessage =
    locale === 'zh-CN'
      ? '当前远程接口不可用，订单操作需要连接后端接口。'
      : 'Remote API unavailable. Order actions require a backend connection.'

  useEffect(() => {
    setSelectedOrderKeys([])
  }, [listFilters])

  useEffect(() => {
    setListFilters((prev) =>
      areAdminOrderFiltersEqual(prev, routeFilters) ? prev : routeFilters,
    )
  }, [routeFilters])

  useEffect(() => {
    replaceTo(buildAdminOrdersLocation(listFilters))
  }, [listFilters])

  const reviewQueue = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.paymentStatus === 'pending_review' ||
          order.orderStatus === 'paid_pending_review',
      ),
    [orders],
  )
  const orderStatusRows = useMemo(
    () => buildOrderStatusRows(text, orders),
    [text, orders],
  )
  const selectedOrders = useMemo(
    () => orders.filter((order) => selectedOrderKeys.includes(order.key)),
    [orders, selectedOrderKeys],
  )

  const orderFilters = (
    <AdminOrderFilters
      locale={locale}
      value={listFilters}
      loading={loading}
      onChange={setListFilters}
      onReset={() => setListFilters(emptyAdminOrderFilters)}
    />
  )

  const orderSelectionBar = (
    <SelectionSummaryBar
      selectedCount={selectedOrders.length}
      title={labels.batchTitle}
      itemLabelSingular={labels.selectedOne}
      itemLabelPlural={labels.selectedMany}
      clearText={labels.clearSelection}
      onClear={() => setSelectedOrderKeys([])}
      actions={[
        {
          key: 'batch_reject',
          label: labels.rejectPayment,
          hidden: !selectedOrders.some(canRejectPayment),
          onClick: () => void handleBatchOrderAction('reject_payment'),
        },
        {
          key: 'batch_fulfill',
          label: labels.fulfill,
          type: 'primary',
          hidden: !selectedOrders.some(canFulfill),
          onClick: () => void handleBatchOrderAction('fulfill'),
        },
        {
          key: 'batch_retry_fulfillment',
          label: labels.retryFulfillment,
          hidden: !selectedOrders.some(canRetryFulfillment),
          onClick: () => void handleBatchOrderAction('retry_fulfillment'),
        },
        {
          key: 'batch_deliver',
          label: labels.deliver,
          hidden: !selectedOrders.some(canDeliver),
          onClick: () => void handleBatchOrderAction('deliver'),
        },
        {
          key: 'batch_complete_delivery',
          label: labels.completeDelivery,
          type: 'primary',
          hidden: !selectedOrders.some(canCompleteDelivery),
          onClick: () => void handleBatchOrderAction('complete_delivery'),
        },
        {
          key: 'batch_retry_delivery',
          label: labels.retryDelivery,
          hidden: !selectedOrders.some(canRetryDelivery),
          onClick: () => void handleBatchOrderAction('retry_delivery'),
        },
        {
          key: 'batch_refund_mark',
          label: labels.markRefund,
          hidden: !selectedOrders.some(canMarkRefund),
          onClick: () => void handleBatchOrderAction('refund_mark'),
        },
        {
          key: 'batch_resend',
          label: labels.resend,
          hidden: !selectedOrders.some(canResend),
          onClick: () => void handleBatchOrderAction('resend'),
        },
        {
          key: 'batch_cancel',
          label: labels.cancel,
          danger: true,
          hidden: !selectedOrders.some(canCancel),
          onClick: () => void handleBatchOrderAction('cancel'),
        },
      ]}
    />
  )

  const orderRowSelection = {
    selectedRowKeys: selectedOrderKeys,
    onChange: (keys: Key[]) => setSelectedOrderKeys(keys),
    preserveSelectedRowKeys: true,
  }

  const sections = getOrderSections({
    locale,
    text,
    orders,
    reviewQueue,
    orderStatusRows,
    rowSelection: orderRowSelection,
    orderSelectionBar,
    orderFilters,
    labels,
    actions: {
      onOpenOrderDetail: (order) => {
        void openOrderDetail(order)
      },
      onOpenConfirmPayment: (order) =>
        setConfirmDrawer({ open: true, order }),
      onRunOrderAction: (order, action) => {
        void handleOrderAction(order, action)
      },
    },
  })

  const sourceTag = (
    <Tag color={getAdminSourceTagColor(source, remoteEnabled)}>
      {getOrderSourceLabel(source, labels)}
    </Tag>
  )

  return (
    <div className="admin-page">
      <PageHeader
        title={text.pages.orders.title}
        subtitle={text.pages.orders.subtitle}
        extra={sourceTag}
      />

      <AdminMetricStrip
        items={buildOrderMetricItems({
          text,
          orders,
          reviewQueueSize: reviewQueue.length,
        })}
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
                  void reload().catch((nextError) => {
                    message.error(getErrorMessage(nextError, labels.actionFailed))
                  })
                  setSelectedOrderKeys([])
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
        fields={getConfirmPaymentFields(text, labels)}
        initialValues={getConfirmPaymentInitialValues(confirmDrawer.order)}
        submitText={labels.save}
        cancelText={labels.cancelText}
        onCancel={() => setConfirmDrawer(emptyAdminOrderConfirmDrawerState)}
        onSubmit={async (values) => {
          if (!confirmDrawer.order) {
            return
          }

          try {
            if (source === 'remote') {
              await confirmAdminOrderPayment(confirmDrawer.order.orderNo, {
                paymentMethod: String(
                  values.paymentMethod ?? 'wechat_qr',
                ) as AdminOrderRecord['paymentMethod'],
                amount: String(values.amount ?? ''),
                currency: String(values.currency ?? 'RMB'),
                note: String(values.note ?? ''),
              })
              await reload()
            } else if (canMutateLocalAdminDraft(source, remoteEnabled)) {
              setOrders((prev) =>
                confirmAdminOrderPaymentLocal(prev, confirmDrawer.order!.orderNo, {
                  paymentMethod: String(values.paymentMethod ?? 'wechat_qr'),
                  amount: String(values.amount ?? ''),
                  currency: String(values.currency ?? 'RMB'),
                }),
              )
            } else {
              throw new Error(remoteOnlyMessage)
            }

            setConfirmDrawer(emptyAdminOrderConfirmDrawerState)
            message.success(labels.actionSuccess)
          } catch (nextError) {
            message.error(getErrorMessage(nextError, labels.actionFailed))
            throw nextError
          }
        }}
      />

      <SystemEditorDrawer
        locale={locale}
        open={actionNoteDrawer.open}
        title={
          actionNoteDrawer.orders.length > 1
            ? `${actionLabelMap[actionNoteDrawer.action]} (${actionNoteDrawer.orders.length})`
            : actionLabelMap[actionNoteDrawer.action]
        }
        fields={buildOrderActionNoteFields(locale, actionNoteDrawer.action, labels)}
        initialValues={getActionNoteInitialValues()}
        submitText={labels.save}
        cancelText={labels.cancelText}
        onCancel={() => setActionNoteDrawer(emptyOrderActionNoteDrawerState)}
        onSubmit={async (values) => {
          if (!actionNoteDrawer.orders.length) {
            return
          }

          try {
            const note = String(values.note ?? '')

            if (source === 'remote') {
              const results = await Promise.all(
                actionNoteDrawer.orders.map((order) =>
                  runRemoteOrderAction(order.orderNo, actionNoteDrawer.action, {
                    note,
                  }),
                ),
              )
              await reload()

              if (actionNoteDrawer.action === 'refund_original') {
                const feedback = normalizeOriginalRefundFeedback(results[0])
                const feedbackMessage = buildOriginalRefundFeedbackMessage(
                  locale,
                  feedback,
                )

                setActionNoteDrawer(emptyOrderActionNoteDrawerState)
                setSelectedOrderKeys([])

                switch (resolveOriginalRefundFeedbackLevel(feedback)) {
                  case 'success':
                    message.success(feedbackMessage)
                    break
                  case 'warning':
                    message.warning(feedbackMessage)
                    break
                  default:
                    message.error(feedbackMessage)
                    break
                }
                return
              }
            } else if (canMutateLocalAdminDraft(source, remoteEnabled)) {
              setOrders((prev) =>
                actionNoteDrawer.orders.reduce(
                  (draft, order) =>
                    applyAdminOrderActionLocal(draft, order.orderNo, actionNoteDrawer.action),
                  prev,
                ),
              )
            } else {
              throw new Error(remoteOnlyMessage)
            }

            setActionNoteDrawer(emptyOrderActionNoteDrawerState)
            setSelectedOrderKeys([])
            message.success(labels.actionSuccess)
          } catch (nextError) {
            message.error(getErrorMessage(nextError, labels.actionFailed))
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
        fieldLabels={getOrderDetailLabels(locale)}
        preferredKeys={getOrderDetailPreferredKeys()}
        onClose={() => setDetailDrawer(emptyAdminOrderDetailDrawerState)}
      />
    </div>
  )

  async function handleOrderAction(
    order: AdminOrderRecord,
    action: OrderActionKey,
  ) {
    if (requiresOrderActionNote(action)) {
      setActionNoteDrawer({
        open: true,
        action,
        orders: [order],
      })
      return
    }

    modal.confirm({
      title: actionLabelMap[action],
      onOk: async () => {
        try {
          if (source === 'remote') {
            await runRemoteOrderAction(order.orderNo, action)
            await reload()
          } else if (canMutateLocalAdminDraft(source, remoteEnabled)) {
            setOrders((prev) =>
              applyAdminOrderActionLocal(prev, order.orderNo, action),
            )
          } else {
            throw new Error(remoteOnlyMessage)
          }

          message.success(labels.actionSuccess)
        } catch (nextError) {
          message.error(getErrorMessage(nextError, labels.actionFailed))
        }
      },
    })
  }

  async function handleBatchOrderAction(action: OrderActionKey) {
    const eligibleOrders = selectedOrders.filter((order) =>
      canRunOrderAction(order, action),
    )

    if (!eligibleOrders.length) {
      return
    }

    if (requiresOrderActionNote(action)) {
      setActionNoteDrawer({
        open: true,
        action,
        orders: eligibleOrders,
      })
      return
    }

    modal.confirm({
      title: `${actionLabelMap[action]} (${eligibleOrders.length})`,
      content: getBatchActionContent(
        locale,
        eligibleOrders.length,
        selectedOrders.length,
        labels.batchActionHint,
      ),
      onOk: async () => {
        try {
          if (source === 'remote') {
            await Promise.all(
              eligibleOrders.map((order) =>
                runRemoteOrderAction(order.orderNo, action),
              ),
            )
            await reload()
          } else if (canMutateLocalAdminDraft(source, remoteEnabled)) {
            setOrders((prev) =>
              eligibleOrders.reduce(
                (draft, order) =>
                  applyAdminOrderActionLocal(draft, order.orderNo, action),
                prev,
              ),
            )
          } else {
            throw new Error(remoteOnlyMessage)
          }

          setSelectedOrderKeys([])
          message.success(labels.actionSuccess)
        } catch (nextError) {
          message.error(getErrorMessage(nextError, labels.actionFailed))
        }
      },
    })
  }

  async function openOrderDetail(order: AdminOrderRecord) {
    const remoteDetailReady = source === 'remote'
    const fallbackDetail = buildLocalOrderDetail(order, locale)
    const title = `${labels.viewDetail} - ${order.orderNo}`

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
      const remoteDetail = await getAdminOrderDetail(order.orderNo)
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

function requiresOrderActionNote(action: OrderActionKey): action is OrderActionNoteKey {
  return (
    action === 'reject_payment' ||
    action === 'complete_delivery' ||
    action === 'cancel' ||
    action === 'refund_mark' ||
    action === 'refund_original'
  )
}

function buildOrderActionNoteFields(
  locale: Locale,
  action: OrderActionNoteKey,
  labels: ReturnType<typeof getOrderPageLabels>,
) {
  switch (action) {
    case 'complete_delivery':
      return buildActionNoteFields(locale, {
        label: labels.note,
        placeholderZh: '请输入交付完成说明、联络记录或人工处理备注',
        placeholderEn: 'Enter the delivery completion note or operator handoff summary',
        helpZh: '该备注会写入人工交付完成日志，方便后续审计和售后追踪。',
        helpEn: 'This note will be saved into the manual delivery completion log.',
      })
    case 'cancel':
      return buildActionNoteFields(locale, {
        label: labels.note,
        placeholderZh: '请输入取消原因或操作说明',
        placeholderEn: 'Enter the cancellation reason or operator note',
        helpZh: '该备注会写入订单取消日志。',
        helpEn: 'This note will be written into the order cancellation log.',
      })
    case 'refund_mark':
      return buildActionNoteFields(locale, {
        label: labels.note,
        placeholderZh: '请输入人工标记退款的原因、金额差异或处理说明',
        placeholderEn: 'Enter the refund reason, amount discrepancy, or operator note',
        helpZh: '该备注会写入退款事件，并立即将订单与支付状态标记为已退款。',
        helpEn: 'This note is saved into refund events and immediately marks the order as refunded.',
      })
    case 'refund_original':
      return buildActionNoteFields(locale, {
        label: labels.note,
        placeholderZh: '请输入原路退款原因或补充说明',
        placeholderEn: 'Enter the original refund reason or operator note',
        helpZh: '会调用支付通道退款接口，并保存退款状态、回执号与失败信息。',
        helpEn: 'This will call the payment channel refund API and store the status, receipt number, and failure details.',
      })
    default:
      return buildActionNoteFields(locale, {
        label: labels.note,
        placeholderZh: '请输入驳回原因或复核说明',
        placeholderEn: 'Enter the rejection reason or review note',
        helpZh: '该备注会进入审核日志，便于后续复核。',
        helpEn: 'This note will be saved into the review log for follow-up.',
      })
  }
}
