import type { Locale } from '../../i18n/copy'
import type { DrawerFieldSchema } from '../system/types'

type BuildActionNoteFieldsOptions = {
  label?: string
  placeholderZh?: string
  placeholderEn?: string
  helpZh?: string
  helpEn?: string
  required?: boolean
  rows?: number
}

export function buildActionNoteFields(
  locale: Locale,
  options: BuildActionNoteFieldsOptions = {},
): DrawerFieldSchema[] {
  return [
    {
      name: 'note',
      label: options.label ?? (locale === 'zh-CN' ? '备注' : 'Note'),
      type: 'textarea',
      required: options.required ?? true,
      rows: options.rows ?? 4,
      placeholder:
        locale === 'zh-CN'
          ? options.placeholderZh ?? '请输入处理备注'
          : options.placeholderEn ?? 'Enter an operator note',
      help:
        locale === 'zh-CN'
          ? options.helpZh
          : options.helpEn,
    },
  ]
}

export function getActionNoteInitialValues(note = '') {
  return {
    note,
  }
}
