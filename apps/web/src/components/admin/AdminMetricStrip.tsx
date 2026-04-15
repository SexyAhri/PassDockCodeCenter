import { Col, Row } from 'antd'
import type { ReactNode } from 'react'

import { MetricCard } from '../common/MetricCard'

type AdminMetricStripProps = {
  items: Array<{
    key: string
    title: string
    value: string | number
    suffix?: string
    icon: ReactNode
    percent?: number
    color?: string
  }>
}

export function AdminMetricStrip(props: AdminMetricStripProps) {
  const { items } = props

  return (
    <Row gutter={[16, 16]} className="admin-metric-strip">
      {items.map((item) => (
        <Col key={item.key} xs={24} md={12} xl={6}>
          <MetricCard
            title={item.title}
            value={item.value}
            suffix={item.suffix}
            icon={item.icon}
            percent={item.percent}
            color={item.color}
          />
        </Col>
      ))}
    </Row>
  )
}
