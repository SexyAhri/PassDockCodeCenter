import type { AdminDraftSource } from '../hooks/useAdminSystemConfig'

export function combineAdminSources(...sources: AdminDraftSource[]): AdminDraftSource {
  if (sources.length === 0) {
    return 'local'
  }

  if (sources.every((source) => source === 'remote-error')) {
    return 'remote-error'
  }

  if (sources.every((source) => source === 'remote')) {
    return 'remote'
  }

  if (sources.every((source) => source === 'local')) {
    return 'local'
  }

  if (sources.includes('local-fallback')) {
    return 'local-fallback'
  }

  if (sources.includes('remote-error') && !sources.includes('local')) {
    return 'remote-error'
  }

  return 'local-fallback'
}

export function canMutateLocalAdminDraft(source: AdminDraftSource, remoteEnabled: boolean) {
  return !remoteEnabled && source === 'local'
}

export function getAdminSourceTagColor(source: AdminDraftSource, remoteEnabled = true) {
  if (!remoteEnabled && source === 'local') {
    return undefined
  }

  if (source === 'remote') {
    return 'blue'
  }

  if (source === 'local-fallback') {
    return 'gold'
  }

  if (source === 'remote-error') {
    return 'volcano'
  }

  return undefined
}
