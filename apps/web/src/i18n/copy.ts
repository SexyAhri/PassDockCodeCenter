export type Locale = 'zh-CN' | 'en-US'
export type PaymentMethodKey = 'wechat_qr' | 'alipay_qr' | 'okx_usdt'

export const localeOptions = [
  { value: 'zh-CN', shortLabel: '中' },
  { value: 'en-US', shortLabel: 'EN' },
] as const satisfies ReadonlyArray<{ value: Locale; shortLabel: string }>

export function isLocale(value: string): value is Locale {
  return value === 'zh-CN' || value === 'en-US'
}

export type AppCopy = {
  common: {
    brandName: string
    brandMeta: string
    confirm: string
    cancel: string
  }
  header: {
    navAriaLabel: string
    home: string
    products: string
    orders: string
    admin: string
    language: string
    theme: string
    light: string
    dark: string
  }
  store: {
    bannerBadge: string
    bannerTitle: string
    bannerLead: string
    primaryAction: string
    secondaryAction: string
    noticeTitle: string
    noticeLead: string
    noticeSteps: string[]
    noticePrimary: string
    noticeSecondary: string
    featuredEyebrow: string
    featuredTitle: string
    featuredLead: string
    viewAll: string
    buyNow: string
    stats: Array<{ label: string; value: string }>
    specLabels: {
      billing: string
      delivery: string
      payment: string
      stock: string
    }
  }
  checkout: {
    eyebrow: string
    lead: string
    snapshotTitle: string
    paymentTitle: string
    notesTitle: string
    flowTitle: string
    flowSteps: Array<{ title: string; detail: string }>
    summaryLabels: {
      sku: string
      billing: string
      delivery: string
      stock: string
      price: string
    }
    backToShop: string
  }
  notFound: {
    title: string
    body: string
    cta: string
  }
  paymentMethods: Record<string, { label: string; mode: string }>
  admin: {
    sidebar: {
      dashboard: string
      products: string
      orders: string
      customers: string
      settings: string
      viewStore: string
    }
    shell: {
      welcome: string
      logout: string
      logoutTitle: string
      logoutBody: string
    }
    login: {
      title: string
      subtitle: string
      panelTitle: string
      panelLead: string
      accountLabel: string
      accountPlaceholder: string
      passwordLabel: string
      passwordPlaceholder: string
      remember: string
      hint: string
      submit: string
      loading: string
      success: string
      failure: string
      features: Array<{ title: string; description: string }>
    }
    dashboard: {
      title: string
      subtitle: string
      refresh: string
      export: string
      cards: {
        revenue: string
        paidOrders: string
        pendingFulfillment: string
        inventoryCoverage: string
      }
      ordersTitle: string
      stockTitle: string
      reminderTitle: string
      reminderBody: string
    }
    products: {
      title: string
      subtitle: string
    }
    orders: {
      title: string
      subtitle: string
    }
    customers: {
      title: string
      subtitle: string
    }
    settings: {
      title: string
      subtitle: string
      paymentCard: string
      deliveryCard: string
      riskCard: string
      paymentItems: string[]
      deliveryItems: string[]
      riskItems: string[]
    }
    status: {
      online: string
      stable: string
      autoDelivery: string
      manualReview: string
      paid: string
      pending: string
      delivering: string
      completed: string
      active: string
      vip: string
    }
    table: {
      orderNo: string
      product: string
      customer: string
      amount: string
      payment: string
      delivery: string
      channel: string
      createdAt: string
      sku: string
      billing: string
      methods: string
      inventory: string
      status: string
      region: string
      orders: string
      spend: string
      tier: string
      lastOrder: string
    }
  }
}

export const uiCopy: Record<Locale, AppCopy> = {
  'zh-CN': {
    common: {
      brandName: 'PassDock',
      brandMeta: 'Commerce Center',
      confirm: '确认',
      cancel: '取消',
    },
    header: {
      navAriaLabel: '主导航',
      home: '首页',
      products: '商品',
      orders: '订单',
      admin: '后台',
      language: '语言',
      theme: '主题',
      light: '浅色',
      dark: '深色',
    },
    store: {
      bannerBadge: 'PASSDOCK COMMERCE',
      bannerTitle: '数字商品与卡密交付中心',
      bannerLead: '面向充值、订阅和企业采购的标准化交易前台。',
      primaryAction: '浏览商品',
      secondaryAction: '进入后台',
      noticeTitle: '下单流程',
      noticeLead: '先在主站完成注册，再在这里下单，最后回主站或 Telegram 领取结果。',
      noticeSteps: ['主站注册', '店铺下单', '主站兑换'],
      noticePrimary: '查看商品',
      noticeSecondary: '登录后台',
      featuredEyebrow: 'Product Shelf',
      featuredTitle: '在售商品',
      featuredLead: '聚焦 SKU、周期、交付、支付与价格。',
      viewAll: '查看全部',
      buyNow: '立即下单',
      stats: [
        { label: '在售 SKU', value: '05' },
        { label: '支付通道', value: '04' },
        { label: '交付路径', value: 'Web / TG' },
      ],
      specLabels: {
        billing: '周期',
        delivery: '交付',
        payment: '支付',
        stock: '库存',
      },
    },
    checkout: {
      eyebrow: 'Order Preview',
      lead: '展示 SKU 快照、支付方式和履约路径。',
      snapshotTitle: '商品快照',
      paymentTitle: '支付通道',
      notesTitle: '交付说明',
      flowTitle: '履约流程',
      flowSteps: [
        { title: '创建订单', detail: '按 SKU 固化价格、支付方式与交付配置。' },
        { title: '确认付款', detail: '通过二维码或 watcher 完成支付确认。' },
        { title: '执行履约', detail: '按订单号发码，并同步至站内与 Telegram。' },
      ],
      summaryLabels: {
        sku: 'SKU',
        billing: '周期',
        delivery: '交付',
        stock: '库存',
        price: '价格',
      },
      backToShop: '返回商品',
    },
    notFound: {
      title: '页面未映射',
      body: '当前地址还没有接入前台或后台视图。',
      cta: '返回商品中心',
    },
    paymentMethods: {
      wechat_qr: {
        label: '微信二维码',
        mode: '人工确认',
      },
      alipay_qr: {
        label: '支付宝二维码',
        mode: '人工确认',
      },
      okx_usdt: {
        label: 'OKX USDT',
        mode: '链上 watcher',
      },
    },
    admin: {
      sidebar: {
        dashboard: '运营概览',
        products: '商品管理',
        orders: '订单中心',
        customers: '客户档案',
        settings: '系统设置',
        viewStore: '前台页面',
      },
      shell: {
        welcome: '运营控制台',
        logout: '退出登录',
        logoutTitle: '确认退出',
        logoutBody: '确定退出当前后台会话吗？',
      },
      login: {
        title: 'PassDock 后台',
        subtitle: '统一管理商品、订单、支付与履约。',
        panelTitle: '欢迎回来',
        panelLead: '登录后进入企业化运营后台。',
        accountLabel: '账号或邮箱',
        accountPlaceholder: '输入账号或邮箱',
        passwordLabel: '密码',
        passwordPlaceholder: '输入密码',
        remember: '保持登录',
        hint: '未接远程接口时可用任意非空账号登录；接入远程接口后请使用真实后台账号。',
        submit: '登录',
        loading: '登录中...',
        success: '登录成功',
        failure: '请输入账号和密码',
        features: [
          {
            title: '商品面板',
            description: '集中查看 SKU、价格、库存与支付配置。',
          },
          {
            title: '订单履约',
            description: '统一追踪支付状态、发码进度和交付路径。',
          },
          {
            title: '客户管理',
            description: '按客户、区域和消费层级快速定位记录。',
          },
          {
            title: '运营设置',
            description: '管理自动交付、人工复核和渠道开关。',
          },
        ],
      },
      dashboard: {
        title: '运营概览',
        subtitle: '交易、库存与支付状态集中呈现。',
        refresh: '刷新',
        export: '导出报表',
        cards: {
          revenue: '今日成交',
          paidOrders: '已支付订单',
          pendingFulfillment: '待履约',
          inventoryCoverage: '库存覆盖',
        },
        ordersTitle: '最近订单',
        stockTitle: '库存看板',
        reminderTitle: '履约提醒',
        reminderBody: '高客单价订单建议先人工复核，再执行自动发码。',
      },
      products: {
        title: '商品管理',
        subtitle: '查看在售 SKU、库存、周期与支付方式。',
      },
      orders: {
        title: '订单中心',
        subtitle: '追踪支付、履约和交付状态。',
      },
      customers: {
        title: '客户档案',
        subtitle: '按客户等级和区域查看交易活跃度。',
      },
      settings: {
        title: '系统设置',
        subtitle: '统一管理支付、集成、履约与运行参数。',
        paymentCard: '支付通道',
        deliveryCard: '履约策略',
        riskCard: '风控策略',
        paymentItems: ['微信二维码', '支付宝二维码', 'OKX USDT'],
        deliveryItems: ['站内卡密发放', 'Telegram 同步交付', '失败重试队列'],
        riskItems: ['高价订单人工复核', '库存阈值预警', '支付超时自动关闭'],
      },
      status: {
        online: '上架',
        stable: '稳定',
        autoDelivery: '自动交付',
        manualReview: '人工复核',
        paid: '已支付',
        pending: '待支付',
        delivering: '履约中',
        completed: '已完成',
        active: '活跃',
        vip: '重点客户',
      },
      table: {
        orderNo: '订单号',
        product: '商品',
        customer: '客户',
        amount: '金额',
        payment: '支付状态',
        delivery: '交付状态',
        channel: '来源',
        createdAt: '时间',
        sku: 'SKU',
        billing: '周期',
        methods: '支付方式',
        inventory: '库存',
        status: '状态',
        region: '区域',
        orders: '订单数',
        spend: '消费额',
        tier: '层级',
        lastOrder: '最近下单',
      },
    },
  },
  'en-US': {
    common: {
      brandName: 'PassDock',
      brandMeta: 'Commerce Center',
      confirm: 'Confirm',
      cancel: 'Cancel',
    },
    header: {
      navAriaLabel: 'Main navigation',
      home: 'Home',
      products: 'Products',
      orders: 'Orders',
      admin: 'Admin',
      language: 'Language',
      theme: 'Theme',
      light: 'Light',
      dark: 'Dark',
    },
    store: {
      bannerBadge: 'PASSDOCK COMMERCE',
      bannerTitle: 'Digital Product and Code Delivery Center',
      bannerLead: 'Storefront for recharge, subscription, and enterprise orders.',
      primaryAction: 'Browse Products',
      secondaryAction: 'Open Admin',
      noticeTitle: 'Purchase flow',
      noticeLead: 'Register on the main site, order here, then redeem there.',
      noticeSteps: ['Register', 'Purchase', 'Redeem'],
      noticePrimary: 'View products',
      noticeSecondary: 'Open admin',
      featuredEyebrow: 'Product Shelf',
      featuredTitle: 'Live products',
      featuredLead: 'Focus on SKU, billing, delivery, payment, and price.',
      viewAll: 'View all',
      buyNow: 'Buy now',
      stats: [
        { label: 'Live SKUs', value: '05' },
        { label: 'Payment rails', value: '04' },
        { label: 'Delivery paths', value: 'Web / TG' },
      ],
      specLabels: {
        billing: 'Billing',
        delivery: 'Delivery',
        payment: 'Payment',
        stock: 'Stock',
      },
    },
    checkout: {
      eyebrow: 'Order Preview',
      lead: 'Review SKU, payment, and fulfillment.',
      snapshotTitle: 'Product snapshot',
      paymentTitle: 'Payment channels',
      notesTitle: 'Delivery notes',
      flowTitle: 'Fulfillment flow',
      flowSteps: [
        { title: 'Create order', detail: 'Freeze SKU price, payment, and delivery.' },
        { title: 'Confirm payment', detail: 'Confirm via QR or watcher.' },
        { title: 'Fulfill order', detail: 'Issue codes and sync to web and Telegram.' },
      ],
      summaryLabels: {
        sku: 'SKU',
        billing: 'Billing',
        delivery: 'Delivery',
        stock: 'Stock',
        price: 'Price',
      },
      backToShop: 'Back to products',
    },
    notFound: {
      title: 'Page not mapped',
      body: 'This address has not been connected to a storefront or admin view yet.',
      cta: 'Back to product center',
    },
    paymentMethods: {
      wechat_qr: {
        label: 'WeChat QR',
        mode: 'Manual review',
      },
      alipay_qr: {
        label: 'Alipay QR',
        mode: 'Manual review',
      },
      okx_usdt: {
        label: 'OKX USDT',
        mode: 'On-chain watcher',
      },
    },
    admin: {
      sidebar: {
        dashboard: 'Dashboard',
        products: 'Products',
        orders: 'Orders',
        customers: 'Customers',
        settings: 'Settings',
        viewStore: 'Storefront',
      },
      shell: {
        welcome: 'Operations console',
        logout: 'Log out',
        logoutTitle: 'Sign out',
        logoutBody: 'Do you want to sign out of the current admin session?',
      },
      login: {
        title: 'PassDock Admin',
        subtitle: 'Manage products, orders, payments, and fulfillment in one place.',
        panelTitle: 'Welcome back',
        panelLead: 'Sign in to enter the enterprise operations workspace.',
        accountLabel: 'Account or email',
        accountPlaceholder: 'Enter account or email',
        passwordLabel: 'Password',
        passwordPlaceholder: 'Enter password',
        remember: 'Keep me signed in',
        hint: 'Without a remote API any non-empty credentials can enter preview mode; with a remote API use real admin credentials.',
        submit: 'Sign in',
        loading: 'Signing in...',
        success: 'Signed in successfully',
        failure: 'Please enter both account and password',
        features: [
          {
            title: 'Product board',
            description: 'Review SKUs, prices, stock, and payment configuration in one place.',
          },
          {
            title: 'Order fulfillment',
            description: 'Track payment state, code issuance, and delivery path together.',
          },
          {
            title: 'Customer records',
            description: 'Find accounts quickly by region, activity, and spend tier.',
          },
          {
            title: 'Ops controls',
            description: 'Centralize automation, review rules, and channel switches.',
          },
        ],
      },
      dashboard: {
        title: 'Operations overview',
        subtitle: 'Revenue, stock, and fulfillment state on one screen.',
        refresh: 'Refresh',
        export: 'Export',
        cards: {
          revenue: 'Revenue today',
          paidOrders: 'Paid orders',
          pendingFulfillment: 'Pending fulfillment',
          inventoryCoverage: 'Inventory coverage',
        },
        ordersTitle: 'Recent orders',
        stockTitle: 'Stock board',
        reminderTitle: 'Fulfillment reminder',
        reminderBody: 'Higher-ticket orders should pass manual review before automated delivery.',
      },
      products: {
        title: 'Product management',
        subtitle: 'Review live SKUs, inventory, billing cycles, and payment methods.',
      },
      orders: {
        title: 'Order center',
        subtitle: 'Track payment, fulfillment, and delivery state.',
      },
      customers: {
        title: 'Customer records',
        subtitle: 'Monitor activity by tier and region.',
      },
      settings: {
        title: 'System settings',
        subtitle: 'Manage payments, integrations, fulfillment, and runtime settings.',
        paymentCard: 'Payment channels',
        deliveryCard: 'Fulfillment strategy',
        riskCard: 'Risk controls',
        paymentItems: ['WeChat QR', 'Alipay QR', 'OKX USDT'],
        deliveryItems: ['Website code delivery', 'Telegram sync delivery', 'Failure retry queue'],
        riskItems: ['Manual review for high-value orders', 'Low stock alerting', 'Auto-close on payment timeout'],
      },
      status: {
        online: 'Live',
        stable: 'Stable',
        autoDelivery: 'Auto delivery',
        manualReview: 'Manual review',
        paid: 'Paid',
        pending: 'Pending',
        delivering: 'Delivering',
        completed: 'Completed',
        active: 'Active',
        vip: 'VIP',
      },
      table: {
        orderNo: 'Order no.',
        product: 'Product',
        customer: 'Customer',
        amount: 'Amount',
        payment: 'Payment status',
        delivery: 'Delivery status',
        channel: 'Channel',
        createdAt: 'Created at',
        sku: 'SKU',
        billing: 'Billing',
        methods: 'Payment methods',
        inventory: 'Inventory',
        status: 'Status',
        region: 'Region',
        orders: 'Orders',
        spend: 'Spend',
        tier: 'Tier',
        lastOrder: 'Last order',
      },
    },
  },
}
