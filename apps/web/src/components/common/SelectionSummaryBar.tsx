import { Button, Card, Space, Typography } from 'antd'
import type { ReactNode } from 'react'

import { ActionButtons, type ActionButtonItem } from './ActionButtons'

type SelectionSummaryBarProps = {
  selectedCount: number
  itemLabelSingular?: string
  itemLabelPlural?: string
  title?: ReactNode
  actions?: ReadonlyArray<ActionButtonItem>
  onClear?: () => void
  clearText?: ReactNode
}

export function SelectionSummaryBar(props: SelectionSummaryBarProps) {
  const {
    selectedCount,
    itemLabelSingular = 'record selected',
    itemLabelPlural = 'records selected',
    title = 'Bulk actions',
    actions = [],
    onClear,
    clearText = 'Clear',
  } = props

  if (selectedCount === 0) {
    return null
  }

  return (
    <Card size="small" className="selection-summary-card">
      <div className="selection-summary-bar">
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{title}</Typography.Text>
          <Typography.Text type="secondary">
            {selectedCount} {selectedCount === 1 ? itemLabelSingular : itemLabelPlural}
          </Typography.Text>
        </Space>

        <Space wrap>
          <ActionButtons actions={actions} />
          {onClear ? <Button onClick={onClear}>{clearText}</Button> : null}
        </Space>
      </div>
    </Card>
  )
}
