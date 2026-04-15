import type { TableColumnsType, TableProps } from 'antd'
import type { ReactNode } from 'react'

import type {
  AdminDeliveryRecord,
  AdminTelegramBindingRecord,
} from '../../api/adminBots'
import { buildAdminQueryPath } from '../routeFilters'
import { getDeliveryStatusTone } from '../status'
import {
  getTelegramBindingStatusLabel,
  getTelegramBindingStatusTone,
  getTelegramRoleLabel,
  getAdminBotsText,
} from './presentation'
import type { Locale } from '../../i18n/copy'
import { StatusTag } from '../../components/admin/StatusTag'
import type { AdminWorkbenchSection } from '../../components/admin/AdminTabbedWorkbench'
import { ActionButtons } from '../../components/common/ActionButtons'

type AdminBotSectionsParams = {
  locale: Locale
  bindings: AdminTelegramBindingRecord[]
  deliveryRecords: AdminDeliveryRecord[]
  deliveryRowSelection?: TableProps<Record<string, unknown>>['rowSelection']
  deliverySelectionBar?: ReactNode
  actions: {
    onOpenBindingDetail: (record: AdminTelegramBindingRecord) => void
    onOpenDeliveryDetail: (record: AdminDeliveryRecord) => void
    onRetryDelivery: (record: AdminDeliveryRecord) => void
    onNavigate: (to: string) => void
  }
  labels: {
    details: string
    retry: string
    ordersPage: string
  }
}

export function getAdminBotSections(
  params: AdminBotSectionsParams,
): AdminWorkbenchSection[] {
  const { locale, bindings, deliveryRecords, deliveryRowSelection, deliverySelectionBar, actions, labels } =
    params
  const text = getAdminBotsText(locale)

  const bindingColumns: TableColumnsType<Record<string, unknown>> = [
    {
      title: locale === 'zh-CN' ? '账户' : 'Account',
      dataIndex: 'displayName',
      width: 220,
      render: (_value, record) => {
        const binding = record as AdminTelegramBindingRecord

        return (
          <div className="admin-row-title">
            <strong>{binding.displayName || binding.telegramUsername || binding.userId}</strong>
            <small>{binding.email || `User ID: ${binding.userId}`}</small>
          </div>
        )
      },
    },
    {
      title: locale === 'zh-CN' ? '角色' : 'Role',
      dataIndex: 'userRole',
      width: 112,
      render: (value: string) => getTelegramRoleLabel(locale, value),
    },
    {
      title: locale === 'zh-CN' ? '状态' : 'Status',
      dataIndex: 'userStatus',
      width: 116,
      render: (value: string) => (
        <StatusTag
          label={getTelegramBindingStatusLabel(locale, value)}
          tone={getTelegramBindingStatusTone(value)}
        />
      ),
    },
    {
      title: locale === 'zh-CN' ? 'Telegram 用户名' : 'Telegram username',
      dataIndex: 'telegramUsername',
      width: 168,
      render: (value: string) => formatTelegramUsername(value),
    },
    {
      title: locale === 'zh-CN' ? 'Telegram 用户 ID' : 'Telegram user id',
      dataIndex: 'telegramUserId',
      width: 172,
    },
    {
      title: locale === 'zh-CN' ? '会话 ID' : 'Chat id',
      dataIndex: 'chatId',
      width: 172,
    },
    {
      title: locale === 'zh-CN' ? '绑定时间' : 'Bound at',
      dataIndex: 'boundAt',
      width: 156,
    },
    {
      title: locale === 'zh-CN' ? '最近登录' : 'Last login',
      dataIndex: 'lastLoginAt',
      width: 156,
    },
    {
      title: locale === 'zh-CN' ? '操作' : 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_value, record) => (
        <ActionButtons
          actions={[
            {
              key: 'detail',
              label: labels.details,
              onClick: () => actions.onOpenBindingDetail(record as AdminTelegramBindingRecord),
            },
          ]}
        />
      ),
    },
  ]

  const deliveryColumns: TableColumnsType<Record<string, unknown>> = [
    {
      title: locale === 'zh-CN' ? '订单号' : 'Order no.',
      dataIndex: 'orderNo',
      width: 172,
    },
    {
      title: locale === 'zh-CN' ? '目标' : 'Target',
      dataIndex: 'target',
      width: 220,
      render: (value: string, record) => {
        const delivery = record as AdminDeliveryRecord

        return (
          <div className="admin-row-title">
            <strong>{value || '-'}</strong>
            <small>{delivery.deliveryChannel}</small>
          </div>
        )
      },
    },
    {
      title: locale === 'zh-CN' ? '状态' : 'Status',
      dataIndex: 'status',
      width: 116,
      render: (value: string) => (
        <StatusTag
          label={getDeliveryStatusLabel(locale, value)}
          tone={getDeliveryStatusTone(value as never)}
        />
      ),
    },
    {
      title: locale === 'zh-CN' ? '开始时间' : 'Started at',
      dataIndex: 'startedAt',
      width: 156,
    },
    {
      title: locale === 'zh-CN' ? '完成时间' : 'Finished at',
      dataIndex: 'finishedAt',
      width: 156,
    },
    {
      title: locale === 'zh-CN' ? '操作' : 'Actions',
      key: 'actions',
      width: 214,
      fixed: 'right',
      render: (_value, record) => {
        const delivery = record as AdminDeliveryRecord

        return (
          <ActionButtons
            actions={[
              {
                key: 'detail',
                label: labels.details,
                onClick: () => actions.onOpenDeliveryDetail(delivery),
              },
              {
                key: 'retry',
                label: labels.retry,
                hidden: delivery.status === 'sent',
                onClick: () => actions.onRetryDelivery(delivery),
              },
              {
                key: 'orders',
                label: labels.ordersPage,
                onClick: () =>
                  actions.onNavigate(
                    buildAdminQueryPath('/admin/orders', {
                      orderNo: delivery.orderNo,
                    }),
                  ),
              },
            ]}
          />
        )
      },
    },
  ]

  return [
    {
      key: 'bindings',
      label: text.sections.bindings,
      title: text.sections.bindingsTitle,
      description: text.sections.bindingsDescription,
      dataSource: bindings,
      columns: bindingColumns,
      scrollX: 1360,
      fitContent: true,
    },
    {
      key: 'deliveries',
      label: text.sections.deliveries,
      title: text.sections.deliveriesTitle,
      description: text.sections.deliveriesDescription,
      dataSource: deliveryRecords,
      columns: deliveryColumns,
      rowSelection: deliveryRowSelection,
      selectionBar: deliverySelectionBar,
      scrollX: 1280,
      fitContent: true,
    },
  ]
}

function formatTelegramUsername(value: string) {
  if (!value) {
    return '-'
  }

  return value.startsWith('@') ? value : `@${value}`
}

function getDeliveryStatusLabel(locale: Locale, status: string) {
  const isZh = locale === 'zh-CN'

  switch (status) {
    case 'pending':
      return isZh ? '待发送' : 'Pending'
    case 'sending':
      return isZh ? '发送中' : 'Sending'
    case 'sent':
      return isZh ? '已发送' : 'Sent'
    case 'failed':
      return isZh ? '失败' : 'Failed'
    case 'cancelled':
      return isZh ? '已取消' : 'Cancelled'
    default:
      return status || '-'
  }
}
