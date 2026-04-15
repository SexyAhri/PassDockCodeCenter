import {
  LogoutOutlined,
  MoonOutlined,
  SunOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { App, Avatar, Breadcrumb, Dropdown, Segmented, Space, Switch, theme } from 'antd'
import type { MenuProps } from 'antd'

import { getAdminBreadcrumbs } from '../../admin/navigation'
import type { AdminSession } from '../../hooks/useAdminSession'
import {
  localeOptions,
  type AppCopy,
  type Locale,
} from '../../i18n/copy'
import { useThemeMode } from '../../providers/themeMode'

const adminAvatarUrl = '/favicon.png'

type AdminHeaderProps = {
  copy: AppCopy
  pathname: string
  locale: Locale
  setLocale: (locale: Locale) => void
  session: AdminSession
  onNavigate: (to: string) => void
  onLogout: () => void
}

export function AdminHeader(props: AdminHeaderProps) {
  const { copy, pathname, locale, setLocale, session, onNavigate, onLogout } = props
  const { token } = theme.useToken()
  const { themeMode, setThemeMode } = useThemeMode()
  const { modal } = App.useApp()

  const userMenu: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: session.email,
      disabled: true,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: copy.admin.shell.logout,
    },
  ]

  return (
    <header className="admin-header" style={{ background: token.colorBgContainer }}>
      <div className="admin-header__start">
        <Breadcrumb
          items={getAdminBreadcrumbs(copy, locale, pathname).map((item, index, items) => ({
            title:
              index < items.length - 1 ? (
                <button
                  type="button"
                  className="header-link-button"
                  onClick={() => onNavigate(item.path)}
                >
                  {item.label}
                </button>
              ) : (
                item.label
              ),
          }))}
        />
      </div>

      <Space size="middle">
        <Segmented
          value={locale}
          options={localeOptions.map((option) => ({
            label: option.shortLabel,
            value: option.value,
          }))}
          onChange={(value) => setLocale(value as Locale)}
        />

        <Switch
          checked={themeMode === 'dark'}
          checkedChildren={<MoonOutlined />}
          unCheckedChildren={<SunOutlined />}
          onChange={(checked) => setThemeMode(checked ? 'dark' : 'light')}
        />

        <Dropdown
          menu={{
            items: userMenu,
            onClick: ({ key }) => {
              if (key === 'logout') {
                modal.confirm({
                  title: copy.admin.shell.logoutTitle,
                  content: copy.admin.shell.logoutBody,
                  okText: copy.common.confirm,
                  cancelText: copy.common.cancel,
                  onOk: onLogout,
                })
              }
            },
          }}
          placement="bottomRight"
        >
          <Space style={{ cursor: 'pointer' }}>
            <Avatar
              src={adminAvatarUrl}
              className="admin-header__avatar"
              style={{ backgroundColor: token.colorPrimary }}
            >
              {session.name.charAt(0).toUpperCase() || 'P'}
            </Avatar>
            <span>{session.name}</span>
          </Space>
        </Dropdown>
      </Space>
    </header>
  )
}
