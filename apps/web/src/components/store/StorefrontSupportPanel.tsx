import { Alert, Button, Form, Input, Select } from 'antd'

import type {
  CreateStorefrontSupportTicketInput,
  StorefrontSupportTicket,
} from '../../api/storefrontSupport'
import type { Locale } from '../../i18n/copy'
import { CheckoutCompactList } from './CheckoutCompactList'
import { CheckoutSection } from './CheckoutSection'

type StorefrontSupportPanelProps = {
  locale: Locale
  loading?: boolean
  submitting?: boolean
  disabled?: boolean
  tickets?: StorefrontSupportTicket[]
  error?: string | null
  onSubmit: (values: CreateStorefrontSupportTicketInput) => Promise<void> | void
}

export function StorefrontSupportPanel(props: StorefrontSupportPanelProps) {
  const {
    locale,
    loading = false,
    submitting = false,
    disabled = false,
    tickets = [],
    error,
    onSubmit,
  } = props
  const [form] = Form.useForm<CreateStorefrontSupportTicketInput>()
  const labels = getSupportPanelLabels(locale)

  const ticketItems = tickets.map((ticket) => ({
    id: ticket.ticketNo,
    title: `${ticket.ticketNo} | ${ticket.subject}`,
    meta: [
      getStatusLabel(ticket.status, locale),
      getPriorityLabel(ticket.priority, locale),
      ticket.resolutionNote || ticket.updatedAt || ticket.createdAt,
    ]
      .filter(Boolean)
      .join(' | '),
    aside: <span className="checkout-compact-list__badge">{getStatusLabel(ticket.status, locale)}</span>,
  }))

  return (
    <CheckoutSection title={labels.title}>
      {error ? (
        <Alert
          showIcon
          type="warning"
          message={error}
          style={{ marginBottom: 12 }}
        />
      ) : null}

      {disabled ? (
        <Alert
          showIcon
          type="info"
          message={labels.remoteOnly}
          style={{ marginBottom: 12 }}
        />
      ) : null}

      <Form<CreateStorefrontSupportTicketInput>
        form={form}
        layout="vertical"
        size="small"
        className="checkout-form"
        disabled={disabled || loading || submitting}
        initialValues={{ priority: 'normal' }}
        onFinish={async (values) => {
          await onSubmit(values)
          form.resetFields()
          form.setFieldValue('priority', 'normal')
        }}
      >
        <div className="checkout-form__grid">
          <Form.Item
            name="subject"
            label={labels.subject}
            rules={[{ required: true, message: labels.subjectRequired }]}
          >
            <Input placeholder={labels.subjectPlaceholder} />
          </Form.Item>

          <Form.Item
            name="priority"
            label={labels.priority}
            rules={[{ required: true, message: labels.priorityRequired }]}
          >
            <Select options={buildPriorityOptions(locale)} />
          </Form.Item>
        </div>

        <Form.Item
          name="content"
          label={labels.content}
          rules={[{ required: true, message: labels.contentRequired }]}
        >
          <Input.TextArea rows={4} placeholder={labels.contentPlaceholder} />
        </Form.Item>

        <div className="checkout-form__actions">
          <Button type="primary" htmlType="submit" loading={submitting}>
            {labels.submit}
          </Button>
        </div>
      </Form>

      <div className="checkout-form__history">
        <div className="checkout-form__history-title">{labels.history}</div>
        {ticketItems.length ? (
          <CheckoutCompactList items={ticketItems} />
        ) : (
          <div className="checkout-detail-record__empty">{labels.empty}</div>
        )}
      </div>
    </CheckoutSection>
  )
}

function buildPriorityOptions(locale: Locale) {
  return [
    { value: 'normal', label: getPriorityLabel('normal', locale) },
    { value: 'high', label: getPriorityLabel('high', locale) },
    { value: 'urgent', label: getPriorityLabel('urgent', locale) },
    { value: 'low', label: getPriorityLabel('low', locale) },
  ]
}

function getSupportPanelLabels(locale: Locale) {
  return {
    title: locale === 'zh-CN' ? '售后支持' : 'Support',
    subject: locale === 'zh-CN' ? '问题标题' : 'Subject',
    subjectPlaceholder:
      locale === 'zh-CN' ? '例如：发码失败 / 收到的内容不正确' : 'For example: code issue or wrong delivery content',
    subjectRequired: locale === 'zh-CN' ? '请填写问题标题' : 'Please enter a subject',
    priority: locale === 'zh-CN' ? '优先级' : 'Priority',
    priorityRequired: locale === 'zh-CN' ? '请选择优先级' : 'Please select a priority',
    content: locale === 'zh-CN' ? '问题描述' : 'Description',
    contentPlaceholder:
      locale === 'zh-CN'
        ? '请描述问题现象、期望结果以及你已经尝试过的操作。'
        : 'Describe the issue, expected result, and what you have tried already.',
    contentRequired: locale === 'zh-CN' ? '请填写问题描述' : 'Please enter a description',
    submit: locale === 'zh-CN' ? '提交工单' : 'Submit ticket',
    history: locale === 'zh-CN' ? '支持记录' : 'Support history',
    empty: locale === 'zh-CN' ? '当前订单还没有支持记录。' : 'No support records for this order yet.',
    remoteOnly:
      locale === 'zh-CN'
        ? '当前未连接后端接口，暂时无法提交真实工单。'
        : 'The remote API is required to submit support tickets.',
  }
}

function getPriorityLabel(
  value: CreateStorefrontSupportTicketInput['priority'],
  locale: Locale,
) {
  if (locale === 'zh-CN') {
    return {
      low: '低',
      normal: '普通',
      high: '高',
      urgent: '紧急',
    }[value]
  }

  return {
    low: 'Low',
    normal: 'Normal',
    high: 'High',
    urgent: 'Urgent',
  }[value]
}

function getStatusLabel(value: StorefrontSupportTicket['status'], locale: Locale) {
  if (locale === 'zh-CN') {
    return {
      open: '待处理',
      processing: '处理中',
      resolved: '已解决',
      closed: '已关闭',
    }[value]
  }

  return {
    open: 'Open',
    processing: 'Processing',
    resolved: 'Resolved',
    closed: 'Closed',
  }[value]
}
