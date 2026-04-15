import { Button, Space } from 'antd'
import type { ButtonProps } from 'antd'
import type { ReactNode } from 'react'

export type ActionButtonItem = {
  key: string
  label: ReactNode
  onClick?: () => void
  type?: ButtonProps['type']
  danger?: boolean
  icon?: ReactNode
  disabled?: boolean
  loading?: boolean
  hidden?: boolean
}

type ActionButtonsProps = {
  actions: ReadonlyArray<ActionButtonItem>
  size?: ButtonProps['size']
  wrap?: boolean
}

export function ActionButtons(props: ActionButtonsProps) {
  const { actions, size = 'small', wrap = true } = props

  return (
    <Space size={8} wrap={wrap}>
      {actions
        .filter((action) => !action.hidden)
        .map((action) => (
          <Button
            key={action.key}
            size={size}
            type={action.type}
            danger={action.danger}
            icon={action.icon}
            disabled={action.disabled}
            loading={action.loading}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        ))}
    </Space>
  )
}
