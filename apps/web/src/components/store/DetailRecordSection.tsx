import type { ReactNode } from 'react'

import { CheckoutKeyValueGrid } from './CheckoutKeyValueGrid'
import { CheckoutSection } from './CheckoutSection'

type DetailRecordSectionProps = {
  title: string
  emptyText: string
  data?: Record<string, unknown> | null
  fieldLabels?: Record<string, string>
  preferredKeys?: string[]
  extra?: ReactNode
}

export function DetailRecordSection(props: DetailRecordSectionProps) {
  const { title, emptyText, data, fieldLabels, preferredKeys, extra } = props
  const entries = getOrderedEntries(data, preferredKeys)
  const scalarItems: Array<{ label: string; value: string }> = []
  const nestedItems: Array<{ key: string; label: string; value: unknown }> = []

  entries.forEach(([key, value]) => {
    const label = fieldLabels?.[key] ?? humanizeKey(key)

    if (isNestedValue(value)) {
      nestedItems.push({ key, label, value })
      return
    }

    scalarItems.push({
      label,
      value: formatScalarValue(value),
    })
  })

  return (
    <CheckoutSection title={title} extra={extra}>
      {scalarItems.length ? (
        <CheckoutKeyValueGrid items={scalarItems} compact />
      ) : (
        <div className="checkout-detail-record__empty">{emptyText}</div>
      )}

      {nestedItems.length ? (
        <div className="checkout-detail-record__sections">
          {nestedItems.map((item) => (
            <section key={item.key} className="checkout-detail-record__section">
              <strong>{item.label}</strong>
              <pre>{JSON.stringify(item.value, null, 2)}</pre>
            </section>
          ))}
        </div>
      ) : null}
    </CheckoutSection>
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

function isNestedValue(value: unknown) {
  if (value == null) {
    return false
  }

  if (Array.isArray(value)) {
    return true
  }

  return typeof value === 'object'
}

function formatScalarValue(value: unknown) {
  if (value == null || value === '') {
    return '-'
  }

  if (typeof value === 'boolean') {
    return value ? 'True' : 'False'
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
