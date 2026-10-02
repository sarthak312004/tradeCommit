import { useContext, useEffect, useState } from 'react'
import Sidebar from './components/sidebar/Sidebar'
import TopBar from './components/rightContainer/TopBar'
import MainJournal from './pages/MainJournal'
import { journalContext } from './context/Context'
import { Navigate } from 'react-router'

function Home() {
  const {journals, selectedJournal, uploadTradeImage, addTrade, updateTrade, deleteTrade} = useContext(journalContext)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/v1/auth/check', { credentials: 'include' })
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
    <div className="dark">
      <div className="min-h-screen bg-stone-100 text-zinc-900 transition-colors duration-200 dark:bg-[#111315] dark:text-zinc-100">
        <div className="flex h-screen overflow-hidden">
          <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} journals={journals} />

          <main className="flex flex-1 flex-col overflow-hidden">
            <TopBar journalName={selectedJournal?.name} />

            <MainJournal
              selectedJournal={selectedJournal}
              isSidebarOpen={isSidebarOpen}
              onAddTrade={addTrade}
              onUpdateTrade={updateTrade}
              onDeleteTrade={deleteTrade}
              onUploadTradeImage={uploadTradeImage}
            />
          </main>
        </div>
      </div>

    </div>
  )
}

export default Home