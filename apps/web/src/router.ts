import { startTransition, useEffect, useState } from 'react'

const navigationEventName = 'passdock:navigate'

export type RouteMatch =
  | { key: 'home'; pathname: string }
  | { key: 'shop'; pathname: string }
  | { key: 'orders'; pathname: string }
  | { key: 'account-login'; pathname: string }
  | { key: 'account-register'; pathname: string }
  | { key: 'account'; pathname: string }
  | { key: 'product'; pathname: string; sku: string }
  | { key: 'admin-login'; pathname: string }
  | { key: 'admin-dashboard'; pathname: string }
  | { key: 'admin-products'; pathname: string }
  | { key: 'admin-orders'; pathname: string }
  | { key: 'admin-payments'; pathname: string }
  | { key: 'admin-fulfillment'; pathname: string }
  | { key: 'admin-bots'; pathname: string }
  | { key: 'admin-customers'; pathname: string }
  | { key: 'admin-support'; pathname: string }
  | { key: 'admin-system'; pathname: string }
  | { key: 'admin-not-found'; pathname: string }
  | { key: 'not-found'; pathname: string }

function normalizePathname(pathname: string) {
  if (!pathname) {
    return '/'
  }

  if (pathname !== '/' && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }

  return pathname
}

export function usePathname() {
  const [pathname, setPathname] = useState(() => normalizePathname(window.location.pathname))

  useEffect(() => {
    const handleNavigation = () => {
      startTransition(() => {
        setPathname(normalizePathname(window.location.pathname))
      })
    }

    window.addEventListener('popstate', handleNavigation)
    window.addEventListener(navigationEventName, handleNavigation)

    return () => {
      window.removeEventListener('popstate', handleNavigation)
      window.removeEventListener(navigationEventName, handleNavigation)
    }
  }, [])

  return pathname
}

export function useLocationSearch() {
  const [search, setSearch] = useState(() => window.location.search)

  useEffect(() => {
    const handleNavigation = () => {
      startTransition(() => {
        setSearch(window.location.search)
      })
    }

    window.addEventListener('popstate', handleNavigation)
    window.addEventListener(navigationEventName, handleNavigation)

    return () => {
      window.removeEventListener('popstate', handleNavigation)
      window.removeEventListener(navigationEventName, handleNavigation)
    }
  }, [])

  return search
}

export function navigateTo(to: string) {
  const nextLocation = normalizeTargetLocation(to)
  const currentLocation = `${normalizePathname(window.location.pathname)}${window.location.search}`

  if (currentLocation === nextLocation) {
    return
  }

  window.history.pushState({}, '', nextLocation)
  window.dispatchEvent(new Event(navigationEventName))
}

export function replaceTo(to: string) {
  const nextLocation = normalizeTargetLocation(to)
  const currentLocation = `${normalizePathname(window.location.pathname)}${window.location.search}`

  if (currentLocation === nextLocation) {
    return
  }

  window.history.replaceState({}, '', nextLocation)
  window.dispatchEvent(new Event(navigationEventName))
}

export function resolveRoute(pathname: string): RouteMatch {
  const normalized = normalizePathname(pathname)

  if (normalized === '/') {
    return { key: 'home', pathname: normalized }
  }

  if (normalized === '/shop') {
    return { key: 'shop', pathname: normalized }
  }

  if (normalized === '/orders') {
    return { key: 'orders', pathname: normalized }
  }

  if (normalized === '/account/login') {
    return { key: 'account-login', pathname: normalized }
  }

  if (normalized === '/account/register') {
    return { key: 'account-register', pathname: normalized }
  }

  if (normalized === '/account') {
    return { key: 'account', pathname: normalized }
  }

  if (normalized === '/admin/login') {
    return { key: 'admin-login', pathname: normalized }
  }

  if (normalized === '/admin') {
    return { key: 'admin-dashboard', pathname: normalized }
  }

  if (normalized === '/admin/products') {
    return { key: 'admin-products', pathname: normalized }
  }

  if (normalized === '/admin/orders') {
    return { key: 'admin-orders', pathname: normalized }
  }

  if (normalized === '/admin/payments') {
    return { key: 'admin-payments', pathname: normalized }
  }

  if (normalized === '/admin/fulfillment') {
    return { key: 'admin-fulfillment', pathname: normalized }
  }

  if (normalized === '/admin/bots') {
    return { key: 'admin-bots', pathname: normalized }
  }

  if (normalized === '/admin/customers') {
    return { key: 'admin-customers', pathname: normalized }
  }

  if (normalized === '/admin/support') {
    return { key: 'admin-support', pathname: normalized }
  }

  if (normalized === '/admin/system' || normalized === '/admin/settings') {
    return { key: 'admin-system', pathname: normalized }
  }

  if (normalized.startsWith('/products/')) {
    return {
      key: 'product',
      pathname: normalized,
      sku: normalized.replace('/products/', ''),
    }
  }

  if (normalized.startsWith('/admin/')) {
    return { key: 'admin-not-found', pathname: normalized }
  }

  return { key: 'not-found', pathname: normalized }
}

function normalizeTargetLocation(target: string) {
  const url = new URL(target, window.location.origin)
  const pathname = normalizePathname(url.pathname)

  return `${pathname}${url.search}`
}
