import { Alert, App, Badge, Tabs, Tag } from 'antd'
import type { TabsProps } from 'antd'
import type { Key } from 'react'
import { useMemo, useState } from 'react'

import { getTableTotalText } from '../../admin/presentation'
import { filterRecordsByQuery } from '../../admin/table'
import {
  deleteSectionRecord,
  deleteSectionRecords,
  prependAudit,
  saveSectionRecord,
  updateSectionEnabled,
} from '../../admin/system/draft'
import { buildSystemMetricItems } from '../../admin/system/metrics'
import {
  buildTelegramWebhookDetailData,
  buildLocalSystemAuditDetail,
  emptyAdminTelegramWebhookDetailDrawerState,
  emptyAdminSystemAuditDetailDrawerState,
  getTelegramWebhookActionLabels,
  getTelegramWebhookDetailFieldLabels,
  getTelegramWebhookDetailPreferredKeys,
  getTelegramWebhookDetailTitle,
  getSystemAuditDetailLabels,
  getSystemAuditDetailPreferredKeys,
  getSystemAuditDetailTitle,
  isPersistedAuditLogKey,
} from '../../admin/system/detail'
import { getAdminDetailSeedData } from '../../admin/detailDrawer'
import {
  emptySystemEditorState,
  getActionErrorMessage,
  getSystemPageLabels,
  getSystemTestPreferredKeys,
  getSystemTestResultFieldLabels,
  getSystemTestResultTitle,
  getSystemSourceLabel,
  type SystemEditorState,
} from '../../admin/system/presentation'
import {
  getSystemSectionConfig,
  getSystemSectionItems,
} from '../../admin/system/sections'
import type { SystemSectionKey } from '../../admin/system/types'
import {
  deleteAdminTelegramWebhook,
  deleteAdminSystemSectionRecord,
  getAdminAuditLogDetail,
  getAdminTelegramWebhookInfo,
  getAdminTelegramWebhookSetup,
  saveAdminSystemSectionRecord,
  syncAdminTelegramWebhook,
  supportsRemoteSystemSection,
  testAdminSystemSectionRecord,
} from '../../api/adminSystem'
import { AdminMetricStrip } from '../../components/admin/AdminMetricStrip'
import { AdminDetailDrawer } from '../../components/admin/AdminDetailDrawer'
import { SystemEditorDrawer } from '../../components/admin/system/SystemEditorDrawer'
import { ActionButtons } from '../../components/common/ActionButtons'
import { DataTable } from '../../components/common/DataTable'
import { PageHeader } from '../../components/common/PageHeader'
import { SearchToolbar } from '../../components/common/SearchToolbar'
import { SelectionSummaryBar } from '../../components/common/SelectionSummaryBar'
import {
  createAdminAuditLog,
  useAdminSystemConfig,
} from '../../hooks/useAdminSystemConfig'
import { getAdminConsoleText } from '../../i18n/adminConsole'
import type { Locale } from '../../i18n/copy'
import { getAdminSourceTagColor } from '../../admin/source'

type AdminSystemPageProps = {
  locale: Locale
  operatorName?: string
}

type SystemTestDrawerState = {
  open: boolean
  title: string
  loading: boolean
  targetId: string
  mode: 'auto' | 'preview' | 'live'
  data: Record<string, unknown> | null
}

const emptySystemTestDrawerState: SystemTestDrawerState = {
  open: false,
  title: '',
  loading: false,
  targetId: '',
  mode: 'auto',
  data: null,
}

export function AdminSystemPage(props: AdminSystemPageProps) {
  const { locale, operatorName } = props
  const text = getAdminConsoleText(locale)
  const labels = getSystemPageLabels(locale)
  const webhookLabels = getTelegramWebhookActionLabels(locale)
  const { modal, message } = App.useApp()
  const {
    draft,
    setDraft,
    resetDraft,
    reload,
    loading,
    error,
    source,
    remoteEnabled,
  } = useAdminSystemConfig()
  const [activeSection, setActiveSection] =
    useState<SystemSectionKey>('paymentChannels')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([])
  const [editorState, setEditorState] = useState<SystemEditorState>(
    emptySystemEditorState,
  )
  const [testDrawer, setTestDrawer] = useState<SystemTestDrawerState>(
    emptySystemTestDrawerState,
  )
  const [auditDetailDrawer, setAuditDetailDrawer] = useState(
    emptyAdminSystemAuditDetailDrawerState,
  )
  const [telegramWebhookDrawer, setTelegramWebhookDrawer] = useState(
    emptyAdminTelegramWebhookDetailDrawerState,
  )
  const operator =
    operatorName || (locale === 'zh-CN' ? '当前管理员' : 'Current admin')
  const remoteAuditReady = source === 'remote'

  const sectionConfig = getSystemSectionConfig({
    section: activeSection,
    locale,
    text,
    draft,
    labels,
    actions: {
      onView: (record) => {
        if (activeSection === 'auditLogs') {
          void openAuditDetail(record)
          return
        }

        if (activeSection === 'telegramConfigs') {
          void openTelegramWebhookDetail(record)
        }
      },
      onEdit: (record) => {
        setEditorState({
          open: true,
          mode: 'edit',
          values: record,
        })
      },
      onDelete: (record) => {
        if (!sectionConfig.module || !sectionConfig.getTargetId) {
          return
        }

        modal.confirm({
          title: labels.deleteConfirmTitle,
          content: labels.deleteConfirmBody,
          onOk: async () => {
            const targetId = sectionConfig.getTargetId?.(record) ?? ''

            try {
              if (remoteEnabled && supportsRemoteSystemSection(activeSection)) {
                await deleteAdminSystemSectionRecord(activeSection, targetId)
                await reload()
              } else {
                setDraft((prev) =>
                  deleteSectionRecord(
                    prev,
                    activeSection,
                    targetId,
                    operator,
                    sectionConfig.module!,
                  ),
                )
              }

              message.success(labels.deleted)
            } catch (nextError) {
              message.error(getActionErrorMessage(nextError, locale))
            }
          },
        })
      },
      onTest: (record) => {
        if (!sectionConfig.module || !sectionConfig.getTargetId) {
          return
        }

        const targetId = sectionConfig.getTargetId(record)
        void runSystemSectionTest(targetId, 'auto')
      },
      onToggleEnabled: (record, enabled) => {
        void handleToggleRecord(record, enabled)
      },
    },
  })

  const sectionItems = getSystemSectionItems(locale, draft)
  const filteredDataSource = useMemo(
    () => filterRecordsByQuery(sectionConfig.dataSource, searchQuery),
    [sectionConfig.dataSource, searchQuery],
  )
  const supportsSelection = Boolean(
    sectionConfig.module && sectionConfig.getTargetId,
  )
  const selectedRecords = sectionConfig.dataSource.filter((record) =>
    selectedRowKeys.includes(String(record.key ?? '')),
  )
  const hasEnabledSelection = selectedRecords.some(
    (record) => typeof record.enabled === 'boolean',
  )
  const tabItems: TabsProps['items'] = sectionItems.map((item) => ({
    key: item.key,
    label: (
      <span>
        {item.label} <Badge count={item.count} size="small" />
      </span>
    ),
  }))
  const sourceTag = (
    <Tag color={getAdminSourceTagColor(source, remoteEnabled)}>
      {getSystemSourceLabel(source, remoteEnabled, labels)}
    </Tag>
  )

  return (
    <div className="admin-page admin-page--system">
      <PageHeader
        title={text.pages.system.title}
        subtitle={text.pages.system.subtitle}
        extra={sourceTag}
      />

      {error ? (
        <Alert
          showIcon
          type="warning"
          message={labels.loadWarningTitle}
          description={error}
          style={{ marginBottom: 16 }}
        />
      ) : null}

      <AdminMetricStrip items={buildSystemMetricItems(draft, locale)} />

      <DataTable
        rowKey="key"
        loading={loading}
        dataSource={filteredDataSource}
        columns={sectionConfig.columns}
        cardTitle={sectionConfig.title}
        cardTabs={
          <Tabs
            size="small"
            activeKey={activeSection}
            items={tabItems}
            onChange={(key) => {
              setActiveSection(key as SystemSectionKey)
              setEditorState(emptySystemEditorState)
              setTestDrawer(emptySystemTestDrawerState)
              setAuditDetailDrawer(emptyAdminSystemAuditDetailDrawerState)
              setTelegramWebhookDrawer(emptyAdminTelegramWebhookDetailDrawerState)
              setSearchQuery('')
              setSelectedRowKeys([])
            }}
          />
        }
        cardChildren={
          <div className="admin-console__lead">{sectionConfig.description}</div>
        }
        cardToolbar={
          <SearchToolbar
            value={searchQuery}
            placeholder={labels.searchPlaceholder}
            searchText={labels.search}
            resetText={labels.resetSearch}
            loading={loading}
            onValueChange={setSearchQuery}
            onReset={() => setSearchQuery('')}
            extra={
              <ActionButtons
                actions={[
                  {
                    key: 'create',
                    label: sectionConfig.createLabel ?? '',
                    type: 'primary',
                    hidden: !(
                      sectionConfig.fields &&
                      sectionConfig.createInitial &&
                      sectionConfig.createLabel
                    ),
                    onClick: () =>
                      setEditorState({
                        open: true,
                        mode: 'create',
                        values: sectionConfig.createInitial?.() ?? {},
                      }),
                  },
                  {
                    key: 'reset',
                    label: labels.reset,
                    onClick: () => {
                      modal.confirm({
                        title: labels.resetConfirmTitle,
                        content: labels.resetConfirmBody,
                        onOk: async () => {
                          try {
                            await resetDraft()
                            setSearchQuery('')
                            setSelectedRowKeys([])
                            setEditorState(emptySystemEditorState)
                            message.success(labels.saved)
                          } catch (nextError) {
                            message.error(getActionErrorMessage(nextError, locale))
                          }
                        },
                      })
                    },
                  },
                ]}
              />
            }
          />
        }
        cardSelectionBar={
          supportsSelection ? (
            <SelectionSummaryBar
              selectedCount={selectedRowKeys.length}
              title={labels.batch}
              itemLabelSingular={labels.selectedOne}
              itemLabelPlural={labels.selectedMany}
              clearText={labels.clearSelection}
              onClear={() => setSelectedRowKeys([])}
              actions={[
                {
                  key: 'enable',
                  label: labels.enableSelected,
                  hidden: !hasEnabledSelection,
                  onClick: () => {
                    void handleToggleSelected(true)
                  },
                },
                {
                  key: 'disable',
                  label: labels.disableSelected,
                  hidden: !hasEnabledSelection,
                  onClick: () => {
                    void handleToggleSelected(false)
                  },
                },
                {
                  key: 'delete',
                  label: labels.deleteSelected,
                  danger: true,
                  onClick: () => {
                    void handleDeleteSelected()
                  },
                },
              ]}
            />
          ) : null
        }
        rowSelection={
          supportsSelection
            ? {
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys),
                preserveSelectedRowKeys: true,
              }
            : undefined
        }
        showPagination={filteredDataSource.length > 8}
        paginationShowTotal={(total) => getTableTotalText(locale, total)}
        scroll={{ x: 1180 }}
      />

      {sectionConfig.fields ? (
        <SystemEditorDrawer
          locale={locale}
          open={editorState.open}
          title={`${editorState.mode === 'create' ? labels.saveCreate : labels.edit} ${sectionConfig.title}`}
          fields={sectionConfig.fields}
          initialValues={editorState.values}
          submitText={
            editorState.mode === 'create' ? labels.saveCreate : labels.saveEdit
          }
          cancelText={labels.cancel}
          onCancel={() => setEditorState(emptySystemEditorState)}
          onValuesChange={sectionConfig.editorOnValuesChange}
          onSubmit={async (values) => {
            if (!sectionConfig.module || !sectionConfig.getTargetId) {
              return
            }

            try {
              if (remoteEnabled && supportsRemoteSystemSection(activeSection)) {
                await saveAdminSystemSectionRecord(
                  activeSection,
                  editorState.mode,
                  values,
                )
                await reload()
              } else {
                const nextDraft = saveSectionRecord(
                  draft,
                  activeSection,
                  editorState.mode,
                  values,
                  operator,
                  sectionConfig.module,
                  sectionConfig.getTargetId,
                )

                setDraft(nextDraft)
              }

              setEditorState(emptySystemEditorState)
              message.success(labels.saved)
            } catch (nextError) {
              message.error(getActionErrorMessage(nextError, locale))
              throw nextError
            }
          }}
        />
      ) : null}

      <AdminDetailDrawer
        locale={locale}
        open={testDrawer.open}
        title={testDrawer.title}
        loading={testDrawer.loading}
        data={testDrawer.data}
        extra={
          activeSection === 'actions' && testDrawer.targetId ? (
            <ActionButtons
              actions={[
                {
                  key: 'preview',
                  label: labels.previewTest,
                  loading: testDrawer.loading && testDrawer.mode === 'preview',
                  hidden: testDrawer.mode === 'preview',
                  onClick: () => {
                    void runSystemSectionTest(testDrawer.targetId, 'preview')
                  },
                },
                {
                  key: 'live',
                  label: labels.liveTest,
                  type: 'primary',
                  hidden:
                    !Boolean(testDrawer.data?.live_test_allowed) ||
                    testDrawer.mode === 'live' ||
                    String(testDrawer.data?.execution_mode ?? '') ===
                      'executed_internal',
                  loading: testDrawer.loading && testDrawer.mode === 'live',
                  onClick: () => {
                    modal.confirm({
                      title: labels.liveTestConfirmTitle,
                      content: labels.liveTestConfirmBody,
                      onOk: async () => {
                        await runSystemSectionTest(testDrawer.targetId, 'live')
                      },
                    })
                  },
                },
              ]}
            />
          ) : null
        }
        fieldLabels={getSystemTestResultFieldLabels(locale)}
        preferredKeys={getSystemTestPreferredKeys(activeSection)}
        onClose={() => setTestDrawer(emptySystemTestDrawerState)}
      />

      <AdminDetailDrawer
        locale={locale}
        open={auditDetailDrawer.open}
        title={auditDetailDrawer.title}
        loading={auditDetailDrawer.loading}
        error={auditDetailDrawer.error}
        data={auditDetailDrawer.data}
        fieldLabels={getSystemAuditDetailLabels(locale)}
        preferredKeys={getSystemAuditDetailPreferredKeys()}
        onClose={() =>
          setAuditDetailDrawer(emptyAdminSystemAuditDetailDrawerState)
        }
      />

      <AdminDetailDrawer
        locale={locale}
        open={telegramWebhookDrawer.open}
        title={telegramWebhookDrawer.title}
        loading={telegramWebhookDrawer.loading}
        error={telegramWebhookDrawer.error}
        data={telegramWebhookDrawer.data}
        extra={
          telegramWebhookDrawer.botKey ? (
            <ActionButtons
              actions={[
                {
                  key: 'refresh_webhook',
                  label: webhookLabels.refresh,
                  onClick: () => {
                    void loadTelegramWebhookDetail(telegramWebhookDrawer.botKey)
                  },
                },
                {
                  key: 'sync_webhook',
                  label: webhookLabels.sync,
                  type: 'primary',
                  loading: telegramWebhookDrawer.syncing,
                  onClick: () => {
                    void handleSyncTelegramWebhook()
                  },
                },
                {
                  key: 'delete_webhook',
                  label: webhookLabels.delete,
                  danger: true,
                  loading: telegramWebhookDrawer.deleting,
                  onClick: () => {
                    void confirmDeleteTelegramWebhook(false)
                  },
                },
                {
                  key: 'delete_webhook_drop',
                  label: webhookLabels.deleteAndDrop,
                  danger: true,
                  loading: telegramWebhookDrawer.deleting,
                  onClick: () => {
                    void confirmDeleteTelegramWebhook(true)
                  },
                },
              ]}
            />
          ) : null
        }
        fieldLabels={getTelegramWebhookDetailFieldLabels(locale)}
        preferredKeys={getTelegramWebhookDetailPreferredKeys()}
        onClose={() =>
          setTelegramWebhookDrawer(emptyAdminTelegramWebhookDetailDrawerState)
        }
      />
    </div>
  )

  async function handleToggleSelected(enabled: boolean) {
    if (!sectionConfig.module || !sectionConfig.getTargetId) {
      return
    }

    try {
      const targetIds = selectedRecords.map((record) =>
        sectionConfig.getTargetId!(record),
      )

      if (remoteEnabled && supportsRemoteSystemSection(activeSection)) {
        await Promise.all(
          selectedRecords.map((record) =>
            saveAdminSystemSectionRecord(activeSection, 'edit', {
              ...record,
              enabled,
            }),
          ),
        )
        await reload()
      } else {
        setDraft((prev) =>
          updateSectionEnabled(
            prev,
            activeSection,
            targetIds,
            enabled,
            operator,
            sectionConfig.module!,
          ),
        )
      }

      setSelectedRowKeys([])
      message.success(labels.saved)
    } catch (nextError) {
      message.error(getActionErrorMessage(nextError, locale))
    }
  }

  async function handleToggleRecord(
    record: Record<string, unknown>,
    enabled: boolean,
  ) {
    if (!sectionConfig.module || !sectionConfig.getTargetId) {
      return
    }

    const targetId = sectionConfig.getTargetId(record)

    try {
      if (remoteEnabled && supportsRemoteSystemSection(activeSection)) {
        await saveAdminSystemSectionRecord(activeSection, 'edit', {
          ...record,
          enabled,
        })
        await reload()
      } else {
        setDraft((prev) =>
          updateSectionEnabled(
            prev,
            activeSection,
            [targetId],
            enabled,
            operator,
            sectionConfig.module!,
          ),
        )
      }

      setSelectedRowKeys((prev) =>
        prev.filter((key) => String(key) !== String(record.key ?? '')),
      )
      message.success(labels.saved)
    } catch (nextError) {
      message.error(getActionErrorMessage(nextError, locale))
    }
  }

  async function runSystemSectionTest(
    targetId: string,
    mode: 'auto' | 'preview' | 'live',
  ) {
    if (!sectionConfig.module) {
      return
    }

    try {
      if (remoteEnabled && supportsRemoteSystemSection(activeSection)) {
        setTestDrawer((prev) => ({
          open: true,
          title: getSystemTestResultTitle(activeSection, locale),
          loading: true,
          targetId,
          mode,
          data: prev.targetId === targetId ? prev.data : null,
        }))

        const result = await testAdminSystemSectionRecord(activeSection, targetId, {
          mode,
        })
        await reload()
        setTestDrawer({
          open: true,
          title: getSystemTestResultTitle(activeSection, locale),
          loading: false,
          targetId,
          mode,
          data: result,
        })
      } else {
        appendAuditLog(sectionConfig.module, 'test_config', targetId)
      }

      message.success(labels.tested)
    } catch (nextError) {
      setTestDrawer((prev) => ({
        ...prev,
        open: prev.open || activeSection === 'actions',
        title: getSystemTestResultTitle(activeSection, locale),
        loading: false,
        targetId,
        mode,
      }))
      message.error(getActionErrorMessage(nextError, locale))
    }
  }

  async function handleDeleteSelected() {
    if (!sectionConfig.module || !sectionConfig.getTargetId) {
      return
    }

    modal.confirm({
      title: labels.deleteSelectedConfirmTitle,
      content: labels.deleteSelectedConfirmBody,
      onOk: async () => {
        const targetIds = selectedRecords.map((record) =>
          sectionConfig.getTargetId!(record),
        )

        try {
          if (remoteEnabled && supportsRemoteSystemSection(activeSection)) {
            await Promise.all(
              targetIds.map((targetId) =>
                deleteAdminSystemSectionRecord(activeSection, targetId),
              ),
            )
            await reload()
          } else {
            setDraft((prev) =>
              deleteSectionRecords(
                prev,
                activeSection,
                targetIds,
                operator,
                sectionConfig.module!,
              ),
            )
          }

          setSelectedRowKeys([])
          message.success(labels.deleted)
        } catch (nextError) {
          message.error(getActionErrorMessage(nextError, locale))
        }
      },
    })
  }

  function appendAuditLog(module: string, action: string, targetId: string) {
    setDraft((prev) =>
      prependAudit(prev, createAdminAuditLog(module, action, targetId, operator)),
    )
  }

  async function openAuditDetail(record: Record<string, unknown>) {
    const remoteDetailReady =
      remoteAuditReady && isPersistedAuditLogKey(record.key)
    const title = `${getSystemAuditDetailTitle(locale)} - ${
      String(record.targetId ?? record.key ?? '') || '-'
    }`
    const fallbackData = buildLocalSystemAuditDetail(
      record as (typeof draft.auditLogs)[number],
    )

    setAuditDetailDrawer({
      open: true,
      title,
      loading: remoteDetailReady,
      error: null,
      data: getAdminDetailSeedData(remoteDetailReady, fallbackData),
    })

    if (!remoteDetailReady) {
      return
    }

    try {
      const remoteDetail = await getAdminAuditLogDetail(String(record.key ?? ''))
      setAuditDetailDrawer({
        open: true,
        title,
        loading: false,
        error: null,
        data: remoteDetail,
      })
    } catch (nextError) {
      setAuditDetailDrawer({
        open: true,
        title,
        loading: false,
        error: getActionErrorMessage(nextError, locale),
        data: getAdminDetailSeedData(remoteDetailReady, fallbackData),
      })
    }
  }

  async function openTelegramWebhookDetail(record: Record<string, unknown>) {
    const botKey = String(record.botKey ?? '')
    const title = getTelegramWebhookDetailTitle(locale, botKey)

    setTelegramWebhookDrawer({
      open: true,
      title,
      botKey,
      loading: true,
      syncing: false,
      deleting: false,
      error: null,
      data: null,
    })

    await loadTelegramWebhookDetail(botKey)
  }

  async function loadTelegramWebhookDetail(botKey: string) {
    const title = getTelegramWebhookDetailTitle(locale, botKey)

    setTelegramWebhookDrawer((prev) => ({
      ...prev,
      open: true,
      title,
      botKey,
      loading: true,
      error: null,
    }))

    try {
      const setup = await getAdminTelegramWebhookSetup(botKey)
      let info: Record<string, unknown> | null = null
      let nextError: string | null = null

      try {
        info = await getAdminTelegramWebhookInfo(botKey)
      } catch (nextErrorValue) {
        nextError = `${webhookLabels.infoWarningPrefix}${getActionErrorMessage(nextErrorValue, locale)}`
      }

      setTelegramWebhookDrawer((prev) => ({
        ...prev,
        open: true,
        title,
        botKey,
        loading: false,
        error: nextError,
        data: buildTelegramWebhookDetailData(setup, info),
      }))
    } catch (nextError) {
      setTelegramWebhookDrawer((prev) => ({
        ...prev,
        open: true,
        title,
        botKey,
        loading: false,
        error: getActionErrorMessage(nextError, locale),
        data: null,
      }))
    }
  }

  async function handleSyncTelegramWebhook() {
    const botKey = telegramWebhookDrawer.botKey
    if (!botKey) {
      return
    }

    modal.confirm({
      title: webhookLabels.syncConfirmTitle,
      content: webhookLabels.syncConfirmBody,
      onOk: async () => {
        try {
          setTelegramWebhookDrawer((prev) => ({
            ...prev,
            syncing: true,
            error: null,
          }))
          await syncAdminTelegramWebhook(botKey)
          await Promise.all([
            loadTelegramWebhookDetail(botKey),
            reload().catch(() => undefined),
          ])
          message.success(webhookLabels.syncSuccess)
        } catch (nextError) {
          const errorMessage = getActionErrorMessage(nextError, locale)
          setTelegramWebhookDrawer((prev) => ({
            ...prev,
            syncing: false,
            error: errorMessage,
          }))
          message.error(errorMessage)
        } finally {
          setTelegramWebhookDrawer((prev) => ({
            ...prev,
            syncing: false,
          }))
        }
      },
    })
  }

  async function confirmDeleteTelegramWebhook(dropPendingUpdates: boolean) {
    const botKey = telegramWebhookDrawer.botKey
    if (!botKey) {
      return
    }

    modal.confirm({
      title: webhookLabels.deleteConfirmTitle,
      content: dropPendingUpdates
        ? webhookLabels.deleteAndDropConfirmBody
        : webhookLabels.deleteConfirmBody,
      onOk: async () => {
        try {
          setTelegramWebhookDrawer((prev) => ({
            ...prev,
            deleting: true,
            error: null,
          }))
          await deleteAdminTelegramWebhook(botKey, dropPendingUpdates)
          await Promise.all([
            loadTelegramWebhookDetail(botKey),
            reload().catch(() => undefined),
          ])
          message.success(webhookLabels.deleteSuccess)
        } catch (nextError) {
          const errorMessage = getActionErrorMessage(nextError, locale)
          setTelegramWebhookDrawer((prev) => ({
            ...prev,
            deleting: false,
            error: errorMessage,
          }))
          message.error(errorMessage)
        } finally {
          setTelegramWebhookDrawer((prev) => ({
            ...prev,
            deleting: false,
          }))
        }
      },
    })
  }
}
