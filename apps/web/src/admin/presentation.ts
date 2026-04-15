import type { Locale } from '../i18n/copy'

export function getTableTotalText(locale: Locale, total: number) {
  return locale === 'zh-CN' ? `共 ${total} 条` : `Total ${total}`
}

export function getBooleanText(locale: Locale, value: boolean) {
  if (locale === 'zh-CN') {
    return value ? '启用' : '停用'
  }

  return value ? 'Enabled' : 'Disabled'
}

export function getScopeText(locale: Locale, scope: 'db' | 'env') {
  if (locale === 'zh-CN') {
    return scope === 'db' ? '数据库' : '环境变量'
  }

  return scope === 'db' ? 'Database' : 'Environment'
}
