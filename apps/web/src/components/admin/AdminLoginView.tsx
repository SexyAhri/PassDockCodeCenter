import {
  AppstoreOutlined,
  CreditCardOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { App, Button, Checkbox, Form, Input, theme } from 'antd'
import { useState } from 'react'

import { BrandIdentity } from '../brand/BrandIdentity'
import type { AppCopy } from '../../i18n/copy'

type LoginValues = {
  email: string
  password: string
  remember: boolean
}

type AdminLoginViewProps = {
  copy: AppCopy
  onLogin: (values: LoginValues) => Promise<void> | void
}

export function AdminLoginView(props: AdminLoginViewProps) {
  const { copy, onLogin } = props
  const { token } = theme.useToken()
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)

  const featureIcons = [
    <AppstoreOutlined key="product" />,
    <CreditCardOutlined key="order" />,
    <SafetyCertificateOutlined key="customer" />,
    <SettingOutlined key="setting" />,
  ]

  async function handleSubmit(values: LoginValues) {
    if (!values.email.trim() || !values.password.trim()) {
      message.error(copy.admin.login.failure)
      return
    }

    setLoading(true)

    try {
      await onLogin(values)
      message.success(copy.admin.login.success)
    } catch (error) {
      message.error(error instanceof Error ? error.message : copy.admin.login.failure)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-showcase">
        <BrandIdentity
          name={copy.common.brandName}
          meta={copy.common.brandMeta}
          tone="inverse"
          className="auth-brand"
        />

        <div className="auth-showcase__copy">
          <span className="auth-showcase__eyebrow">{copy.admin.shell.welcome}</span>
          <h1>{copy.admin.login.title}</h1>
          <p>{copy.admin.login.subtitle}</p>
        </div>

        <div className="auth-feature-grid">
          {copy.admin.login.features.map((feature, index) => (
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
          <BrandIdentity
            name={copy.common.brandName}
            meta={copy.common.brandMeta}
            className="auth-panel__brand"
          />
          <h2>{copy.admin.login.panelTitle}</h2>
          <p>{copy.admin.login.panelLead}</p>

          <Form<LoginValues>
            layout="vertical"
            size="large"
            initialValues={{ remember: true }}
            onFinish={handleSubmit}
          >
            <Form.Item
              label={copy.admin.login.accountLabel}
              name="email"
              rules={[{ required: true, message: copy.admin.login.failure }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: token.colorTextTertiary }} />}
                placeholder={copy.admin.login.accountPlaceholder}
              />
            </Form.Item>

            <Form.Item
              label={copy.admin.login.passwordLabel}
              name="password"
              rules={[{ required: true, message: copy.admin.login.failure }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: token.colorTextTertiary }} />}
                placeholder={copy.admin.login.passwordPlaceholder}
              />
            </Form.Item>

            <Form.Item
              name="remember"
              valuePropName="checked"
              extra={copy.admin.login.hint}
            >
              <Checkbox>{copy.admin.login.remember}</Checkbox>
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" loading={loading} block>
                {loading ? copy.admin.login.loading : copy.admin.login.submit}
              </Button>
            </Form.Item>
          </Form>
        </div>
      </section>
    </div>
  )
}
