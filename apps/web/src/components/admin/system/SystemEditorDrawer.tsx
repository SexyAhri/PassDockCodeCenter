import { App, Button, Drawer, Form, Input, InputNumber, Select, Space, Switch, Upload } from 'antd'
import type { FormInstance } from 'antd'
import { useEffect, useMemo, useState } from 'react'

import {
  buildSystemFormValues,
  parseSystemFormValues,
  validateJsonFieldValue,
} from '../../../admin/system/serialization'
import type { DrawerFieldSchema } from '../../../admin/system/types'
import type { Locale } from '../../../i18n/copy'

type SystemEditorDrawerProps = {
  locale: Locale
  open: boolean
  title: string
  fields: DrawerFieldSchema[]
  initialValues: Record<string, unknown>
  submitText: string
  cancelText: string
  onCancel: () => void
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>
  onValuesChange?: (
    changedValues: Record<string, unknown>,
    allValues: Record<string, unknown>,
    form: FormInstance<Record<string, unknown>>,
  ) => void
}

export function SystemEditorDrawer(props: SystemEditorDrawerProps) {
  const {
    locale,
    open,
    title,
    fields,
    initialValues,
    submitText,
    cancelText,
    onCancel,
    onSubmit,
    onValuesChange,
  } = props
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const initialFormValues = useMemo(
    () => buildSystemFormValues(fields, initialValues),
    [fields, initialValues],
  )

  useEffect(() => {
    if (!open) {
      form.resetFields()
      setSubmitting(false)
      return
    }

    form.setFieldsValue(initialFormValues)
  }, [form, initialFormValues, open])

  return (
    <Drawer
      open={open}
      title={title}
      width={640}
      destroyOnClose
      className="admin-editor-drawer"
      onClose={onCancel}
      footer={
        <Space>
          <Button onClick={onCancel} disabled={submitting}>
            {cancelText}
          </Button>
          <Button type="primary" loading={submitting} onClick={() => form.submit()}>
            {submitText}
          </Button>
        </Space>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onValuesChange={(changedValues, allValues) => {
          onValuesChange?.(
            changedValues as Record<string, unknown>,
            allValues as Record<string, unknown>,
            form,
          )
        }}
        onFinish={async (values) => {
          setSubmitting(true)

          try {
            await onSubmit({
              ...initialValues,
              ...parseSystemFormValues(fields, values, locale),
            })
          } finally {
            setSubmitting(false)
          }
        }}
      >
        {fields.map((field) => (
          <Form.Item
            key={field.name}
            name={field.name}
            label={field.label}
            extra={field.help}
            rules={getFieldRules(field, locale)}
            valuePropName={field.type === 'switch' ? 'checked' : 'value'}
          >
            {renderField(field, initialFormValues[field.name], message, locale)}
          </Form.Item>
        ))}
      </Form>
    </Drawer>
  )
}

function renderField(
  field: DrawerFieldSchema,
  initialValue: unknown,
  messageApi: ReturnType<typeof App.useApp>['message'],
  locale: Locale,
) {
  switch (field.type) {
    case 'number':
      return <InputNumber min={field.min ?? 0} style={{ width: '100%' }} />
    case 'select':
      return (
        <Select
          mode={field.mode}
          options={buildSelectOptions(field, initialValue)}
          placeholder={field.placeholder}
        />
      )
    case 'switch':
      return <Switch />
    case 'textarea':
      return <Input.TextArea rows={field.rows ?? 4} placeholder={field.placeholder} />
    case 'asset':
      return (
        <UploadValueField
          field={field}
          initialValue={initialValue}
          messageApi={messageApi}
          locale={locale}
        />
      )
    case 'json':
      return (
        <Input.TextArea
          rows={field.rows ?? 8}
          placeholder={field.placeholder}
          style={{
            fontFamily:
              'ui-monospace, SFMono-Regular, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
          }}
        />
      )
    default:
      return <Input placeholder={field.placeholder} />
  }
}

type UploadValueFieldProps = {
  field: DrawerFieldSchema
  initialValue: unknown
  messageApi: ReturnType<typeof App.useApp>['message']
  locale: Locale
  value?: string
  onChange?: (value: string) => void
}

function UploadValueField(props: UploadValueFieldProps) {
  const { field, initialValue, messageApi, locale, value, onChange } = props
  const [uploading, setUploading] = useState(false)
  const resolvedValue =
    typeof value === 'string'
      ? value
      : typeof initialValue === 'string'
        ? initialValue
        : ''

  return (
    <div className="admin-editor-upload-field">
      <Input.TextArea
        rows={field.rows ?? 5}
        placeholder={field.placeholder}
        value={resolvedValue}
        onChange={(event) => onChange?.(event.target.value)}
      />

      <div className="admin-editor-upload-field__toolbar">
        <Upload
          accept={field.accept}
          showUploadList={false}
          beforeUpload={async (file) => {
            if (!field.onUpload) {
              return Upload.LIST_IGNORE
            }

            try {
              setUploading(true)
              const nextValue = await field.onUpload(file as File)
              onChange?.(nextValue)
              if (field.uploadSuccessText) {
                messageApi.success(field.uploadSuccessText)
              }
            } catch (error) {
              messageApi.error(
                error instanceof Error && error.message.trim()
                  ? error.message
                  : locale === 'zh-CN'
                    ? '上传失败'
                    : 'Upload failed',
              )
            } finally {
              setUploading(false)
            }

            return Upload.LIST_IGNORE
          }}
        >
          <Button loading={uploading}>
            {field.uploadButtonLabel ?? (locale === 'zh-CN' ? '上传资源' : 'Upload asset')}
          </Button>
        </Upload>

        {field.uploadHint ? (
          <span className="admin-editor-upload-field__hint">{field.uploadHint}</span>
        ) : null}
      </div>

      {field.previewKind === 'image' && isImageSource(resolvedValue) ? (
        <div className="admin-editor-upload-field__preview">
          <img
            className="admin-editor-upload-field__image"
            src={resolvedValue}
            alt={field.label}
          />
        </div>
      ) : null}
    </div>
  )
}

function buildSelectOptions(
  field: DrawerFieldSchema,
  initialValue: unknown,
) {
  const options = [...(field.options ?? [])]
  const existingValues = new Set(options.map((option) => option.value))

  if (typeof initialValue === 'string' && initialValue && !existingValues.has(initialValue)) {
    options.push({ value: initialValue, label: initialValue })
  }

  if (Array.isArray(initialValue)) {
    initialValue.forEach((value) => {
      if (typeof value === 'string' && value && !existingValues.has(value)) {
        options.push({ value, label: value })
        existingValues.add(value)
      }
    })
  }

  return options
}

function isImageSource(value: string) {
  const normalizedValue = value.trim().toLowerCase()

  if (!normalizedValue) {
    return false
  }

  if (
    normalizedValue.startsWith('data:image/') ||
    normalizedValue.startsWith('blob:')
  ) {
    return true
  }

  return /\.(png|jpe?g|webp)(\?.*)?$/.test(normalizedValue)
}

function getFieldRules(field: DrawerFieldSchema, locale: Locale) {
  const rules: Array<Record<string, unknown>> = []

  if (field.required) {
    rules.push({
      required: true,
      message:
        locale === 'zh-CN'
          ? `请填写${field.label}`
          : `Please enter ${field.label.toLowerCase()}`,
    })
  }

  if (field.type === 'json') {
    rules.push({
      validator: (_rule: unknown, value: unknown) =>
        validateJsonFieldValue(value, locale),
    })
  }

  return rules.length ? rules : undefined
}
