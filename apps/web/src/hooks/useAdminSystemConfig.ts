import { useEffect, useRef, useState } from 'react'

import { createAdminAuditLog } from '../admin/audit'
import type { AdminSystemDraft } from '../admin/system/types'
import { loadAdminSystemRemoteDraft } from '../api/adminSystem'
import { isRemoteApiEnabled } from '../api/config'
import {
  getAuditLogs,
  getDeliveryStrategies,
  getFulfillmentStrategies,
  getInternalClientKeys,
  getIntegrationActions,
  getIntegrationProviders,
  getRuntimeSettings,
  getTelegramConfigs,
} from '../data/admin'
import { getPaymentChannels } from '../data/paymentChannels'
import { usePersistentState } from './usePersistentState'

export { createAdminAuditLog }

const adminSystemStorageKey = 'passdock.admin.system-config.v1'

export type AdminDraftSource = 'local' | 'remote' | 'local-fallback' | 'remote-error'

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function getInitialAdminSystemDraft(): AdminSystemDraft {
  const zhPaymentChannels = getPaymentChannels('zh-CN')
  const enPaymentChannelMap = Object.fromEntries(
    getPaymentChannels('en-US').map((channel) => [channel.channelKey, channel]),
  )

  return {
    paymentChannels: zhPaymentChannels.map((channel) => ({
      key: channel.key,
      channelKey: channel.channelKey,
      channelName: enPaymentChannelMap[channel.channelKey]?.label ?? channel.label,
      displayNameZh: channel.label,
      displayNameEn: enPaymentChannelMap[channel.channelKey]?.label ?? channel.label,
      modeLabelZh: channel.mode,
      modeLabelEn: enPaymentChannelMap[channel.channelKey]?.mode ?? channel.mode,
      channelType: channel.channelType,
      providerName: channel.providerName,
      currency: channel.currency,
      settlementMode: channel.settlementMode,
      enabled: channel.enabled,
      qrValue: channel.qrValue,
      reference: channel.reference,
      autoFulfill: Boolean(channel.autoFulfill),
      autoDeliver: Boolean(channel.autoDeliver),
      callbackAuthType: 'none',
      callbackSecret: '',
      callbackSecretMasked: '',
      callbackKey: '',
      callbackHeaderName: '',
      callbackSignHeader: '',
      callbackTimestampHeader: '',
      callbackNonceHeader: '',
      callbackSignatureParam: '',
      callbackTimestampParam: '',
      callbackNonceParam: '',
      callbackTTLSeconds: 300,
      callbackSignSource: 'body',
      refundProviderKey: '',
      refundActionKey: '',
      refundStatusPath: '',
      refundReceiptPath: '',
    })),
    providers: cloneValue(getIntegrationProviders()),
    actions: cloneValue(getIntegrationActions()),
    fulfillmentStrategies: cloneValue(getFulfillmentStrategies()),
    deliveryStrategies: cloneValue(getDeliveryStrategies()),
    telegramConfigs: cloneValue(getTelegramConfigs()),
    internalClientKeys: cloneValue(getInternalClientKeys()),
    runtimeSettings: cloneValue(getRuntimeSettings('en-US')),
    auditLogs: cloneValue(getAuditLogs()),
  }
}

function getEmptyAdminSystemDraft(): AdminSystemDraft {
  return {
    paymentChannels: [],
    providers: [],
    actions: [],
    fulfillmentStrategies: [],
    deliveryStrategies: [],
    telegramConfigs: [],
    internalClientKeys: [],
    runtimeSettings: [],
    auditLogs: [],
  }
}

const initialAdminSystemDraftSignature = JSON.stringify(getInitialAdminSystemDraft())

function isSeededAdminSystemDraft(value: AdminSystemDraft) {
  return JSON.stringify(value) === initialAdminSystemDraftSignature
}

export function useAdminSystemConfig() {
  const remoteEnabled = isRemoteApiEnabled()
  const [draft, setDraft] = usePersistentState(
    adminSystemStorageKey,
    () => (remoteEnabled ? getEmptyAdminSystemDraft() : getInitialAdminSystemDraft()),
    {
      shouldUseStoredValue: (value) => !remoteEnabled || !isSeededAdminSystemDraft(value),
    },
  )
  const [loading, setLoading] = useState(remoteEnabled)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<AdminDraftSource>(() =>
    remoteEnabled ? 'remote' : 'local',
  )
  const hydratedRef = useRef(false)
  const hydrateRemoteDraftRef = useRef<(mode: 'reload' | 'reset') => Promise<void>>(async () => undefined)

  hydrateRemoteDraftRef.current = hydrateRemoteDraft

  useEffect(() => {
    if (!remoteEnabled) {
      setSource('local')
      setError(null)
      setLoading(false)
      return
    }

    if (hydratedRef.current) {
      return
    }

    hydratedRef.current = true
    void hydrateRemoteDraftRef.current('reload').catch(() => undefined)
  }, [remoteEnabled])

  async function hydrateRemoteDraft(mode: 'reload' | 'reset') {
    if (!remoteEnabled) {
      const nextDraft = getInitialAdminSystemDraft()

      if (mode === 'reset') {
        setDraft(nextDraft)
      }

      setSource('local')
      setError(null)
      return
    }

    setLoading(true)
    setSource('remote')

    try {
      const baseDraft = mode === 'reset' ? getEmptyAdminSystemDraft() : draft
      const remoteDraft = await loadAdminSystemRemoteDraft()

      setDraft(mergeRemoteSystemDraft(baseDraft, remoteDraft))
      setSource('remote')
      setError(null)
    } catch (nextError) {
      if (mode === 'reset') {
        setDraft(getEmptyAdminSystemDraft())
      }

      setSource('remote-error')
      setError(getErrorMessage(nextError))
      throw nextError
    } finally {
      setLoading(false)
    }
  }

  return {
    draft,
    setDraft,
    loading,
    error,
    source,
    remoteEnabled,
    reload: () => hydrateRemoteDraft('reload'),
    resetDraft: () => (remoteEnabled ? hydrateRemoteDraft('reset') : Promise.resolve(setDraft(getInitialAdminSystemDraft()))),
  }
}

function mergeRemoteSystemDraft(baseDraft: AdminSystemDraft, remoteDraft: AdminSystemDraft): AdminSystemDraft {
  return {
    ...baseDraft,
    paymentChannels: remoteDraft.paymentChannels,
    providers: remoteDraft.providers,
    actions: remoteDraft.actions,
    fulfillmentStrategies: remoteDraft.fulfillmentStrategies,
    deliveryStrategies: remoteDraft.deliveryStrategies,
    telegramConfigs: remoteDraft.telegramConfigs,
    internalClientKeys: remoteDraft.internalClientKeys,
    runtimeSettings: remoteDraft.runtimeSettings,
    auditLogs: remoteDraft.auditLogs,
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Failed to load remote system configuration.'
}
