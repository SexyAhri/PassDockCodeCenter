import { useState } from 'react'

import type { StorefrontPaymentProof } from '../../api/storefrontOrders'
import type { Locale } from '../../i18n/copy'
import { formatStorefrontDateTime } from '../../storefront/orders/presentation'
import { extractFileName } from '../common/filePreview'
import { CheckoutCompactList } from './CheckoutCompactList'
import { StorefrontFilePreviewModal } from './StorefrontFilePreviewModal'

type StorefrontPaymentProofListProps = {
  locale: Locale
  proofs: StorefrontPaymentProof[]
  subtle?: boolean
}

export function StorefrontPaymentProofList(props: StorefrontPaymentProofListProps) {
  const { locale, proofs, subtle = false } = props
  const labels = getLabels(locale)
  const [selectedProofKey, setSelectedProofKey] = useState<string | null>(null)
  const selectedProof =
    proofs.find((proof, index) => buildProofKey(proof, index) === selectedProofKey) ?? null

  return (
    <>
      <CheckoutCompactList
        subtle={subtle}
        items={proofs.map((proof, index) => {
          const proofKey = buildProofKey(proof, index)

          return {
            id: proofKey,
            title: getProofTitle(proof, labels.untitledProof),
            meta: buildProofMeta(proof, locale),
            action: proof.objectUrl.trim() ? () => setSelectedProofKey(proofKey) : undefined,
            active: proofKey === selectedProofKey,
            aside: (
              <span className="checkout-compact-list__badge">
                {formatProofStatus(proof.reviewStatus, locale)}
              </span>
            ),
          }
        })}
      />

      <StorefrontFilePreviewModal
        open={Boolean(selectedProof)}
        locale={locale}
        title={selectedProof ? getProofTitle(selectedProof, labels.untitledProof) : labels.previewTitle}
        previewUrl={selectedProof?.objectUrl}
        fileName={selectedProof?.objectKey}
        onClose={() => setSelectedProofKey(null)}
      />
    </>
  )
}

function buildProofKey(proof: StorefrontPaymentProof, index: number) {
  return `${proof.objectUrl}|${proof.objectKey}|${proof.createdAt}|${index}`
}

function getProofTitle(proof: StorefrontPaymentProof, fallback: string) {
  const note = proof.note.trim()
  if (note) {
    return note
  }

  return extractFileName(proof.objectKey) || extractFileName(proof.objectUrl) || fallback
}

function buildProofMeta(proof: StorefrontPaymentProof, locale: Locale) {
  const timestamp = proof.reviewedAt || proof.createdAt
  return timestamp ? formatStorefrontDateTime(timestamp, locale) : undefined
}

function getLabels(locale: Locale) {
  if (locale === 'zh-CN') {
    return {
      untitledProof: '支付凭证',
      previewTitle: '凭证预览',
    }
  }

  return {
    untitledProof: 'Payment proof',
    previewTitle: 'Proof preview',
  }
}

function formatProofStatus(value: string, locale: Locale) {
  switch ((value ?? '').trim().toLowerCase()) {
    case 'approved':
      return locale === 'zh-CN' ? '已通过' : 'Approved'
    case 'rejected':
      return locale === 'zh-CN' ? '已驳回' : 'Rejected'
    default:
      return locale === 'zh-CN' ? '待审核' : 'Pending review'
  }
}
