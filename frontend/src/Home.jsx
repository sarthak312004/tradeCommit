import { useCallback, useContext, useEffect, useState } from 'react'
import Sidebar from './components/sidebar/Sidebar'
import { Navigate, Outlet } from 'react-router'
import { fetchPrefetched } from './utils/prefetch'
import { SessionError, SessionLoading } from './components/common/SessionScreen'
import ProductTour from './components/tour/ProductTour'
import { journalContext } from './context/Context'
import { DeepFocusProvider } from './context/DeepFocusProvider'
import DeepFocusDock from './components/rightContainer/planner/DeepFocusDock'
import { MOBILE_MEDIA_QUERY, useIsMobile } from './hooks/useMediaQuery'

const AUTH_CHECK_TIMEOUT_MS = 60_000

const withTimeout = (promise) => {
  let timeoutId
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Session check timed out')), AUTH_CHECK_TIMEOUT_MS)
  })

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId))
}

function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  // below `md` the sidebar is a slide-over menu that sits on top of the page instead of beside it
  const isMobile = useIsMobile()
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const navOpen = isMobile ? isMobileNavOpen : isSidebarOpen
  const setNavOpen = isMobile ? setIsMobileNavOpen : setIsSidebarOpen
  // which sidebar create form is open ('journals' | 'planners' | null); lifted here so the big "create" buttons
  // on the empty pages can open the same forms the sidebar's + buttons do
  const [openFormSection, setOpenFormSection] = useState(null)
  const { journals } = useContext(journalContext)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [authError, setAuthError] = useState(false)
  const [authCheckAttempt, setAuthCheckAttempt] = useState(0)

  useEffect(() => {
    let isCurrent = true

    const checkAuth = async () => {
      try {
        const res = await withTimeout(fetchPrefetched('auth', '/api/v1/auth/check'))
        if (!isCurrent) return

        if (res.status === 401) {
          setIsAuthenticated(false)
          return
        }

        if (!res.ok) throw new Error(`Session check failed (${res.status})`)

        const payload = await withTimeout(res.json())
        if (!isCurrent) return

        setIsAuthenticated(true)
        setNeedsOnboarding(payload?.data?.user?.onboardingCompleted === false)
        setAuthError(false)
      } catch {
        if (isCurrent) {
          setIsAuthenticated(false)
          setAuthError(true)
        }
      } finally {
        if (isCurrent) setIsCheckingAuth(false)
      }
    }

    checkAuth()

    return () => {
      isCurrent = false
    }
  }, [authCheckAttempt])

  const openCreateForm = useCallback((section) => {
    setNavOpen(true)
    setOpenFormSection(section)
  }, [setNavOpen])

  const openMobileNav = useCallback(() => setIsMobileNavOpen(true), [])

  // Growing past the breakpoint (rotating a tablet) must not leave the slide-over "open".
  useEffect(() => {
    const media = window.matchMedia(MOBILE_MEDIA_QUERY)
    const closeOnDesktop = (event) => {
      if (!event.matches) setIsMobileNavOpen(false)
    }
    media.addEventListener('change', closeOnDesktop)
    return () => media.removeEventListener('change', closeOnDesktop)
  }, [])

  // a new user who just finished (or skipped) the tour lands straight in the "new journal" form instead of an empty page
  const handleTourEnd = () => {
    if (journals.length === 0) openCreateForm('journals')
  }

  const retryAuthCheck = () => {
    setAuthError(false)
    setIsCheckingAuth(true)
    setAuthCheckAttempt((attempt) => attempt + 1)
  }

  useEffect(() => {
    const handleAuthExpired = () => setIsAuthenticated(false)
    window.addEventListener('auth-expired', handleAuthExpired)
    return () => window.removeEventListener('auth-expired', handleAuthExpired)
  }, [])

  if (isCheckingAuth) return <SessionLoading />

  if (authError) return <SessionError onRetry={retryAuthCheck} />

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <DeepFocusProvider>
    <>
      <div className="fixed inset-0 flex overflow-hidden bg-canvas text-zinc-900 transition-colors duration-200 dark:bg-night dark:text-zinc-100">
        {isMobile && (
          <div
            aria-hidden="true"
            onClick={() => setIsMobileNavOpen(false)}
            className={`fixed inset-0 z-[35] bg-black/40 transition-opacity duration-300 motion-reduce:transition-none ${isMobileNavOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          />
        )}

        <Sidebar
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          isMobile={isMobile}
          isMobileOpen={isMobileNavOpen}
          onMobileClose={() => setIsMobileNavOpen(false)}
          openFormSection={openFormSection}
          setOpenFormSection={setOpenFormSection}
        />

        <main className="tc-ambient flex min-h-0 flex-1 flex-col overflow-hidden">
          <Outlet context={{ isSidebarOpen, openCreateForm, openMobileNav }} />
        </main>
      </div>

      <DeepFocusDock />
      <ProductTour isSidebarOpen={navOpen} setIsSidebarOpen={setNavOpen} autoCloseSidebar={isMobile} onTourEnd={handleTourEnd} />
    </>
    </DeepFocusProvider>
  )
}

export default Home