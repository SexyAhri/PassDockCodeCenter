import { Alert, Drawer, Empty, Spin } from 'antd'
import type { ReactNode } from 'react'

import { resolveFilePreviewKind } from '../common/filePreview'

type AdminFilePreviewDrawerProps = {
  open: boolean
  title: string
  loading?: boolean
  error?: string | null
  previewUrl?: string | null
  contentType?: string
  emptyText?: string
  unsupportedText?: string
  extra?: ReactNode
  onClose: () => void
}

export function AdminFilePreviewDrawer(props: AdminFilePreviewDrawerProps) {
  const {
    open,
    title,
    loading = false,
    error,
    previewUrl,
    contentType = '',
    emptyText = 'No preview available.',
    unsupportedText = 'Preview is not available for this file type.',
    extra,
    onClose,
  } = props
  const previewKind = resolveFilePreviewKind({ contentType, previewUrl })

  return (
    <Drawer
      open={open}
      title={title}
      width={920}
      destroyOnClose
      className="admin-file-preview-drawer"
      extra={extra}
      onClose={onClose}
    >
      <div className="admin-file-preview-drawer__content">
        {error ? <Alert showIcon type="warning" message={error} /> : null}

        {loading ? (
          <div className="admin-file-preview-drawer__loading">
            <Spin />
          </div>
        ) : null}

        {!loading && !previewUrl ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
        ) : null}

        {!loading && previewUrl && previewKind === 'image' ? (
          <div className="admin-file-preview-drawer__stage">
            <img className="admin-file-preview-drawer__image" src={previewUrl} alt={title} />
          </div>
        ) : null}

        {!loading && previewUrl && previewKind === 'pdf' ? (
          <div className="admin-file-preview-drawer__stage admin-file-preview-drawer__stage--document">
            <iframe className="admin-file-preview-drawer__frame" src={previewUrl} title={title} />
          </div>
        ) : null}

        {!loading && previewUrl && previewKind === 'other' ? (
          <Alert showIcon type="info" message={unsupportedText} />
        ) : null}
      </div>
    </Drawer>
  )
}
