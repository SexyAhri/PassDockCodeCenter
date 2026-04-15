import {
  MessageOutlined,
  ShoppingOutlined,
  TeamOutlined,
  TrophyOutlined,
} from '@ant-design/icons'
import type { ReactNode } from 'react'

import type { AdminConsoleText } from '../../i18n/adminConsole-types'
import { getCustomerPageLabels } from './detail'
import type { Locale } from '../../i18n/copy'

type CustomerMetricItem = {
  key: string
  title: string
  value: string | number
  suffix?: string
  icon: ReactNode
  percent?: number
  color?: string
}

type CustomerMetricParams = {
  locale: Locale
  text: AdminConsoleText
  totalCustomers: number
  vipCustomers: number
  attentionCustomers: number
  totalOrders: number
}

export function buildCustomerMetricItems(
  params: CustomerMetricParams,
): CustomerMetricItem[] {
  const { locale, text, totalCustomers, vipCustomers, attentionCustomers, totalOrders } =
    params
  const labels = getCustomerPageLabels(locale)

  return [
    {
      key: 'customer_total',
      title: labels.customerTotal,
      value: totalCustomers,
      percent: 100,
      icon: <TeamOutlined />,
    },
    {
      key: 'vip_total',
      title: text.enums.userTier.vip,
      value: vipCustomers,
      percent: Math.round((vipCustomers / Math.max(totalCustomers, 1)) * 100),
      color: '#d97706',
      icon: <TrophyOutlined />,
    },
    {
      key: 'attention_total',
      title: labels.attentionAccounts,
      value: attentionCustomers,
      percent: Math.round(
        (attentionCustomers / Math.max(totalCustomers, 1)) * 100,
      ),
      color: '#ef4444',
      icon: <MessageOutlined />,
    },
    {
      key: 'order_total',
      title: text.table.orders,
      value: totalOrders,
      percent: 88,
      color: '#2563eb',
      icon: <ShoppingOutlined />,
    },
  ]
}
