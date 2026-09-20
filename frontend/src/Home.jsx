import { useContext, useState } from 'react'
import Sidebar from './components/sidebar/Sidebar'
import TopBar from './components/rightContainer/TopBar'
import MainJournal from './pages/MainJournal'
import { journalContext } from './context/Context'
import { Outlet } from 'react-router'


function Home() {
  const {journals, selectedJournal, addTrade, updateTrade, deleteTrade} = useContext(journalContext)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  return (
    <div className="dark">
      <div className="min-h-screen bg-stone-100 text-zinc-900 transition-colors duration-200 dark:bg-[#111315] dark:text-zinc-100">
        <div className="flex h-screen overflow-hidden">
          <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} journals={journals} />

          <main className="flex flex-1 flex-col overflow-hidden">
            <TopBar journalName={selectedJournal?.name} />

            {/* <Outlet/> */}
            <MainJournal
              selectedJournal={selectedJournal}
              isSidebarOpen={isSidebarOpen}
              onAddTrade={addTrade}
              onUpdateTrade={updateTrade}
              onDeleteTrade={deleteTrade}
            />
          </main>
        </div>
      </div>

    </div>
  )
}

export default Home