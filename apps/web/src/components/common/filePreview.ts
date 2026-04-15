export type FilePreviewKind = 'image' | 'pdf' | 'other'

type ResolveFilePreviewKindInput = {
  contentType?: string
  previewUrl?: string | null
  fileName?: string
}

export function resolveFilePreviewKind(input: ResolveFilePreviewKindInput) {
  const normalizedType = String(input.contentType ?? '').trim().toLowerCase()
  const normalizedUrl = String(input.previewUrl ?? '').trim().toLowerCase()
  const normalizedFileName = String(input.fileName ?? '').trim().toLowerCase()

  if (normalizedType.startsWith('image/')) {
    return 'image' satisfies FilePreviewKind
  }

  if (normalizedType.includes('pdf')) {
    return 'pdf' satisfies FilePreviewKind
  }

  if (
    /\.(png|jpe?g|gif|webp|bmp|svg)(?:$|\?)/.test(normalizedUrl) ||
    /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(normalizedFileName)
  ) {
    return 'image' satisfies FilePreviewKind
  }

  if (/\.pdf(?:$|\?)/.test(normalizedUrl) || /\.pdf$/i.test(normalizedFileName)) {
    return 'pdf' satisfies FilePreviewKind
  }

  return 'other' satisfies FilePreviewKind
}

export function extractFileName(value: string | null | undefined) {
  const source = String(value ?? '').trim()
  if (!source) {
    return ''
  }

  const normalizedSource = source.replace(/[?#].*$/, '')
  const segments = normalizedSource.split(/[\\/]/).filter(Boolean)
  const fileName = segments.at(-1) ?? normalizedSource

  try {
    return decodeURIComponent(fileName).trim()
  } catch {
    return fileName.trim()
  }
}
