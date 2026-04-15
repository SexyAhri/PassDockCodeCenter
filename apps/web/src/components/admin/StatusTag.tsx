import { Tag } from 'antd'

type StatusTagTone = 'success' | 'processing' | 'warning' | 'error' | 'default'

type StatusTagProps = {
  label: string
  tone?: StatusTagTone
}

const toneColorMap: Record<StatusTagTone, string> = {
  success: 'green',
  processing: 'blue',
  warning: 'orange',
  error: 'red',
  default: 'default',
}

export function StatusTag(props: StatusTagProps) {
  const { label, tone = 'default' } = props

  return <Tag color={toneColorMap[tone]}>{label}</Tag>
}
