import { useEffect, useState } from 'react'
import Sidebar from './components/sidebar/Sidebar'
import { Navigate, Outlet } from 'react-router'
import { fetchPrefetched } from './utils/prefetch'

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

  if (isCheckingAuth) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#10151c] text-[#e6eaf0]">
        Checking session...
      </div>
    )
  }

  if (authError) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#10151c] px-6 text-[#e6eaf0]">
        <div className="text-center">
          <p>We couldn't verify your session. The server may be temporarily unavailable. Please try again.</p>
          <button
            type="button"
            onClick={retryAuthCheck}
            className="mt-4 rounded-lg bg-indigo-500 px-4 py-2 font-medium text-white hover:bg-indigo-400"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <div>
      <div className="min-h-screen bg-canvas text-zinc-900 transition-colors duration-200 dark:bg-night dark:text-zinc-100">
        <div className="flex h-screen overflow-hidden">
          <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />

          <main className="flex flex-1 flex-col overflow-hidden">
            <Outlet context={{ isSidebarOpen }} />
          </main>
        </div>
      </div>

    </div>
  )
}

export default Home