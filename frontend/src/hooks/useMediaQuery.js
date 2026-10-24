import { useCallback, useSyncExternalStore } from 'react'

/** True while the media query matches; updates when the window is resized or rotated. */
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    [query]
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  )
}

// below Tailwind's `md` (768px): the sidebar becomes a slide-over menu
export const MOBILE_MEDIA_QUERY = '(max-width: 767px)'
export const useIsMobile = () => useMediaQuery(MOBILE_MEDIA_QUERY)

// below Tailwind's `sm` (640px): calendars switch to a compact month grid with a day list underneath
export const useIsCompact = () => useMediaQuery('(max-width: 639px)')
