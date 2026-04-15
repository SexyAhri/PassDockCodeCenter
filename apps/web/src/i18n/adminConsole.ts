import type { Locale } from './copy'

type AdminConsoleText = {
  nav: {
    dashboard: string
    products: string
    orders: string
    payments: string
    fulfillment: string
    customers: string
    support: string
    system: string
  }
  pages: {
    dashboard: { title: string; subtitle: string }
    products: { title: string; subtitle: string }
    orders: { title: string; subtitle: string }
    payments: { title: string; subtitle: string }
    fulfillment: { title: string; subtitle: string }
    customers: { title: string; subtitle: string }
    support: { title: string; subtitle: string }
    system: { title: string; subtitle: string }
  }
  sections: {
    recentOrders: string
    reviewQueue: string
    stockBoard: string
    revenueChannels: string
    integrationHealth: string
    paymentRecords: string
    callbackLogs: string
    watcherRecords: string
    paymentChannels: string
    fulfillmentRecords: string
    deliveryRecords: string
    strategyCatalog: string
    urgentTickets: string
    tickets: string
    integrationProviders: string
    integrationActions: string
    deliveryStrategies: string
    runtimeSettings: string
    auditLogs: string
  }
  metrics: {
    revenueToday: string
    paidOrders: string
    paymentReviews: string
    fulfillmentSuccess: string
    deliverySuccess: string
    activeChannels: string
    providerHealth: string
    openTickets: string
  }
  table: {
    orderNo: string
    product: string
    customer: string
    amount: string
    paymentMethod: string
    paymentStatus: string
    orderStatus: string
    deliveryStatus: string
    sourceChannel: string
    createdAt: string
    paidAt: string
    confirmedAt: string
    buyerRef: string
    channelKey: string
    channelType: string
    provider: string
    currency: string
    enabled: string
    strategy: string
    fulfillmentType: string
    actionKey: string
    status: string
    startedAt: string
    finishedAt: string
    deliveryChannel: string
    target: string
    region: string
    orders: string
    spend: string
    tier: string
    lastOrder: string
    ticketNo: string
    subject: string
    priority: string
    assignedTo: string
    providerKey: string
    authType: string
    baseUrl: string
    health: string
    retryTimes: string
    module: string
    action: string
    targetId: string
    operator: string
    value: string
  }
  labels: {
    queueAction: string
    retry: string
    review: string
    resend: string
    dryRun: string
    operator: string
    webhook: string
    onchain: string
    auto: string
    manual: string
  }
  enums: {
    paymentMethod: Record<string, string>
    paymentStatus: Record<string, string>
    orderStatus: Record<string, string>
    deliveryStatus: Record<string, string>
    sourceChannel: Record<string, string>
    fulfillmentType: Record<string, string>
    fulfillmentStatus: Record<string, string>
    authType: Record<string, string>
    health: Record<string, string>
    ticketStatus: Record<string, string>
    ticketPriority: Record<string, string>
    deliveryChannel: Record<string, string>
    userTier: Record<string, string>
  }
}

const adminConsoleText: Record<Locale, AdminConsoleText> = {
  'zh-CN': {
    nav: {
      dashboard: '运营总览',
      products: '商品中心',
      orders: '订单中心',
      payments: '支付中心',
      fulfillment: '履约中心',
      customers: '用户中心',
      support: '支持中心',
      system: '系统中心',
    },
    pages: {
      dashboard: {
        title: '运营总览',
        subtitle: '围绕订单、支付、履约、交付与集成健康的统一工作台。',
      },
      products: {
        title: '商品中心',
        subtitle: '管理 SKU、价格模板、可用支付方式与履约策略绑定。',
      },
      orders: {
        title: '订单中心',
        subtitle: '聚焦人工审核、异常订单、重试与退款动作。',
      },
      payments: {
        title: '支付中心',
        subtitle: '查看支付记录、回调日志、链上确认与收款通道状态。',
      },
      fulfillment: {
        title: '履约中心',
        subtitle: '跟踪发码、交付、重试队列与策略执行结果。',
      },
      customers: {
        title: '用户中心',
        subtitle: '按地区、层级和订单历史查看客户与绑定情况。',
      },
      support: {
        title: '支持中心',
        subtitle: '处理售后工单、分配运营人员并跟踪解决进度。',
      },
      system: {
        title: '系统中心',
        subtitle: '统一维护支付通道、上游集成、策略模板与审计日志。',
      },
    },
    sections: {
      recentOrders: '最新订单',
      reviewQueue: '人工审核队列',
      stockBoard: '库存看板',
      revenueChannels: '渠道收入',
      integrationHealth: '集成健康',
      paymentRecords: '支付记录',
      callbackLogs: '回调日志',
      watcherRecords: '链上确认',
      paymentChannels: '支付通道配置',
      fulfillmentRecords: '履约记录',
      deliveryRecords: '交付记录',
      strategyCatalog: '策略目录',
      urgentTickets: '紧急工单',
      tickets: '工单列表',
      integrationProviders: '上游服务方',
      integrationActions: '动作模板',
      deliveryStrategies: '交付策略',
      runtimeSettings: '运行时配置',
      auditLogs: '审计日志',
    },
    metrics: {
      revenueToday: '今日收入',
      paidOrders: '已支付订单',
      paymentReviews: '待审核支付',
      fulfillmentSuccess: '履约成功率',
      deliverySuccess: '交付成功率',
      activeChannels: '启用通道',
      providerHealth: '健康服务方',
      openTickets: '处理中工单',
    },
    table: {
      orderNo: '订单号',
      product: '商品',
      customer: '客户',
      amount: '金额',
      paymentMethod: '支付方式',
      paymentStatus: '支付状态',
      orderStatus: '订单状态',
      deliveryStatus: '交付状态',
      sourceChannel: '来源',
      createdAt: '创建时间',
      paidAt: '支付时间',
      confirmedAt: '确认时间',
      buyerRef: '买家标识',
      channelKey: '通道键',
      channelType: '通道类型',
      provider: '服务方',
      currency: '币种',
      enabled: '启用',
      strategy: '策略',
      fulfillmentType: '履约类型',
      actionKey: '动作键',
      status: '状态',
      startedAt: '开始时间',
      finishedAt: '完成时间',
      deliveryChannel: '交付通道',
      target: '目标',
      region: '地区',
      orders: '订单数',
      spend: '消费额',
      tier: '层级',
      lastOrder: '最近下单',
      ticketNo: '工单号',
      subject: '主题',
      priority: '优先级',
      assignedTo: '处理人',
      providerKey: '服务方标识',
      authType: '鉴权方式',
      baseUrl: '接口地址',
      health: '健康状态',
      retryTimes: '重试次数',
      module: '模块',
      action: '动作',
      targetId: '目标标识',
      operator: '操作人',
      value: '值',
    },
    labels: {
      queueAction: '进入处理',
      retry: '重试',
      review: '审核',
      resend: '重发',
      dryRun: '演练',
      operator: '运营',
      webhook: '回调',
      onchain: '链上',
      auto: '自动',
      manual: '人工',
    },
    enums: {
      paymentMethod: {
        wechat_qr: '微信收款码',
        alipay_qr: '支付宝收款码',
        okx_usdt: 'OKX USDT',
      },
      paymentStatus: {
        unpaid: '未支付',
        pending_review: '待审核',
        paid: '已支付',
        failed: '失败',
        refunded: '已退款',
      },
      orderStatus: {
        created: '已创建',
        awaiting_payment: '待支付',
        paid_pending_review: '已付款待审核',
        payment_confirmed: '支付确认',
        issuing: '履约中',
        issued: '已出码',
        delivery_pending: '待交付',
        delivered: '已交付',
        completed: '已完成',
        cancelled: '已取消',
        expired: '已过期',
        failed: '失败',
        refunded: '已退款',
      },
      deliveryStatus: {
        pending: '待发送',
        sending: '发送中',
        sent: '已发送',
        failed: '失败',
        cancelled: '已取消',
      },
      sourceChannel: {
        web: '网站',
        telegram: 'Telegram',
        admin: '后台',
        api: 'API',
      },
      fulfillmentType: {
        issue_code: '充值码',
        issue_subscription: '订阅码',
        issue_license: '许可证',
        credit_account: '直充账户',
        call_webhook: '回调调用',
        manual_delivery: '人工交付',
      },
      fulfillmentStatus: {
        pending: '待执行',
        running: '执行中',
        success: '成功',
        failed: '失败',
        cancelled: '已取消',
      },
      authType: {
        none: '无鉴权',
        bearer_token: '令牌鉴权',
        static_header: '静态请求头',
        hmac_sha256: 'HMAC SHA256',
        query_signature: '查询签名',
      },
      health: {
        unknown: '未知',
        healthy: '健康',
        degraded: '降级',
        failed: '失败',
      },
      ticketStatus: {
        open: '待处理',
        processing: '处理中',
        resolved: '已解决',
        closed: '已关闭',
      },
      ticketPriority: {
        low: '低',
        normal: '普通',
        high: '高',
        urgent: '紧急',
      },
      deliveryChannel: {
        web: '网站',
        telegram: 'Telegram',
        email: '邮件',
        manual: '人工',
      },
      userTier: {
        active: '活跃',
        vip: '重点客户',
      },
    },
  },
  'en-US': {
    nav: {
      dashboard: 'Dashboard',
      products: 'Products',
      orders: 'Orders',
      payments: 'Payments',
      fulfillment: 'Fulfillment',
      customers: 'Customers',
      support: 'Support',
      system: 'System',
    },
    pages: {
      dashboard: {
        title: 'Operations dashboard',
        subtitle: 'One enterprise console for orders, payments, fulfillment, delivery, and integration health.',
      },
      products: {
        title: 'Product center',
        subtitle: 'Manage SKUs, price templates, payment availability, and fulfillment strategy bindings.',
      },
      orders: {
        title: 'Order center',
        subtitle: 'Review manual payments, exceptions, retries, refunds, and delivery state.',
      },
      payments: {
        title: 'Payment center',
        subtitle: 'Track payment records, callback logs, on-chain confirmations, and channel readiness.',
      },
      fulfillment: {
        title: 'Fulfillment center',
        subtitle: 'Monitor issuance, delivery, retries, and strategy execution results.',
      },
      customers: {
        title: 'Customer center',
        subtitle: 'Review buyer tier, region, order history, and delivery binding signals.',
      },
      support: {
        title: 'Support center',
        subtitle: 'Manage after-sales tickets, operator assignment, and resolution progress.',
      },
      system: {
        title: 'System center',
        subtitle: 'Configure payment channels, upstream integrations, strategy templates, and audit trails.',
      },
    },
    sections: {
      recentOrders: 'Recent orders',
      reviewQueue: 'Manual review queue',
      stockBoard: 'Inventory board',
      revenueChannels: 'Revenue by channel',
      integrationHealth: 'Integration health',
      paymentRecords: 'Payment records',
      callbackLogs: 'Callback logs',
      watcherRecords: 'On-chain confirmations',
      paymentChannels: 'Payment channel config',
      fulfillmentRecords: 'Fulfillment records',
      deliveryRecords: 'Delivery records',
      strategyCatalog: 'Strategy catalog',
      urgentTickets: 'Urgent tickets',
      tickets: 'Ticket list',
      integrationProviders: 'Integration providers',
      integrationActions: 'Action templates',
      deliveryStrategies: 'Delivery strategies',
      runtimeSettings: 'Runtime settings',
      auditLogs: 'Audit logs',
    },
    metrics: {
      revenueToday: 'Revenue today',
      paidOrders: 'Paid orders',
      paymentReviews: 'Payment reviews',
      fulfillmentSuccess: 'Fulfillment success',
      deliverySuccess: 'Delivery success',
      activeChannels: 'Active channels',
      providerHealth: 'Healthy providers',
      openTickets: 'Open tickets',
    },
    table: {
      orderNo: 'Order no.',
      product: 'Product',
      customer: 'Customer',
      amount: 'Amount',
      paymentMethod: 'Payment method',
      paymentStatus: 'Payment status',
      orderStatus: 'Order status',
      deliveryStatus: 'Delivery status',
      sourceChannel: 'Source',
      createdAt: 'Created at',
      paidAt: 'Paid at',
      confirmedAt: 'Confirmed at',
      buyerRef: 'Buyer ref',
      channelKey: 'Channel key',
      channelType: 'Channel type',
      provider: 'Provider',
      currency: 'Currency',
      enabled: 'Enabled',
      strategy: 'Strategy',
      fulfillmentType: 'Fulfillment type',
      actionKey: 'Action key',
      status: 'Status',
      startedAt: 'Started at',
      finishedAt: 'Finished at',
      deliveryChannel: 'Delivery channel',
      target: 'Target',
      region: 'Region',
      orders: 'Orders',
      spend: 'Spend',
      tier: 'Tier',
      lastOrder: 'Last order',
      ticketNo: 'Ticket no.',
      subject: 'Subject',
      priority: 'Priority',
      assignedTo: 'Assigned to',
      providerKey: 'Provider key',
      authType: 'Auth type',
      baseUrl: 'Base URL',
      health: 'Health',
      retryTimes: 'Retry times',
      module: 'Module',
      action: 'Action',
      targetId: 'Target ID',
      operator: 'Operator',
      value: 'Value',
    },
    labels: {
      queueAction: 'Open queue',
      retry: 'Retry',
      review: 'Review',
      resend: 'Resend',
      dryRun: 'Dry run',
      operator: 'Operator',
      webhook: 'Webhook',
      onchain: 'On-chain',
      auto: 'Automatic',
      manual: 'Manual',
    },
    enums: {
      paymentMethod: {
        wechat_qr: 'WeChat QR',
        alipay_qr: 'Alipay QR',
        okx_usdt: 'OKX USDT',
      },
      paymentStatus: {
        unpaid: 'Unpaid',
        pending_review: 'Pending review',
        paid: 'Paid',
        failed: 'Failed',
        refunded: 'Refunded',
      },
      orderStatus: {
        created: 'Created',
        awaiting_payment: 'Awaiting payment',
        paid_pending_review: 'Paid pending review',
        payment_confirmed: 'Payment confirmed',
        issuing: 'Issuing',
        issued: 'Issued',
        delivery_pending: 'Delivery pending',
        delivered: 'Delivered',
        completed: 'Completed',
        cancelled: 'Cancelled',
        expired: 'Expired',
        failed: 'Failed',
        refunded: 'Refunded',
      },
      deliveryStatus: {
        pending: 'Pending',
        sending: 'Sending',
        sent: 'Sent',
        failed: 'Failed',
        cancelled: 'Cancelled',
      },
      sourceChannel: {
        web: 'Web',
        telegram: 'Telegram',
        admin: 'Admin',
        api: 'API',
      },
      fulfillmentType: {
        issue_code: 'Issue code',
        issue_subscription: 'Issue subscription',
        issue_license: 'Issue license',
        credit_account: 'Credit account',
        call_webhook: 'Call webhook',
        manual_delivery: 'Manual delivery',
      },
      fulfillmentStatus: {
        pending: 'Pending',
        running: 'Running',
        success: 'Success',
        failed: 'Failed',
        cancelled: 'Cancelled',
      },
      authType: {
        none: 'None',
        bearer_token: 'Bearer token',
        static_header: 'Static header',
        hmac_sha256: 'HMAC SHA256',
        query_signature: 'Query signature',
      },
      health: {
        unknown: 'Unknown',
        healthy: 'Healthy',
        degraded: 'Degraded',
        failed: 'Failed',
      },
      ticketStatus: {
        open: 'Open',
        processing: 'Processing',
        resolved: 'Resolved',
        closed: 'Closed',
      },
      ticketPriority: {
        low: 'Low',
        normal: 'Normal',
        high: 'High',
        urgent: 'Urgent',
      },
      deliveryChannel: {
        web: 'Web',
        telegram: 'Telegram',
        email: 'Email',
        manual: 'Manual',
      },
      userTier: {
        active: 'Active',
        vip: 'VIP',
      },
    },
  },
}

export function getAdminConsoleText(locale: Locale) {
  return adminConsoleText[locale]
}
