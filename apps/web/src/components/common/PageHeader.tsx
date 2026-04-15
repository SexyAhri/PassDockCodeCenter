import { ArrowLeftOutlined } from '@ant-design/icons'
import { Button, Space, Tag } from 'antd'
import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  subtitle?: string
  tags?: Array<{ label: string; color?: string }>
  extra?: ReactNode
  onBack?: () => void
}

export function PageHeader(props: PageHeaderProps) {
  const { title, subtitle, tags, extra, onBack } = props
  const visibleTags = tags?.filter((tag) => tag.label.trim()) ?? []

  return (
    <div className="page-header">
      <Space size="middle" align="start">
        {onBack ? (
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={onBack}
            style={{ paddingInline: 8 }}
          />
        ) : null}

        <div>
          <div className="page-header__title-row">
            <span className="page-header__title">{title}</span>
            {visibleTags.map((tag) => (
              <Tag key={tag.label} color={tag.color}>
                {tag.label}
              </Tag>
            ))}
          </div>

          {subtitle ? <div className="page-header__subtitle">{subtitle}</div> : null}
        </div>
      </Space>

      {extra ? <div>{extra}</div> : null}
    </div>
  )
}
