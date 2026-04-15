import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ShoppingOutlined,
  TagsOutlined,
} from '@ant-design/icons'
import { Alert, App, Badge, Tabs, Tag } from 'antd'
import type { TabsProps } from 'antd'
import type { Key } from 'react'
import { useMemo, useState } from 'react'

import {
  buildProductEditorValues,
  getProductSectionConfig,
  getProductSectionItems,
} from '../../admin/products/sections'
import type { ProductSectionKey } from '../../admin/products/sections'
import type {
  AdminManagedProduct,
  AdminProductDraft,
  AdminProductPriceTemplate,
} from '../../admin/products/types'
import {
  buildLocalSystemAuditDetail,
  emptyAdminSystemAuditDetailDrawerState,
  getSystemAuditDetailLabels,
  getSystemAuditDetailPreferredKeys,
  getSystemAuditDetailTitle,
  isPersistedAuditLogKey,
} from '../../admin/system/detail'
import { getAdminDetailSeedData } from '../../admin/detailDrawer'
import { AdminMetricStrip } from '../../components/admin/AdminMetricStrip'
import { AdminDetailDrawer } from '../../components/admin/AdminDetailDrawer'
import { ProductPriceManagerDrawer } from '../../components/admin/products/ProductPriceManagerDrawer'
import { SystemEditorDrawer } from '../../components/admin/system/SystemEditorDrawer'
import { ActionButtons } from '../../components/common/ActionButtons'
import { DataTable } from '../../components/common/DataTable'
import { PageHeader } from '../../components/common/PageHeader'
import { SearchToolbar } from '../../components/common/SearchToolbar'
import { SelectionSummaryBar } from '../../components/common/SelectionSummaryBar'
import { getTableTotalText } from '../../admin/presentation'
import { getAdminSourceTagColor } from '../../admin/source'
import {
  deleteAdminProduct,
  deleteAdminProducts,
  deleteAdminProductPriceTemplate,
  deleteAdminProductPriceTemplates,
  updateAdminProductsEnabled,
  updateAdminProductPriceTemplatesEnabled,
  upsertAdminProduct,
  upsertAdminProductPriceTemplate,
} from '../../admin/products/draft'
import {
  deleteAdminProductSectionRecord,
  saveAdminProductSectionRecord,
  supportsRemoteProductSection,
} from '../../api/adminProducts'
import { getAdminAuditLogDetail } from '../../api/adminSystem'
import {
  createAdminProductAuditLog,
  useAdminProductsConfig,
} from '../../hooks/useAdminProductsConfig'
import { useAdminSystemConfig } from '../../hooks/useAdminSystemConfig'
import { getAdminConsoleText } from '../../i18n/adminConsole'
import type { Locale } from '../../i18n/copy'

type AdminProductsPageProps = {
  locale: Locale
  operatorName?: string
}

type EditorState = {
  open: boolean
  mode: 'create' | 'edit'
  values: Record<string, unknown>
}

export function AdminProductsPage(props: AdminProductsPageProps) {
  const { locale, operatorName } = props
  const text = getAdminConsoleText(locale)
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
  } = useAdminProductsConfig()
  const {
    draft: systemDraft,
    setDraft: setSystemDraft,
    reload: reloadSystemDraft,
  } = useAdminSystemConfig()
  const [activeSection, setActiveSection] = useState<ProductSectionKey>('products')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([])
  const [editorState, setEditorState] = useState<EditorState>({
    open: false,
    mode: 'create',
    values: {},
  })
  const [priceDrawerProduct, setPriceDrawerProduct] = useState<AdminManagedProduct | null>(null)
  const [auditDetailDrawer, setAuditDetailDrawer] = useState(
    emptyAdminSystemAuditDetailDrawerState,
  )

  const operator = operatorName || (locale === 'zh-CN' ? '当前管理员' : 'Current admin')
  const productAuditLogs = useMemo(
    () => systemDraft.auditLogs.filter((item) => item.module === 'products'),
    [systemDraft.auditLogs],
  )

  const labels = useMemo(
    () => ({
      view: locale === 'zh-CN' ? '详情' : 'Details',
      edit: locale === 'zh-CN' ? '编辑' : 'Edit',
      delete: locale === 'zh-CN' ? '删除' : 'Delete',
      managePrices: locale === 'zh-CN' ? '价格' : 'Prices',
      createProduct: locale === 'zh-CN' ? '新增商品' : 'New product',
      createPriceTemplate: locale === 'zh-CN' ? '新增价格模板' : 'New price template',
      saveCreate: locale === 'zh-CN' ? '创建' : 'Create',
      saveEdit: locale === 'zh-CN' ? '保存修改' : 'Save changes',
      cancel: locale === 'zh-CN' ? '取消' : 'Cancel',
      reset: locale === 'zh-CN' ? '恢复快照' : 'Reset snapshot',
      saved: locale === 'zh-CN' ? '商品配置已保存' : 'Product configuration saved',
      deleted: locale === 'zh-CN' ? '商品配置已删除' : 'Product configuration removed',
      resetConfirmTitle: locale === 'zh-CN' ? '恢复商品配置' : 'Reset product snapshot',
      resetConfirmBody:
        locale === 'zh-CN'
          ? '这会重置当前商品工作台草稿，并重新拉取可用的远程配置。'
          : 'This resets the current product draft and reloads any available remote configuration.',
      deleteProductConfirmTitle: locale === 'zh-CN' ? '确认删除商品' : 'Delete product',
      deleteProductConfirmBody:
        locale === 'zh-CN'
          ? '该商品以及关联的价格模板会立即移除。'
          : 'This product and its related price templates will be removed immediately.',
      deletePriceTemplateConfirmTitle: locale === 'zh-CN' ? '确认删除价格模板' : 'Delete price template',
      deletePriceTemplateConfirmBody:
        locale === 'zh-CN'
          ? '该价格模板会立即从当前配置中移除。'
          : 'This price template will be removed from the current configuration immediately.',
      batch: locale === 'zh-CN' ? '批量操作' : 'Bulk actions',
      clearSelection: locale === 'zh-CN' ? '清空选择' : 'Clear',
      enableSelected: locale === 'zh-CN' ? '批量启用' : 'Enable selected',
      disableSelected: locale === 'zh-CN' ? '批量停用' : 'Disable selected',
      deleteSelected: locale === 'zh-CN' ? '批量删除' : 'Delete selected',
      selectedOne: locale === 'zh-CN' ? '条记录已选中' : 'record selected',
      selectedMany: locale === 'zh-CN' ? '条记录已选中' : 'records selected',
      search: locale === 'zh-CN' ? '搜索' : 'Search',
      resetSearch: locale === 'zh-CN' ? '重置' : 'Reset',
      searchPlaceholder:
        locale === 'zh-CN' ? '搜索当前标签页中的关键字' : 'Search within the active tab',
      deleteSelectedConfirmTitle: locale === 'zh-CN' ? '确认批量删除' : 'Delete selected records',
      deleteSelectedConfirmBody:
        locale === 'zh-CN'
          ? '选中的记录会立即从当前配置中移除。'
          : 'The selected records will be removed from the current configuration.',
      remoteReady: locale === 'zh-CN' ? '远程接口' : 'Remote API',
      localFallback: locale === 'zh-CN' ? '本地兜底' : 'Local fallback',
      localDraft: locale === 'zh-CN' ? '本地草稿' : 'Local draft',
      remoteUnavailable: locale === 'zh-CN' ? '远程不可用' : 'Remote unavailable',
      loadWarningTitle:
        locale === 'zh-CN'
          ? '远程商品配置暂不可用，请检查接口连接后重试。'
          : 'Remote product config unavailable. Check the API connection and try again.',
    }),
    [locale],
  )

  const sectionItems = getProductSectionItems(locale, draft, productAuditLogs)
  const sectionConfig = getProductSectionConfig({
    section: activeSection,
    locale,
    text,
    draft,
    systemDraft,
    auditLogs: productAuditLogs,
    labels,
    actions: {
      onView: (record) => {
        if (activeSection !== 'auditLogs') {
          return
        }

        void openAuditDetail(record)
      },
      onEdit: (record) => {
        setEditorState({
          open: true,
          mode: 'edit',
          values:
            activeSection === 'products'
              ? buildProductEditorValues(record as AdminManagedProduct)
              : record,
        })
      },
      onDelete: (record) => {
        if (activeSection === 'products') {
          modal.confirm({
            title: labels.deleteProductConfirmTitle,
            content: labels.deleteProductConfirmBody,
            onOk: async () => {
              try {
                if (remoteEnabled && supportsRemoteProductSection(activeSection)) {
                  await deleteAdminProductSectionRecord('products', record)
                  await reload()
                  await refreshRemoteAuditLogs()
                } else {
                  const result = deleteAdminProduct(draft, record as AdminManagedProduct)
                  setDraft(result.draft)
                  appendAuditLog(createAdminProductAuditLog('delete_product', result.targetId, operator))
                }

                if (priceDrawerProduct?.key === String(record.key ?? '')) {
                  setPriceDrawerProduct(null)
                }

                message.success(labels.deleted)
              } catch (nextError) {
                message.error(getActionErrorMessage(nextError, locale))
              }
            },
          })

          return
        }

        if (activeSection === 'priceTemplates') {
          modal.confirm({
            title: labels.deletePriceTemplateConfirmTitle,
            content: labels.deletePriceTemplateConfirmBody,
            onOk: async () => {
              try {
                if (remoteEnabled && supportsRemoteProductSection(activeSection)) {
                  await deleteAdminProductSectionRecord('priceTemplates', record)
                  await reload()
                  await refreshRemoteAuditLogs()
                } else {
                  const result = deleteAdminProductPriceTemplate(draft, record as AdminProductPriceTemplate)
                  setDraft(result.draft)
                  appendAuditLog(createAdminProductAuditLog('delete_price_template', result.targetId, operator))
                }

                message.success(labels.deleted)
              } catch (nextError) {
                message.error(getActionErrorMessage(nextError, locale))
              }
            },
          })
        }
      },
      onManagePrices: (record) => setPriceDrawerProduct(record),
    },
  })

  const filteredDataSource = useMemo(
    () => filterRecordsByQuery(sectionConfig.dataSource, searchQuery),
    [sectionConfig.dataSource, searchQuery],
  )
  const supportsSelection = Boolean(sectionConfig.module && sectionConfig.getTargetId)
  const selectedRecords = sectionConfig.dataSource.filter((record) =>
    selectedRowKeys.includes(String(record.key ?? '')),
  )
  const hasEnabledSelection = selectedRecords.some((record) => typeof record.enabled === 'boolean')
  const tabItems: TabsProps['items'] = sectionItems.map((item) => ({
    key: item.key,
    label: (
      <span>
        {item.label} <Badge count={item.count} size="small" />
      </span>
    ),
  }))

  const priceDrawerTemplates = priceDrawerProduct
    ? draft.priceTemplates
        .filter((template) => template.productSku === priceDrawerProduct.sku)
        .sort((left, right) => left.sortOrder - right.sortOrder)
    : []

  const sourceTag = useMemo(() => {
    if (!remoteEnabled) {
      return <Tag>{labels.localDraft}</Tag>
    }

    return (
      <Tag color={getAdminSourceTagColor(source, remoteEnabled)}>
        {source === 'remote'
          ? labels.remoteReady
          : source === 'remote-error'
            ? labels.remoteUnavailable
            : labels.localFallback}
      </Tag>
    )
  }, [
    labels.localDraft,
    labels.localFallback,
    labels.remoteReady,
    labels.remoteUnavailable,
    remoteEnabled,
    source,
  ])

  return (
    <div className="admin-page admin-page--products">
      <PageHeader
        title={text.pages.products.title}
        subtitle={text.pages.products.subtitle}
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

      <AdminMetricStrip
        items={[
          {
            key: 'product_total',
            title: locale === 'zh-CN' ? '商品总数' : 'Products',
            value: draft.products.length,
            percent: 100,
            icon: <AppstoreOutlined />,
          },
          {
            key: 'product_live',
            title: locale === 'zh-CN' ? '已启用' : 'Enabled',
            value: draft.products.filter((item) => item.enabled).length,
            percent: Math.round(
              (draft.products.filter((item) => item.enabled).length / Math.max(draft.products.length, 1)) *
                100,
            ),
            color: '#0f9f6e',
            icon: <CheckCircleOutlined />,
          },
          {
            key: 'subscription_total',
            title: locale === 'zh-CN' ? '订阅 SKU' : 'Subscriptions',
            value: draft.products.filter((item) => item.productType === 'subscription').length,
            percent: Math.round(
              (draft.products.filter((item) => item.productType === 'subscription').length /
                Math.max(draft.products.length, 1)) *
                100,
            ),
            color: '#2563eb',
            icon: <ShoppingOutlined />,
          },
          {
            key: 'price_templates',
            title: locale === 'zh-CN' ? '价格模板' : 'Price templates',
            value: draft.priceTemplates.length,
            percent: Math.min(
              100,
              Math.round((draft.priceTemplates.length / Math.max(draft.products.length, 1)) * 100),
            ),
            color: '#7c3aed',
            icon: <TagsOutlined />,
          },
        ]}
      />

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
              setActiveSection(key as ProductSectionKey)
              setEditorState({ open: false, mode: 'create', values: {} })
              setSearchQuery('')
              setSelectedRowKeys([])
              setPriceDrawerProduct(null)
              setAuditDetailDrawer(emptyAdminSystemAuditDetailDrawerState)
            }}
          />
        }
        cardChildren={<div className="admin-console__lead">{sectionConfig.description}</div>}
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
                    hidden: !(sectionConfig.fields && sectionConfig.createInitial && sectionConfig.createLabel),
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
                            if (!remoteEnabled) {
                              appendAuditLog(createAdminProductAuditLog('reset_snapshot', 'products', operator))
                            }
                            setSearchQuery('')
                            setSelectedRowKeys([])
                            setPriceDrawerProduct(null)
                            setEditorState({ open: false, mode: 'create', values: {} })
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
                    void handleBatchEnabledChange(true)
                  },
                },
                {
                  key: 'disable',
                  label: labels.disableSelected,
                  hidden: !hasEnabledSelection,
                  onClick: () => {
                    void handleBatchEnabledChange(false)
                  },
                },
                {
                  key: 'delete',
                  label: labels.deleteSelected,
                  danger: true,
                  onClick: () => {
                    modal.confirm({
                      title: labels.deleteSelectedConfirmTitle,
                      content: labels.deleteSelectedConfirmBody,
                      onOk: async () => {
                        try {
                          const result = batchDelete(draft, activeSection, selectedRowKeys)
                          const targetIds = result?.targetIds ?? []

                          if (remoteEnabled && supportsRemoteProductSection(activeSection)) {
                            await Promise.all(
                              selectedRecords.map((record) =>
                                deleteAdminProductSectionRecord(
                                  activeSection === 'products' ? 'products' : 'priceTemplates',
                                  record,
                                ),
                              ),
                            )
                            await reload()
                            await refreshRemoteAuditLogs()
                          } else if (result) {
                            setDraft(result.draft)
                            appendAuditLog(
                              createAdminProductAuditLog('batch_delete', targetIds.join(','), operator),
                            )
                          }

                          if (
                            activeSection === 'products' &&
                            priceDrawerProduct &&
                            selectedRowKeys.includes(priceDrawerProduct.key)
                          ) {
                            setPriceDrawerProduct(null)
                          }

                          setSelectedRowKeys([])
                          message.success(labels.deleted)
                        } catch (nextError) {
                          message.error(getActionErrorMessage(nextError, locale))
                        }
                      },
                    })
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
        scroll={{ x: sectionConfig.scrollX ?? 1180 }}
      />

      {sectionConfig.fields ? (
        <SystemEditorDrawer
          locale={locale}
          open={editorState.open}
          title={`${editorState.mode === 'create' ? labels.saveCreate : labels.edit} ${sectionConfig.title}`}
          fields={sectionConfig.fields}
          initialValues={editorState.values}
          submitText={editorState.mode === 'create' ? labels.saveCreate : labels.saveEdit}
          cancelText={labels.cancel}
          onCancel={() => setEditorState({ open: false, mode: 'create', values: {} })}
          onSubmit={async (values) => {
            try {
              if (remoteEnabled && supportsRemoteProductSection(activeSection)) {
                await saveAdminProductSectionRecord(
                  activeSection === 'products' ? 'products' : 'priceTemplates',
                  editorState.mode,
                  values,
                )
                await reload()
                await refreshRemoteAuditLogs()
              } else if (activeSection === 'products') {
                const result = upsertAdminProduct(draft, editorState.mode, values)
                setDraft(result.draft)
                appendAuditLog(
                  createAdminProductAuditLog(
                    editorState.mode === 'create' ? 'create_product' : 'update_product',
                    result.targetId,
                    operator,
                  ),
                )
              } else if (activeSection === 'priceTemplates') {
                const productSku = String(values.productSku ?? '')
                const result = upsertAdminProductPriceTemplate(draft, productSku, values)
                setDraft(result.draft)
                appendAuditLog(
                  createAdminProductAuditLog(
                    editorState.mode === 'create' ? 'create_price_template' : 'update_price_template',
                    result.targetId,
                    operator,
                  ),
                )
              }

              setEditorState({ open: false, mode: 'create', values: {} })
              message.success(labels.saved)
            } catch (nextError) {
              message.error(getActionErrorMessage(nextError, locale))
              throw nextError
            }
          }}
        />
      ) : null}

      <ProductPriceManagerDrawer
        open={Boolean(priceDrawerProduct)}
        locale={locale}
        product={priceDrawerProduct}
        templates={priceDrawerTemplates}
        onClose={() => setPriceDrawerProduct(null)}
        onSave={async (mode, values) => {
          if (!priceDrawerProduct) {
            return
          }

          try {
            if (remoteEnabled) {
              await saveAdminProductSectionRecord('priceTemplates', mode, {
                ...values,
                productSku: priceDrawerProduct.sku,
                productKey: priceDrawerProduct.key,
              })
              await reload()
              await refreshRemoteAuditLogs()
            } else {
              const result = upsertAdminProductPriceTemplate(draft, priceDrawerProduct.sku, values)
              setDraft(result.draft)
              appendAuditLog(
                createAdminProductAuditLog(
                  mode === 'create' ? 'create_price_template' : 'update_price_template',
                  result.targetId,
                  operator,
                ),
              )
            }

            message.success(labels.saved)
          } catch (nextError) {
            message.error(getActionErrorMessage(nextError, locale))
            throw nextError
          }
        }}
        onDelete={async (template) => {
          try {
            if (remoteEnabled) {
              await deleteAdminProductSectionRecord('priceTemplates', {
                ...template,
                productKey: priceDrawerProduct?.key,
              })
              await reload()
              await refreshRemoteAuditLogs()
            } else {
              const result = deleteAdminProductPriceTemplate(draft, template)
              setDraft(result.draft)
              appendAuditLog(createAdminProductAuditLog('delete_price_template', result.targetId, operator))
            }

            message.success(labels.deleted)
          } catch (nextError) {
            message.error(getActionErrorMessage(nextError, locale))
            throw nextError
          }
        }}
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
    </div>
  )

  async function openAuditDetail(record: Record<string, unknown>) {
    const remoteDetailReady =
      remoteEnabled && isPersistedAuditLogKey(record.key)
    const title = `${getSystemAuditDetailTitle(locale)} - ${
      String(record.targetId ?? record.key ?? '') || '-'
    }`
    const fallbackData = buildLocalSystemAuditDetail(
      record as (typeof productAuditLogs)[number],
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

  async function handleBatchEnabledChange(enabled: boolean) {
    try {
      const result = batchUpdateEnabled(draft, activeSection, selectedRowKeys, enabled)

      if (!result) {
        return
      }

      if (remoteEnabled && supportsRemoteProductSection(activeSection)) {
        await Promise.all(
          selectedRecords.map((record) =>
            saveAdminProductSectionRecord(
              activeSection === 'products' ? 'products' : 'priceTemplates',
              'edit',
              {
                ...record,
                enabled,
              },
            ),
          ),
        )
        await reload()
        await refreshRemoteAuditLogs()
      } else {
        setDraft(result.draft)
        appendAuditLog(
          createAdminProductAuditLog(
            enabled ? 'batch_enable' : 'batch_disable',
            result.targetIds.join(','),
            operator,
          ),
        )
      }
      setSelectedRowKeys([])
      message.success(labels.saved)
    } catch (nextError) {
      message.error(getActionErrorMessage(nextError, locale))
    }
  }

  function appendAuditLog(log: ReturnType<typeof createAdminProductAuditLog>) {
    setSystemDraft((prev) => ({
      ...prev,
      auditLogs: [log, ...prev.auditLogs],
    }))
  }

  async function refreshRemoteAuditLogs() {
    if (!remoteEnabled) {
      return
    }

    try {
      await reloadSystemDraft()
    } catch {
      // Keep the successful mutation UX even if audit log refresh is delayed.
    }
  }
}

function batchDelete(
  draft: AdminProductDraft,
  section: ProductSectionKey,
  rowKeys: Key[],
) {
  const keys = rowKeys.map((key) => String(key))

  if (section === 'products') {
    return deleteAdminProducts(draft, keys)
  }

  if (section === 'priceTemplates') {
    return deleteAdminProductPriceTemplates(draft, keys)
  }

  return null
}

function batchUpdateEnabled(
  draft: AdminProductDraft,
  section: ProductSectionKey,
  rowKeys: Key[],
  enabled: boolean,
) {
  const keys = rowKeys.map((key) => String(key))

  if (section === 'products') {
    return updateAdminProductsEnabled(draft, keys, enabled)
  }

  if (section === 'priceTemplates') {
    return updateAdminProductPriceTemplatesEnabled(draft, keys, enabled)
  }

  return null
}

function getActionErrorMessage(error: unknown, locale: Locale) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return locale === 'zh-CN' ? '请求失败，请稍后重试。' : 'Request failed. Please try again.'
}

function filterRecordsByQuery<T extends Record<string, unknown>>(rows: T[], query: string) {
  const keyword = query.trim().toLowerCase()

  if (!keyword) {
    return rows
  }

  return rows.filter((row) =>
    Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(keyword)),
  )
}
