import { Suspense, lazy, useEffect } from 'react'

import { RouteLoading } from './components/common/RouteLoading'
import { useAdminSession } from './hooks/useAdminSession'
import { useLocaleState } from './hooks/useLocaleState'
import { useStorefrontSession } from './hooks/useStorefrontSession'
import { useStorefrontCatalog } from './hooks/useStorefrontCatalog'
import { getAdminConsoleText } from './i18n/adminConsole'
import { type AppCopy, uiCopy } from './i18n/copy'
import { AppProviders } from './providers/AppProviders'
import { type RouteMatch, navigateTo, resolveRoute, usePathname } from './router'
import './styles/app.scss'
import './styles/store.scss'
import './styles/auth.scss'
import './styles/admin.scss'

const LazyAdminLoginView = lazy(() =>
  import('./components/admin/AdminLoginView').then((module) => ({
    default: module.AdminLoginView,
  })),
)
const LazyAdminShell = lazy(() =>
  import('./layouts/AdminShell').then((module) => ({
    default: module.AdminShell,
  })),
)
const LazyStorefrontShell = lazy(() =>
  import('./layouts/StorefrontShell').then((module) => ({
    default: module.StorefrontShell,
  })),
)
const LazyStorefrontAuthView = lazy(() =>
  import('./components/store/StorefrontAuthView').then((module) => ({
    default: module.StorefrontAuthView,
  })),
)
const LazyNotFoundPage = lazy(() =>
  import('./pages/common/NotFoundPage').then((module) => ({
    default: module.NotFoundPage,
  })),
)
const LazyAdminDashboardPage = lazy(() =>
  import('./pages/admin/AdminDashboardPage').then((module) => ({
    default: module.AdminDashboardPage,
  })),
)
const LazyAdminProductsPage = lazy(() =>
  import('./pages/admin/AdminProductsPage').then((module) => ({
    default: module.AdminProductsPage,
  })),
)
const LazyAdminOrdersPage = lazy(() =>
  import('./pages/admin/AdminOrdersPage').then((module) => ({
    default: module.AdminOrdersPage,
  })),
)
const LazyAdminPaymentsPage = lazy(() =>
  import('./pages/admin/AdminPaymentsPage').then((module) => ({
    default: module.AdminPaymentsPage,
  })),
)
const LazyAdminFulfillmentPage = lazy(() =>
  import('./pages/admin/AdminFulfillmentPage').then((module) => ({
    default: module.AdminFulfillmentPage,
  })),
)
const LazyAdminBotsPage = lazy(() =>
  import('./pages/admin/AdminBotsPage').then((module) => ({
    default: module.AdminBotsPage,
  })),
)
const LazyAdminCustomersPage = lazy(() =>
  import('./pages/admin/AdminCustomersPage').then((module) => ({
    default: module.AdminCustomersPage,
  })),
)
const LazyAdminSupportPage = lazy(() =>
  import('./pages/admin/AdminSupportPage').then((module) => ({
    default: module.AdminSupportPage,
  })),
)
const LazyAdminSystemPage = lazy(() =>
  import('./pages/admin/AdminSystemPage').then((module) => ({
    default: module.AdminSystemPage,
  })),
)
const LazyProductCheckoutPage = lazy(() =>
  import('./pages/store/ProductCheckoutPage').then((module) => ({
    default: module.ProductCheckoutPage,
  })),
)
const LazyStorefrontPage = lazy(() =>
  import('./pages/store/StorefrontPage').then((module) => ({
    default: module.StorefrontPage,
  })),
)
const LazyStorefrontOrdersPage = lazy(() =>
  import('./pages/store/StorefrontOrdersPage').then((module) => ({
    default: module.StorefrontOrdersPage,
  })),
)
const LazyStorefrontAccountPage = lazy(() =>
  import('./pages/store/StorefrontAccountPage').then((module) => ({
    default: module.StorefrontAccountPage,
  })),
)

function App() {
  const [locale, setLocale] = useLocaleState()

  return (
    <AppProviders locale={locale}>
      <AppView locale={locale} setLocale={setLocale} />
    </AppProviders>
  )
}

function AppView(props: {
  locale: 'zh-CN' | 'en-US'
  setLocale: (locale: 'zh-CN' | 'en-US') => void
}) {
  const { locale, setLocale } = props
  const pathname = usePathname()
  const route = resolveRoute(pathname)
  const copy: AppCopy = uiCopy[locale]
  const storefront = useStorefrontCatalog(locale)
  const products = storefront.products
  const product = route.key === 'product' ? products.find((item) => item.sku === route.sku) ?? null : null
  const { session, signIn, signOut } = useAdminSession()
  const {
    session: storefrontSession,
    signIn: signInStorefront,
    signUp: signUpStorefront,
    signOut: signOutStorefront,
  } = useStorefrontSession()
  const adminEntryPath = session ? '/admin' : '/admin/login'

  useEffect(() => {
    const needsAdminSession = route.key.startsWith('admin') && route.key !== 'admin-login'

    if (needsAdminSession && !session) {
      navigateTo('/admin/login')
      return
    }

    if (route.key === 'admin-login' && session) {
      navigateTo('/admin')
    }
  }, [route.key, session])

  useEffect(() => {
    const needsStorefrontSession = route.key === 'account'

    if (needsStorefrontSession && !storefrontSession) {
      navigateTo('/account/login')
      return
    }

    if ((route.key === 'account-login' || route.key === 'account-register') && storefrontSession) {
      navigateTo('/account')
    }
  }, [route.key, storefrontSession])

  useEffect(() => {
    document.title = getDocumentTitle(copy, locale, route, product?.name)
  }, [copy, locale, route, product?.name])

  if (route.key.startsWith('admin') && route.key !== 'admin-login' && !session) {
    return <RouteLoading />
  }

  if (route.key === 'account' && !storefrontSession) {
    return <RouteLoading />
  }

  if (route.key === 'admin-login') {
    return (
      <Suspense fallback={<RouteLoading />}>
        <LazyAdminLoginView
          copy={copy}
          onLogin={async (values: { email: string; password: string; remember: boolean }) => {
            await signIn(values)
            navigateTo('/admin')
          }}
        />
      </Suspense>
    )
  }

  if (route.key.startsWith('admin') && session) {
    return (
      <Suspense fallback={<RouteLoading />}>
        <LazyAdminShell
          copy={copy}
          pathname={route.pathname}
          locale={locale}
          setLocale={setLocale}
          session={session}
          onNavigate={navigateTo}
          onLogout={() => {
            void signOut()
            navigateTo('/admin/login')
          }}
        >
          {renderAdminPage(route.key, copy, locale, session.name)}
        </LazyAdminShell>
      </Suspense>
    )
  }

  if (route.key === 'account-login' || route.key === 'account-register') {
    return (
      <Suspense fallback={<RouteLoading />}>
        <LazyStorefrontAuthView
          locale={locale}
          mode={route.key === 'account-register' ? 'register' : 'login'}
          onLogin={async (values) => {
            await signInStorefront(values)
            navigateTo('/account')
          }}
          onRegister={async (values) => {
            await signUpStorefront({
              ...values,
              locale,
            })
            navigateTo('/account')
          }}
          onSwitchMode={() => navigateTo(route.key === 'account-register' ? '/account/login' : '/account/register')}
          onBackHome={() => navigateTo('/')}
        />
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<RouteLoading />}>
      <LazyStorefrontShell
        copy={copy}
        locale={locale}
        setLocale={setLocale}
        onNavigate={navigateTo}
        adminEntryPath={adminEntryPath}
      >
        {route.key === 'product' && product ? (
          <LazyProductCheckoutPage
            copy={copy}
            locale={locale}
            product={product}
            paymentChannelMap={storefront.paymentChannelMap}
            loading={storefront.loading}
            error={storefront.error}
            onBack={() => navigateTo('/shop')}
            onNavigate={navigateTo}
          />
        ) : route.key === 'orders' ? (
          <LazyStorefrontOrdersPage
            locale={locale}
            products={products}
            paymentChannelMap={storefront.paymentChannelMap}
            onNavigate={navigateTo}
          />
        ) : route.key === 'account' ? (
          <LazyStorefrontAccountPage
            locale={locale}
            session={storefrontSession}
            onNavigate={navigateTo}
            onLogout={() => {
              void signOutStorefront()
              navigateTo('/account/login')
            }}
          />
        ) : route.key === 'not-found' || route.key === 'product' ? (
          <LazyNotFoundPage copy={copy} onBack={() => navigateTo('/shop')} />
        ) : (
          <LazyStorefrontPage
            copy={copy}
            locale={locale}
            products={products}
            paymentChannelMap={storefront.paymentChannelMap}
            paymentChannelCount={storefront.paymentChannelCount}
            loading={storefront.loading}
            error={storefront.error}
            onNavigate={navigateTo}
            adminEntryPath={adminEntryPath}
          />
        )}
      </LazyStorefrontShell>
    </Suspense>
  )
}

function renderAdminPage(
  routeKey: string,
  copy: AppCopy,
  locale: 'zh-CN' | 'en-US',
  operatorName?: string,
) {
  switch (routeKey) {
    case 'admin-dashboard':
      return <LazyAdminDashboardPage locale={locale} />
    case 'admin-products':
      return <LazyAdminProductsPage locale={locale} />
    case 'admin-orders':
      return <LazyAdminOrdersPage locale={locale} />
    case 'admin-payments':
      return <LazyAdminPaymentsPage locale={locale} />
    case 'admin-fulfillment':
      return <LazyAdminFulfillmentPage locale={locale} />
    case 'admin-bots':
      return <LazyAdminBotsPage locale={locale} operatorName={operatorName} />
    case 'admin-customers':
      return <LazyAdminCustomersPage locale={locale} />
    case 'admin-support':
      return <LazyAdminSupportPage locale={locale} />
    case 'admin-system':
      return <LazyAdminSystemPage locale={locale} operatorName={operatorName} />
    default:
      return <LazyNotFoundPage copy={copy} onBack={() => navigateTo('/admin')} />
  }
}

export default App

function getDocumentTitle(
  copy: AppCopy,
  locale: 'zh-CN' | 'en-US',
  route: RouteMatch,
  productName?: string,
) {
  const brand = `${copy.common.brandName} ${copy.common.brandMeta}`
  const adminText = getAdminConsoleText(locale)

  switch (route.key) {
    case 'home':
    case 'shop':
      return `${brand} | ${copy.store.featuredTitle}`
    case 'orders':
      return `${brand} | ${copy.header.orders}`
    case 'account-login':
      return `${brand} | ${locale === 'zh-CN' ? '用户登录' : 'Sign in'}`
    case 'account-register':
      return `${brand} | ${locale === 'zh-CN' ? '用户注册' : 'Register'}`
    case 'account':
      return `${brand} | ${locale === 'zh-CN' ? '账户中心' : 'Account center'}`
    case 'product':
      return `${brand} | ${productName ?? copy.checkout.snapshotTitle}`
    case 'admin-login':
      return `${brand} | ${copy.admin.login.title}`
    case 'admin-dashboard':
      return `${brand} | ${adminText.pages.dashboard.title}`
    case 'admin-products':
      return `${brand} | ${adminText.pages.products.title}`
    case 'admin-orders':
      return `${brand} | ${adminText.pages.orders.title}`
    case 'admin-payments':
      return `${brand} | ${adminText.pages.payments.title}`
    case 'admin-fulfillment':
      return `${brand} | ${adminText.pages.fulfillment.title}`
    case 'admin-bots':
      return `${brand} | ${locale === 'zh-CN' ? 'Telegram 机器人管理' : 'Bot / Telegram operations'}`
    case 'admin-customers':
      return `${brand} | ${adminText.pages.customers.title}`
    case 'admin-support':
      return `${brand} | ${adminText.pages.support.title}`
    case 'admin-system':
      return `${brand} | ${adminText.pages.system.title}`
    default:
      return `${brand} | ${copy.notFound.title}`
  }
}
