import { useEffect, useState } from 'react'

import { isLocale, type Locale } from '../i18n/copy'

const localeStorageKey = 'passdock.locale'

function readInitialLocale(): Locale {
  const stored = window.localStorage.getItem(localeStorageKey)

  if (stored && isLocale(stored)) {
    return stored
  }

  return window.navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
}

export function useLocaleState() {
  const [locale, setLocale] = useState<Locale>(() => readInitialLocale())

  useEffect(() => {
    window.localStorage.setItem(localeStorageKey, locale)
    document.documentElement.lang = locale
  }, [locale])

  return [locale, setLocale] as const
}
