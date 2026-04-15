import type { Locale } from '../../i18n/copy'
import type { DrawerFieldSchema } from './types'

export function buildSystemFormValues(
  fields: DrawerFieldSchema[],
  initialValues: Record<string, unknown>,
) {
  return fields.reduce<Record<string, unknown>>((result, field) => {
    const value = initialValues[field.name]
    result[field.name] = field.type === 'json' ? stringifyJsonValue(value) : value
    return result
  }, {})
}

export function parseSystemFormValues(
  fields: DrawerFieldSchema[],
  values: Record<string, unknown>,
  locale: Locale = 'en-US',
) {
  return fields.reduce<Record<string, unknown>>((result, field) => {
    const value = values[field.name]
    result[field.name] = field.type === 'json' ? parseJsonValue(value, locale) : value
    return result
  }, {})
}

export function validateJsonFieldValue(value: unknown, locale: Locale = 'en-US') {
  try {
    parseJsonValue(value, locale)
    return Promise.resolve()
  } catch (error) {
    if (error instanceof Error && error.message.trim()) {
      return Promise.reject(error)
    }

    return Promise.reject(
      new Error(locale === 'zh-CN' ? '请输入有效的 JSON 对象' : 'Invalid JSON object'),
    )
  }
}

function stringifyJsonValue(value: unknown) {
  if (value == null || value === '') {
    return '{}'
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || '{}'
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return '{}'
  }
}

function parseJsonValue(value: unknown, locale: Locale) {
  if (value == null) {
    return {}
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  const text = String(value).trim()
  if (!text) {
    return {}
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(locale === 'zh-CN' ? '请输入有效的 JSON' : 'Please enter valid JSON')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      locale === 'zh-CN' ? 'JSON 内容必须是对象' : 'JSON value must be an object',
    )
  }

  return parsed as Record<string, unknown>
}
