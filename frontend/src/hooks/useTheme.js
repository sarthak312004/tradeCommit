import { useCallback, useEffect, useState } from "react"

const STORAGE_KEY = "tradecommit-theme"
const MEDIA_QUERY = "(prefers-color-scheme: dark)"
export const THEMES = ["light", "dark", "system"]

const readStoredTheme = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return THEMES.includes(stored) ? stored : "system"
  } catch {
    return "system"
  }
}

const applyTheme = (theme) => {
  const prefersDark = window.matchMedia(MEDIA_QUERY).matches
  const isDark = theme === "dark" || (theme === "system" && prefersDark)
  const root = document.documentElement
  root.classList.toggle("dark", isDark)
  root.style.colorScheme = isDark ? "dark" : "light"
}

export function useTheme() {
  const [theme, setThemeState] = useState(readStoredTheme)

  useEffect(() => {
    applyTheme(theme)
    if (theme !== "system") return
    const media = window.matchMedia(MEDIA_QUERY)
    const onChange = () => applyTheme("system")
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [theme])

  const setTheme = useCallback((next) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* storage unavailable */
    }
    setThemeState(next)
  }, [])

  return { theme, setTheme }
}
