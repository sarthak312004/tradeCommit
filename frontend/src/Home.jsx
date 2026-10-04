import { useEffect, useState } from 'react'
import Sidebar from './components/sidebar/Sidebar'
import { Navigate, Outlet } from 'react-router'
import { fetchPrefetched } from './utils/prefetch'

function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetchPrefetched('auth', '/api/v1/auth/check')
        setIsAuthenticated(res.ok)
      } catch {
        setIsAuthenticated(false)
      } finally {
        setIsCheckingAuth(false)
      }
    }

    checkAuth()
  }, [])

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

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  return (
    <div>
      <div className="min-h-screen bg-canvas text-zinc-900 transition-colors duration-200 dark:bg-[#191919] dark:text-zinc-100">
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