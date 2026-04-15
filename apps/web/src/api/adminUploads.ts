import { isRemoteApiEnabled } from './config'
import { requestFormData } from './http'

type UploadedAdminObjectDto = {
  object_key?: string
  object_url?: string
  content_type?: string
  original_name?: string
  size?: number | string
}

export async function uploadAdminPaymentChannelAsset(file: File) {
  if (!isRemoteApiEnabled()) {
    return {
      objectKey: '',
      objectUrl: await readFileAsDataUrl(file),
      contentType: String(file.type ?? ''),
      originalName: String(file.name ?? ''),
      size: Number(file.size ?? 0),
    }
  }

  const formData = new FormData()
  formData.set('file', file)

  const payload = await requestFormData<UploadedAdminObjectDto>(
    '/api/v1/admin/uploads/payment-channel-assets',
    {
      method: 'POST',
      body: formData,
    },
  )

  return {
    objectKey: String(payload.object_key ?? ''),
    objectUrl: String(payload.object_url ?? ''),
    contentType: String(payload.content_type ?? file.type ?? ''),
    originalName: String(payload.original_name ?? file.name ?? ''),
    size: Number(payload.size ?? file.size ?? 0),
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}
