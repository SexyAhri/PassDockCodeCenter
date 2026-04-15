import { Button, Empty } from 'antd'

import type { AppCopy } from '../../i18n/copy'

type NotFoundPageProps = {
  copy: AppCopy
  onBack: () => void
}

export function NotFoundPage(props: NotFoundPageProps) {
  const { copy, onBack } = props

  return (
    <div className="not-found-page">
      <Empty description={copy.notFound.body}>
        <Button type="primary" onClick={onBack}>
          {copy.notFound.cta}
        </Button>
      </Empty>
    </div>
  )
}
