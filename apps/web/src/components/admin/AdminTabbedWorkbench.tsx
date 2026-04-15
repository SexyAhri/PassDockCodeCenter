import { Alert, Badge, Tabs } from 'antd'
import type { TableColumnsType, TableProps, TabsProps } from 'antd'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'

import { getTableTotalText } from '../../admin/presentation'
import { filterRecordsByQuery } from '../../admin/table'
import type { Locale } from '../../i18n/copy'
import { DataTable } from '../common/DataTable'
import { SearchToolbar } from '../common/SearchToolbar'

export type AdminWorkbenchSection = {
  key: string
  label: string
  title: string
  description?: string
  count?: number
  dataSource: Array<Record<string, unknown>>
  columns: TableColumnsType<Record<string, unknown>>
  rowKey?: string
  rowSelection?: TableProps<Record<string, unknown>>['rowSelection']
  scrollX?: number | string
  showPagination?: boolean
  selectionBar?: ReactNode
  toolbarExtra?: ReactNode
  enableKeywordSearch?: boolean
  fitContent?: boolean
}

type AdminTabbedWorkbenchProps = {
  locale: Locale
  sections: AdminWorkbenchSection[]
  loading?: boolean
  error?: string | null
  toolbarExtra?: ReactNode
}

export function AdminTabbedWorkbench(props: AdminTabbedWorkbenchProps) {
  const { locale, sections, loading = false, error, toolbarExtra } = props
  const [activeKey, setActiveKey] = useState(sections[0]?.key ?? '')
  const [searchQuery, setSearchQuery] = useState('')

  const activeSection = useMemo(
    () => sections.find((section) => section.key === activeKey) ?? sections[0],
    [activeKey, sections],
  )

  const showKeywordSearch = activeSection?.enableKeywordSearch ?? !activeSection?.toolbarExtra

  const filteredDataSource = useMemo(
    () =>
      showKeywordSearch
        ? filterRecordsByQuery(activeSection?.dataSource ?? [], searchQuery)
        : (activeSection?.dataSource ?? []),
    [activeSection, searchQuery, showKeywordSearch],
  )

  const tabItems: TabsProps['items'] = useMemo(
    () =>
      sections.map((section) => ({
        key: section.key,
        label: (
          <span>
            {section.label} <Badge count={section.count ?? section.dataSource.length} size="small" />
          </span>
        ),
      })),
    [sections],
  )

  if (!activeSection) {
    return null
  }

  const composedToolbarExtra = activeSection.toolbarExtra || toolbarExtra
    ? (
        <div className="admin-tabbed-workbench__toolbar-extra">
          {activeSection.toolbarExtra ? (
            <div className="admin-tabbed-workbench__toolbar-group admin-tabbed-workbench__toolbar-group--filters">
              {activeSection.toolbarExtra}
            </div>
          ) : null}
          {toolbarExtra ? (
            <div className="admin-tabbed-workbench__toolbar-group admin-tabbed-workbench__toolbar-group--actions">
              {toolbarExtra}
            </div>
          ) : null}
        </div>
      )
    : null

  const cardToolbar = showKeywordSearch
    ? (
        <SearchToolbar
          value={searchQuery}
          placeholder={locale === 'zh-CN' ? '搜索当前标签页数据' : 'Search current tab data'}
          searchText={locale === 'zh-CN' ? '搜索' : 'Search'}
          resetText={locale === 'zh-CN' ? '重置' : 'Reset'}
          loading={loading}
          onValueChange={setSearchQuery}
          onReset={() => setSearchQuery('')}
          extra={composedToolbarExtra}
        />
      )
    : composedToolbarExtra
      ? (
          <div className="admin-tabbed-workbench__toolbar admin-tabbed-workbench__toolbar--filters-only">
            {composedToolbarExtra}
          </div>
        )
      : null

  return (
    <>
      {error ? (
        <Alert
          showIcon
          type="warning"
          message={error}
          style={{ marginBottom: 16 }}
        />
      ) : null}

      <DataTable
        rowKey={activeSection.rowKey ?? 'key'}
        rowSelection={activeSection.rowSelection}
        loading={loading}
        dataSource={filteredDataSource}
        columns={activeSection.columns}
        cardTitle={activeSection.title}
        cardTabs={
          <Tabs
            size="small"
            activeKey={activeSection.key}
            items={tabItems}
            onChange={(key) => {
              setActiveKey(key)
              setSearchQuery('')
            }}
          />
        }
        cardChildren={
          activeSection.description ? <div className="admin-console__lead">{activeSection.description}</div> : null
        }
        cardToolbar={cardToolbar}
        cardSelectionBar={activeSection.selectionBar}
        fitContent={activeSection.fitContent}
        showPagination={activeSection.showPagination ?? filteredDataSource.length > 8}
        paginationShowTotal={(total) => getTableTotalText(locale, total)}
        scroll={{ x: activeSection.scrollX ?? 1080 }}
      />
    </>
  )
}
