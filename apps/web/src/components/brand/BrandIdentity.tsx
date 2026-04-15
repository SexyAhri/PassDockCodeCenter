type BrandIdentityProps = {
  name: string
  meta: string
  tone?: 'default' | 'inverse'
  className?: string
}

export function BrandIdentity(props: BrandIdentityProps) {
  const { name, meta, tone = 'default', className } = props
  const classes = ['brand-identity', `brand-identity--${tone}`, className].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      <img className="brand-identity__icon" src="/favicon.png" alt={`${name} logo`} />
      <div className="brand-identity__text">
        <strong>{name}</strong>
        <span>{meta}</span>
      </div>
    </div>
  )
}
