import type { TableProps } from 'antd'

function normalizeSearchValue(value: unknown): string {
  if (value == null) {
    return ''
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeSearchValue(item)).join(' ')
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map((item) => normalizeSearchValue(item))
      .join(' ')
  }

  return String(value)
}

export function filterRecordsByQuery<T extends Record<string, unknown>>(rows: T[], query: string) {
  const keyword = query.trim().toLowerCase()

  if (!keyword) {
    return rows
  }

  return rows.filter((row) => normalizeSearchValue(row).toLowerCase().includes(keyword))
}

type TableColumnList<T extends object> = NonNullable<TableProps<T>['columns']>
type TableColumn<T extends object> = TableColumnList<T>[number]
type ColumnKind =
  | 'action'
  | 'status'
  | 'boolean'
  | 'currency'
  | 'amount'
  | 'datetime'
  | 'identifier'
  | 'title'
  | 'description'
  | 'text'

export function balanceTableColumns<T extends object>(
  columns: TableProps<T>['columns'],
  rows: readonly T[],
) {
  if (!columns?.length) {
    return {
      columns,
      totalWidth: 0,
    }
  }

  const balancedColumns = columns.map((column) => normalizeColumn(column, rows))

  return {
    columns: balancedColumns,
    totalWidth: sumColumnWidths(balancedColumns),
  }
}

function normalizeColumn<T extends object>(
  column: TableColumn<T>,
  rows: readonly T[],
): TableColumn<T> {
  if ('children' in column && Array.isArray(column.children)) {
    const normalizedChildren = column.children.map((child) =>
      normalizeColumn(child, rows),
    )
    const childWidth = sumColumnWidths(normalizedChildren)

    return {
      ...column,
      children: normalizedChildren,
      width:
        typeof column.width === 'number'
          ? Math.max(column.width, childWidth)
          : childWidth || column.width,
    }
  }

  const kind = getColumnKind(column)
  const estimatedWidth = estimateColumnWidth(column, rows)
  const resolvedWidth = resolveColumnWidth(column, estimatedWidth, kind)
  const shouldEllipsis = kind !== 'action' && column.ellipsis == null

  return {
    ...column,
    width: resolvedWidth,
    align: column.align ?? getDefaultColumnAlign(kind),
    className: joinClassNames(column.className, `table-column table-column--${kind}`),
    ellipsis: shouldEllipsis ? true : column.ellipsis,
  }
}

function resolveColumnWidth<T extends object>(
  column: TableColumn<T>,
  estimatedWidth: number,
  kind: ColumnKind,
) {
  const presetWidth = getPresetColumnWidth(kind)

  if (typeof column.width === 'number') {
    if (kind === 'action') {
      return column.width
    }

    if (presetWidth != null) {
      return column.width > presetWidth + 64 ? column.width : presetWidth
    }

    return Math.max(column.width, estimatedWidth)
  }

  if (typeof column.width === 'string') {
    return column.width
  }

  if (presetWidth != null) {
    return presetWidth
  }

  return estimatedWidth
}

function estimateColumnWidth<T extends object>(
  column: TableColumn<T>,
  rows: readonly T[],
) {
  const titleText = extractNodeText(column.title)
  const sampleValues = collectColumnSamples(column, rows)
  const maxWeight = Math.max(
    measureTextWeight(titleText),
    ...sampleValues.map((value) => measureTextWeight(value)),
    0,
  )
  const estimated = Math.round(maxWeight * 8 + 44)
  const minWidth = getColumnMinWidth(column)
  const maxWidth = getColumnMaxWidth(column)

  return clamp(estimated, minWidth, maxWidth)
}

function collectColumnSamples<T extends object>(
  column: TableColumn<T>,
  rows: readonly T[],
) {
  const dataIndex = getColumnDataIndexPath(column)

  if (!dataIndex.length) {
    return []
  }

  return rows
    .slice(0, 10)
    .map((row) => readPathValue(row, dataIndex))
    .map((value) => normalizeSearchValue(value).trim())
    .filter(Boolean)
}

function getColumnMinWidth<T extends object>(column: TableColumn<T>) {
  const kind = getColumnKind(column)

  switch (kind) {
    case 'action':
      return 120
    case 'status':
      return 112
    case 'boolean':
      return 104
    case 'currency':
      return 88
    case 'amount':
      return 124
    case 'datetime':
      return 152
    case 'identifier':
      return 164
    case 'title':
      return 176
    case 'description':
      return 216
    default:
      return 120
  }
}

function getColumnMaxWidth<T extends object>(column: TableColumn<T>) {
  const kind = getColumnKind(column)

  switch (kind) {
    case 'action':
      return 220
    case 'status':
      return 124
    case 'boolean':
      return 112
    case 'currency':
      return 96
    case 'amount':
      return 132
    case 'datetime':
      return 164
    case 'identifier':
      return 184
    case 'title':
      return 236
    case 'description':
      return 340
    default:
      return 224
  }
}

function getPresetColumnWidth(kind: ColumnKind) {
  switch (kind) {
    case 'status':
      return 116
    case 'boolean':
      return 108
    case 'currency':
      return 92
    case 'amount':
      return 128
    case 'datetime':
      return 156
    case 'identifier':
      return 172
    case 'title':
      return 208
    case 'description':
      return 264
    default:
      return null
  }
}

function getColumnKind<T extends object>(column: TableColumn<T>): ColumnKind {
  const key = String(column.key ?? '').toLowerCase()
  const dataIndex = getColumnDataIndexPath(column).join('.').toLowerCase()
  const title = extractNodeText(column.title).toLowerCase()
  const compactKey = compactText(key)
  const compactDataIndex = compactText(dataIndex)
  const compactTitle = compactText(title)
  const tokens = [compactKey, compactDataIndex, compactTitle].filter(Boolean)
  const searchable = compactText(tokens.join(' '))

  if (
    compactKey === 'actions' ||
    compactDataIndex === 'actions' ||
    ((!compactDataIndex || compactDataIndex === 'actionbuttons') &&
      /(actions|operation|operate|button)/.test(compactTitle))
  ) {
    return 'action'
  }

  if (/(paymentstatus|orderstatus|deliverystatus|status|health|priority|tier|level)/.test(searchable)) {
    return 'status'
  }

  if (/(enabled|resendallowed|allow|disabled|active)/.test(searchable)) {
    return 'boolean'
  }

  if (/(currency)/.test(searchable)) {
    return 'currency'
  }

  if (/(amount|price|spend|fee|total|revenue|balance|cost)/.test(searchable)) {
    return 'amount'
  }

  if (/(created|updated|confirmed|paid|started|finished|resolved|closed|activity|time|date|at$)/.test(searchable)) {
    return 'datetime'
  }

  if (
    tokens.some((token) =>
      /(^name$|^label$|^subject$|^product$|^customer$|^provider$|^channel$|^strategy$|providername|channelname|strategyname|productname|customername|metric$|subjectline$)/.test(
        token,
      ),
    )
  ) {
    return 'title'
  }

  if (
    tokens.some((token) =>
      /(^value$|^target$|^message$|^reference$|^description$|^content$|^summary$|^baseurl$|^url$|^maskpolicy$|^pathtemplate$|^successpath$|^qrvalue$|templatedescription|responsemessage)/.test(
        token,
      ),
    )
  ) {
    return 'description'
  }

  if (
    /(orderno|ticketno|buyerref|channelkey|providerkey|strategykey|actionkey|recordid|targetid|templateid|customerid|productid|deliveryid|paymentid|hash|sku|serialno|trackingno|(^|.*)(key|ref|id)$)/.test(
      searchable,
    )
  ) {
    return 'identifier'
  }

  return 'text'
}

function getDefaultColumnAlign(kind: ColumnKind) {
  switch (kind) {
    case 'currency':
    case 'status':
    case 'boolean':
    case 'datetime':
      return 'center'
    default:
      return undefined
  }
}

function compactText(value: string) {
  return value.replace(/[\s_.-]+/g, '')
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ')
}

function getDataIndexPath(dataIndex: unknown) {
  if (Array.isArray(dataIndex)) {
    return dataIndex.map((segment) => String(segment))
  }

  if (typeof dataIndex === 'string' || typeof dataIndex === 'number') {
    return [String(dataIndex)]
  }

  return []
}

function getColumnDataIndexPath<T extends object>(column: TableColumn<T>) {
  if ('children' in column && Array.isArray(column.children)) {
    return []
  }

  return getDataIndexPath((column as { dataIndex?: unknown }).dataIndex)
}

function readPathValue(row: unknown, path: string[]) {
  return path.reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') {
      return ''
    }

    return (current as Record<string, unknown>)[segment]
  }, row)
}

function extractNodeText(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }

  if (Array.isArray(node)) {
    return node.map((item) => extractNodeText(item)).join(' ')
  }

  if (node && typeof node === 'object' && 'props' in node) {
    return extractNodeText((node as { props?: { children?: unknown } }).props?.children)
  }

  return ''
}

function measureTextWeight(text: string) {
  return Array.from(text).reduce((total, char) => {
    if (/[\u4e00-\u9fff]/.test(char)) {
      return total + 1.8
    }

    if (/[A-Z0-9_-]/.test(char)) {
      return total + 1.05
    }

    return total + 0.85
  }, 0)
}

function sumColumnWidths<T extends object>(columns: TableColumnList<T>): number {
  return columns.reduce((total, column) => {
    if ('children' in column && Array.isArray(column.children)) {
      return total + sumColumnWidths(column.children)
    }

    return total + (typeof column.width === 'number' ? column.width : 0)
  }, 0)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
