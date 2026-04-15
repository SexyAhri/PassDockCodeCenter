import { Card, Progress, theme } from 'antd'
import type { ReactNode } from 'react'

type MetricCardProps = {
  title: string
  value: string | number
  suffix?: string
  icon: ReactNode
  percent?: number
  color?: string
}

export function MetricCard(props: MetricCardProps) {
  const { title, value, suffix, icon, percent = 0, color = '#2563eb' } = props
  const { token } = theme.useToken()

  return (
    <Card size="small" className="metric-card">
      <div className="metric-card__head">
        <div className="metric-card__icon" style={{ background: `${color}15`, color }}>
          {icon}
        </div>
        <span className="metric-card__label" style={{ color: token.colorTextSecondary }}>
          {title}
        </span>
      </div>

      <div className="metric-card__value" style={{ color: token.colorText }}>
        {value}
        {suffix ? (
          <span className="metric-card__suffix" style={{ color: token.colorTextSecondary }}>
            {suffix}
          </span>
        ) : null}
      </div>

      <Progress
        percent={percent}
        showInfo={false}
        strokeColor={color}
        railColor={token.colorBorderSecondary}
        size="small"
      />
    </Card>
  )
}
