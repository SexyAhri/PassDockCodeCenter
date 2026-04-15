import {
  ApiOutlined,
  AuditOutlined,
  CreditCardOutlined,
  DeploymentUnitOutlined,
} from '@ant-design/icons'
import type { ReactNode } from 'react'

import type { AdminSystemDraft } from './types'
import type { Locale } from '../../i18n/copy'

type SystemMetricItem = {
  key: string
  title: string
  value: string | number
  suffix?: string
  icon: ReactNode
  percent?: number
  color?: string
}

export function buildSystemMetricItems(
  draft: AdminSystemDraft,
  locale: Locale,
): SystemMetricItem[] {
  const enabledChannels = draft.paymentChannels.filter((item) => item.enabled)
  const healthyProviders = draft.providers.filter(
    (item) => item.health === 'healthy',
  )
  const activeStrategies =
    draft.fulfillmentStrategies.filter((item) => item.enabled).length +
    draft.deliveryStrategies.filter((item) => item.enabled).length
  const totalStrategies =
    draft.fulfillmentStrategies.length + draft.deliveryStrategies.length

  return [
    {
      key: 'enabled_channels',
      title: locale === 'zh-CN' ? '启用通道' : 'Enabled channels',
      value: enabledChannels.length,
      percent: Math.round(
        (enabledChannels.length / Math.max(draft.paymentChannels.length, 1)) *
          100,
      ),
      icon: <CreditCardOutlined />,
    },
    {
      key: 'healthy_providers',
      title: locale === 'zh-CN' ? '健康服务方' : 'Healthy providers',
      value: healthyProviders.length,
      percent: Math.round(
        (healthyProviders.length / Math.max(draft.providers.length, 1)) * 100,
      ),
      color: '#0f9f6e',
      icon: <ApiOutlined />,
    },
    {
      key: 'active_strategies',
      title: locale === 'zh-CN' ? '启用策略' : 'Active strategies',
      value: activeStrategies,
      percent: Math.round((activeStrategies / Math.max(totalStrategies, 1)) * 100),
      color: '#2563eb',
      icon: <DeploymentUnitOutlined />,
    },
    {
      key: 'audit_logs',
      title: locale === 'zh-CN' ? '审计条目' : 'Audit items',
      value: draft.auditLogs.length,
      percent: Math.min(100, draft.auditLogs.length * 10),
      color: '#7c3aed',
      icon: <AuditOutlined />,
    },
  ]
}
