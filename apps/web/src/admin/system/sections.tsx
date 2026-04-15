import { Button, Space, Tag } from 'antd'
import type { FormInstance, TableColumnsType } from 'antd'

import { getBooleanText, getScopeText } from '../presentation'
import { getHealthTone } from '../status'
import { uploadAdminPaymentChannelAsset } from '../../api/adminUploads'
import { StatusTag } from '../../components/admin/StatusTag'
import type { AdminConsoleText } from '../../i18n/adminConsole-types'
import type { Locale } from '../../i18n/copy'
import type {
  AdminIntegrationAction,
  AdminIntegrationProvider,
  AdminRuntimeSetting,
} from '../../data/admin'
import type {
  AdminManagedPaymentChannel,
  AdminPaymentChannelType,
  AdminSystemDraft,
  DrawerFieldSchema,
  SystemSectionKey,
} from './types'

type SectionActionHandlers = {
  onView: (record: Record<string, unknown>) => void
  onEdit: (record: Record<string, unknown>) => void
  onDelete: (record: Record<string, unknown>) => void
  onTest: (record: Record<string, unknown>) => void
}

type SectionLocalLabels = {
  edit: string
  delete: string
  test: string
  create: {
    paymentChannels: string
    providers: string
    actions: string
    fulfillmentStrategies: string
    deliveryStrategies: string
    telegramConfigs: string
    internalClientKeys: string
    runtimeSettings: string
  }
}

type SystemSectionConfig = {
  title: string
  description: string
  count: number
  dataSource: Record<string, unknown>[]
  columns: TableColumnsType<Record<string, unknown>>
  fields?: DrawerFieldSchema[]
  createLabel?: string
  createInitial?: () => Record<string, unknown>
  editorOnValuesChange?: (
    changedValues: Record<string, unknown>,
    allValues: Record<string, unknown>,
    form: FormInstance<Record<string, unknown>>,
  ) => void
  module?: string
  getTargetId?: (record: Record<string, unknown>) => string
}

type PaymentChannelPreset = Pick<
  AdminManagedPaymentChannel,
  | 'channelKey'
  | 'channelName'
  | 'displayNameZh'
  | 'displayNameEn'
  | 'modeLabelZh'
  | 'modeLabelEn'
  | 'channelType'
  | 'providerName'
  | 'currency'
  | 'settlementMode'
  | 'reference'
>

const paymentChannelPresets: PaymentChannelPreset[] = [
  {
    channelKey: 'wechat_qr_main',
    channelName: 'WeChat QR',
    displayNameZh: '微信收款码',
    displayNameEn: 'WeChat QR',
    modeLabelZh: '人工确认',
    modeLabelEn: 'Manual review',
    channelType: 'wechat_qr',
    providerName: 'manual_qr',
    currency: 'RMB',
    settlementMode: 'manual',
    reference: 'WX-PASSDOCK-MAIN',
  },
  {
    channelKey: 'alipay_qr_main',
    channelName: 'Alipay QR',
    displayNameZh: '支付宝收款码',
    displayNameEn: 'Alipay QR',
    modeLabelZh: '人工确认',
    modeLabelEn: 'Manual review',
    channelType: 'alipay_qr',
    providerName: 'manual_qr',
    currency: 'RMB',
    settlementMode: 'manual',
    reference: 'ALI-PASSDOCK-MAIN',
  },
  {
    channelKey: 'okx_usdt_watch',
    channelName: 'OKX USDT',
    displayNameZh: 'OKX USDT',
    displayNameEn: 'OKX USDT',
    modeLabelZh: '链上监听',
    modeLabelEn: 'On-chain watcher',
    channelType: 'okx_usdt',
    providerName: 'chain_watcher',
    currency: 'USDT',
    settlementMode: 'auto',
    reference: 'OKX-USDT-MAIN',
  },
  {
    channelKey: 'usdt_qr_main',
    channelName: 'USDT QR',
    displayNameZh: 'USDT 收款码',
    displayNameEn: 'USDT QR',
    modeLabelZh: '人工确认',
    modeLabelEn: 'Manual review',
    channelType: 'usdt_qr',
    providerName: 'manual_qr',
    currency: 'USDT',
    settlementMode: 'manual',
    reference: 'USDT-QR-MAIN',
  },
]

export function getSystemSectionItems(locale: Locale, draft: AdminSystemDraft) {
  const isZh = locale === 'zh-CN'

  return [
    {
      key: 'paymentChannels' as const,
      label: isZh ? '支付通道' : 'Payment channels',
      description: isZh ? '收款配置与通道状态' : 'Collection config and channel status',
      count: draft.paymentChannels.length,
    },
    {
      key: 'providers' as const,
      label: isZh ? '集成服务' : 'Providers',
      description: isZh ? '上游服务连接与鉴权配置' : 'Upstream connectivity and auth',
      count: draft.providers.length,
    },
    {
      key: 'actions' as const,
      label: isZh ? '集成动作' : 'Actions',
      description: isZh ? '请求路径、模板与响应映射' : 'Request path, templates, and response mapping',
      count: draft.actions.length,
    },
    {
      key: 'fulfillmentStrategies' as const,
      label: isZh ? '履约策略' : 'Fulfillment strategies',
      description: isZh ? '发码流程与结果提取规则' : 'Issuance flow and result extraction',
      count: draft.fulfillmentStrategies.length,
    },
    {
      key: 'deliveryStrategies' as const,
      label: isZh ? '交付策略' : 'Delivery strategies',
      description: isZh ? '站内、Telegram 与人工交付规则' : 'Web, Telegram, and manual delivery rules',
      count: draft.deliveryStrategies.length,
    },
    {
      key: 'telegramConfigs' as const,
      label: isZh ? 'Telegram 机器人' : 'Telegram bots',
      description: isZh ? '机器人令牌、回调密钥与运行状态' : 'Bot token, webhook secret, and runtime status',
      count: draft.telegramConfigs.length,
    },
    {
      key: 'internalClientKeys' as const,
      label: isZh ? '内部客户端' : 'Internal clients',
      description: isZh ? '内部接口签名密钥与权限范围' : 'Signed internal API clients and scope control',
      count: draft.internalClientKeys.length,
    },
    {
      key: 'runtimeSettings' as const,
      label: isZh ? '运行参数' : 'Runtime settings',
      description: isZh ? '业务运行时可覆盖参数' : 'Runtime business overrides and limits',
      count: draft.runtimeSettings.length,
    },
    {
      key: 'auditLogs' as const,
      label: isZh ? '审计日志' : 'Audit logs',
      description: isZh ? '后台操作留痕' : 'Operator audit trail',
      count: draft.auditLogs.length,
    },
  ]
}

export function getSystemSectionConfig(params: {
  section: SystemSectionKey
  locale: Locale
  text: AdminConsoleText
  draft: AdminSystemDraft
  labels: SectionLocalLabels
  actions: SectionActionHandlers
}): SystemSectionConfig {
  const { section, locale, text, draft, labels, actions } = params
  const isZh = locale === 'zh-CN'

  switch (section) {
    case 'paymentChannels':
      return {
        title: isZh ? '支付通道配置' : 'Payment channel configuration',
        description: isZh
          ? '统一维护收款码、通道键、结算方式与启停状态。'
          : 'Manage channel keys, settlement mode, payment content, and runtime availability.',
        count: draft.paymentChannels.length,
        dataSource: draft.paymentChannels,
        columns: getPaymentChannelColumnsConfig(locale, text, labels, actions),
        fields: getPaymentChannelFieldsConfig(locale, text, draft),
        editorOnValuesChange: handlePaymentChannelEditorValuesChange,
        createLabel: labels.create.paymentChannels,
        createInitial: () => createPaymentChannelInitialValues(),
        module: 'payment_channels',
        getTargetId: (record) => String(record.channelKey ?? ''),
      }
    case 'providers':
      return {
        title: isZh ? '服务方配置' : 'Integration providers',
        description: isZh
          ? '配置上游服务方的连接地址、鉴权信息、超时与重试策略。'
          : 'Configure upstream providers, auth mode, timeouts, retries, and health readiness.',
        count: draft.providers.length,
        dataSource: draft.providers,
        columns: getProviderColumns(locale, text, labels, actions),
        fields: getProviderFields(locale, text),
        createLabel: labels.create.providers,
        createInitial: () => ({
          providerKey: '',
          providerName: '',
          baseUrl: '',
          authType: 'none',
          authConfig: {},
          retryTimes: 0,
          timeoutMs: 10000,
          health: 'unknown',
          enabled: true,
        }),
        module: 'integration_providers',
        getTargetId: (record) => String(record.providerKey ?? ''),
      }
    case 'actions':
      return {
        title: isZh ? '动作映射' : 'Integration actions',
        description: isZh
          ? '维护请求方法、路径模板、请求体模板与响应提取规则。'
          : 'Define request method, path template, request templates, and response extraction rules.',
        count: draft.actions.length,
        dataSource: draft.actions,
        columns: getActionColumns(locale, labels, actions),
        fields: getActionFields(locale, draft.providers),
        createLabel: labels.create.actions,
        createInitial: () => ({
          providerKey: draft.providers[0]?.providerKey ?? '',
          actionKey: '',
          method: 'POST',
          pathTemplate: '',
          successPath: 'success',
          messagePath: 'message',
          codeListPath: 'data.codes',
          headerTemplate: {},
          queryTemplate: {},
          bodyTemplate: {},
          enabled: true,
        }),
        module: 'integration_actions',
        getTargetId: (record) => String(record.actionKey ?? ''),
      }
    case 'fulfillmentStrategies':
      return {
        title: isZh ? '履约策略模板' : 'Fulfillment strategy templates',
        description: isZh
          ? '将履约类型、服务方、动作与模板配置绑定成可执行发码策略。'
          : 'Bind fulfillment type, provider, action, and templates into executable issuance strategies.',
        count: draft.fulfillmentStrategies.length,
        dataSource: draft.fulfillmentStrategies,
        columns: getFulfillmentColumns(locale, text, labels, actions),
        fields: getFulfillmentFields(locale, text, draft.providers, draft.actions),
        createLabel: labels.create.fulfillmentStrategies,
        createInitial: () => ({
          strategyKey: '',
          strategyName: '',
          fulfillmentType: 'issue_code',
          providerKey: draft.providers[0]?.providerKey ?? '',
          actionKey: draft.actions[0]?.actionKey ?? '',
          requestTemplate: {},
          resultSchema: {},
          deliveryTemplate: {},
          retryPolicy: {},
          enabled: true,
        }),
        module: 'fulfillment_strategies',
        getTargetId: (record) => String(record.strategyKey ?? ''),
      }
    case 'deliveryStrategies':
      return {
        title: isZh ? '交付策略模板' : 'Delivery strategy templates',
        description: isZh
          ? '配置交付渠道、脱敏规则、重发能力与最终消息模板。'
          : 'Maintain channel, masking, resend rules, and final message templates.',
        count: draft.deliveryStrategies.length,
        dataSource: draft.deliveryStrategies,
        columns: getDeliveryColumns(locale, text, labels, actions),
        fields: getDeliveryFields(locale, text),
        createLabel: labels.create.deliveryStrategies,
        createInitial: () => ({
          strategyKey: '',
          strategyName: '',
          channelType: 'web',
          maskPolicy: '',
          resendAllowed: false,
          messageTemplate: {},
          enabled: true,
        }),
        module: 'delivery_strategies',
        getTargetId: (record) => String(record.strategyKey ?? ''),
      }
    case 'telegramConfigs':
      return {
        title: isZh ? 'Telegram 机器人配置' : 'Telegram bot configuration',
        description: isZh
          ? '维护机器人标识、令牌、回调密钥与启用状态，前台发送和回调校验会直接读取这里。'
          : 'Maintain bot key, token, webhook secret, and enable status for live delivery and webhook validation.',
        count: draft.telegramConfigs.length,
        dataSource: draft.telegramConfigs,
        columns: getTelegramConfigColumns(locale, labels, actions),
        fields: getTelegramConfigFields(locale),
        createLabel: labels.create.telegramConfigs,
        createInitial: () => ({
          botKey: '',
          botUsername: '',
          botToken: '',
          webhookSecret: '',
          webhookUrl: '',
          webhookUrlResolved: '',
          webhookIP: '',
          allowedUpdates: 'message,callback_query',
          maxConnections: 40,
          dropPendingUpdates: false,
          enabled: true,
          source: 'db',
        }),
        module: 'telegram_bot_configs',
        getTargetId: (record) => String(record.botKey ?? ''),
      }
    case 'internalClientKeys':
      return {
        title: isZh ? '内部客户端密钥' : 'Internal client keys',
        description: isZh
          ? '管理内部接口的签名客户端标识、密钥、作用范围与允许来源。'
          : 'Manage signed internal API client keys, secrets, scopes, and allowed origins.',
        count: draft.internalClientKeys.length,
        dataSource: draft.internalClientKeys,
        columns: getInternalClientKeyColumns(locale, labels, actions),
        fields: getInternalClientKeyFields(locale),
        createLabel: labels.create.internalClientKeys,
        createInitial: () => ({
          clientKey: '',
          clientName: '',
          clientSecret: '',
          scopes: 'orders.fulfillment,orders.delivery,orders.read,payments.confirm',
          allowedIPs: '',
          status: 'active',
          enabled: true,
        }),
        module: 'internal_client_keys',
        getTargetId: (record) => String(record.clientKey ?? ''),
      }
    case 'runtimeSettings':
      return {
        title: isZh ? '运行时业务参数' : 'Runtime business settings',
        description: isZh
          ? '维护运行参数，遵循“环境变量覆盖 > 后台配置 > 默认值”的优先级。'
          : 'Maintain runtime values following env override > admin config > default precedence.',
        count: draft.runtimeSettings.length,
        dataSource: draft.runtimeSettings,
        columns: getRuntimeColumns(locale, text, labels, actions),
        fields: getRuntimeFields(locale),
        createLabel: labels.create.runtimeSettings,
        createInitial: () => ({
          module: '',
          name: '',
          value: '',
          scope: 'db',
          effectiveValue: '',
          valueSource: 'db',
          appliesLive: false,
          description: '',
          envKey: '',
        }),
        module: 'runtime_settings',
        getTargetId: (record) => String(record.name ?? ''),
      }
    default:
      return {
        title: isZh ? '审计日志' : 'Audit logs',
        description: isZh
          ? '所有远程配置修改、测试和删除操作都应该可追溯。'
          : 'Every remote config mutation, test run, and delete action should be auditable.',
        count: draft.auditLogs.length,
        dataSource: draft.auditLogs,
        columns: getAuditLogColumns(locale, text, actions),
      }
  }
}

function getOperationColumn(
  locale: Locale,
  labels: SectionLocalLabels,
  actions: SectionActionHandlers,
  includeTest = false,
) {
  return {
    title: locale === 'zh-CN' ? '操作' : 'Actions',
    key: 'actions',
    width: includeTest ? 188 : 132,
    fixed: 'right' as const,
    render: (_value: unknown, record: Record<string, unknown>) => (
      <Space size={4}>
        <Button size="small" type="link" onClick={() => actions.onEdit(record)}>
          {labels.edit}
        </Button>
        {includeTest ? (
          <Button size="small" type="link" onClick={() => actions.onTest(record)}>
            {labels.test}
          </Button>
        ) : null}
        <Button size="small" danger type="link" onClick={() => actions.onDelete(record)}>
          {labels.delete}
        </Button>
      </Space>
    ),
  }
}

function getAuditLogColumns(
  locale: Locale,
  text: AdminConsoleText,
  actions: SectionActionHandlers,
): TableColumnsType<Record<string, unknown>> {
  return [
    { title: text.table.operator, dataIndex: 'operator', width: 140 },
    { title: text.table.module, dataIndex: 'module', width: 164 },
    { title: text.table.action, dataIndex: 'action', width: 196 },
    { title: text.table.targetId, dataIndex: 'targetId', width: 208 },
    { title: text.table.createdAt, dataIndex: 'createdAt', width: 156 },
    {
      title: locale === 'zh-CN' ? '操作' : 'Actions',
      key: 'actions',
      width: 108,
      fixed: 'right',
      render: (_value: unknown, record: Record<string, unknown>) => (
        <Button size="small" type="link" onClick={() => actions.onView(record)}>
          {locale === 'zh-CN' ? '详情' : 'Details'}
        </Button>
      ),
    },
  ]
}

function getProviderColumns(
  locale: Locale,
  text: AdminConsoleText,
  labels: SectionLocalLabels,
  actions: SectionActionHandlers,
): TableColumnsType<Record<string, unknown>> {
  const isZh = locale === 'zh-CN'

  return [
    { title: text.table.providerKey, dataIndex: 'providerKey', width: 180 },
    { title: text.table.provider, dataIndex: 'providerName', width: 180 },
    { title: text.table.baseUrl, dataIndex: 'baseUrl', width: 264 },
    {
      title: text.table.authType,
      dataIndex: 'authType',
      width: 148,
      render: (value: string) => text.enums.authType[value] ?? value,
    },
    {
      title: isZh ? '超时' : 'Timeout',
      dataIndex: 'timeoutMs',
      width: 116,
      render: (value: unknown) => `${Number(value ?? 0)} ms`,
    },
    { title: text.table.retryTimes, dataIndex: 'retryTimes', width: 116 },
    {
      title: text.table.health,
      dataIndex: 'health',
      width: 116,
      render: (value: string) => (
        <StatusTag label={text.enums.health[value] ?? value} tone={getHealthTone(value as never)} />
      ),
    },
    {
      title: text.table.enabled,
      dataIndex: 'enabled',
      width: 108,
      render: (value: boolean) => renderBooleanStatus(locale, value),
    },
    getOperationColumn(locale, labels, actions, true),
  ]
}

function getPaymentChannelColumnsConfig(
  locale: Locale,
  text: AdminConsoleText,
  labels: SectionLocalLabels,
  actions: SectionActionHandlers,
): TableColumnsType<Record<string, unknown>> {
  const isZh = locale === 'zh-CN'

  return [
    {
      title: isZh ? '通道名称' : 'Channel name',
      dataIndex: 'channelName',
      width: 208,
    },
    { title: text.table.channelKey, dataIndex: 'channelKey', width: 172 },
    {
      title: text.table.channelType,
      dataIndex: 'channelType',
      width: 132,
      render: (value: string) => getPaymentChannelTypeLabel(locale, text, value),
    },
    {
      title: text.table.provider,
      dataIndex: 'providerName',
      width: 148,
      render: (value: string) =>
        locale === 'zh-CN' ? getPaymentProviderDisplayName(value) : value,
    },
    { title: text.table.currency, dataIndex: 'currency', width: 92 },
    {
      title: isZh ? '结算模式' : 'Settlement',
      dataIndex: 'settlementMode',
      width: 120,
      render: (value: string) => (value === 'auto' ? text.labels.auto : text.labels.manual),
    },
    {
      title: isZh ? '回调鉴权' : 'Callback auth',
      dataIndex: 'callbackAuthType',
      width: 148,
      render: (value: string) => renderPaymentCallbackAuthType(locale, value),
    },
    {
      title: isZh ? '参考标识' : 'Reference',
      dataIndex: 'reference',
      width: 172,
    },
    {
      title: text.table.enabled,
      dataIndex: 'enabled',
      width: 108,
      render: (value: boolean) => renderBooleanStatus(locale, value),
    },
    getOperationColumn(locale, labels, actions),
  ]
}

function getPaymentChannelFieldsConfig(
  locale: Locale,
  text: AdminConsoleText,
  draft: AdminSystemDraft,
): DrawerFieldSchema[] {
  const isZh = locale === 'zh-CN'
  const channelTypeOptions = getPaymentChannelPresetOptions(locale, text, 'channelType')

  return [
    {
      name: 'channelType',
      label: text.table.channelType,
      type: 'select',
      required: true,
      options: channelTypeOptions,
      placeholder: isZh ? '选择固定通道类型' : 'Select a channel preset',
      help: isZh
        ? '选择后会自动带出通道键、显示名、服务方、币种和参考标识。'
        : 'Selecting a type will auto-fill the channel key, labels, provider, currency, and reference.',
    },
    {
      name: 'channelKey',
      label: text.table.channelKey,
      type: 'select',
      required: true,
      options: getPaymentChannelPresetOptions(locale, text, 'channelKey'),
    },
    {
      name: 'channelName',
      label: isZh ? '通道名称' : 'Channel name',
      type: 'select',
      required: true,
      options: getPaymentChannelPresetOptions(locale, text, 'channelName'),
    },
    {
      name: 'displayNameZh',
      label: isZh ? '前台显示名（中文）' : 'Storefront label (ZH)',
      type: 'select',
      required: true,
      options: getPaymentChannelPresetOptions(locale, text, 'displayNameZh'),
    },
    {
      name: 'displayNameEn',
      label: isZh ? '前台显示名（英文）' : 'Storefront label (EN)',
      type: 'select',
      required: true,
      options: getPaymentChannelPresetOptions(locale, text, 'displayNameEn'),
    },
    {
      name: 'modeLabelZh',
      label: isZh ? '模式文案（中文）' : 'Mode label (ZH)',
      type: 'select',
      help: isZh ? '用于前台支付方式列表和收款码弹框。' : 'Used in the storefront payment list and QR modal.',
      options: getPaymentChannelPresetOptions(locale, text, 'modeLabelZh'),
    },
    {
      name: 'modeLabelEn',
      label: isZh ? '模式文案（英文）' : 'Mode label (EN)',
      type: 'select',
      help: isZh ? '用于前台支付方式列表和收款码弹框。' : 'Used in the storefront payment list and QR modal.',
      options: getPaymentChannelPresetOptions(locale, text, 'modeLabelEn'),
    },
    {
      name: 'providerName',
      label: text.table.provider,
      type: 'select',
      required: true,
      options: getPaymentChannelPresetOptions(locale, text, 'providerName'),
    },
    {
      name: 'currency',
      label: text.table.currency,
      type: 'select',
      required: true,
      options: getPaymentChannelPresetOptions(locale, text, 'currency'),
    },
    {
      name: 'settlementMode',
      label: isZh ? '结算模式' : 'Settlement mode',
      type: 'select',
      required: true,
      options: getPaymentChannelPresetOptions(locale, text, 'settlementMode'),
    },
    {
      name: 'enabled',
      label: text.table.enabled,
      type: 'switch',
    },
    {
      name: 'autoFulfill',
      label: isZh ? '支付确认后自动履约' : 'Auto fulfill after payment confirm',
      type: 'switch',
      help: isZh
        ? '适用于人工审核通过、支付回调和链上确认后的自动履约。'
        : 'Applies after manual approval, payment callbacks, and on-chain confirmations.',
    },
    {
      name: 'autoDeliver',
      label: isZh ? '履约后自动发货' : 'Auto deliver after fulfillment',
      type: 'switch',
      help: isZh
        ? '开启后会隐式执行自动履约，再继续自动发货。'
        : 'When enabled, fulfillment will run first and delivery will continue automatically.',
    },
    {
      name: 'qrValue',
      label: isZh ? '收款内容' : 'Payment content',
      type: 'asset',
      rows: 5,
      required: true,
      placeholder: isZh
        ? '填写二维码内容、地址、收款码文本，或上传收款码图片后的 URL'
        : 'Enter QR content, address, text payload, or upload a payment image URL',
      accept: 'image/png,image/jpeg,image/webp',
      uploadButtonLabel: isZh ? '上传收款码图片' : 'Upload payment image',
      uploadHint: isZh
        ? '支持 PNG、JPG、WEBP。上传后会自动把图片地址写入这里，前台会直接展示图片。'
        : 'Supports PNG, JPG, and WEBP. The uploaded image URL will be written here automatically.',
      uploadSuccessText: isZh ? '收款码图片已上传' : 'Payment image uploaded',
      previewKind: 'image',
      onUpload: async (file) => {
        const uploaded = await uploadAdminPaymentChannelAsset(file)
        return uploaded.objectUrl
      },
    },
    {
      name: 'reference',
      label: isZh ? '参考标识' : 'Reference',
      type: 'select',
      options: getPaymentChannelPresetOptions(locale, text, 'reference'),
      placeholder: isZh ? '如门店、钱包或渠道备注' : 'Store, wallet, or channel note',
    },
    {
      name: 'callbackAuthType',
      label: isZh ? '回调鉴权方式' : 'Callback auth type',
      type: 'select',
      required: true,
      options: [
        { value: 'none', label: isZh ? '不校验' : 'None' },
        { value: 'static_header', label: isZh ? '静态请求头' : 'Static header' },
        { value: 'hmac_sha256', label: 'HMAC-SHA256' },
      ],
    },
    {
      name: 'callbackSecret',
      label: isZh ? '回调 Secret' : 'Callback secret',
      type: 'textarea',
      rows: 4,
      help: isZh
        ? '编辑时留空表示保留当前回调 secret，静态请求头和 HMAC 都使用该值。'
        : 'Leave empty on edit to keep the current callback secret. Both static-header and HMAC modes use this value.',
      placeholder: isZh ? '填写回调验签 secret' : 'Enter the callback signing secret',
    },
    {
      name: 'callbackKey',
      label: isZh ? '回调 Key' : 'Callback key',
      type: 'text',
      placeholder: isZh ? '可选，用于 HMAC key id 校验' : 'Optional key id for HMAC callback validation',
    },
    {
      name: 'callbackHeaderName',
      label: isZh ? '回调请求头名称' : 'Callback header name',
      type: 'text',
      placeholder: isZh
        ? 'static_header 默认使用 X-PassDock-Callback-Token，HMAC 签名默认使用 X-PassDock-Key'
        : 'Static-header defaults to X-PassDock-Callback-Token. HMAC key defaults to X-PassDock-Key.',
    },
    {
      name: 'callbackSignHeader',
      label: isZh ? '签名请求头' : 'Signature header',
      type: 'text',
      placeholder: isZh ? '例如 X-PassDock-Sign' : 'For example: X-PassDock-Sign',
    },
    {
      name: 'callbackTimestampHeader',
      label: isZh ? '时间戳请求头' : 'Timestamp header',
      type: 'text',
      placeholder: isZh ? '例如 X-PassDock-Timestamp' : 'For example: X-PassDock-Timestamp',
    },
    {
      name: 'callbackNonceHeader',
      label: isZh ? '随机串请求头' : 'Nonce header',
      type: 'text',
      placeholder: isZh ? '例如 X-PassDock-Nonce' : 'For example: X-PassDock-Nonce',
    },
    {
      name: 'callbackSignatureParam',
      label: isZh ? '签名查询参数' : 'Signature query param',
      type: 'text',
      placeholder: isZh ? '如 sign' : 'For example: sign',
    },
    {
      name: 'callbackTimestampParam',
      label: isZh ? '时间戳查询参数' : 'Timestamp query param',
      type: 'text',
      placeholder: isZh ? '如 ts' : 'For example: ts',
    },
    {
      name: 'callbackNonceParam',
      label: isZh ? '随机串查询参数' : 'Nonce query param',
      type: 'text',
      placeholder: isZh ? '如 nonce' : 'For example: nonce',
    },
    {
      name: 'callbackTTLSeconds',
      label: isZh ? '回调时间窗口(s)' : 'Callback TTL (s)',
      type: 'number',
      min: 0,
      help: isZh
        ? '当回调带 timestamp 时用于限制重放时间窗，填 0 表示不额外限制。'
        : 'Use when the callback carries a timestamp. Set 0 to skip replay-window enforcement.',
    },
    {
      name: 'callbackSignSource',
      label: isZh ? '签名原文模式' : 'Signature source',
      type: 'select',
      required: true,
      options: [
        { value: 'body', label: isZh ? '原始 Body' : 'Raw body' },
        { value: 'body_sha256', label: isZh ? 'Body SHA256' : 'Body SHA256' },
        { value: 'timestamp_body', label: isZh ? 'timestamp + body' : 'timestamp + body' },
        {
          value: 'method_path_timestamp_nonce_body_sha256',
          label: isZh ? 'method/path/timestamp/nonce/body_sha256' : 'method/path/timestamp/nonce/body_sha256',
        },
      ],
    },
    {
      name: 'refundProviderKey',
      label: isZh ? '退款服务方' : 'Refund provider',
      type: 'select',
      options: [
        { value: '', label: isZh ? '不配置原路退款' : 'No original refund' },
        ...draft.providers.map((provider) => ({
          value: provider.providerKey,
          label: `${provider.providerKey} / ${provider.providerName}`,
        })),
      ],
      help: isZh
        ? '配置后，“发起原路退款”会调用这里指定的 Provider。'
        : 'When configured, original refund requests will call this provider.',
    },
    {
      name: 'refundActionKey',
      label: isZh ? '退款动作' : 'Refund action',
      type: 'select',
      options: [
        { value: '', label: isZh ? '请选择动作' : 'Select an action' },
        ...draft.actions.map((action) => ({
          value: action.actionKey,
          label: `${action.providerKey} / ${action.actionKey}`,
        })),
      ],
      help: isZh
        ? '建议使用专门的退款 Action，不要和支付确认或发码动作复用。'
        : 'Use a dedicated refund action instead of reusing payment or fulfillment actions.',
    },
    {
      name: 'refundStatusPath',
      label: isZh ? '退款状态路径' : 'Refund status path',
      type: 'text',
      placeholder: isZh ? '如 data.status / refund_status' : 'For example: data.status / refund_status',
      help: isZh
        ? '留空时会按常见字段自动猜测退款状态。'
        : 'Leave empty to use built-in status inference.',
    },
    {
      name: 'refundReceiptPath',
      label: isZh ? '退款回执路径' : 'Refund receipt path',
      type: 'text',
      placeholder: isZh ? '如 data.refund_no / out_refund_no' : 'For example: data.refund_no / out_refund_no',
      help: isZh
        ? '用于从退款响应里提取回执号或退款单号。'
        : 'Used to extract the refund receipt number from the response.',
    },
  ]
}

function createPaymentChannelInitialValues(
  channelType: AdminPaymentChannelType = 'wechat_qr',
) {
  return {
    ...getPaymentChannelPresetValues(channelType),
    enabled: true,
    qrValue: '',
    autoFulfill: false,
    autoDeliver: false,
    callbackAuthType: 'none',
    callbackSecret: '',
    callbackSecretMasked: '',
    callbackKey: '',
    callbackHeaderName: '',
    callbackSignHeader: '',
    callbackTimestampHeader: '',
    callbackNonceHeader: '',
    callbackSignatureParam: '',
    callbackTimestampParam: '',
    callbackNonceParam: '',
    callbackTTLSeconds: 300,
    callbackSignSource: 'body',
    refundProviderKey: '',
    refundActionKey: '',
    refundStatusPath: '',
    refundReceiptPath: '',
  }
}

function handlePaymentChannelEditorValuesChange(
  changedValues: Record<string, unknown>,
  _allValues: Record<string, unknown>,
  form: FormInstance<Record<string, unknown>>,
) {
  const nextChannelType = changedValues.channelType

  if (typeof nextChannelType !== 'string') {
    return
  }

  form.setFieldsValue(getPaymentChannelPresetValues(nextChannelType))
}

function getPaymentChannelPresetValues(channelType: string) {
  const preset =
    paymentChannelPresets.find((item) => item.channelType === channelType) ??
    paymentChannelPresets[0]

  return {
    channelKey: preset.channelKey,
    channelName: preset.channelName,
    displayNameZh: preset.displayNameZh,
    displayNameEn: preset.displayNameEn,
    modeLabelZh: preset.modeLabelZh,
    modeLabelEn: preset.modeLabelEn,
    channelType: preset.channelType,
    providerName: preset.providerName,
    currency: preset.currency,
    settlementMode: preset.settlementMode,
    reference: preset.reference,
  }
}

function getPaymentChannelTypeLabel(
  locale: Locale,
  text: AdminConsoleText,
  value: string,
) {
  const preset = paymentChannelPresets.find((item) => item.channelType === value)
  if (preset) {
    return locale === 'zh-CN' ? preset.displayNameZh : preset.displayNameEn
  }

  return text.enums.paymentMethod[value] ?? value
}

function getPaymentChannelPresetOptions(
  locale: Locale,
  text: AdminConsoleText,
  field:
    | 'channelType'
    | 'channelKey'
    | 'channelName'
    | 'displayNameZh'
    | 'displayNameEn'
    | 'modeLabelZh'
    | 'modeLabelEn'
    | 'providerName'
    | 'currency'
    | 'settlementMode'
    | 'reference',
) {
  switch (field) {
    case 'channelType':
      return paymentChannelPresets.map((preset) => ({
        value: preset.channelType,
        label: getPaymentChannelTypeLabel(locale, text, preset.channelType),
      }))
    case 'providerName':
      return buildUniqueOptions(
        paymentChannelPresets.map((preset) => ({
          value: preset.providerName,
          label:
            locale === 'zh-CN'
              ? getPaymentProviderDisplayName(preset.providerName)
              : preset.providerName,
        })),
      )
    case 'settlementMode':
      return buildUniqueOptions(
        paymentChannelPresets.map((preset) => ({
          value: preset.settlementMode,
          label:
            preset.settlementMode === 'auto'
              ? text.labels.auto
              : text.labels.manual,
        })),
      )
    default:
      return buildUniqueOptions(
        paymentChannelPresets.map((preset) => ({
          value: String(preset[field] ?? ''),
          label: String(preset[field] ?? ''),
        })),
      )
  }
}

function getPaymentProviderDisplayName(value: string) {
  switch (value) {
    case 'manual_qr':
      return '人工收款码'
    case 'chain_watcher':
      return '链上监听器'
    default:
      return value
  }
}

function buildUniqueOptions(options: Array<{ value: string; label: string }>) {
  const seen = new Set<string>()

  return options.filter((option) => {
    if (!option.value || seen.has(option.value)) {
      return false
    }

    seen.add(option.value)
    return true
  })
}

function getActionColumns(
  locale: Locale,
  labels: SectionLocalLabels,
  actions: SectionActionHandlers,
): TableColumnsType<Record<string, unknown>> {
  const isZh = locale === 'zh-CN'

  return [
    {
      title: isZh ? '服务方标识' : 'Provider key',
      dataIndex: 'providerKey',
      width: 172,
    },
    {
      title: isZh ? '动作标识' : 'Action key',
      dataIndex: 'actionKey',
      width: 208,
    },
    {
      title: isZh ? '请求方法' : 'Method',
      dataIndex: 'method',
      width: 108,
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: isZh ? '路径模板' : 'Path template',
      dataIndex: 'pathTemplate',
      width: 264,
    },
    {
      title: isZh ? '响应映射' : 'Response mapping',
      key: 'responseMapping',
      width: 188,
      render: (_value: unknown, record: Record<string, unknown>) =>
        renderSummaryTags(locale, [
          { label: isZh ? '成功' : 'Success', active: Boolean(record.successPath) },
          { label: isZh ? '消息' : 'Message', active: Boolean(record.messagePath) },
          { label: isZh ? '码列表' : 'Codes', active: Boolean(record.codeListPath) },
        ]),
    },
    {
      title: isZh ? '模板' : 'Templates',
      key: 'templates',
      width: 156,
      render: (_value: unknown, record: Record<string, unknown>) =>
        renderSummaryTags(locale, [
          { label: isZh ? '请求头' : 'Header', active: hasObjectContent(record.headerTemplate) },
          { label: isZh ? '查询参数' : 'Query', active: hasObjectContent(record.queryTemplate) },
          { label: isZh ? '请求体' : 'Body', active: hasObjectContent(record.bodyTemplate) },
        ]),
    },
    {
      title: isZh ? '启用' : 'Enabled',
      dataIndex: 'enabled',
      width: 108,
      render: (value: boolean) => renderBooleanStatus(locale, value),
    },
    getOperationColumn(locale, labels, actions, true),
  ]
}

function getFulfillmentColumns(
  locale: Locale,
  text: AdminConsoleText,
  labels: SectionLocalLabels,
  actions: SectionActionHandlers,
): TableColumnsType<Record<string, unknown>> {
  const isZh = locale === 'zh-CN'

  return [
    {
      title: isZh ? '策略名称' : 'Strategy name',
      dataIndex: 'strategyName',
      width: 208,
    },
    {
      title: isZh ? '策略标识' : 'Strategy key',
      dataIndex: 'strategyKey',
      width: 180,
    },
    {
      title: text.table.fulfillmentType,
      dataIndex: 'fulfillmentType',
      width: 148,
      render: (value: string) => text.enums.fulfillmentType[value] ?? value,
    },
    { title: text.table.providerKey, dataIndex: 'providerKey', width: 172 },
    { title: text.table.actionKey, dataIndex: 'actionKey', width: 180 },
    {
      title: isZh ? '模板' : 'Templates',
      key: 'templates',
      width: 208,
      render: (_value: unknown, record: Record<string, unknown>) =>
        renderSummaryTags(locale, [
          { label: isZh ? '请求' : 'Request', active: hasObjectContent(record.requestTemplate) },
          { label: isZh ? '结果' : 'Result', active: hasObjectContent(record.resultSchema) },
          { label: isZh ? '交付' : 'Delivery', active: hasObjectContent(record.deliveryTemplate) },
          { label: isZh ? '重试' : 'Retry', active: hasObjectContent(record.retryPolicy) },
        ]),
    },
    {
      title: text.table.enabled,
      dataIndex: 'enabled',
      width: 108,
      render: (value: boolean) => renderBooleanStatus(locale, value),
    },
    getOperationColumn(locale, labels, actions, true),
  ]
}

function getDeliveryColumns(
  locale: Locale,
  text: AdminConsoleText,
  labels: SectionLocalLabels,
  actions: SectionActionHandlers,
): TableColumnsType<Record<string, unknown>> {
  const isZh = locale === 'zh-CN'

  return [
    {
      title: isZh ? '策略名称' : 'Strategy name',
      dataIndex: 'strategyName',
      width: 208,
    },
    {
      title: isZh ? '策略标识' : 'Strategy key',
      dataIndex: 'strategyKey',
      width: 180,
    },
    {
      title: text.table.deliveryChannel,
      dataIndex: 'channelType',
      width: 132,
      render: (value: string) => text.enums.deliveryChannel[value] ?? value,
    },
    {
      title: isZh ? '脱敏策略' : 'Mask policy',
      dataIndex: 'maskPolicy',
      width: 180,
    },
    {
      title: isZh ? '消息模板' : 'Message template',
      key: 'messageTemplate',
      width: 148,
      render: (_value: unknown, record: Record<string, unknown>) =>
        renderSummaryTags(locale, [
          { label: isZh ? '消息' : 'Message', active: hasObjectContent(record.messageTemplate) },
        ]),
    },
    {
      title: isZh ? '允许重发' : 'Resend',
      dataIndex: 'resendAllowed',
      width: 116,
      render: (value: boolean) => (
        <StatusTag
          label={value ? text.labels.retry : text.labels.manual}
          tone={value ? 'processing' : 'default'}
        />
      ),
    },
    {
      title: text.table.enabled,
      dataIndex: 'enabled',
      width: 108,
      render: (value: boolean) => renderBooleanStatus(locale, value),
    },
    getOperationColumn(locale, labels, actions, true),
  ]
}

function getTelegramConfigColumns(
  locale: Locale,
  labels: SectionLocalLabels,
  actions: SectionActionHandlers,
): TableColumnsType<Record<string, unknown>> {
  const isZh = locale === 'zh-CN'

  return [
    {
      title: isZh ? '机器人标识' : 'Bot key',
      dataIndex: 'botKey',
      width: 160,
    },
    {
      title: isZh ? '机器人用户名' : 'Bot username',
      dataIndex: 'botUsername',
      width: 180,
      render: (value: string) => value || '-',
    },
    {
      title: isZh ? '机器人令牌' : 'Token',
      dataIndex: 'botTokenMasked',
      width: 188,
      render: (value: string, record: Record<string, unknown>) =>
        value || (String(record.botToken ?? '') ? '******' : isZh ? '未配置' : 'Not configured'),
    },
    {
      title: isZh ? '回调密钥' : 'Webhook secret',
      dataIndex: 'webhookMasked',
      width: 188,
      render: (value: string, record: Record<string, unknown>) =>
        value || (String(record.webhookSecret ?? '') ? '******' : isZh ? '未配置' : 'Not configured'),
    },
    {
      title: isZh ? '回调地址' : 'Webhook URL',
      dataIndex: 'webhookUrlResolved',
      width: 320,
      render: (value: string, record: Record<string, unknown>) =>
        value || String(record.webhookUrl ?? '') || '-',
    },
    {
      title: isZh ? '来源' : 'Source',
      dataIndex: 'source',
      width: 104,
      render: (value: string) => <Tag>{locale === 'zh-CN' ? (value === 'config' ? '配置' : '数据库') : value === 'config' ? 'Config' : 'DB'}</Tag>,
    },
    {
      title: isZh ? '启用' : 'Enabled',
      dataIndex: 'enabled',
      width: 108,
      render: (value: boolean) => renderBooleanStatus(locale, value),
    },
    {
      title: isZh ? '操作' : 'Actions',
      key: 'actions',
      width: 212,
      fixed: 'right',
      render: (_value: unknown, record: Record<string, unknown>) => (
        <Space size={4}>
          <Button size="small" type="link" onClick={() => actions.onView(record)}>
            {isZh ? '回调详情' : 'Webhook'}
          </Button>
          <Button size="small" type="link" onClick={() => actions.onEdit(record)}>
            {labels.edit}
          </Button>
          <Button size="small" danger type="link" onClick={() => actions.onDelete(record)}>
            {labels.delete}
          </Button>
        </Space>
      ),
    },
  ]
}

function getInternalClientKeyColumns(
  locale: Locale,
  labels: SectionLocalLabels,
  actions: SectionActionHandlers,
): TableColumnsType<Record<string, unknown>> {
  const isZh = locale === 'zh-CN'

  return [
    {
      title: isZh ? '客户端标识' : 'Client key',
      dataIndex: 'clientKey',
      width: 172,
    },
    {
      title: isZh ? '客户端名称' : 'Client name',
      dataIndex: 'clientName',
      width: 180,
    },
    {
      title: isZh ? '密钥预览' : 'Secret preview',
      dataIndex: 'clientSecretMasked',
      width: 176,
      render: (value: string) => value || '-',
    },
    {
      title: isZh ? '权限范围' : 'Scopes',
      dataIndex: 'scopes',
      width: 248,
      render: (value: string) => value || '*',
    },
    {
      title: isZh ? '允许来源 IP' : 'Allowed IPs',
      dataIndex: 'allowedIPs',
      width: 220,
      render: (value: string) => value || '*',
    },
    {
      title: isZh ? '状态' : 'Status',
      dataIndex: 'status',
      width: 116,
      render: (value: string) => renderInternalClientStatus(locale, value),
    },
    getOperationColumn(locale, labels, actions),
  ]
}

function getRuntimeColumns(
  locale: Locale,
  text: AdminConsoleText,
  labels: SectionLocalLabels,
  actions: SectionActionHandlers,
): TableColumnsType<Record<string, unknown>> {
  const isZh = locale === 'zh-CN'

  return [
    { title: text.table.module, dataIndex: 'module', width: 136 },
    {
      title: isZh ? '配置项' : 'Setting',
      dataIndex: 'name',
      width: 220,
    },
    {
      title: isZh ? '配置值' : 'Configured',
      dataIndex: 'value',
      width: 164,
    },
    {
      title: isZh ? '生效值' : 'Effective',
      dataIndex: 'effectiveValue',
      width: 148,
      render: (value: string) => value || '-',
    },
    {
      title: isZh ? '实际来源' : 'Source',
      dataIndex: 'valueSource',
      width: 116,
      render: (value: AdminRuntimeSetting['valueSource']) => renderRuntimeValueSource(locale, value),
    },
    {
      title: isZh ? '作用范围' : 'Scope',
      dataIndex: 'scope',
      width: 108,
      render: (value: AdminRuntimeSetting['scope']) => getScopeText(locale, value),
    },
    {
      title: isZh ? '实时生效' : 'Live apply',
      dataIndex: 'appliesLive',
      width: 116,
      render: (value: boolean) => renderRuntimeLiveStatus(locale, value),
    },
    getOperationColumn(locale, labels, actions),
  ]
}

function getProviderFields(
  locale: Locale,
  text: AdminConsoleText,
): DrawerFieldSchema[] {
  const isZh = locale === 'zh-CN'

  return [
    {
      name: 'providerKey',
      label: text.table.providerKey,
      type: 'text',
      required: true,
    },
    {
      name: 'providerName',
      label: text.table.provider,
      type: 'text',
      required: true,
    },
    {
      name: 'baseUrl',
      label: text.table.baseUrl,
      type: 'text',
      required: true,
    },
    {
      name: 'authType',
      label: text.table.authType,
      type: 'select',
      required: true,
      options: Object.entries(text.enums.authType).map(([value, label]) => ({ value, label })),
    },
    {
      name: 'timeoutMs',
      label: isZh ? '超时(ms)' : 'Timeout (ms)',
      type: 'number',
      min: 0,
      required: true,
    },
    {
      name: 'retryTimes',
      label: text.table.retryTimes,
      type: 'number',
      min: 0,
      required: true,
    },
    {
      name: 'health',
      label: text.table.health,
      type: 'select',
      required: true,
      options: Object.entries(text.enums.health).map(([value, label]) => ({ value, label })),
    },
    {
      name: 'enabled',
      label: isZh ? '启用' : 'Enabled',
      type: 'switch',
    },
    {
      name: 'authConfig',
      label: isZh ? '鉴权配置' : 'Auth config',
      type: 'json',
      rows: 8,
      help: isZh
        ? '使用 JSON 对象配置 key_id、secret、header 等鉴权参数。'
        : 'Use a JSON object for key_id, secret, header, and other auth parameters.',
      placeholder: isZh
        ? '{\n  "key_id": "passdock-prod",\n  "secret": "请替换为真实密钥"\n}'
        : '{\n  "key_id": "passdock-prod",\n  "secret": "replace-with-real-secret"\n}',
    },
  ]
}

function getActionFields(
  locale: Locale,
  providers: AdminIntegrationProvider[],
): DrawerFieldSchema[] {
  const isZh = locale === 'zh-CN'

  return [
    {
      name: 'providerKey',
      label: isZh ? '服务方标识' : 'Provider key',
      type: 'select',
      required: true,
      options: providers.map((provider) => ({
        value: provider.providerKey,
        label: provider.providerKey,
      })),
    },
    {
      name: 'actionKey',
      label: isZh ? '动作标识' : 'Action key',
      type: 'text',
      required: true,
    },
    {
      name: 'method',
      label: isZh ? '请求方法' : 'Method',
      type: 'select',
      required: true,
      options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((value) => ({ value, label: value })),
    },
    {
      name: 'pathTemplate',
      label: isZh ? '路径模板' : 'Path template',
      type: 'text',
      required: true,
      placeholder: '/api/internal/redemption/issue',
    },
    {
      name: 'successPath',
      label: isZh ? '成功路径' : 'Success path',
      type: 'text',
      required: true,
      placeholder: 'success',
    },
    {
      name: 'messagePath',
      label: isZh ? '消息路径' : 'Message path',
      type: 'text',
      placeholder: 'message',
    },
    {
      name: 'codeListPath',
      label: isZh ? '码列表路径' : 'Code list path',
      type: 'text',
      placeholder: 'data.codes',
    },
    {
      name: 'enabled',
      label: isZh ? '启用' : 'Enabled',
      type: 'switch',
    },
    {
      name: 'headerTemplate',
      label: isZh ? '请求头模板' : 'Header template',
      type: 'json',
      rows: 6,
      placeholder: isZh
        ? '{\n  "Content-Type": "application/json"\n}'
        : '{\n  "Content-Type": "application/json"\n}',
    },
    {
      name: 'queryTemplate',
      label: isZh ? '查询参数模板' : 'Query template',
      type: 'json',
      rows: 6,
      placeholder: '{\n  "order_no": "{{order_no}}"\n}',
    },
    {
      name: 'bodyTemplate',
      label: isZh ? '请求体模板' : 'Body template',
      type: 'json',
      rows: 10,
      placeholder:
        '{\n  "order_no": "{{order_no}}",\n  "buyer_ref": "{{buyer_ref}}",\n  "product_id": "{{product_id}}"\n}',
    },
  ]
}

function getFulfillmentFields(
  locale: Locale,
  text: AdminConsoleText,
  providers: AdminIntegrationProvider[],
  actions: AdminIntegrationAction[],
): DrawerFieldSchema[] {
  const isZh = locale === 'zh-CN'

  return [
    {
      name: 'strategyKey',
      label: isZh ? '策略标识' : 'Strategy key',
      type: 'text',
      required: true,
    },
    {
      name: 'strategyName',
      label: isZh ? '策略名称' : 'Strategy name',
      type: 'text',
      required: true,
    },
    {
      name: 'fulfillmentType',
      label: text.table.fulfillmentType,
      type: 'select',
      required: true,
      options: Object.entries(text.enums.fulfillmentType).map(([value, label]) => ({ value, label })),
    },
    {
      name: 'providerKey',
      label: text.table.providerKey,
      type: 'select',
      required: true,
      options: providers.map((provider) => ({
        value: provider.providerKey,
        label: provider.providerKey,
      })),
    },
    {
      name: 'actionKey',
      label: text.table.actionKey,
      type: 'select',
      required: true,
      options: actions.map((action) => ({
        value: action.actionKey,
        label: `${action.providerKey} / ${action.actionKey}`,
      })),
    },
    {
      name: 'enabled',
      label: isZh ? '启用' : 'Enabled',
      type: 'switch',
    },
    {
      name: 'requestTemplate',
      label: isZh ? '请求模板' : 'Request template',
      type: 'json',
      rows: 8,
      placeholder: '{\n  "order_no": "{{order_no}}",\n  "buyer_ref": "{{buyer_ref}}"\n}',
    },
    {
      name: 'resultSchema',
      label: isZh ? '结果结构' : 'Result schema',
      type: 'json',
      rows: 8,
      placeholder: '{\n  "code_list_path": "data.codes",\n  "mask_policy": "show_last_6"\n}',
    },
    {
      name: 'deliveryTemplate',
      label: isZh ? '交付模板' : 'Delivery template',
      type: 'json',
      rows: 8,
      placeholder: isZh
        ? '{\n  "title": "充值码",\n  "content": "卡密：{{codes[0]}}"\n}'
        : '{\n  "title": "Recharge code",\n  "content": "Code: {{codes[0]}}"\n}',
    },
    {
      name: 'retryPolicy',
      label: isZh ? '重试策略' : 'Retry policy',
      type: 'json',
      rows: 8,
      placeholder: '{\n  "max_retries": 2,\n  "backoff_seconds": [5, 30]\n}',
    },
  ]
}

function getDeliveryFields(
  locale: Locale,
  text: AdminConsoleText,
): DrawerFieldSchema[] {
  const isZh = locale === 'zh-CN'

  return [
    {
      name: 'strategyKey',
      label: isZh ? '策略标识' : 'Strategy key',
      type: 'text',
      required: true,
    },
    {
      name: 'strategyName',
      label: isZh ? '策略名称' : 'Strategy name',
      type: 'text',
      required: true,
    },
    {
      name: 'channelType',
      label: text.table.deliveryChannel,
      type: 'select',
      required: true,
      options: Object.entries(text.enums.deliveryChannel).map(([value, label]) => ({ value, label })),
    },
    {
      name: 'maskPolicy',
      label: isZh ? '脱敏策略' : 'Mask policy',
      type: 'text',
      required: true,
      placeholder: isZh ? '如 show_last_6 / masked_full' : 'For example: show_last_6 / masked_full',
    },
    {
      name: 'resendAllowed',
      label: isZh ? '允许重发' : 'Resend allowed',
      type: 'switch',
    },
    {
      name: 'enabled',
      label: isZh ? '启用' : 'Enabled',
      type: 'switch',
    },
    {
      name: 'messageTemplate',
      label: isZh ? '消息模板' : 'Message template',
      type: 'json',
      rows: 8,
      placeholder: isZh
        ? '{\n  "title": "Telegram 交付",\n  "content": "您的卡密是 {{codes[0]}}"\n}'
        : '{\n  "title": "Telegram delivery",\n  "content": "Your code is {{codes[0]}}"\n}',
    },
  ]
}

function getTelegramConfigFields(locale: Locale): DrawerFieldSchema[] {
  const isZh = locale === 'zh-CN'

  return [
    {
      name: 'botKey',
      label: isZh ? '机器人标识' : 'Bot key',
      type: 'text',
      required: true,
    },
    {
      name: 'botUsername',
      label: isZh ? '机器人用户名' : 'Bot username',
      type: 'text',
      placeholder: isZh ? '例如 passdock_ops_bot' : 'For example: passdock_ops_bot',
    },
    {
      name: 'botToken',
      label: isZh ? '机器人令牌' : 'Bot token',
      type: 'textarea',
      rows: 4,
      required: true,
      placeholder: isZh ? '填写真实 Telegram 机器人令牌' : 'Enter the real Telegram Bot Token',
    },
    {
      name: 'webhookSecret',
      label: isZh ? '回调密钥' : 'Webhook secret',
      type: 'text',
      placeholder: isZh ? '可留空，不校验密钥请求头' : 'Optional. Leave empty to skip secret header validation',
    },
    {
      name: 'webhookUrl',
      label: isZh ? '回调地址' : 'Webhook URL',
      type: 'text',
      placeholder: isZh
        ? '可留空，默认使用 APP_BASE_URL + /api/v1/bots/{botKey}/telegram/webhook'
        : 'Optional. Defaults to APP_BASE_URL + /api/v1/bots/{botKey}/telegram/webhook',
    },
    {
      name: 'webhookIP',
      label: isZh ? '回调 IP 地址' : 'Webhook IP',
      type: 'text',
      placeholder: isZh ? '可选，对应 Telegram setWebhook 的 ip_address 参数' : 'Optional ip_address for Telegram setWebhook',
    },
    {
      name: 'allowedUpdates',
      label: isZh ? '允许的更新类型' : 'Allowed updates',
      type: 'textarea',
      rows: 3,
      placeholder: isZh
        ? '使用逗号或换行分隔，例如 message,callback_query'
        : 'Use commas or new lines, for example: message, callback_query',
    },
    {
      name: 'maxConnections',
      label: isZh ? '最大连接数' : 'Max connections',
      type: 'number',
      min: 1,
      placeholder: '40',
    },
    {
      name: 'dropPendingUpdates',
      label: isZh ? '清空积压更新' : 'Drop pending updates',
      type: 'switch',
    },
    {
      name: 'enabled',
      label: isZh ? '启用' : 'Enabled',
      type: 'switch',
    },
  ]
}

function getInternalClientKeyFields(locale: Locale): DrawerFieldSchema[] {
  const isZh = locale === 'zh-CN'

  return [
    {
      name: 'clientKey',
      label: isZh ? '客户端标识' : 'Client key',
      type: 'text',
      required: true,
    },
    {
      name: 'clientName',
      label: isZh ? '客户端名称' : 'Client name',
      type: 'text',
      required: true,
    },
    {
      name: 'clientSecret',
      label: isZh ? '客户端密钥' : 'Client secret',
      type: 'textarea',
      rows: 4,
      placeholder: isZh ? '编辑时留空表示保留当前密钥' : 'Leave empty on edit to keep the current secret',
    },
    {
      name: 'scopes',
      label: isZh ? '权限范围' : 'Scopes',
      type: 'textarea',
      rows: 4,
      help: isZh
        ? '使用逗号或换行分隔，例如 orders.fulfillment、orders.delivery、integrations.execute。'
        : 'Use commas or new lines, for example: orders.fulfillment, orders.delivery, integrations.execute.',
      placeholder: 'orders.fulfillment,orders.delivery,orders.read,payments.confirm',
    },
    {
      name: 'allowedIPs',
      label: isZh ? '允许的 IP' : 'Allowed IPs',
      type: 'textarea',
      rows: 3,
      help: isZh
        ? '支持单个 IP 或 CIDR，使用逗号或换行分隔；留空表示不限制。'
        : 'Supports single IPs or CIDR ranges separated by commas or new lines. Leave empty for no restriction.',
      placeholder: '10.10.0.0/16,127.0.0.1',
    },
    {
      name: 'status',
      label: isZh ? '状态' : 'Status',
      type: 'select',
      required: true,
      options: [
        { value: 'active', label: isZh ? '启用' : 'Active' },
        { value: 'disabled', label: isZh ? '停用' : 'Disabled' },
        { value: 'revoked', label: isZh ? '吊销' : 'Revoked' },
      ],
    },
  ]
}

function getRuntimeFields(locale: Locale): DrawerFieldSchema[] {
  const isZh = locale === 'zh-CN'

  return [
    {
      name: 'module',
      label: isZh ? '模块' : 'Module',
      type: 'text',
      required: true,
    },
    {
      name: 'name',
      label: isZh ? '配置项' : 'Setting',
      type: 'text',
      required: true,
    },
    {
      name: 'value',
      label: isZh ? '值' : 'Value',
      type: 'text',
      required: true,
    },
    {
      name: 'scope',
      label: isZh ? '作用范围' : 'Scope',
      type: 'select',
      required: true,
      options: [
        { value: 'db', label: isZh ? '数据库' : 'Database' },
        { value: 'env', label: isZh ? '环境变量' : 'Environment' },
      ],
    },
  ]
}

function renderInternalClientStatus(locale: Locale, value: string) {
  const isZh = locale === 'zh-CN'

  switch (value) {
    case 'disabled':
      return <StatusTag label={isZh ? '停用' : 'Disabled'} tone="default" />
    case 'revoked':
      return <StatusTag label={isZh ? '吊销' : 'Revoked'} tone="error" />
    default:
      return <StatusTag label={isZh ? '启用' : 'Active'} tone="success" />
  }
}

function renderBooleanStatus(locale: Locale, value: boolean) {
  return (
    <StatusTag
      label={getBooleanText(locale, value)}
      tone={value ? 'success' : 'default'}
    />
  )
}

function renderRuntimeValueSource(locale: Locale, value: AdminRuntimeSetting['valueSource']) {
  const isZh = locale === 'zh-CN'

  switch (value) {
    case 'env':
      return <StatusTag label={isZh ? '环境变量' : 'Environment'} tone="processing" />
    case 'db':
      return <StatusTag label={isZh ? '数据库' : 'Database'} tone="success" />
    default:
      return <StatusTag label={isZh ? '默认值' : 'Default'} tone="default" />
  }
}

function renderRuntimeLiveStatus(locale: Locale, value: boolean) {
  const isZh = locale === 'zh-CN'

  return (
    <StatusTag
      label={value ? (isZh ? '已接线' : 'Live') : isZh ? '未接线' : 'Planned'}
      tone={value ? 'success' : 'default'}
    />
  )
}

function renderPaymentCallbackAuthType(locale: Locale, value: string) {
  const isZh = locale === 'zh-CN'

  switch (value) {
    case 'static_header':
      return <Tag color="gold">{isZh ? '静态请求头' : 'Static header'}</Tag>
    case 'hmac_sha256':
      return <Tag color="blue">HMAC-SHA256</Tag>
    default:
      return <Tag>{isZh ? '不校验' : 'None'}</Tag>
  }
}

function renderSummaryTags(
  locale: Locale,
  items: Array<{ label: string; active: boolean }>,
) {
  const activeItems = items.filter((item) => item.active)

  if (!activeItems.length) {
    return locale === 'zh-CN' ? '未配置' : 'Not configured'
  }

  return (
    <Space size={[4, 4]} wrap>
      {activeItems.map((item) => (
        <Tag key={item.label}>{item.label}</Tag>
      ))}
    </Space>
  )
}

function hasObjectContent(value: unknown) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value as Record<string, unknown>).length)
}
