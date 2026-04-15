import {
  ApiOutlined,
  CreditCardOutlined,
  CustomerServiceOutlined,
  DashboardOutlined,
  GlobalOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ShoppingOutlined,
  TeamOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import type { ReactNode } from 'react'

import { getAdminConsoleText } from '../i18n/adminConsole'
import type { AppCopy, Locale } from '../i18n/copy'

export type AdminNavEntry = {
  key: string
  label: string
  icon: ReactNode
}

export function getAdminNavEntries(copy: AppCopy, locale: Locale): AdminNavEntry[] {
  const text = getAdminConsoleText(locale)
  const botsLabel = locale === 'zh-CN' ? '机器人管理' : 'Bot operations'

  return [
    { key: '/admin', icon: <DashboardOutlined />, label: text.nav.dashboard },
    { key: '/admin/products', icon: <ShoppingOutlined />, label: text.nav.products },
    { key: '/admin/orders', icon: <WalletOutlined />, label: text.nav.orders },
    { key: '/admin/payments', icon: <CreditCardOutlined />, label: text.nav.payments },
    { key: '/admin/fulfillment', icon: <ApiOutlined />, label: text.nav.fulfillment },
    { key: '/admin/bots', icon: <RobotOutlined />, label: botsLabel },
    { key: '/admin/customers', icon: <TeamOutlined />, label: text.nav.customers },
    { key: '/admin/support', icon: <CustomerServiceOutlined />, label: text.nav.support },
    { key: '/admin/system', icon: <SettingOutlined />, label: text.nav.system },
    { key: '/', icon: <GlobalOutlined />, label: copy.admin.sidebar.viewStore },
  ]
}

export function getAdminMenuItems(copy: AppCopy, locale: Locale): MenuProps['items'] {
  const entries = getAdminNavEntries(copy, locale)
  const storeEntry = entries[entries.length - 1]
  const adminEntries = entries.slice(0, -1)

  return [
    ...adminEntries.map((entry) => ({
      key: entry.key,
      icon: entry.icon,
      label: entry.label,
    })),
    { type: 'divider' as const },
    {
      key: storeEntry.key,
      icon: <SafetyCertificateOutlined />,
      label: storeEntry.label,
    },
  ]
}

export function getSelectedAdminKey(pathname: string) {
  if (pathname === '/admin') {
    return '/admin'
  }

  if (pathname.startsWith('/admin/settings') || pathname.startsWith('/admin/system')) {
    return '/admin/system'
  }

  const candidates = [
    '/admin/products',
    '/admin/orders',
    '/admin/payments',
    '/admin/fulfillment',
    '/admin/bots',
    '/admin/customers',
    '/admin/support',
    '/admin/system',
  ]

  return candidates.find((candidate) => pathname.startsWith(candidate)) ?? '/admin'
}

export function getAdminBreadcrumbs(copy: AppCopy, locale: Locale, pathname: string) {
  const entries = getAdminNavEntries(copy, locale)
  const items = [{ label: entries[0].label, path: '/admin' }]
  const matched = pathname.startsWith('/admin/settings')
    ? entries.find((entry) => entry.key === '/admin/system')
    : entries.slice(1, -1).find((entry) => pathname.startsWith(entry.key))

  if (matched) {
    items.push({ label: matched.label, path: matched.key })
  }

  return items
}
