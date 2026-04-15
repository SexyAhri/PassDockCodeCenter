export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')
export const localDemoMode = String(import.meta.env.VITE_LOCAL_DEMO_MODE ?? '')
  .trim()
  .toLowerCase() === 'true'

export const apiConfig = {
  baseUrl: apiBaseUrl,
  adminBearerToken: (import.meta.env.VITE_ADMIN_BEARER_TOKEN ?? '').trim(),
  localDemoMode,
}

export function isRemoteApiEnabled() {
  return !apiConfig.localDemoMode
}

export function buildApiUrl(path: string) {
  if (!isRemoteApiEnabled()) {
    throw new Error('Remote API is not configured')
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (!apiConfig.baseUrl) {
    return normalizedPath
  }

  return `${apiConfig.baseUrl}${normalizedPath}`
}
