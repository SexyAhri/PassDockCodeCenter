import { BrandIdentity } from '../brand/BrandIdentity'
import type { AppCopy } from '../../i18n/copy'

type StorefrontFooterProps = {
  copy: AppCopy
}

export function StorefrontFooter(props: StorefrontFooterProps) {
  const { copy } = props

  return (
    <footer className="store-footer">
      <div className="store-footer__inner">
        <BrandIdentity name={copy.common.brandName} meta={copy.common.brandMeta} />
        <span className="store-footer__copyright">
          Copyright {new Date().getFullYear()} {copy.common.brandName}
        </span>
      </div>
    </footer>
  )
}
