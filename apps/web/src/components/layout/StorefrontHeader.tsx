import {
  DashboardOutlined,
  MoonOutlined,
  OrderedListOutlined,
  ShoppingOutlined,
  SunOutlined,
} from '@ant-design/icons'
import { Button, Segmented, Space, Switch } from 'antd'

import { BrandIdentity } from '../brand/BrandIdentity'
import {
  localeOptions,
  type AppCopy,
  type Locale,
} from '../../i18n/copy'
import { useThemeMode } from '../../providers/themeMode'

type StorefrontHeaderProps = {
  copy: AppCopy
  locale: Locale
  setLocale: (locale: Locale) => void
  onNavigate: (to: string) => void
  adminEntryPath: string
}

export function StorefrontHeader(props: StorefrontHeaderProps) {
  const { copy, locale, setLocale, onNavigate, adminEntryPath } = props
  const { themeMode, setThemeMode } = useThemeMode()

  return (
    <header className="store-header">
      <div className="store-topbar">
        <button type="button" className="store-brand" onClick={() => onNavigate('/')}>
          <BrandIdentity name={copy.common.brandName} meta={copy.common.brandMeta} />
        </button>

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

          <Button icon={<ShoppingOutlined />} onClick={() => onNavigate('/shop')}>
            {copy.header.products}
          </Button>
          <Button icon={<OrderedListOutlined />} onClick={() => onNavigate('/orders')}>
            {copy.header.orders}
          </Button>
          <Button type="primary" icon={<DashboardOutlined />} onClick={() => onNavigate(adminEntryPath)}>
            {copy.header.admin}
          </Button>
        </Space>
      </div>
    </header>
  )
}
