import { Alert, App, Button, Card, Form, Input, Space, Tag } from 'antd'
import type { Key } from 'react'
import { useEffect, useMemo, useState } from 'react'

import {
  emptyAdminBotsDetailDrawerState,
  getBotResultLabels,
  getBotResultPreferredKeys,
  getTelegramBindingPreferredKeys,
  type AdminBotsDetailDrawerState,
} from '../../admin/bots/detail'
import { getAdminDetailSeedData } from '../../admin/detailDrawer'
import { getAdminBotSections } from '../../admin/bots/sections'
import {
  buildAdminBotMetricItems,
  getAdminBotSourceLabel,
  getAdminBotsText,
  getTelegramCommandPreset,
  normalizeBotKey,
} from '../../admin/bots/presentation'
import {
  buildLocalDeliveryDetail,
  getFulfillmentDetailLabels,
  getFulfillmentDetailPreferredKeys,
} from '../../admin/fulfillment/detail'
import { buildAdminQueryPath } from '../../admin/routeFilters'
import { getAdminSourceTagColor } from '../../admin/source'
import {
  bindTelegramUser,
  buildTelegramBindingDetail,
  buildTelegramBindingLabels,
  getAdminDeliveryRecordDetail,
  retryTelegramDelivery,
  simulateTelegramWebhook,
  testTelegramSend,
  type AdminDeliveryRecord,
  type AdminTelegramBindingRecord,
} from '../../api/adminBots'
import { AdminDetailDrawer } from '../../components/admin/AdminDetailDrawer'
import { AdminMetricStrip } from '../../components/admin/AdminMetricStrip'
import { AdminTabbedWorkbench } from '../../components/admin/AdminTabbedWorkbench'
import { ActionButtons } from '../../components/common/ActionButtons'
import { PageHeader } from '../../components/common/PageHeader'
import { SelectionSummaryBar } from '../../components/common/SelectionSummaryBar'
import { useAdminBotsData } from '../../hooks/useAdminBotsData'
import type { Locale } from '../../i18n/copy'
import { navigateTo, replaceTo, useLocationSearch } from '../../router'

type AdminBotsPageProps = {
  locale: Locale
  operatorName?: string
}

type BindFormValues = {
  email?: string
  displayName?: string
  telegramUserId: string
  telegramUsername?: string
  chatId: string
}

type TestSendFormValues = {
  chatId: string
  message: string
  operator: string
}

type WebhookFormValues = {
  chatId: string
  telegramUserId: string
  username?: string
  text: string
}

type RetryFormValues = {
  deliveryRecordId: string
}

export function AdminBotsPage(props: AdminBotsPageProps) {
  const { locale, operatorName } = props
  const text = getAdminBotsText(locale)
  const { message } = App.useApp()
  const locationSearch = useLocationSearch()
  const [bindForm] = Form.useForm<BindFormValues>()
  const [testSendForm] = Form.useForm<TestSendFormValues>()
  const [webhookForm] = Form.useForm<WebhookFormValues>()
  const [retryForm] = Form.useForm<RetryFormValues>()
  const [botKey, setBotKey] = useState(() => readBotKeyFromSearch(window.location.search))
  const [botKeyInput, setBotKeyInput] = useState(botKey)
  const [submittingKey, setSubmittingKey] = useState<string | null>(null)
  const [detailDrawer, setDetailDrawer] = useState<AdminBotsDetailDrawerState>(
    emptyAdminBotsDetailDrawerState,
  )
  const [selectedDeliveryKeys, setSelectedDeliveryKeys] = useState<Key[]>([])
  const {
    bindings,
    deliveryRecords,
    loading,
    error,
    source,
    remoteEnabled,
    reload,
  } = useAdminBotsData(botKey)

  useEffect(() => {
    const nextBotKey = readBotKeyFromSearch(locationSearch)
    setBotKey((prev) => (prev === nextBotKey ? prev : nextBotKey))
    setBotKeyInput((prev) => (prev === nextBotKey ? prev : nextBotKey))
  }, [locationSearch])

  useEffect(() => {
    replaceTo(
      buildAdminQueryPath('/admin/bots', {
        botKey,
      }),
    )
  }, [botKey])

  useEffect(() => {
    setSelectedDeliveryKeys([])
  }, [botKey, deliveryRecords])

  useEffect(() => {
    testSendForm.setFieldsValue({
      operator: operatorName ?? '',
    })
  }, [operatorName, testSendForm])

  useEffect(() => {
    webhookForm.setFieldsValue({
      text: getTelegramCommandPreset(locale),
    })
  }, [locale, webhookForm])

  const selectedDeliveries = useMemo(
    () => deliveryRecords.filter((record) => selectedDeliveryKeys.includes(record.key)),
    [deliveryRecords, selectedDeliveryKeys],
  )
  const retryableDeliveries = useMemo(
    () => selectedDeliveries.filter((record) => record.status !== 'sent'),
    [selectedDeliveries],
  )

  const deliverySelectionBar = (
    <SelectionSummaryBar
      selectedCount={selectedDeliveries.length}
      title={text.selection.title}
      itemLabelSingular={text.selection.single}
      itemLabelPlural={text.selection.plural}
      clearText={text.actions.clearSelection}
      onClear={() => setSelectedDeliveryKeys([])}
      actions={[
        {
          key: 'batch_retry',
          label: text.actions.batchRetry,
          type: 'primary',
          hidden: !retryableDeliveries.length,
          onClick: () => {
            void handleBatchRetry()
          },
        },
      ]}
    />
  )

  const sections = getAdminBotSections({
    locale,
    bindings,
    deliveryRecords,
    deliveryRowSelection: {
      selectedRowKeys: selectedDeliveryKeys,
      onChange: (keys) => setSelectedDeliveryKeys(keys),
      preserveSelectedRowKeys: true,
    },
    deliverySelectionBar,
    labels: {
      details: text.actions.details,
      retry: text.actions.retry,
      ordersPage: text.actions.ordersPage,
    },
    actions: {
      onOpenBindingDetail: openBindingDetail,
      onOpenDeliveryDetail: (record) => {
        void openDeliveryDetail(record)
      },
      onRetryDelivery: (record) => {
        void runSingleRetry(record.key)
      },
      onNavigate: navigateTo,
    },
  })

  const detailFieldLabels =
    detailDrawer.kind === 'binding'
      ? buildTelegramBindingLabels(locale)
      : detailDrawer.kind === 'delivery'
        ? getFulfillmentDetailLabels(locale)
        : getBotResultLabels(locale)

  const detailPreferredKeys =
    detailDrawer.kind === 'binding'
      ? getTelegramBindingPreferredKeys()
      : detailDrawer.kind === 'delivery'
        ? getFulfillmentDetailPreferredKeys()
        : getBotResultPreferredKeys()

  return (
    <div className="admin-page">
      <PageHeader
        title={text.page.title}
        subtitle={text.page.subtitle}
        extra={
          <Space size={8} wrap>
            <Tag>{botKey}</Tag>
            <Tag color={getAdminSourceTagColor(source, remoteEnabled)}>
              {getAdminBotSourceLabel(source, text)}
            </Tag>
          </Space>
        }
      />

      {!remoteEnabled ? (
        <Alert
          showIcon
          type="info"
          message={text.source.remoteRequired}
        />
      ) : null}

      <AdminMetricStrip items={buildAdminBotMetricItems(locale, bindings, deliveryRecords)} />

      <div className="admin-bot-actions">
        <Card size="small" className="admin-side-card" title={text.cards.scope.title}>
          <div className="admin-bot-card__description">{text.cards.scope.description}</div>

          <div className="admin-bot-scope">
            <Input
              value={botKeyInput}
              className="admin-toolbar-field admin-toolbar-field--wide"
              placeholder={text.placeholders.botKey}
              onChange={(event) => setBotKeyInput(event.target.value)}
            />
            <Button
              className="admin-toolbar-action"
              disabled={submittingKey !== null}
              onClick={() => {
                void applyBotKey()
              }}
            >
              {text.actions.applyBotKey}
            </Button>
          </div>

          <Form<BindFormValues>
            layout="vertical"
            form={bindForm}
            className="admin-bot-form"
            disabled={!remoteEnabled}
            onFinish={(values) => {
              void handleBind(values)
            }}
          >
            <div className="admin-bot-form__grid">
              <Form.Item name="email" label={text.fields.email}>
                <Input placeholder={text.placeholders.email} />
              </Form.Item>

              <Form.Item name="displayName" label={text.fields.displayName}>
                <Input placeholder={text.placeholders.displayName} />
              </Form.Item>

              <Form.Item
                name="telegramUserId"
                label={text.fields.telegramUserId}
                rules={[{ required: true, message: getRequiredMessage(locale, text.fields.telegramUserId) }]}
              >
                <Input placeholder={text.placeholders.telegramUserId} />
              </Form.Item>

              <Form.Item name="telegramUsername" label={text.fields.telegramUsername}>
                <Input placeholder={text.placeholders.telegramUsername} />
              </Form.Item>

              <Form.Item
                name="chatId"
                label={text.fields.chatId}
                rules={[{ required: true, message: getRequiredMessage(locale, text.fields.chatId) }]}
              >
                <Input placeholder={text.placeholders.chatId} />
              </Form.Item>
            </div>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={submittingKey === 'bind'}
                disabled={!remoteEnabled}
              >
                {text.actions.bind}
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <Card size="small" className="admin-side-card" title={text.cards.testSend.title}>
          <div className="admin-bot-card__description">{text.cards.testSend.description}</div>

          <Form<TestSendFormValues>
            layout="vertical"
            form={testSendForm}
            className="admin-bot-form"
            disabled={!remoteEnabled}
            onFinish={(values) => {
              void handleTestSend(values)
            }}
          >
            <div className="admin-bot-form__grid">
              <Form.Item
                name="chatId"
                label={text.fields.chatId}
                rules={[{ required: true, message: getRequiredMessage(locale, text.fields.chatId) }]}
              >
                <Input placeholder={text.placeholders.chatId} />
              </Form.Item>

              <Form.Item
                name="operator"
                label={text.fields.operator}
                rules={[{ required: true, message: getRequiredMessage(locale, text.fields.operator) }]}
              >
                <Input placeholder={text.placeholders.operator} />
              </Form.Item>

              <Form.Item
                className="admin-bot-form__span-2"
                name="message"
                label={text.fields.message}
                rules={[{ required: true, message: getRequiredMessage(locale, text.fields.message) }]}
              >
                <Input.TextArea rows={4} placeholder={text.placeholders.message} />
              </Form.Item>
            </div>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={submittingKey === 'test-send'}
                disabled={!remoteEnabled}
              >
                {text.actions.send}
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <Card size="small" className="admin-side-card" title={text.cards.webhook.title}>
          <div className="admin-bot-card__description">{text.cards.webhook.description}</div>

          <Form<WebhookFormValues>
            layout="vertical"
            form={webhookForm}
            className="admin-bot-form"
            disabled={!remoteEnabled}
            onFinish={(values) => {
              void handleWebhook(values)
            }}
          >
            <div className="admin-bot-form__grid">
              <Form.Item
                name="chatId"
                label={text.fields.chatId}
                rules={[{ required: true, message: getRequiredMessage(locale, text.fields.chatId) }]}
              >
                <Input placeholder={text.placeholders.chatId} />
              </Form.Item>

              <Form.Item
                name="telegramUserId"
                label={text.fields.telegramUserId}
                rules={[{ required: true, message: getRequiredMessage(locale, text.fields.telegramUserId) }]}
              >
                <Input placeholder={text.placeholders.telegramUserId} />
              </Form.Item>

              <Form.Item name="username" label={text.fields.telegramUsername}>
                <Input placeholder={text.placeholders.telegramUsername} />
              </Form.Item>

              <Form.Item
                name="text"
                label={text.fields.text}
                rules={[{ required: true, message: getRequiredMessage(locale, text.fields.text) }]}
              >
                <Input placeholder={text.placeholders.text} />
              </Form.Item>
            </div>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={submittingKey === 'webhook'}
                disabled={!remoteEnabled}
              >
                {text.actions.simulate}
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <Card size="small" className="admin-side-card" title={text.cards.retry.title}>
          <div className="admin-bot-card__description">{text.cards.retry.description}</div>

          <Form<RetryFormValues>
            layout="vertical"
            form={retryForm}
            className="admin-bot-form"
            disabled={!remoteEnabled}
            onFinish={(values) => {
              void handleRetry(values)
            }}
          >
            <Form.Item
              name="deliveryRecordId"
              label={text.fields.deliveryRecordId}
              rules={[{ required: true, message: getRequiredMessage(locale, text.fields.deliveryRecordId) }]}
            >
              <Input placeholder={text.placeholders.deliveryRecordId} />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={submittingKey === 'retry'}
                disabled={!remoteEnabled}
              >
                {text.actions.retry}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>

      <AdminTabbedWorkbench
        locale={locale}
        sections={sections}
        loading={loading}
        error={remoteEnabled ? error : null}
        toolbarExtra={
          <ActionButtons
            actions={[
              {
                key: 'orders',
                label: text.actions.ordersPage,
                onClick: () => navigateTo('/admin/orders'),
              },
              {
                key: 'reload',
                label: text.actions.reload,
                onClick: () => {
                  void reloadBots()
                },
              },
            ]}
          />
        }
      />

      <AdminDetailDrawer
        locale={locale}
        open={detailDrawer.open}
        title={detailDrawer.title}
        loading={detailDrawer.loading}
        error={detailDrawer.error}
        data={detailDrawer.data}
        fieldLabels={detailFieldLabels}
        preferredKeys={detailPreferredKeys}
        onClose={() => setDetailDrawer(emptyAdminBotsDetailDrawerState)}
      />
    </div>
  )

  async function applyBotKey() {
    const nextBotKey = normalizeBotKey(botKeyInput)
    setBotKeyInput(nextBotKey)

    if (nextBotKey === botKey) {
      await reloadBots()
      return
    }

    setBotKey(nextBotKey)
  }

  async function reloadBots() {
    try {
      await reload()
    } catch (nextError) {
      message.error(getErrorMessage(nextError, text.feedback.actionFailed))
    }
  }

  function openBindingDetail(record: AdminTelegramBindingRecord) {
    setDetailDrawer({
      open: true,
      kind: 'binding',
      title: `${text.detail.bindingTitle} · ${record.displayName || record.bindingId}`,
      loading: false,
      error: null,
      data: buildTelegramBindingDetail(record),
    })
  }

  async function openDeliveryDetail(record: AdminDeliveryRecord) {
    const remoteDetailReady = source === 'remote'
    const fallbackDetail = buildLocalDeliveryDetail(record, locale)

    setDetailDrawer({
      open: true,
      kind: 'delivery',
      title: `${text.detail.deliveryTitle} · ${record.orderNo}`,
      loading: remoteDetailReady,
      error: null,
      data: getAdminDetailSeedData(remoteDetailReady, fallbackDetail),
    })

    if (!remoteDetailReady) {
      return
    }

    try {
      const remoteDetail = await getAdminDeliveryRecordDetail(record.key)
      setDetailDrawer({
        open: true,
        kind: 'delivery',
        title: `${text.detail.deliveryTitle} · ${record.orderNo}`,
        loading: false,
        error: null,
        data: remoteDetail,
      })
    } catch (nextError) {
      setDetailDrawer({
        open: true,
        kind: 'delivery',
        title: `${text.detail.deliveryTitle} · ${record.orderNo}`,
        loading: false,
        error: getErrorMessage(nextError, text.feedback.actionFailed),
        data: getAdminDetailSeedData(remoteDetailReady, fallbackDetail),
      })
    }
  }

  async function handleBind(values: BindFormValues) {
    await withSubmitting('bind', async () => {
      const result = await bindTelegramUser(botKey, values)
      message.success(text.feedback.bindingSaved)
      bindForm.resetFields()
      await reload()
      openResultDrawer(text.feedback.bindingSaved, result)
    })
  }

  async function handleTestSend(values: TestSendFormValues) {
    await withSubmitting('test-send', async () => {
      const result = await testTelegramSend(botKey, values)
      message.success(text.feedback.testSent)
      openResultDrawer(text.feedback.testSent, result)
    })
  }

  async function handleWebhook(values: WebhookFormValues) {
    await withSubmitting('webhook', async () => {
      const result = await simulateTelegramWebhook(botKey, {
        ...values,
        operator: operatorName ?? '',
      })
      message.success(text.feedback.webhookSimulated)
      openResultDrawer(text.feedback.webhookSimulated, result)
    })
  }

  async function handleRetry(values: RetryFormValues) {
    await runSingleRetry(values.deliveryRecordId, true)
  }

  async function runSingleRetry(deliveryRecordId: string, syncForm = false) {
    await withSubmitting('retry', async () => {
      const result = await retryTelegramDelivery(botKey, deliveryRecordId)
      if (syncForm) {
        retryForm.setFieldsValue({ deliveryRecordId })
      }
      message.success(text.feedback.retryDone)
      await reload()
      openResultDrawer(text.feedback.retryDone, result)
    })
  }

  async function handleBatchRetry() {
    await withSubmitting('batch-retry', async () => {
      const results = await Promise.allSettled(
        retryableDeliveries.map((record) => retryTelegramDelivery(botKey, record.key)),
      )
      const failedCount = results.filter((result) => result.status === 'rejected').length

      if (failedCount > 0) {
        throw new Error(
          locale === 'zh-CN'
            ? `批量补发完成，但有 ${failedCount} 条失败。`
            : `Batch retry completed with ${failedCount} failures.`,
        )
      }

      message.success(text.feedback.batchRetryDone)
      setSelectedDeliveryKeys([])
      await reload()
    })
  }

  function openResultDrawer(title: string, data: Record<string, unknown>) {
    setDetailDrawer({
      open: true,
      kind: 'result',
      title,
      loading: false,
      error: null,
      data,
    })
  }

  async function withSubmitting(actionKey: string, task: () => Promise<void>) {
    try {
      setSubmittingKey(actionKey)
      await task()
    } catch (nextError) {
      message.error(getErrorMessage(nextError, text.feedback.actionFailed))
    } finally {
      setSubmittingKey(null)
    }
  }
}

function readBotKeyFromSearch(search: string) {
  const params = new URLSearchParams(search)
  return normalizeBotKey(params.get('botKey') ?? '')
}

function getRequiredMessage(locale: Locale, label: string) {
  return locale === 'zh-CN' ? `请填写${label}` : `Please enter ${label.toLowerCase()}`
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}
