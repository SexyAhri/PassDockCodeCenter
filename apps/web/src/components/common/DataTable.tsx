import { Table, theme } from 'antd'
import type { TableProps } from 'antd'
import { useMemo } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import { balanceTableColumns } from '../../admin/table'

type DataTableProps<T> = Omit<TableProps<T>, 'size' | 'pagination' | 'title'> & {
  showPagination?: boolean
  pageSize?: number
  cardTitle?: string
  cardExtra?: ReactNode
  cardTabs?: ReactNode
  cardChildren?: ReactNode
  cardToolbar?: ReactNode
  cardSelectionBar?: ReactNode
  paginationShowTotal?: (total: number) => string
  fitContent?: boolean
  style?: CSSProperties
}

export function DataTable<T extends object>(props: DataTableProps<T>) {
  const {
    showPagination = true,
    pageSize = 10,
    cardTitle,
    cardExtra,
    cardTabs,
    cardChildren,
    cardToolbar,
    cardSelectionBar,
    paginationShowTotal,
    fitContent = false,
    style,
    columns,
    dataSource,
    scroll,
    tableLayout,
    ...tableProps
  } = props
  const { token } = theme.useToken()
  const balancedTable = useMemo(
    () => balanceTableColumns(columns, (dataSource ?? []) as readonly T[]),
    [columns, dataSource],
  )
  const resolvedScroll = useMemo(
    () => ({
      ...scroll,
      x: fitContent ? 'max-content' : (scroll?.x ?? 'max-content'),
    }),
    [fitContent, scroll],
  )
  const resolvedTableLayout = fitContent ? 'auto' : (tableLayout ?? 'fixed')

  return (
    <div
      className="data-table-card"
      style={{
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        ...style,
      }}
    >
      {cardTitle ? (
        <div
          className="data-table-card__head"
          style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}
        >
          <span className="data-table-card__title">{cardTitle}</span>
          {cardExtra}
        </div>
      ) : null}

      {cardChildren ? <div className="data-table-card__content">{cardChildren}</div> : null}

      {cardTabs ? <div className="data-table-card__tabs">{cardTabs}</div> : null}

      {cardToolbar ? <div className="data-table-card__toolbar">{cardToolbar}</div> : null}

      {cardSelectionBar ? <div className="data-table-card__selection">{cardSelectionBar}</div> : null}

      <div
        className={`data-table-card__table${fitContent ? ' data-table-card__table--fit-content' : ''}`}
      >
        <Table<T>
          size="middle"
          tableLayout={resolvedTableLayout}
          columns={balancedTable.columns}
          dataSource={dataSource}
          pagination={
            showPagination
              ? {
                  pageSize,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total) =>
                    paginationShowTotal ? paginationShowTotal(total) : `Total ${total}`,
                }
              : false
          }
          scroll={resolvedScroll}
          {...tableProps}
        />
      </div>
    </div>
  )
}
