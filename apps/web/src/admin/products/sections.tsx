import { Button, Space, Tag } from 'antd'
import type { TableColumnsType } from 'antd'

import type { AdminAuditLog } from '../../data/admin'
import type { Locale } from '../../i18n/copy'
import { StatusTag } from '../../components/admin/StatusTag'
import { getBooleanText } from '../presentation'
import type { AdminSystemDraft, DrawerFieldSchema } from '../system/types'
import type { AdminConsoleText } from '../../i18n/adminConsole-types'
import type {
  AdminManagedProduct,
  AdminManagedProductType,
  AdminProductDraft,
  AdminProductPriceTemplate,
  ProductArtVariant,
  ProductBillingCycle,
} from './types'

export type ProductSectionKey = 'products' | 'priceTemplates' | 'auditLogs'

type ProductSectionRow = Record<string, unknown>

type ProductPriceTemplateTableRow = AdminProductPriceTemplate & {
  productKey: string
  productNameZh: string
  productNameEn: string
  productType: AdminManagedProductType
  productEnabled: boolean
}

type ProductSectionActionHandlers = {
  onView: (record: ProductSectionRow) => void
  onEdit: (record: ProductSectionRow) => void
  onDelete: (record: ProductSectionRow) => void
  onManagePrices: (record: AdminManagedProduct) => void
}

type ProductSectionLabels = {
  view: string
  edit: string
  delete: string
  managePrices: string
  createProduct: string
  createPriceTemplate: string
}

type ProductSectionConfig = {
  title: string
  description: string
  dataSource: ProductSectionRow[]
  columns: TableColumnsType<ProductSectionRow>
  fields?: DrawerFieldSchema[]
  createLabel?: string
  createInitial?: () => Record<string, unknown>
  scrollX?: number
  module?: 'products' | 'product_prices'
  getTargetId?: (record: ProductSectionRow) => string
}

export function getProductSectionItems(
  locale: Locale,
  draft: AdminProductDraft,
  auditLogs: AdminAuditLog[],
) {
  return [
    {
      key: 'products' as const,
      label: locale === 'zh-CN' ? '商品目录' : 'Products',
      description:
        locale === 'zh-CN'
          ? 'SKU、支付方式与履约交付绑定'
          : 'SKU, payment methods, and strategy binding',
      count: draft.products.length,
    },
    {
      key: 'priceTemplates' as const,
      label: locale === 'zh-CN' ? '价格模板' : 'Price templates',
      description:
        locale === 'zh-CN'
          ? '统一维护商品价格与计费周期'
          : 'Manage price rows and billing cycles centrally',
      count: draft.priceTemplates.length,
    },
    {
      key: 'auditLogs' as const,
      label: locale === 'zh-CN' ? '审计轨迹' : 'Audit trail',
      description:
        locale === 'zh-CN'
          ? '记录商品与价格变更'
          : 'Track product and pricing mutations',
      count: auditLogs.length,
    },
  ]
}

export function buildProductEditorValues(product: AdminManagedProduct): Record<string, unknown> {
  return {
    ...product,
    tagsZh: joinProductTextLines(product.tagsZh),
    tagsEn: joinProductTextLines(product.tagsEn),
    checkoutNotesZh: joinProductTextLines(product.checkoutNotesZh),
    checkoutNotesEn: joinProductTextLines(product.checkoutNotesEn),
  }
}

export function getProductSectionConfig(params: {
  section: ProductSectionKey
  locale: Locale
  text: AdminConsoleText
  draft: AdminProductDraft
  systemDraft: AdminSystemDraft
  auditLogs: AdminAuditLog[]
  labels: ProductSectionLabels
  actions: ProductSectionActionHandlers
}): ProductSectionConfig {
  const { section, locale, text, draft, systemDraft, auditLogs, labels, actions } = params

  switch (section) {
    case 'products':
      return {
        title: locale === 'zh-CN' ? '商品目录' : 'Product directory',
        description:
          locale === 'zh-CN'
            ? '维护 SKU、价格展示、支付通道以及履约/交付策略绑定，作为后台商品主工作台。'
            : 'Maintain SKU inventory, pricing display, payment methods, and strategy binding in one product workspace.',
        dataSource: [...draft.products].sort((left, right) => left.sortOrder - right.sortOrder),
        columns: getProductColumns(locale, text, systemDraft, labels, actions),
        fields: getProductFields(locale, text, systemDraft),
        createLabel: labels.createProduct,
        createInitial: () => createProductInitialValues(draft, systemDraft),
        scrollX: 1560,
        module: 'products',
        getTargetId: (record) => String(record.sku ?? ''),
      }
    case 'priceTemplates':
      return {
        title: locale === 'zh-CN' ? '价格模板台账' : 'Price template desk',
        description:
          locale === 'zh-CN'
            ? '直接维护价格模板数据，不再依赖摘要表跳转，支持跨商品筛选、编辑、启停与批量操作。'
            : 'Edit price templates directly as first-class records with filtering, batch actions, and per-row maintenance.',
        dataSource: getProductPriceTemplateRows(draft),
        columns: getPriceTemplateColumns(locale, text, labels, actions),
        fields: getPriceTemplateFields(locale, text, draft),
        createLabel: labels.createPriceTemplate,
        createInitial: () => createPriceTemplateInitialValues(draft),
        scrollX: 1560,
        module: 'product_prices',
        getTargetId: (record) =>
          `${String(record.productSku ?? '')}:${String(record.templateName ?? '')}:${String(record.paymentMethod ?? '')}`,
      }
    default:
      return {
        title: locale === 'zh-CN' ? '商品审计轨迹' : 'Product audit trail',
        description:
          locale === 'zh-CN'
            ? '所有商品与价格模板的新增、修改、删除都会进入统一审计流。'
            : 'All product and price-template changes are appended into the shared audit stream.',
        dataSource: auditLogs,
        columns: getAuditColumns(locale, text, labels, actions),
        scrollX: 1100,
      }
  }
}

function getProductColumns(
  locale: Locale,
  text: AdminConsoleText,
  systemDraft: AdminSystemDraft,
  labels: ProductSectionLabels,
  actions: ProductSectionActionHandlers,
): TableColumnsType<ProductSectionRow> {
  const paymentMethodLabelMap = text.enums.paymentMethod
  const fulfillmentStrategyMap = Object.fromEntries(
    systemDraft.fulfillmentStrategies.map((item) => [item.strategyKey, item]),
  )
  const deliveryStrategyMap = Object.fromEntries(
    systemDraft.deliveryStrategies.map((item) => [item.strategyKey, item]),
  )

  return [
    {
      title: text.table.product,
      dataIndex: 'nameEn',
      width: 240,
      fixed: 'left',
      render: (_value, record) => renderProductTitle(locale, record as AdminManagedProduct),
    },
    {
      title: locale === 'zh-CN' ? '商品类型' : 'Product type',
      dataIndex: 'productType',
      width: 140,
      render: (value: AdminManagedProductType) => <Tag>{getProductTypeText(locale, value)}</Tag>,
    },
    { title: 'SKU', dataIndex: 'sku', width: 180 },
    {
      title: locale === 'zh-CN' ? '计费周期' : 'Billing cycle',
      dataIndex: 'billingCycle',
      width: 136,
      render: (value: ProductBillingCycle) => getBillingCycleText(locale, value),
    },
    {
      title: text.table.amount,
      dataIndex: 'displayPrice',
      width: 138,
      render: (_value, record) => {
        const product = record as AdminManagedProduct

        return renderPriceStack(product.displayPrice, product.originalPrice, product.currency)
      },
    },
    {
      title: text.table.paymentMethod,
      dataIndex: 'paymentMethods',
      width: 260,
      render: (value: AdminManagedProduct['paymentMethods']) => (
        <div className="admin-inline-tags">
          {value.map((method) => (
            <Tag key={method}>{paymentMethodLabelMap[method] ?? method}</Tag>
          ))}
        </div>
      ),
    },
    {
      title: locale === 'zh-CN' ? '履约策略' : 'Fulfillment',
      dataIndex: 'fulfillmentStrategyKey',
      width: 220,
      render: (value: string) =>
        renderLinkedStrategy(fulfillmentStrategyMap[value]?.strategyName ?? value, value),
    },
    {
      title: locale === 'zh-CN' ? '交付策略' : 'Delivery',
      dataIndex: 'deliveryStrategyKey',
      width: 220,
      render: (value: string) =>
        renderLinkedStrategy(deliveryStrategyMap[value]?.strategyName ?? value, value),
    },
    { title: locale === 'zh-CN' ? '库存' : 'Inventory', dataIndex: 'inventory', width: 106 },
    { title: locale === 'zh-CN' ? '排序' : 'Sort', dataIndex: 'sortOrder', width: 92 },
    {
      title: text.table.enabled,
      dataIndex: 'enabled',
      width: 112,
      render: (value: boolean) => (
        <StatusTag label={getBooleanText(locale, value)} tone={value ? 'success' : 'default'} />
      ),
    },
    {
      title: locale === 'zh-CN' ? '操作' : 'Actions',
      key: 'actions',
      width: 210,
      fixed: 'right',
      render: (_value, record) => (
        <Space size={4} className="admin-table-actions">
          <Button size="small" type="link" onClick={() => actions.onEdit(record)}>
            {labels.edit}
          </Button>
          <Button size="small" type="link" onClick={() => actions.onManagePrices(record as AdminManagedProduct)}>
            {labels.managePrices}
          </Button>
          <Button size="small" danger type="link" onClick={() => actions.onDelete(record)}>
            {labels.delete}
          </Button>
        </Space>
      ),
    },
  ]
}

function getPriceTemplateColumns(
  locale: Locale,
  text: AdminConsoleText,
  labels: ProductSectionLabels,
  actions: ProductSectionActionHandlers,
): TableColumnsType<ProductSectionRow> {
  return [
    {
      title: locale === 'zh-CN' ? '商品' : 'Product',
      dataIndex: 'productNameEn',
      width: 240,
      fixed: 'left',
      render: (_value, record) => renderPriceTemplateProductTitle(locale, record as ProductPriceTemplateTableRow),
    },
    {
      title: locale === 'zh-CN' ? '商品类型' : 'Product type',
      dataIndex: 'productType',
      width: 132,
      render: (value: AdminManagedProductType) => <Tag>{getProductTypeText(locale, value)}</Tag>,
    },
    { title: 'SKU', dataIndex: 'productSku', width: 180 },
    {
      title: text.table.paymentMethod,
      dataIndex: 'paymentMethod',
      width: 156,
      render: (value: string) => text.enums.paymentMethod[value] ?? value,
    },
    {
      title: locale === 'zh-CN' ? '模板名称' : 'Template name',
      dataIndex: 'templateName',
      width: 200,
    },
    {
      title: locale === 'zh-CN' ? '销售价格' : 'Amount',
      dataIndex: 'amount',
      width: 148,
      render: (_value, record) => {
        const template = record as ProductPriceTemplateTableRow

        return renderPriceStack(template.amount, template.originalAmount, template.currency)
      },
    },
    {
      title: locale === 'zh-CN' ? '计费周期' : 'Billing cycle',
      dataIndex: 'billingCycle',
      width: 136,
      render: (value: ProductBillingCycle) => getBillingCycleText(locale, value),
    },
    {
      title: locale === 'zh-CN' ? '商品状态' : 'Product status',
      dataIndex: 'productEnabled',
      width: 124,
      render: (value: boolean) => (
        <StatusTag label={getBooleanText(locale, value)} tone={value ? 'success' : 'default'} />
      ),
    },
    {
      title: locale === 'zh-CN' ? '模板状态' : 'Template status',
      dataIndex: 'enabled',
      width: 128,
      render: (value: boolean) => (
        <StatusTag label={getBooleanText(locale, value)} tone={value ? 'success' : 'default'} />
      ),
    },
    { title: locale === 'zh-CN' ? '排序' : 'Sort', dataIndex: 'sortOrder', width: 92 },
    {
      title: locale === 'zh-CN' ? '操作' : 'Actions',
      key: 'actions',
      width: 136,
      fixed: 'right',
      render: (_value, record) => (
        <Space size={4} className="admin-table-actions">
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

function getAuditColumns(
  locale: Locale,
  text: AdminConsoleText,
  labels: ProductSectionLabels,
  actions: ProductSectionActionHandlers,
): TableColumnsType<ProductSectionRow> {
  return [
    { title: text.table.operator, dataIndex: 'operator', width: 132 },
    { title: text.table.action, dataIndex: 'action', width: 200 },
    { title: text.table.targetId, dataIndex: 'targetId' },
    { title: locale === 'zh-CN' ? '模块' : 'Module', dataIndex: 'module', width: 120 },
    { title: text.table.createdAt, dataIndex: 'createdAt', width: 168 },
    {
      title: locale === 'zh-CN' ? '操作' : 'Actions',
      key: 'actions',
      width: 108,
      fixed: 'right',
      render: (_value, record) => (
        <Button size="small" type="link" onClick={() => actions.onView(record)}>
          {labels.view}
        </Button>
      ),
    },
  ]
}

function getProductFields(
  locale: Locale,
  text: AdminConsoleText,
  systemDraft: AdminSystemDraft,
): DrawerFieldSchema[] {
  return [
    {
      name: 'productType',
      label: locale === 'zh-CN' ? '商品类型' : 'Product type',
      type: 'select',
      required: true,
      options: getProductTypeOptions(locale),
    },
    { name: 'sku', label: 'SKU', type: 'text', required: true },
    { name: 'nameZh', label: locale === 'zh-CN' ? '中文名称' : 'Chinese name', type: 'text', required: true },
    { name: 'nameEn', label: locale === 'zh-CN' ? '英文名称' : 'English name', type: 'text', required: true },
    { name: 'badgeZh', label: locale === 'zh-CN' ? '中文角标' : 'Chinese badge', type: 'text' },
    { name: 'badgeEn', label: locale === 'zh-CN' ? '英文角标' : 'English badge', type: 'text' },
    { name: 'cycleLabelZh', label: locale === 'zh-CN' ? '中文周期标签' : 'Chinese cycle label', type: 'text' },
    { name: 'cycleLabelEn', label: locale === 'zh-CN' ? '英文周期标签' : 'English cycle label', type: 'text' },
    { name: 'deliveryLabelZh', label: locale === 'zh-CN' ? '中文交付标签' : 'Chinese delivery label', type: 'text' },
    { name: 'deliveryLabelEn', label: locale === 'zh-CN' ? '英文交付标签' : 'English delivery label', type: 'text' },
    { name: 'stockLabelZh', label: locale === 'zh-CN' ? '中文库存标签' : 'Chinese stock label', type: 'text' },
    { name: 'stockLabelEn', label: locale === 'zh-CN' ? '英文库存标签' : 'English stock label', type: 'text' },
    { name: 'statusLabelZh', label: locale === 'zh-CN' ? '中文状态标签' : 'Chinese status label', type: 'text' },
    { name: 'statusLabelEn', label: locale === 'zh-CN' ? '英文状态标签' : 'English status label', type: 'text' },
    { name: 'displayPrice', label: locale === 'zh-CN' ? '展示价格' : 'Display price', type: 'text', required: true },
    { name: 'originalPrice', label: locale === 'zh-CN' ? '划线价格' : 'Original price', type: 'text' },
    { name: 'currency', label: text.table.currency, type: 'text', required: true },
    {
      name: 'billingCycle',
      label: locale === 'zh-CN' ? '计费周期' : 'Billing cycle',
      type: 'select',
      required: true,
      options: getBillingCycleOptions(locale),
    },
    { name: 'inventory', label: locale === 'zh-CN' ? '库存' : 'Inventory', type: 'number', min: 0, required: true },
    {
      name: 'tagsZh',
      label: locale === 'zh-CN' ? '中文标签' : 'Chinese tags',
      type: 'textarea',
      rows: 3,
      placeholder: locale === 'zh-CN' ? '每行一个标签，或使用逗号分隔' : 'One tag per line, or separate with commas',
    },
    {
      name: 'tagsEn',
      label: locale === 'zh-CN' ? '英文标签' : 'English tags',
      type: 'textarea',
      rows: 3,
      placeholder: locale === 'zh-CN' ? '每行一个标签，或使用逗号分隔' : 'One tag per line, or separate with commas',
    },
    {
      name: 'checkoutNotesZh',
      label: locale === 'zh-CN' ? '中文下单说明' : 'Chinese checkout notes',
      type: 'textarea',
      rows: 4,
      placeholder: locale === 'zh-CN' ? '每行一条说明' : 'One note per line',
    },
    {
      name: 'checkoutNotesEn',
      label: locale === 'zh-CN' ? '英文下单说明' : 'English checkout notes',
      type: 'textarea',
      rows: 4,
      placeholder: locale === 'zh-CN' ? '每行一条说明' : 'One note per line',
    },
    {
      name: 'artVariant',
      label: locale === 'zh-CN' ? '视觉变体' : 'Visual variant',
      type: 'select',
      required: true,
      options: getArtVariantOptions(locale),
    },
    { name: 'sortOrder', label: locale === 'zh-CN' ? '排序' : 'Sort order', type: 'number', min: 1, required: true },
    {
      name: 'paymentMethods',
      label: text.table.paymentMethod,
      type: 'select',
      mode: 'multiple',
      required: true,
      options: systemDraft.paymentChannels.map((channel) => ({
        value: channel.channelType,
        label: channel.enabled
          ? channel.channelName
          : `${channel.channelName} (${locale === 'zh-CN' ? '停用' : 'disabled'})`,
      })),
    },
    {
      name: 'fulfillmentStrategyKey',
      label: locale === 'zh-CN' ? '履约策略' : 'Fulfillment strategy',
      type: 'select',
      required: true,
      options: systemDraft.fulfillmentStrategies.map((strategy) => ({
        value: strategy.strategyKey,
        label: strategy.enabled
          ? strategy.strategyName
          : `${strategy.strategyName} (${locale === 'zh-CN' ? '停用' : 'disabled'})`,
      })),
    },
    {
      name: 'deliveryStrategyKey',
      label: locale === 'zh-CN' ? '交付策略' : 'Delivery strategy',
      type: 'select',
      required: true,
      options: systemDraft.deliveryStrategies.map((strategy) => ({
        value: strategy.strategyKey,
        label: strategy.enabled
          ? strategy.strategyName
          : `${strategy.strategyName} (${locale === 'zh-CN' ? '停用' : 'disabled'})`,
      })),
    },
    { name: 'enabled', label: text.table.enabled, type: 'switch' },
  ]
}

function getPriceTemplateFields(
  locale: Locale,
  text: AdminConsoleText,
  draft: AdminProductDraft,
): DrawerFieldSchema[] {
  const productOptions = [...draft.products]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((product) => ({
      value: product.sku,
      label:
        locale === 'zh-CN'
          ? `${product.nameZh || product.sku} · ${product.sku}`
          : `${product.nameEn || product.sku} · ${product.sku}`,
    }))

  const paymentMethodOptions = getPriceTemplatePaymentMethodOptions(text, draft)

  return [
    {
      name: 'productSku',
      label: locale === 'zh-CN' ? '所属商品' : 'Product',
      type: 'select',
      required: true,
      options: productOptions,
    },
    {
      name: 'paymentMethod',
      label: text.table.paymentMethod,
      type: 'select',
      required: true,
      options: paymentMethodOptions,
    },
    {
      name: 'templateName',
      label: locale === 'zh-CN' ? '模板名称' : 'Template name',
      type: 'text',
      required: true,
    },
    { name: 'amount', label: locale === 'zh-CN' ? '销售价格' : 'Amount', type: 'text', required: true },
    { name: 'originalAmount', label: locale === 'zh-CN' ? '原价' : 'Original amount', type: 'text' },
    { name: 'currency', label: locale === 'zh-CN' ? '币种' : 'Currency', type: 'text', required: true },
    {
      name: 'billingCycle',
      label: locale === 'zh-CN' ? '计费周期' : 'Billing cycle',
      type: 'select',
      required: true,
      options: getBillingCycleOptions(locale),
    },
    { name: 'sortOrder', label: locale === 'zh-CN' ? '排序' : 'Sort order', type: 'number', min: 1, required: true },
    { name: 'enabled', label: locale === 'zh-CN' ? '启用' : 'Enabled', type: 'switch' },
  ]
}

function createProductInitialValues(draft: AdminProductDraft, systemDraft: AdminSystemDraft) {
  const defaultPaymentMethods = systemDraft.paymentChannels
    .filter((channel) => channel.enabled)
    .slice(0, 2)
    .map((channel) => channel.channelType)

  return {
    productType: 'recharge',
    sku: '',
    nameZh: '',
    nameEn: '',
    badgeZh: '',
    badgeEn: '',
    cycleLabelZh: '',
    cycleLabelEn: '',
    deliveryLabelZh: '',
    deliveryLabelEn: '',
    stockLabelZh: '',
    stockLabelEn: '',
    statusLabelZh: '',
    statusLabelEn: '',
    currency: 'RMB',
    displayPrice: '',
    originalPrice: '',
    billingCycle: 'one_time',
    inventory: 0,
    tagsZh: '',
    tagsEn: '',
    checkoutNotesZh: '',
    checkoutNotesEn: '',
    artVariant: 'starter',
    enabled: true,
    sortOrder: draft.products.length + 1,
    paymentMethods: defaultPaymentMethods,
    fulfillmentStrategyKey:
      systemDraft.fulfillmentStrategies.find((item) => item.enabled)?.strategyKey ??
      systemDraft.fulfillmentStrategies[0]?.strategyKey ??
      '',
    deliveryStrategyKey:
      systemDraft.deliveryStrategies.find((item) => item.enabled)?.strategyKey ??
      systemDraft.deliveryStrategies[0]?.strategyKey ??
      '',
  }
}

function createPriceTemplateInitialValues(draft: AdminProductDraft) {
  const primaryProduct =
    [...draft.products].sort((left, right) => left.sortOrder - right.sortOrder)[0] ?? null

  return {
    productSku: primaryProduct?.sku ?? '',
    templateName: primaryProduct?.nameEn ?? '',
    paymentMethod: primaryProduct?.paymentMethods[0] ?? 'wechat_qr',
    amount: primaryProduct?.displayPrice ?? '',
    originalAmount: primaryProduct?.originalPrice ?? '',
    currency: primaryProduct?.currency ?? 'RMB',
    billingCycle: primaryProduct?.billingCycle ?? 'one_time',
    sortOrder:
      draft.priceTemplates.filter((item) => item.productSku === primaryProduct?.sku).length + 1,
    enabled: true,
  }
}

function getProductPriceTemplateRows(draft: AdminProductDraft): ProductPriceTemplateTableRow[] {
  const productMap = Object.fromEntries(draft.products.map((product) => [product.sku, product]))

  return [...draft.priceTemplates]
    .sort((left, right) => {
      if (left.productSku !== right.productSku) {
        return left.productSku.localeCompare(right.productSku)
      }

      return left.sortOrder - right.sortOrder
    })
    .map((template) => {
      const product = productMap[template.productSku]

      return {
        ...template,
        productKey: product?.key ?? template.productSku,
        productNameZh: product?.nameZh ?? template.productSku,
        productNameEn: product?.nameEn ?? template.productSku,
        productType: product?.productType ?? 'digital',
        productEnabled: product?.enabled ?? false,
      }
    })
}

function getPriceTemplatePaymentMethodOptions(
  text: AdminConsoleText,
  draft: AdminProductDraft,
) {
  const configuredMethods = Array.from(
    new Set(draft.products.flatMap((product) => product.paymentMethods)),
  )
  const methods = configuredMethods.length
    ? configuredMethods
    : (['okx_usdt', 'wechat_qr', 'alipay_qr'] as const)

  return methods.map((value) => ({
    value,
    label: text.enums.paymentMethod[value] ?? value,
  }))
}

function getProductTypeOptions(locale: Locale) {
  return [
    { value: 'recharge', label: getProductTypeText(locale, 'recharge') },
    { value: 'subscription', label: getProductTypeText(locale, 'subscription') },
    { value: 'digital', label: getProductTypeText(locale, 'digital') },
    { value: 'manual', label: getProductTypeText(locale, 'manual') },
  ]
}

function getBillingCycleOptions(locale: Locale) {
  return [
    { value: 'one_time', label: getBillingCycleText(locale, 'one_time') },
    { value: 'monthly', label: getBillingCycleText(locale, 'monthly') },
    { value: 'quarterly', label: getBillingCycleText(locale, 'quarterly') },
    { value: 'yearly', label: getBillingCycleText(locale, 'yearly') },
  ]
}

function getArtVariantOptions(locale: Locale) {
  return [
    { value: 'trial', label: getArtVariantText(locale, 'trial') },
    { value: 'starter', label: getArtVariantText(locale, 'starter') },
    { value: 'growth', label: getArtVariantText(locale, 'growth') },
    { value: 'team', label: getArtVariantText(locale, 'team') },
    { value: 'enterprise', label: getArtVariantText(locale, 'enterprise') },
  ]
}

function getProductTypeText(locale: Locale, value: AdminManagedProductType) {
  switch (value) {
    case 'recharge':
      return locale === 'zh-CN' ? '充值' : 'Recharge'
    case 'subscription':
      return locale === 'zh-CN' ? '订阅' : 'Subscription'
    case 'manual':
      return locale === 'zh-CN' ? '人工交付' : 'Manual'
    default:
      return locale === 'zh-CN' ? '数字商品' : 'Digital'
  }
}

function getBillingCycleText(locale: Locale, value: ProductBillingCycle) {
  switch (value) {
    case 'monthly':
      return locale === 'zh-CN' ? '月付' : 'Monthly'
    case 'quarterly':
      return locale === 'zh-CN' ? '季付' : 'Quarterly'
    case 'yearly':
      return locale === 'zh-CN' ? '年付' : 'Yearly'
    default:
      return locale === 'zh-CN' ? '一次性' : 'One-time'
  }
}

function getArtVariantText(locale: Locale, value: ProductArtVariant) {
  switch (value) {
    case 'trial':
      return locale === 'zh-CN' ? '试用' : 'Trial'
    case 'growth':
      return locale === 'zh-CN' ? '增长' : 'Growth'
    case 'team':
      return locale === 'zh-CN' ? '团队' : 'Team'
    case 'enterprise':
      return locale === 'zh-CN' ? '企业' : 'Enterprise'
    default:
      return locale === 'zh-CN' ? '入门' : 'Starter'
  }
}

function renderProductTitle(locale: Locale, record: Pick<AdminManagedProduct, 'sku' | 'nameZh' | 'nameEn'>) {
  const primaryName = locale === 'zh-CN' ? record.nameZh : record.nameEn
  const secondaryName = locale === 'zh-CN' ? record.nameEn : record.nameZh

  return (
    <div className="admin-row-title">
      <strong>{primaryName || record.sku}</strong>
      <small>{secondaryName || record.sku}</small>
    </div>
  )
}

function renderPriceTemplateProductTitle(locale: Locale, record: ProductPriceTemplateTableRow) {
  const primaryName = locale === 'zh-CN' ? record.productNameZh : record.productNameEn
  const secondaryName = locale === 'zh-CN' ? record.productNameEn : record.productNameZh

  return (
    <div className="admin-row-title">
      <strong>{primaryName || record.productSku}</strong>
      <small>{secondaryName || record.productSku}</small>
    </div>
  )
}

function renderPriceStack(price: string, originalPrice: string, currency: string) {
  return (
    <div className="admin-table-price-stack">
      <strong>{`${price} ${currency}`}</strong>
      {originalPrice ? <small>{`${originalPrice} ${currency}`}</small> : null}
    </div>
  )
}

function renderLinkedStrategy(title: string, key: string) {
  return (
    <div className="admin-row-title">
      <strong>{title || key}</strong>
      <small>{key}</small>
    </div>
  )
}

function joinProductTextLines(values: string[]) {
  return values.join('\n')
}
