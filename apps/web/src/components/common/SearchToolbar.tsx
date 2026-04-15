import { Button, Input } from 'antd'
import type { ReactNode } from 'react'

type SearchToolbarProps = {
  value: string
  placeholder?: string
  onValueChange: (value: string) => void
  onSearch?: () => void
  onReset?: () => void
  loading?: boolean
  extra?: ReactNode
  searchText?: ReactNode
  resetText?: ReactNode
}

export function SearchToolbar(props: SearchToolbarProps) {
  const {
    value,
    placeholder,
    onValueChange,
    onSearch,
    onReset,
    loading = false,
    extra,
    searchText = 'Search',
    resetText = 'Reset',
  } = props

  return (
    <div className="search-toolbar">
      <div className="search-toolbar__controls">
        <Input.Search
          allowClear
          value={value}
          className="search-toolbar__input"
          placeholder={placeholder}
          enterButton={searchText}
          loading={loading}
          onChange={(event) => onValueChange(event.target.value)}
          onSearch={() => onSearch?.()}
        />
        <Button
          className="search-toolbar__reset"
          onClick={() => {
            onValueChange('')
            onReset?.()
          }}
        >
          {resetText}
        </Button>
      </div>

      {extra ? <div className="search-toolbar__extra">{extra}</div> : null}
    </div>
  )
}
