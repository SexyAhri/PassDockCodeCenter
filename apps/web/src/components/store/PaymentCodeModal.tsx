import { Modal, QRCode, Spin } from 'antd'
import type { ReactNode } from 'react'

type PaymentCodeModalProps = {
  open: boolean
  title: string
  mode: string
  reference: string
  qrValue: string
  loading?: boolean
  details?: Array<{ key: string; label: string; value: string }>
  footer?: ReactNode
  onClose: () => void
}

export function PaymentCodeModal(props: PaymentCodeModalProps) {
  const {
    open,
    title,
    mode,
    reference,
    qrValue,
    loading = false,
    details = [],
    footer,
    onClose,
  } = props
  const imageMode = isImageSource(qrValue)

  return (
    <Modal
      centered
      open={open}
      title={title}
      footer={null}
      width={420}
      onCancel={onClose}
      className="payment-code-modal"
    >
      <div className="payment-code-modal__body">
        <div className="payment-code-modal__qr">
          {loading ? (
            <Spin />
          ) : imageMode ? (
            <img className="payment-code-modal__image" src={qrValue} alt={title} />
          ) : (
            <QRCode bordered={false} size={220} value={qrValue} />
          )}
        </div>

        <div className="payment-code-modal__meta">
          <strong>{mode}</strong>
          <code>{reference}</code>
        </div>

        {details.length ? (
          <div className="payment-code-modal__details">
            {details.map((item) => (
              <div key={item.key} className="payment-code-modal__detail">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        ) : null}

        {footer ? <div className="payment-code-modal__footer">{footer}</div> : null}
      </div>
    </Modal>
  )
}

function isImageSource(value: string) {
  const normalizedValue = value.trim().toLowerCase()

  if (!normalizedValue) {
    return false
  }

  if (
    normalizedValue.startsWith('data:image/') ||
    normalizedValue.startsWith('blob:')
  ) {
    return true
  }

  return /\.(png|jpe?g|webp)(\?.*)?$/.test(normalizedValue)
}
