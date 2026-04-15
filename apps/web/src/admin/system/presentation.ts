import type { Locale } from '../../i18n/copy'
import type { SystemSectionKey } from './types'

export type SystemEditorState = {
  open: boolean
  mode: 'create' | 'edit'
  values: Record<string, unknown>
}

export const emptySystemEditorState: SystemEditorState = {
  open: false,
  mode: 'create',
  values: {},
}

export function getSystemPageLabels(locale: Locale) {
  const isZh = locale === 'zh-CN'

  return {
    edit: isZh ? '编辑' : 'Edit',
    delete: isZh ? '删除' : 'Delete',
    test: isZh ? '测试' : 'Test',
    reset: isZh ? '重置配置' : 'Reset config',
    resetConfirmTitle: isZh ? '恢复默认配置' : 'Reset to defaults',
    resetConfirmBody: isZh
      ? '这会重置当前系统配置草稿，并重新拉取可用的远程配置。'
      : 'This resets the current workspace draft and reloads any available remote configuration.',
    deleteConfirmTitle: isZh ? '确认删除' : 'Confirm deletion',
    deleteConfirmBody: isZh
      ? '该记录会立即从当前配置中移除。'
      : 'This record will be removed from the current configuration immediately.',
    create: {
      paymentChannels: isZh ? '新增通道' : 'New channel',
      providers: isZh ? '新增服务方' : 'New provider',
      actions: isZh ? '新增动作' : 'New action',
      fulfillmentStrategies: isZh ? '新增履约策略' : 'New fulfillment strategy',
      deliveryStrategies: isZh ? '新增交付策略' : 'New delivery strategy',
      telegramConfigs: isZh ? '新增 Telegram 机器人' : 'New Telegram bot',
      internalClientKeys: isZh ? '新增内部客户端' : 'New internal client',
      runtimeSettings: isZh ? '新增运行时参数' : 'New runtime setting',
    },
    saveCreate: isZh ? '创建' : 'Create',
    saveEdit: isZh ? '保存修改' : 'Save changes',
    cancel: isZh ? '取消' : 'Cancel',
    saved: isZh ? '配置已保存' : 'Configuration saved',
    deleted: isZh ? '配置已删除' : 'Configuration removed',
    tested: isZh ? '测试完成' : 'Test completed',
    testing: isZh ? '执行中' : 'Running',
    previewTest: isZh ? '预览' : 'Preview',
    liveTest: isZh ? '实时测试' : 'Live test',
    liveTestConfirmTitle: isZh ? '执行实时测试' : 'Run live test',
    liveTestConfirmBody: isZh
      ? '将对当前动作配置的真实上游目标发起一次测试请求。仅建议用于沙箱、测试环境或只读查询动作。'
      : 'This sends a real test request to the configured upstream target. Only use it for sandbox, test, or read-only actions.',
    batch: isZh ? '批量操作' : 'Bulk actions',
    clearSelection: isZh ? '清空选择' : 'Clear',
    enableSelected: isZh ? '批量启用' : 'Enable selected',
    disableSelected: isZh ? '批量停用' : 'Disable selected',
    deleteSelected: isZh ? '批量删除' : 'Delete selected',
    selectedOne: isZh ? '条记录已选中' : 'record selected',
    selectedMany: isZh ? '条记录已选中' : 'records selected',
    search: isZh ? '搜索' : 'Search',
    resetSearch: isZh ? '重置' : 'Reset',
    searchPlaceholder: isZh ? '搜索当前标签页中的关键字' : 'Search within the active tab',
    deleteSelectedConfirmTitle: isZh ? '确认批量删除' : 'Delete selected records',
    deleteSelectedConfirmBody: isZh
      ? '选中的记录会立即从当前配置中移除。'
      : 'The selected records will be removed from the current configuration.',
    remoteReady: isZh ? '远程接口' : 'Remote API',
    localFallback: isZh ? '本地兜底' : 'Local fallback',
    localDraft: isZh ? '本地草稿' : 'Local draft',
    remoteUnavailable: isZh ? '远程不可用' : 'Remote unavailable',
    loadWarningTitle: isZh
      ? '远程配置暂不可用，请检查接口连接后重试。'
      : 'Remote config unavailable. Check the API connection and try again.',
    testResultTitle: isZh ? '测试结果' : 'Test result',
    testResultEmpty: isZh ? '没有返回测试结果。' : 'No test result returned.',
  } as const
}

export function getSystemSourceLabel(
  source: string,
  remoteEnabled: boolean,
  labels: ReturnType<typeof getSystemPageLabels>,
) {
  if (!remoteEnabled) {
    return labels.localDraft
  }

  if (source === 'remote') {
    return labels.remoteReady
  }

  if (source === 'remote-error') {
    return labels.remoteUnavailable
  }

  return labels.localFallback
}

export function getSaveAction(section: SystemSectionKey, mode: 'create' | 'edit') {
  switch (section) {
    case 'paymentChannels':
      return mode === 'create' ? 'create_channel' : 'update_channel'
    case 'providers':
      return mode === 'create' ? 'create_provider' : 'update_provider'
    case 'actions':
      return mode === 'create' ? 'create_action' : 'update_action'
    case 'telegramConfigs':
      return mode === 'create' ? 'create_telegram_config' : 'update_telegram_config'
    case 'internalClientKeys':
      return mode === 'create' ? 'create_internal_client_key' : 'update_internal_client_key'
    case 'runtimeSettings':
      return mode === 'create' ? 'create_setting' : 'update_setting'
    default:
      return mode === 'create' ? 'create_strategy' : 'update_strategy'
  }
}

export function getDeleteAction(section: SystemSectionKey) {
  switch (section) {
    case 'paymentChannels':
      return 'delete_channel'
    case 'providers':
      return 'delete_provider'
    case 'actions':
      return 'delete_action'
    case 'telegramConfigs':
      return 'delete_telegram_config'
    case 'internalClientKeys':
      return 'delete_internal_client_key'
    case 'runtimeSettings':
      return 'delete_setting'
    default:
      return 'delete_strategy'
  }
}

export function getActionErrorMessage(error: unknown, locale: Locale) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return locale === 'zh-CN' ? '请求失败，请稍后重试。' : 'Request failed. Please try again.'
}

export function getSystemTestResultTitle(section: SystemSectionKey, locale: Locale) {
  const isZh = locale === 'zh-CN'

  switch (section) {
    case 'providers':
      return isZh ? '服务方连通性测试' : 'Provider health check'
    case 'actions':
      return isZh ? '动作测试结果' : 'Action test result'
    case 'fulfillmentStrategies':
      return isZh ? '履约策略预览' : 'Fulfillment strategy preview'
    case 'deliveryStrategies':
      return isZh ? '交付策略测试' : 'Delivery strategy test'
    default:
      return isZh ? '测试结果' : 'Test result'
  }
}

export function getSystemTestResultFieldLabels(locale: Locale) {
  const isZh = locale === 'zh-CN'

  return {
    provider_key: isZh ? '服务方标识' : 'Provider key',
    strategy_key: isZh ? '策略标识' : 'Strategy key',
    action_key: isZh ? '动作标识' : 'Action key',
    sample_source: isZh ? '样本来源' : 'Sample source',
    execution_mode: isZh ? '执行模式' : 'Execution mode',
    requested_mode: isZh ? '请求模式' : 'Requested mode',
    execution_note: isZh ? '执行说明' : 'Execution note',
    dry_run: isZh ? '预演模式' : 'Dry run',
    live_test_allowed: isZh ? '允许实时测试' : 'Live test allowed',
    live_test_guard_reason: isZh ? '实时测试限制' : 'Live test guard',
    health: isZh ? '健康状态' : 'Health',
    last_checked_at: isZh ? '最后检查时间' : 'Last checked at',
    fulfillment_type: isZh ? '履约类型' : 'Fulfillment type',
    channel_type: isZh ? '交付渠道' : 'Delivery channel',
    mask_policy: isZh ? '脱敏策略' : 'Mask policy',
    message: isZh ? '消息' : 'Message',
    preview: isZh ? '预览结果' : 'Preview',
    request_url: isZh ? '请求地址' : 'Request URL',
    request_method: isZh ? '请求方法' : 'Request method',
    response_message: isZh ? '响应消息' : 'Response message',
    status_code: isZh ? '状态码' : 'Status code',
  } satisfies Record<string, string>
}

export function getSystemTestPreferredKeys(section: SystemSectionKey) {
  switch (section) {
    case 'providers':
      return ['provider_key', 'health', 'last_checked_at']
    case 'actions':
      return [
        'provider_key',
        'action_key',
        'execution_mode',
        'requested_mode',
        'sample_source',
        'dry_run',
        'live_test_allowed',
        'request_method',
        'request_url',
        'status_code',
        'execution_note',
        'live_test_guard_reason',
        'response_message',
      ]
    case 'fulfillmentStrategies':
      return ['strategy_key', 'fulfillment_type', 'preview', 'request_template', 'delivery_template']
    case 'deliveryStrategies':
      return ['strategy_key', 'channel_type', 'mask_policy', 'message']
    default:
      return undefined
  }
}
