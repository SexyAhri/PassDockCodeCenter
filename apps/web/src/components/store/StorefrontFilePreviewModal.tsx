import { Alert, Button, Empty, Modal } from 'antd'

import type { Locale } from '../../i18n/copy'
import { resolveFilePreviewKind } from '../common/filePreview'

type StorefrontFilePreviewModalProps = {
  open: boolean
  locale: Locale
  title: string
  previewUrl?: string | null
  fileName?: string
  onClose: () => void
}

export function StorefrontFilePreviewModal(props: StorefrontFilePreviewModalProps) {
  const { open, locale, title, previewUrl, fileName, onClose } = props
  const labels = getLabels(locale)
  const previewKind = resolveFilePreviewKind({ previewUrl, fileName })

  return (
    <Modal
      open={open}
      title={title || labels.title}
      width={960}
      centered
      destroyOnClose
      className="storefront-file-preview-modal"
      footer={[
        previewUrl ? (
          <Button
            key="open"
            onClick={() => {
              window.open(previewUrl, '_blank', 'noopener,noreferrer')
            }}
          >
            {labels.openInNewTab}
          </Button>
        ) : null,
        <Button key="close" type="primary" onClick={onClose}>
          {labels.close}
        </Button>,
      ]}
      onCancel={onClose}
    >
      <div className="storefront-file-preview-modal__content">
        {!previewUrl ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={labels.emptyText} />
        ) : null}

        {previewUrl && previewKind === 'image' ? (
          <div className="storefront-file-preview-modal__stage">
            <img className="storefront-file-preview-modal__image" src={previewUrl} alt={title} />
          </div>
        ) : null}

        {previewUrl && previewKind === 'pdf' ? (
          <div className="storefront-file-preview-modal__stage storefront-file-preview-modal__stage--document">
            <iframe className="storefront-file-preview-modal__frame" src={previewUrl} title={title} />
          </div>
        ) : null}

        {previewUrl && previewKind === 'other' ? (
          <Alert showIcon type="info" message={labels.unsupportedText} />
        ) : null}
      </div>
    </Modal>
  )
}

function getLabels(locale: Locale) {
  if (locale === 'zh-CN') {
    return {
      title: '凭证预览',
      openInNewTab: '新标签打开',
      close: '关闭',
      emptyText: '当前没有可预览的凭证文件。',
      unsupportedText: '当前文件类型不支持内嵌预览，请使用新标签打开。',
    }
  }

  return {
    title: 'Proof preview',
    openInNewTab: 'Open in new tab',
    close: 'Close',
    emptyText: 'No preview file is available.',
    unsupportedText: 'This file type cannot be previewed inline. Open it in a new tab instead.',
  }
}
