import { useEffect, useState } from 'react'

type UsePersistentStateOptions<T> = {
  shouldUseStoredValue?: (value: T) => boolean
}

export function usePersistentState<T>(
  storageKey: string,
  getInitialState: () => T,
  options?: UsePersistentStateOptions<T>,
) {
  const [state, setState] = useState<T>(() => {
    const stored = window.localStorage.getItem(storageKey)

    if (!stored) {
      return getInitialState()
    }

    try {
      const parsed = JSON.parse(stored) as T

      if (options?.shouldUseStoredValue && !options.shouldUseStoredValue(parsed)) {
        return getInitialState()
      }

      return parsed
    } catch {
      return getInitialState()
    }
  })

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(state))
  }, [storageKey, state])

  return [state, setState] as const
}
