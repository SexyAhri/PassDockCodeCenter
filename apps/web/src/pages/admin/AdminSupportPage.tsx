import {
  CustomerServiceOutlined,
  FieldTimeOutlined,
  NotificationOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { App, Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import type { Key } from 'react'
import { useEffect, useMemo, useState } from 'react'

import { buildActionNoteFields, getActionNoteInitialValues } from '../../admin/common/actionNote'
import { getAdminDetailSeedData } from '../../admin/detailDrawer'
import {
  areAdminTicketFiltersEqual,
  buildAdminQueryPath,
  readAdminTicketFiltersFromSearch,
} from '../../admin/routeFilters'
import {
  buildLocalTicketDetail,
  getTicketDetailLabels,
  getTicketDetailPreferredKeys,
} from '../../admin/support/detail'
import { assignAdminTicketLocal, resolveAdminTicketLocal } from '../../admin/support/draft'
import { canMutateLocalAdminDraft, getAdminSourceTagColor } from '../../admin/source'
import { getTicketPriorityTone, getTicketStatusTone } from '../../admin/status'
import {
  assignAdminTicket,
  getAdminTicketDetail,
  resolveAdminTicket,
  type AdminTicketRecord,
} from '../../api/adminSupport'
import { AdminDetailDrawer } from '../../components/admin/AdminDetailDrawer'
import { AdminMetricStrip } from '../../components/admin/AdminMetricStrip'
import { AdminTabbedWorkbench, type AdminWorkbenchSection } from '../../components/admin/AdminTabbedWorkbench'
import { StatusTag } from '../../components/admin/StatusTag'
import { AdminTicketFilters, type AdminTicketFiltersValue } from '../../components/admin/support/AdminTicketFilters'
import { SystemEditorDrawer } from '../../components/admin/system/SystemEditorDrawer'
import { ActionButtons } from '../../components/common/ActionButtons'
import { PageHeader } from '../../components/common/PageHeader'
import { SelectionSummaryBar } from '../../components/common/SelectionSummaryBar'
import { useAdminSupportData } from '../../hooks/useAdminSupportData'
import { getAdminConsoleText } from '../../i18n/adminConsole'
import type { Locale } from '../../i18n/copy'
import { replaceTo, useLocationSearch } from '../../router'

type AdminSupportPageProps = {
  locale: Locale
}

type AssignDrawerState = {
  open: boolean
  ticket: AdminTicketRecord | null
  ticketNos: string[]
}

type DetailDrawerState = {
  open: boolean
  title: string
  loading: boolean
  error: string | null
  data: Record<string, unknown> | null
}

type ResolveDrawerState = {
  open: boolean
  tickets: AdminTicketRecord[]
}

const emptyResolveDrawerState: ResolveDrawerState = {
  open: false,
  tickets: [],
}

export function AdminSupportPage(props: AdminSupportPageProps) {
  const { locale } = props
  const text = getAdminConsoleText(locale)
  const { message } = App.useApp()
  const locationSearch = useLocationSearch()
  const routeFilters = useMemo(
    () => readAdminTicketFiltersFromSearch(locationSearch),
    [locationSearch],
  )
  const { tickets, setTickets, loading, error, source, remoteEnabled, reload } = useAdminSupportData(locale)
  const [assignDrawer, setAssignDrawer] = useState<AssignDrawerState>({
    open: false,
    ticket: null,
    ticketNos: [],
  })
  const [detailDrawer, setDetailDrawer] = useState<DetailDrawerState>({
    open: false,
    title: '',
    loading: false,
    error: null,
    data: null,
  })
  const [resolveDrawer, setResolveDrawer] = useState<ResolveDrawerState>(emptyResolveDrawerState)
  const [selectedTicketKeys, setSelectedTicketKeys] = useState<Key[]>([])
  const [ticketFilters, setTicketFilters] = useState<AdminTicketFiltersValue>(() =>
    readAdminTicketFiltersFromSearch(window.location.search),
  )
  const remoteOnlyMessage =
    locale === 'zh-CN'
      ? '当前远程接口不可用，工单操作需要连接后端接口。'
      : 'Remote API unavailable. Ticket actions require a backend connection.'

  const labels = useMemo(
    () => ({
      viewDetail: locale === 'zh-CN' ? '查看详情' : 'Details',
      assign: locale === 'zh-CN' ? '分配工单' : 'Assign',
      resolve: locale === 'zh-CN' ? '解决工单' : 'Resolve',
      assignedTo: locale === 'zh-CN' ? '指派给' : 'Assigned to',
      save: locale === 'zh-CN' ? '保存' : 'Save',
      cancel: locale === 'zh-CN' ? '取消' : 'Cancel',
      reload: locale === 'zh-CN' ? '刷新' : 'Reload',
      remoteReady: locale === 'zh-CN' ? '远程接口' : 'Remote API',
      localFallback: locale === 'zh-CN' ? '本地兜底' : 'Local fallback',
      localDraft: locale === 'zh-CN' ? '本地草稿' : 'Local draft',
      remoteUnavailable: locale === 'zh-CN' ? '远程不可用' : 'Remote unavailable',
      actionSuccess: locale === 'zh-CN' ? '工单已更新' : 'Ticket updated',
      actionFailed: locale === 'zh-CN' ? '请求失败，请稍后重试。' : 'Request failed. Please try again.',
      processing: locale === 'zh-CN' ? '处理中' : 'Processing',
      highPriority: locale === 'zh-CN' ? '高优先级' : 'High priority',
      operatorLoad: locale === 'zh-CN' ? '坐席负载' : 'Operator load',
      ticketDesk: locale === 'zh-CN' ? '工单工作台' : 'Ticket desk',
      operators: locale === 'zh-CN' ? '值班人员' : 'Operators',
    }),
    [locale],
  )
  const batchTitle = locale === 'zh-CN' ? '批量操作' : 'Bulk actions'
  const clearSelectionText = locale === 'zh-CN' ? '清空选择' : 'Clear'
  const selectedOneText = locale === 'zh-CN' ? '条记录已选中' : 'record selected'
  const selectedManyText = locale === 'zh-CN' ? '条记录已选中' : 'records selected'

  useEffect(() => {
    setSelectedTicketKeys([])
  }, [ticketFilters])

  useEffect(() => {
    setTicketFilters((prev) => (areAdminTicketFiltersEqual(prev, routeFilters) ? prev : routeFilters))
  }, [routeFilters])

  useEffect(() => {
    replaceTo(
      buildAdminSupportLocation(ticketFilters),
    )
  }, [ticketFilters])

  const filteredTickets = useMemo(
    () => tickets.filter((ticket) => matchesTicketFilters(ticket, ticketFilters)),
    [ticketFilters, tickets],
  )
  const urgentTickets = filteredTickets.filter((ticket) => ticket.priority === 'urgent' || ticket.priority === 'high')
  const operatorLoad = Array.from(
    filteredTickets.reduce((map, ticket) => {
      const current = map.get(ticket.assignedTo || 'Unassigned') ?? {
        key: (ticket.assignedTo || 'Unassigned').toLowerCase(),
        assignedTo: ticket.assignedTo || 'Unassigned',
        total: 0,
        processing: 0,
        urgent: 0,
      }

      current.total += 1

      if (ticket.status === 'processing') {
        current.processing += 1
      }

      if (ticket.priority === 'urgent' || ticket.priority === 'high') {
        current.urgent += 1
      }

      map.set(ticket.assignedTo || 'Unassigned', current)
      return map
    }, new Map<string, { key: string; assignedTo: string; total: number; processing: number; urgent: number }>()),
  ).map(([, value]) => value)
  const selectedTickets = tickets.filter((ticket) => selectedTicketKeys.includes(ticket.key))
  const selectableTickets = selectedTickets.filter(canAssignTicket)
  const resolvableTickets = selectedTickets.filter(canResolveTicket)
  const ticketRowSelection = {
    selectedRowKeys: selectedTicketKeys,
    onChange: (keys: Key[]) => setSelectedTicketKeys(keys),
    preserveSelectedRowKeys: true,
  }
  const ticketSelectionBar = (
    <SelectionSummaryBar
      selectedCount={selectedTickets.length}
      title={batchTitle}
      itemLabelSingular={selectedOneText}
      itemLabelPlural={selectedManyText}
      clearText={clearSelectionText}
      onClear={() => setSelectedTicketKeys([])}
      actions={[
        {
          key: 'batch_assign',
          label: labels.assign,
          type: 'primary',
          hidden: !selectableTickets.length,
          onClick: () =>
            setAssignDrawer({
              open: true,
              ticket: null,
              ticketNos: selectableTickets.map((ticket) => ticket.ticketNo),
            }),
        },
        {
          key: 'batch_resolve',
          label: labels.resolve,
          hidden: !resolvableTickets.length,
          onClick: () =>
            setResolveDrawer({
              open: true,
              tickets: resolvableTickets,
            }),
        },
      ]}
    />
  )
  const ticketFiltersToolbar = (
    <AdminTicketFilters
      locale={locale}
      value={ticketFilters}
      loading={loading}
      onChange={setTicketFilters}
      onReset={() =>
        setTicketFilters({
          ticketNo: '',
          status: '',
          priority: '',
          assignedTo: '',
        })
      }
    />
  )

  const ticketColumns: TableColumnsType<Record<string, unknown>> = [
    { title: text.table.ticketNo, dataIndex: 'ticketNo', width: 156 },
    { title: text.table.subject, dataIndex: 'subject' },
    { title: text.table.customer, dataIndex: 'customer', width: 170 },
    {
      title: text.table.priority,
      dataIndex: 'priority',
      width: 112,
      render: (value: string) => (
        <StatusTag label={text.enums.ticketPriority[value] ?? value} tone={getTicketPriorityTone(value as never)} />
      ),
    },
    {
      title: text.table.status,
      dataIndex: 'status',
      width: 132,
      render: (value: string) => (
        <StatusTag label={text.enums.ticketStatus[value] ?? value} tone={getTicketStatusTone(value as never)} />
      ),
    },
    { title: text.table.assignedTo, dataIndex: 'assignedTo', width: 120 },
    { title: text.table.createdAt, dataIndex: 'createdAt', width: 156 },
    {
      title: locale === 'zh-CN' ? '操作' : 'Actions',
      key: 'actions',
      width: 252,
      fixed: 'right',
      render: (_value, record) => renderTicketActions(record as AdminTicketRecord),
    },
  ]

  const operatorColumns: TableColumnsType<Record<string, unknown>> = [
    { title: text.table.assignedTo, dataIndex: 'assignedTo', width: '30%' },
    { title: text.sections.tickets, dataIndex: 'total', width: '24%', align: 'center' },
    { title: labels.processing, dataIndex: 'processing', width: '23%', align: 'center' },
    { title: labels.highPriority, dataIndex: 'urgent', width: '23%', align: 'center' },
  ]

  const sections: AdminWorkbenchSection[] = [
    {
      key: 'tickets',
      label: text.sections.tickets,
      title: labels.ticketDesk,
      description:
        locale === 'zh-CN'
          ? '按文档接口接入工单查询、分配与解决流程。'
          : 'Connected to documented ticket APIs with assignment and resolve flows.',
      dataSource: filteredTickets,
      columns: ticketColumns,
      rowSelection: ticketRowSelection,
      scrollX: 1400,
      showPagination: false,
      selectionBar: ticketSelectionBar,
      toolbarExtra: ticketFiltersToolbar,
    },
    {
      key: 'urgent_tickets',
      label: text.sections.urgentTickets,
      title: text.sections.urgentTickets,
      dataSource: urgentTickets,
      columns: ticketColumns,
      rowSelection: ticketRowSelection,
      scrollX: 1400,
      showPagination: false,
      selectionBar: ticketSelectionBar,
      toolbarExtra: ticketFiltersToolbar,
    },
    {
      key: 'operators',
      label: labels.operatorLoad,
      title: labels.operatorLoad,
      dataSource: operatorLoad,
      columns: operatorColumns,
      scrollX: '100%',
      showPagination: false,
      toolbarExtra: ticketFiltersToolbar,
    },
  ]

  const sourceTag = (
    <Tag color={getAdminSourceTagColor(source, remoteEnabled)}>
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
      <PageHeader title={text.pages.support.title} subtitle={text.pages.support.subtitle} extra={sourceTag} />

      <AdminMetricStrip
        items={[
          {
            key: 'open_tickets',
            title: text.metrics.openTickets,
            value: filteredTickets.filter((ticket) => ticket.status === 'open').length,
            percent: 45,
            color: '#d97706',
            icon: <CustomerServiceOutlined />,
          },
          {
            key: 'processing_tickets',
            title: labels.processing,
            value: filteredTickets.filter((ticket) => ticket.status === 'processing').length,
            percent: 68,
            color: '#2563eb',
            icon: <FieldTimeOutlined />,
          },
          {
            key: 'high_priority',
            title: labels.highPriority,
            value: urgentTickets.length,
            percent: 54,
            color: '#ef4444',
            icon: <NotificationOutlined />,
          },
          {
            key: 'operators',
            title: labels.operators,
            value: new Set(filteredTickets.map((ticket) => ticket.assignedTo || 'Unassigned')).size,
            percent: 80,
            color: '#0f9f6e',
            icon: <TeamOutlined />,
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
                  void reload().catch((nextError) => {
                    message.error(getErrorMessage(nextError, labels.actionFailed))
                  })
                  setSelectedTicketKeys([])
                },
              },
            ]}
          />
        }
      />

      <SystemEditorDrawer
        locale={locale}
        open={assignDrawer.open}
        title={labels.assign}
        fields={[
          {
            name: 'assignedTo',
            label: labels.assignedTo,
            type: 'text',
            required: true,
          },
        ]}
        initialValues={{
          assignedTo: assignDrawer.ticket?.assignedTo ?? '',
        }}
        submitText={labels.save}
        cancelText={labels.cancel}
        onCancel={() => setAssignDrawer({ open: false, ticket: null, ticketNos: [] })}
        onSubmit={async (values) => {
          if (!assignDrawer.ticketNos.length) {
            return
          }

          try {
            const assignedTo = String(values.assignedTo ?? '')

            if (source === 'remote') {
              await Promise.all(assignDrawer.ticketNos.map((ticketNo) => assignAdminTicket(ticketNo, assignedTo)))
              await reload()
            } else if (canMutateLocalAdminDraft(source, remoteEnabled)) {
              setTickets((prev) =>
                assignDrawer.ticketNos.reduce(
                  (draft, ticketNo) => assignAdminTicketLocal(draft, ticketNo, assignedTo),
                  prev,
                ),
              )
            } else {
              throw new Error(remoteOnlyMessage)
            }

            setAssignDrawer({ open: false, ticket: null, ticketNos: [] })
            setSelectedTicketKeys([])
            message.success(labels.actionSuccess)
          } catch (nextError) {
            message.error(getErrorMessage(nextError, labels.actionFailed))
            throw nextError
          }
        }}
      />

      <SystemEditorDrawer
        locale={locale}
        open={resolveDrawer.open}
        title={
          resolveDrawer.tickets.length > 1
            ? `${labels.resolve} (${resolveDrawer.tickets.length})`
            : labels.resolve
        }
        fields={buildActionNoteFields(locale, {
          placeholderZh: '请输入处理结果或客户回访说明',
          placeholderEn: 'Enter the resolution summary or customer follow-up note',
          helpZh: '该备注会写入工单解决记录。',
          helpEn: 'This note will be written into the ticket resolution record.',
        })}
        initialValues={getActionNoteInitialValues()}
        submitText={labels.save}
        cancelText={labels.cancel}
        onCancel={() => setResolveDrawer(emptyResolveDrawerState)}
        onSubmit={async (values) => {
          if (!resolveDrawer.tickets.length) {
            return
          }

          try {
            const note = String(values.note ?? '')

            if (source === 'remote') {
              await Promise.all(
                resolveDrawer.tickets.map((ticket) => resolveAdminTicket(ticket.ticketNo, note)),
              )
              await reload()
            } else if (canMutateLocalAdminDraft(source, remoteEnabled)) {
              setTickets((prev) =>
                resolveDrawer.tickets.reduce(
                  (draft, ticket) => resolveAdminTicketLocal(draft, ticket.ticketNo, note),
                  prev,
                ),
              )
            } else {
              throw new Error(remoteOnlyMessage)
            }

            setResolveDrawer(emptyResolveDrawerState)
            setSelectedTicketKeys([])
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
        fieldLabels={getTicketDetailLabels(locale)}
        preferredKeys={getTicketDetailPreferredKeys()}
        onClose={() =>
          setDetailDrawer({
            open: false,
            title: '',
            loading: false,
            error: null,
            data: null,
          })
        }
      />
    </div>
  )

  function renderTicketActions(ticket: AdminTicketRecord) {
    return (
      <ActionButtons
        wrap
        actions={[
          {
            key: 'detail',
            label: labels.viewDetail,
            onClick: () => void openTicketDetail(ticket),
          },
          {
            key: 'assign',
            label: labels.assign,
            type: 'primary',
            hidden: ticket.status === 'resolved' || ticket.status === 'closed',
            onClick: () => setAssignDrawer({ open: true, ticket, ticketNos: [ticket.ticketNo] }),
          },
          {
            key: 'resolve',
            label: labels.resolve,
            hidden: ticket.status === 'resolved' || ticket.status === 'closed',
            onClick: () =>
              setResolveDrawer({
                open: true,
                tickets: [ticket],
              }),
          },
        ]}
      />
    )
  }

  async function openTicketDetail(ticket: AdminTicketRecord) {
    const remoteDetailReady = source === 'remote'
    const fallbackDetail = buildLocalTicketDetail(ticket, locale)
    const title = `${labels.viewDetail} - ${ticket.ticketNo}`

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
      const remoteDetail = await getAdminTicketDetail(ticket.ticketNo)
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

function buildAdminSupportLocation(filters: AdminTicketFiltersValue) {
  return buildAdminQueryPath('/admin/support', {
    ticketNo: filters.ticketNo,
    status: filters.status,
    priority: filters.priority,
    assignedTo: filters.assignedTo,
  })
}

function canAssignTicket(ticket: AdminTicketRecord) {
  return ticket.status !== 'resolved' && ticket.status !== 'closed'
}

function canResolveTicket(ticket: AdminTicketRecord) {
  return ticket.status !== 'resolved' && ticket.status !== 'closed'
}

function matchesTicketFilters(ticket: AdminTicketRecord, filters: AdminTicketFiltersValue) {
  if (filters.ticketNo && !ticket.ticketNo.toLowerCase().includes(filters.ticketNo.toLowerCase())) {
    return false
  }

  if (filters.status && ticket.status !== filters.status) {
    return false
  }

  if (filters.priority && ticket.priority !== filters.priority) {
    return false
  }

  if (filters.assignedTo && !ticket.assignedTo.toLowerCase().includes(filters.assignedTo.toLowerCase())) {
    return false
  }

  return true
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}
