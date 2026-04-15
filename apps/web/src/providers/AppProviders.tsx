import { App as AntApp, ConfigProvider, theme } from 'antd'
import enUS from 'antd/locale/en_US'
import zhCN from 'antd/locale/zh_CN'
import { useEffect, useState, type ReactNode } from 'react'

import type { Locale } from '../i18n/copy'
import { ThemeContext, type ThemeMode } from './themeMode'

const themeStorageKey = 'passdock.theme'

function readInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light'
  }

  try {
    return window.localStorage.getItem(themeStorageKey) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function AppProviders(props: { children: ReactNode; locale: Locale }) {
  const { children, locale } = props
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readInitialTheme())

  useEffect(() => {
    try {
      window.localStorage.setItem(themeStorageKey, themeMode)
    } catch {
      return
    }
  }, [themeMode])

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode
  }, [themeMode])

  const sharedTokens = {
    colorPrimary: '#2563eb',
    colorInfo: '#2563eb',
    colorSuccess: '#0f9f6e',
    colorWarning: '#d97706',
    borderRadius: 12,
    borderRadiusLG: 18,
    fontFamily: "'IBM Plex Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    fontFamilyCode: "'IBM Plex Mono', monospace",
  }

  const lightTheme = {
    algorithm: theme.defaultAlgorithm,
    token: {
      ...sharedTokens,
      colorBgLayout: '#f3f6fb',
      colorBgContainer: '#ffffff',
      colorBgElevated: '#ffffff',
      colorBorder: '#d9e0eb',
      colorBorderSecondary: '#e8edf4',
      colorText: '#162032',
      colorTextSecondary: '#67758a',
      colorTextTertiary: '#8b97aa',
      colorFillSecondary: '#f7f9fc',
    },
    components: {
      Layout: {
        bodyBg: '#f3f6fb',
        headerBg: '#ffffff',
        siderBg: '#ffffff',
      },
      Menu: {
        itemBorderRadius: 12,
        itemHeight: 42,
      },
      Card: {
        borderRadiusLG: 18,
      },
      Table: {
        headerBg: '#f7f9fc',
      },
      Button: {
        borderRadius: 12,
      },
      Input: {
        activeBorderColor: '#2563eb',
        hoverBorderColor: '#5b8cff',
      },
      Select: {
        activeBorderColor: '#2563eb',
        hoverBorderColor: '#5b8cff',
      },
      Switch: {
        colorPrimary: '#2563eb',
      },
      Segmented: {
        trackBg: '#eef3fb',
        itemSelectedBg: '#ffffff',
      },
    },
  }

  const darkTheme = {
    algorithm: theme.darkAlgorithm,
    token: {
      ...sharedTokens,
      colorBgLayout: '#0d1320',
      colorBgContainer: '#101826',
      colorBgElevated: '#162032',
      colorBorder: '#223049',
      colorBorderSecondary: '#1d2940',
      colorText: '#eef3fb',
      colorTextSecondary: '#a4b1c5',
      colorTextTertiary: '#73829a',
      colorFillSecondary: '#0f1724',
    },
    components: {
      Layout: {
        bodyBg: '#0d1320',
        headerBg: '#101826',
        siderBg: '#101826',
      },
      Menu: {
        itemBorderRadius: 12,
        itemHeight: 42,
      },
      Card: {
        borderRadiusLG: 18,
      },
      Table: {
        headerBg: '#0f1724',
      },
      Button: {
        borderRadius: 12,
      },
      Input: {
        activeBorderColor: '#5b8cff',
        hoverBorderColor: '#5b8cff',
      },
      Select: {
        activeBorderColor: '#5b8cff',
        hoverBorderColor: '#5b8cff',
      },
      Switch: {
        colorPrimary: '#5b8cff',
      },
      Segmented: {
        trackBg: '#0f1724',
        itemSelectedBg: '#162032',
      },
    },
  }

  return (
    <ConfigProvider locale={locale === 'zh-CN' ? zhCN : enUS} theme={themeMode === 'dark' ? darkTheme : lightTheme}>
      <ThemeContext.Provider value={{ themeMode, setThemeMode }}>
        <AntApp>{children}</AntApp>
      </ThemeContext.Provider>
    </ConfigProvider>
  )
}
