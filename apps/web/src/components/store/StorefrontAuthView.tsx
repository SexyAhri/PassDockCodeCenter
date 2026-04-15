import {
  LockOutlined,
  MailOutlined,
  OrderedListOutlined,
  ProfileOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { App, Button, Checkbox, Form, Input, theme } from 'antd'
import { useState } from 'react'

import { BrandIdentity } from '../brand/BrandIdentity'
import type { Locale } from '../../i18n/copy'

type LoginValues = {
  email: string
  password: string
  remember: boolean
}

type RegisterValues = LoginValues & {
  displayName?: string
}

type StorefrontAuthViewProps = {
  locale: Locale
  mode: 'login' | 'register'
  onLogin: (values: LoginValues) => Promise<void> | void
  onRegister: (values: RegisterValues) => Promise<void> | void
  onSwitchMode: () => void
  onBackHome: () => void
}

export function StorefrontAuthView(props: StorefrontAuthViewProps) {
  const { locale, mode, onLogin, onRegister, onSwitchMode, onBackHome } = props
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm<LoginValues | RegisterValues>()
  const labels = getAuthLabels(locale, mode)
  const featureIcons = [
    <OrderedListOutlined key="orders" />,
    <SafetyCertificateOutlined key="delivery" />,
    <ProfileOutlined key="support" />,
  ]

  async function handleSubmit(values: LoginValues | RegisterValues) {
    if (!values.email.trim() || !values.password.trim()) {
      message.error(labels.failure)
      return
    }

    setLoading(true)

    try {
      if (mode === 'register') {
        await onRegister(values as RegisterValues)
      } else {
        await onLogin(values as LoginValues)
      }

      message.success(labels.success)
    } catch (error) {
      message.error(error instanceof Error ? error.message : labels.failure)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-showcase">
        <BrandIdentity name="PassDock" meta="Commerce Center" tone="inverse" className="auth-brand" />

        <div className="auth-showcase__copy">
          <span className="auth-showcase__eyebrow">{labels.eyebrow}</span>
          <h1>{labels.title}</h1>
          <p>{labels.subtitle}</p>
        </div>

        <div className="auth-feature-grid">
          {labels.features.map((feature, index) => (
            <div key={feature.title} className="auth-feature">
              <div className="auth-feature__icon">{featureIcons[index]}</div>
              <div>
                <strong>{feature.title}</strong>
                <p>{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="auth-copy">Copyright {new Date().getFullYear()} PassDock</div>
      </section>

      <section className="auth-panel" style={{ background: token.colorBgContainer }}>
        <div className="auth-panel__inner">
          <BrandIdentity name="PassDock" meta="Commerce Center" className="auth-panel__brand" />
          <h2>{labels.panelTitle}</h2>
          <p>{labels.panelLead}</p>

          <Form<LoginValues | RegisterValues>
            form={form}
            layout="vertical"
            size="large"
            initialValues={{ remember: true }}
            onFinish={handleSubmit}
          >
            {mode === 'register' ? (
              <Form.Item label={labels.displayNameLabel} name="displayName">
                <Input
                  prefix={<UserOutlined style={{ color: token.colorTextTertiary }} />}
                  placeholder={labels.displayNamePlaceholder}
                />
              </Form.Item>
            ) : null}

            <Form.Item
              label={labels.emailLabel}
              name="email"
              rules={[{ required: true, message: labels.failure }]}
            >
              <Input
                prefix={<MailOutlined style={{ color: token.colorTextTertiary }} />}
                placeholder={labels.emailPlaceholder}
              />
            </Form.Item>

            <Form.Item
              label={labels.passwordLabel}
              name="password"
              rules={[{ required: true, message: labels.failure }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: token.colorTextTertiary }} />}
                placeholder={labels.passwordPlaceholder}
              />
            </Form.Item>

            <Form.Item name="remember" valuePropName="checked" extra={labels.hint}>
              <Checkbox>{labels.remember}</Checkbox>
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" loading={loading} block>
                {loading ? labels.loading : labels.submit}
              </Button>
            </Form.Item>
          </Form>

          <div className="auth-panel__actions">
            <Button type="link" onClick={onSwitchMode}>
              {labels.switchMode}
            </Button>
            <Button type="link" onClick={onBackHome}>
              {labels.backHome}
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

function getAuthLabels(locale: Locale, mode: 'login' | 'register') {
  const isZh = locale === 'zh-CN'
  const isRegister = mode === 'register'

  return {
    eyebrow: isZh ? '用户中心' : 'Account access',
    title: isRegister
      ? isZh
        ? '注册 PassDock 账户'
        : 'Create your PassDock account'
      : isZh
        ? '登录 PassDock'
        : 'Sign in to PassDock',
    subtitle: isRegister
      ? isZh
        ? '注册后可以查看订单历史、提交售后工单，并让新订单自动归属到你的账户。'
        : 'Create an account to track orders, manage support, and bind future purchases.'
      : isZh
        ? '登录后可以进入账户中心，查看我的订单、付款凭证和支持记录。'
        : 'Sign in to access your order history, payment proofs, and support records.',
    panelTitle: isRegister
      ? isZh
        ? '开始创建账户'
        : 'Create account'
      : isZh
        ? '欢迎回来'
        : 'Welcome back',
    panelLead: isRegister
      ? isZh
        ? '账户会直接关联到前台下单和用户中心。'
        : 'Your account will be linked to storefront checkout and the account center.'
      : isZh
        ? '登录后即可进入完整的用户中心工作台。'
        : 'Sign in to enter the full customer workspace.',
    emailLabel: isZh ? '邮箱' : 'Email',
    emailPlaceholder: isZh ? '输入邮箱地址' : 'Enter your email',
    passwordLabel: isZh ? '密码' : 'Password',
    passwordPlaceholder: isZh ? '输入密码' : 'Enter your password',
    displayNameLabel: isZh ? '显示名称' : 'Display name',
    displayNamePlaceholder: isZh ? '可选，输入昵称或公司名' : 'Optional nickname or company name',
    remember: isZh ? '保持登录' : 'Keep me signed in',
    hint: isZh
      ? '接入远程接口后将使用真实账户体系；未接入时保留本地预览能力。'
      : 'With the remote API enabled this uses the real account system; otherwise it falls back to local preview.',
    submit: isRegister ? (isZh ? '注册并进入' : 'Create account') : isZh ? '登录' : 'Sign in',
    loading: isRegister ? (isZh ? '注册中...' : 'Creating...') : isZh ? '登录中...' : 'Signing in...',
    success: isRegister ? (isZh ? '注册成功' : 'Account created') : isZh ? '登录成功' : 'Signed in successfully',
    failure: isZh ? '请完整填写邮箱和密码' : 'Please enter both email and password',
    switchMode: isRegister
      ? isZh
        ? '已有账户？去登录'
        : 'Already have an account? Sign in'
      : isZh
        ? '没有账户？去注册'
        : 'Need an account? Register',
    backHome: isZh ? '返回首页' : 'Back to storefront',
    features: [
      {
        title: isZh ? '订单归档' : 'Order archive',
        description: isZh ? '查看历史订单、付款状态和交付结果。' : 'Track order history, payment status, and delivery results.',
      },
      {
        title: isZh ? '凭证留档' : 'Proof records',
        description: isZh ? '上传付款凭证后，会直接进入后台审核链路。' : 'Uploaded payment proofs flow directly into operator review.',
      },
      {
        title: isZh ? '售后协同' : 'Support workflow',
        description: isZh ? '统一管理订单工单和处理结果。' : 'Manage support tickets and resolution records in one place.',
      },
    ],
  }
}
