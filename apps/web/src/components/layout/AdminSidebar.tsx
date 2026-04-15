import { Layout, Menu } from 'antd'

import { getAdminMenuItems, getSelectedAdminKey } from '../../admin/navigation'
import type { AppCopy, Locale } from '../../i18n/copy'
import { BrandIdentity } from '../brand/BrandIdentity'

const { Sider } = Layout

type AdminSidebarProps = {
  copy: AppCopy
  pathname: string
  locale: Locale
  onNavigate: (to: string) => void
}

export function AdminSidebar(props: AdminSidebarProps) {
  const { copy, pathname, locale, onNavigate } = props

  return (
    <Sider width={248} theme="dark" breakpoint="lg" collapsedWidth={80} className="admin-sider">
      <div className="admin-sider__brand">
        <BrandIdentity
          name={copy.common.brandName}
          meta={copy.common.brandMeta}
          tone="inverse"
        />
      </div>

      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[getSelectedAdminKey(pathname)]}
        items={getAdminMenuItems(copy, locale)}
        onClick={({ key }) => onNavigate(String(key))}
        style={{ background: 'transparent', borderRight: 0, paddingTop: 8 }}
      />
    </Sider>
  )
}
