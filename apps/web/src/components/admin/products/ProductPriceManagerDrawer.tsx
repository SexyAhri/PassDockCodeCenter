import { App, Button, Drawer, Space } from 'antd'
import type { TableColumnsType } from 'antd'
import { useMemo, useState } from 'react'

import type {
  AdminManagedProduct,
  AdminProductPriceTemplate,
  ProductBillingCycle,
} from '../../../admin/products/types'
import type { PaymentMethodKey } from '../../../i18n/copy'
import type { DrawerFieldSchema } from '../../../admin/system/types'
import { StatusTag } from '../../admin/StatusTag'
import { SystemEditorDrawer } from '../system/SystemEditorDrawer'
import { DataTable } from '../../common/DataTable'

type ProductPriceManagerDrawerProps = {
  open: boolean
  locale: 'zh-CN' | 'en-US'
  product: AdminManagedProduct | null
  templates: AdminProductPriceTemplate[]
  onClose: () => void
  onSave: (mode: 'create' | 'edit', values: Record<string, unknown>) => void | Promise<void>
  onDelete: (template: AdminProductPriceTemplate) => void | Promise<void>
}

type EditorState = {
  open: boolean
  mode: 'create' | 'edit'
  values: Record<string, unknown>
}

export function ProductPriceManagerDrawer(props: ProductPriceManagerDrawerProps) {
  const { open, locale, product, templates, onClose, onSave, onDelete } = props
  const { modal } = App.useApp()
  const [editor, setEditor] = useState<EditorState>({
    open: false,
    mode: 'create',
    values: {},
  })

  const labels = useMemo(
    () => ({
      title: locale === 'zh-CN' ? '价格模板' : 'Price templates',
      add: locale === 'zh-CN' ? '新增模板' : 'New template',
      edit: locale === 'zh-CN' ? '编辑' : 'Edit',
      delete: locale === 'zh-CN' ? '删除' : 'Delete',
      save: locale === 'zh-CN' ? '保存' : 'Save',
      cancel: locale === 'zh-CN' ? '取消' : 'Cancel',
      templateName: locale === 'zh-CN' ? '模板名称' : 'Template name',
      billingCycle: locale === 'zh-CN' ? '计费周期' : 'Billing cycle',
      enabled: locale === 'zh-CN' ? '启用' : 'Enabled',
      sortOrder: locale === 'zh-CN' ? '排序' : 'Sort order',
      amount: locale === 'zh-CN' ? '销售价' : 'Amount',
      originalAmount: locale === 'zh-CN' ? '原价' : 'Original amount',
      currency: locale === 'zh-CN' ? '币种' : 'Currency',
      deleteConfirm: locale === 'zh-CN' ? '确认删除该价格模板？' : 'Delete this price template?',
      oneTime: locale === 'zh-CN' ? '一次性' : 'One-time',
      monthly: locale === 'zh-CN' ? '月付' : 'Monthly',
      quarterly: locale === 'zh-CN' ? '季付' : 'Quarterly',
      yearly: locale === 'zh-CN' ? '年付' : 'Yearly',
    }),
    [locale],
  )

  const billingCycleLabelMap: Record<ProductBillingCycle, string> = {
    one_time: labels.oneTime,
    monthly: labels.monthly,
    quarterly: labels.quarterly,
    yearly: labels.yearly,
  }
  const paymentMethodLabelMap: Record<PaymentMethodKey, string> = {
    wechat_qr: locale === 'zh-CN' ? '微信收款码' : 'WeChat QR',
    alipay_qr: locale === 'zh-CN' ? '支付宝收款码' : 'Alipay QR',
    okx_usdt: 'OKX USDT',
  }
  const paymentMethodOptions = (
    product?.paymentMethods?.length
      ? product.paymentMethods
      : (Object.keys(paymentMethodLabelMap) as PaymentMethodKey[])
  ).map((value) => ({
    value,
    label: paymentMethodLabelMap[value],
  }))

  const fields: DrawerFieldSchema[] = [
    { name: 'templateName', label: labels.templateName, type: 'text', required: true },
    {
      name: 'paymentMethod',
      label: locale === 'zh-CN' ? '支付方式' : 'Payment method',
      type: 'select',
      required: true,
      options: paymentMethodOptions,
    },
    { name: 'amount', label: labels.amount, type: 'text', required: true },
    { name: 'originalAmount', label: labels.originalAmount, type: 'text' },
    { name: 'currency', label: labels.currency, type: 'text', required: true },
    {
      name: 'billingCycle',
      label: labels.billingCycle,
      type: 'select',
      required: true,
      options: Object.entries(billingCycleLabelMap).map(([value, label]) => ({ value, label })),
    },
    { name: 'sortOrder', label: labels.sortOrder, type: 'number', min: 1, required: true },
    { name: 'enabled', label: labels.enabled, type: 'switch' },
  ]

  const columns: TableColumnsType<AdminProductPriceTemplate> = [
    { title: labels.templateName, dataIndex: 'templateName' },
    {
      title: locale === 'zh-CN' ? '支付方式' : 'Payment method',
      dataIndex: 'paymentMethod',
      width: 156,
      render: (value: PaymentMethodKey) => paymentMethodLabelMap[value] ?? value,
    },
    {
      title: labels.amount,
      dataIndex: 'amount',
      width: 120,
      render: (_value, record) => `${record.amount} ${record.currency}`,
    },
    { title: labels.originalAmount, dataIndex: 'originalAmount', width: 120 },
    {
      title: labels.billingCycle,
      dataIndex: 'billingCycle',
      width: 120,
      render: (value: ProductBillingCycle) => billingCycleLabelMap[value],
    },
    { title: labels.sortOrder, dataIndex: 'sortOrder', width: 92 },
    {
      title: labels.enabled,
      dataIndex: 'enabled',
      width: 110,
      render: (value: boolean) => (
        <StatusTag
          label={value ? labels.enabled : locale === 'zh-CN' ? '停用' : 'Disabled'}
          tone={value ? 'success' : 'default'}
        />
      ),
    },
    {
      title: locale === 'zh-CN' ? '操作' : 'Actions',
      key: 'actions',
      width: 140,
      render: (_value, record) => (
        <Space size={4}>
          <Button
            size="small"
            type="link"
            onClick={() =>
              setEditor({
                open: true,
                mode: 'edit',
                values: record,
              })
            }
          >
            {labels.edit}
          </Button>
          <Button
            size="small"
            danger
            type="link"
            onClick={() =>
              modal.confirm({
                title: labels.deleteConfirm,
                onOk: async () => onDelete(record),
              })
            }
          >
            {labels.delete}
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Drawer
        open={open}
        title={`${labels.title}${product ? ` · ${locale === 'zh-CN' ? product.nameZh : product.nameEn}` : ''}`}
        width={880}
        destroyOnClose
        className="admin-editor-drawer"
        onClose={onClose}
        extra={
          <Button
            type="primary"
            onClick={() =>
              setEditor({
                open: true,
                mode: 'create',
                values: {
                  productSku: product?.sku,
                  templateName: locale === 'zh-CN' ? product?.nameZh : product?.nameEn,
                  paymentMethod: product?.paymentMethods[0] ?? 'wechat_qr',
                  amount: product?.displayPrice,
                  originalAmount: product?.originalPrice,
                  currency: product?.currency,
                  billingCycle: product?.billingCycle ?? 'one_time',
                  sortOrder: templates.length + 1,
                  enabled: true,
                },
              })
            }
          >
            {labels.add}
          </Button>
        }
      >
        <DataTable
          rowKey="key"
          dataSource={templates}
          columns={columns}
          cardTitle={labels.title}
          showPagination={false}
        />
      </Drawer>

      <SystemEditorDrawer
        locale={locale}
        open={editor.open}
        title={`${editor.mode === 'create' ? labels.add : labels.edit} ${labels.title}`}
        fields={fields}
        initialValues={editor.values}
        submitText={labels.save}
        cancelText={labels.cancel}
        onCancel={() => setEditor({ open: false, mode: 'create', values: {} })}
        onSubmit={async (values) => {
          await onSave(editor.mode, values)
          setEditor({ open: false, mode: 'create', values: {} })
        }}
      />
    </>
  )
}
