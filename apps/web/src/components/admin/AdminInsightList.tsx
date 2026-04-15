import type { ReactNode } from 'react'

import { StatusTag } from './StatusTag'

type AdminInsightListProps = {
  items: Array<{
    key: string
    title: string
    description?: string
    meta?: string
    extra?: ReactNode
    tone?: 'success' | 'processing' | 'warning' | 'error' | 'default'
  }>
}

export function AdminInsightList(props: AdminInsightListProps) {
  const { items } = props

  return (
    <div className="admin-insight-list">
      {items.map((item) => (
        <div key={item.key} className="admin-insight-list__item">
          <div className="admin-insight-list__copy">
            <strong>{item.title}</strong>
            {item.description ? <p>{item.description}</p> : null}
          </div>

          <div className="admin-insight-list__meta">
            {item.meta ? <span>{item.meta}</span> : null}
            {item.extra ? item.extra : item.tone ? <StatusTag label={item.meta ?? ''} tone={item.tone} /> : null}
          </div>
        </div>
      ))}
    </div>
  )
}
