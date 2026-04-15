import { InboxOutlined, UploadOutlined } from '@ant-design/icons'
import { Button, Form, Input, Upload } from 'antd'
import { useState } from 'react'

import type { StorefrontPaymentProof, UploadPaymentProofInput } from '../../api/storefrontOrders'
import type { Locale } from '../../i18n/copy'
import { CheckoutSection } from './CheckoutSection'
import { StorefrontPaymentProofList } from './StorefrontPaymentProofList'

type PaymentProofFormProps = {
  locale: Locale
  loading?: boolean
  proofs?: StorefrontPaymentProof[]
  onSubmit: (values: UploadPaymentProofInput) => Promise<void> | void
}

export function PaymentProofForm(props: PaymentProofFormProps) {
  const { locale, loading = false, proofs = [], onSubmit } = props
  const [form] = Form.useForm<UploadPaymentProofInput>()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const labels = getLabels(locale)

  return (
    <CheckoutSection title={labels.title}>
      <Form
        form={form}
        layout="vertical"
        size="small"
        className="checkout-form"
        onFinish={async (values) => {
          if (!selectedFile) {
            form.setFields([{ name: 'file', errors: [labels.fileRequired] }])
            return
          }

          await onSubmit({
            ...values,
            file: selectedFile,
          })
          form.resetFields()
          setSelectedFile(null)
        }}
      >
        <Form.Item label={labels.uploader} name="file" rules={[{ validator: async () => undefined }]}>
          <Upload.Dragger
            accept=".png,.jpg,.jpeg,.webp,.pdf"
            maxCount={1}
            multiple={false}
            beforeUpload={(file) => {
              setSelectedFile(file)
              form.setFields([{ name: 'file', errors: [] }])
              return false
            }}
            onRemove={() => {
              setSelectedFile(null)
              return true
            }}
            fileList={selectedFile ? [{ uid: 'payment-proof', name: selectedFile.name, status: 'done' }] : []}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">{labels.selectFile}</p>
            <p className="ant-upload-hint">{labels.uploaderHint}</p>
          </Upload.Dragger>
        </Form.Item>

        <Form.Item name="note" label={labels.note}>
          <Input.TextArea rows={3} placeholder={labels.notePlaceholder} />
        </Form.Item>

        <div className="checkout-form__actions">
          <Button type="primary" htmlType="submit" loading={loading} icon={<UploadOutlined />}>
            {labels.submit}
          </Button>
        </div>
      </Form>

      {proofs.length ? (
        <div className="checkout-form__history">
          <div className="checkout-form__history-title">{labels.proofList}</div>
          <StorefrontPaymentProofList locale={locale} proofs={proofs} subtle />
        </div>
      ) : null}
    </CheckoutSection>
  )
}

function getLabels(locale: Locale) {
  if (locale === 'zh-CN') {
    return {
      title: '付款凭证',
      uploader: '上传文件',
      uploaderHint: '支持 PNG、JPG、WEBP、PDF，提交后会进入后台审核。',
      note: '备注',
      notePlaceholder: '例如：付款尾号、链上转账说明',
      submit: '提交凭证',
      fileRequired: '请选择付款凭证文件',
      proofList: '已提交记录',
      selectFile: '选择文件或拖拽到这里',
    }
  }

  return {
    title: 'Payment proof',
    uploader: 'Upload file',
    uploaderHint: 'PNG, JPG, WEBP, and PDF are supported and will enter operator review.',
    note: 'Note',
    notePlaceholder: 'For example: payer note or on-chain transfer memo',
    submit: 'Submit proof',
    fileRequired: 'Please select a proof file',
    proofList: 'Submitted proofs',
    selectFile: 'Select or drag a file here',
  }
}
