import { Alert, Descriptions, Drawer, Empty, Spin } from 'antd'
import type { DescriptionsProps } from 'antd'
import type { ReactNode } from 'react'

import type { Locale } from '../../i18n/copy'

type AdminDetailDrawerProps = {
  locale: Locale
  open: boolean
  title: string
  loading?: boolean
  error?: string | null
  data?: Record<string, unknown> | null
  fieldLabels?: Record<string, string>
  preferredKeys?: string[]
  extra?: ReactNode
  onClose: () => void
}

export function AdminDetailDrawer(props: AdminDetailDrawerProps) {
  const {
    locale,
    open,
    title,
    loading = false,
    error,
    data,
    fieldLabels,
    preferredKeys,
    extra,
    onClose,
  } = props
  const entries = getOrderedEntries(data, preferredKeys)
  const displayEntries = getDisplayEntries(entries, fieldLabels)
  const scalarItems: DescriptionsProps['items'] = []
  const nestedItems: Array<{ key: string; label: string; value: unknown }> = []

  displayEntries.forEach(({ key, label, value }) => {

    if (isNestedValue(value)) {
      nestedItems.push({ key, label, value })
      return
    }

    scalarItems.push({
      key,
      label,
      children: formatScalarValue(value, locale),
      span: 1,
    })
  })

  return (
    <Drawer
      open={open}
      title={title}
      width={760}
      destroyOnClose
      className="admin-detail-drawer"
      extra={extra}
      onClose={onClose}
    >
      <div className="admin-detail-drawer__content">
        {error ? <Alert showIcon type="warning" message={error} /> : null}

        {loading ? (
          <div className="admin-detail-drawer__loading">
            <Spin />
          </div>
        ) : null}

        {!loading && !data ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={locale === 'zh-CN' ? '暂无可展示数据' : 'No data'}
          />
        ) : null}

        {!loading && scalarItems.length ? (
          <Descriptions
            bordered
            size="small"
            column={1}
            items={scalarItems}
          />
        ) : null}

        {!loading &&
          nestedItems.map((item) => (
            <section key={item.key} className="admin-detail-drawer__section">
              <h4>{item.label}</h4>
              <pre className="admin-detail-drawer__json">
                {JSON.stringify(item.value, null, 2)}
              </pre>
            </section>
          ))}
      </div>
    </Drawer>
  )
}

function getOrderedEntries(
  data: Record<string, unknown> | null | undefined,
  preferredKeys: string[] | undefined,
) {
  if (!data) {
    return [] as Array<[string, unknown]>
  }

  const entries = Object.entries(data)

  if (!preferredKeys?.length) {
    return entries
  }

  const rank = new Map(preferredKeys.map((key, index) => [key, index]))

  return [...entries].sort(([leftKey], [rightKey]) => {
    const leftRank = rank.get(leftKey)
    const rightRank = rank.get(rightKey)

    if (leftRank === undefined && rightRank === undefined) {
      return leftKey.localeCompare(rightKey)
    }

    if (leftRank === undefined) {
      return 1
    }

    if (rightRank === undefined) {
      return -1
    }

    return leftRank - rightRank
  })
}

function getDisplayEntries(
  entries: Array<[string, unknown]>,
  fieldLabels: Record<string, string> | undefined,
) {
  const displayEntries: Array<{ key: string; label: string; value: unknown }> = []
  const displayEntryIndexByKey = new Map<string, number>()

  entries.forEach(([key, value]) => {
    const label = fieldLabels?.[key] ?? humanizeKey(key)
    const dedupeKey = buildDedupeKey(key, label, fieldLabels)
    const existingIndex = displayEntryIndexByKey.get(dedupeKey)

    if (existingIndex === undefined) {
      displayEntryIndexByKey.set(dedupeKey, displayEntries.length)
      displayEntries.push({ key, label, value })
      return
    }

    const existingEntry = displayEntries[existingIndex]

    if (shouldReplaceEntry(existingEntry.value, value)) {
      displayEntries[existingIndex] = { key, label, value }
    }
  })

  return displayEntries
}

function buildDedupeKey(
  key: string,
  label: string,
  fieldLabels: Record<string, string> | undefined,
) {
  if (fieldLabels?.[key]) {
    return `label:${normalizeDedupeToken(label)}`
  }

  return `key:${normalizeDedupeToken(key)}`
}

function normalizeDedupeToken(value: string) {
  return value.replace(/[\s_-]+/g, '').toLowerCase()
}

function shouldReplaceEntry(currentValue: unknown, nextValue: unknown) {
  return isEmptyDetailValue(currentValue) && !isEmptyDetailValue(nextValue)
}

function isEmptyDetailValue(value: unknown) {
  if (value == null) {
    return true
  }

  if (typeof value === 'string') {
    return value.trim() === ''
  }

  if (Array.isArray(value)) {
    return value.length === 0
  }

  if (typeof value === 'object') {
    return Object.keys(value).length === 0
  }

  return false
}

function isNestedValue(value: unknown) {
  if (value == null) {
    return false
  }

  if (Array.isArray(value)) {
    return true
  }

  return typeof value === 'object'
}

function formatScalarValue(value: unknown, locale: Locale) {
  if (value == null || value === '') {
    return '-'
  }

  if (typeof value === 'boolean') {
    return value ? (locale === 'zh-CN' ? '是' : 'True') : locale === 'zh-CN' ? '否' : 'False'
  }

  return String(value)
}

function humanizeKey(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase())
}
