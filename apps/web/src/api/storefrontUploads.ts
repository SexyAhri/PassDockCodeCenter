import { requestFormData } from './http'

export type UploadedStorefrontObject = {
  objectKey: string
  objectUrl: string
  contentType: string
  originalName: string
  size: number
}

type UploadedStorefrontObjectDto = {
  object_key?: string
  object_url?: string
  content_type?: string
  original_name?: string
  size?: number | string
}

export async function uploadStorefrontPaymentProofAsset(
  file: File,
  orderNo: string,
  orderAccessToken?: string,
) {
  const formData = new FormData()
  formData.set('file', file)
  formData.set('order_no', orderNo)

  const payload = await requestFormData<UploadedStorefrontObjectDto>('/api/v1/uploads/payment-proofs', {
    method: 'POST',
    includeAdminAuth: false,
    headers: orderAccessToken
      ? {
          'X-PassDock-Order-Token': orderAccessToken,
        }
      : undefined,
    body: formData,
  })

  return {
    objectKey: String(payload.object_key ?? ''),
    objectUrl: String(payload.object_url ?? ''),
    contentType: String(payload.content_type ?? file.type ?? ''),
    originalName: String(payload.original_name ?? file.name ?? ''),
    size: Number(payload.size ?? file.size ?? 0),
  } satisfies UploadedStorefrontObject
}
