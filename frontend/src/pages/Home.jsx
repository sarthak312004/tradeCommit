import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import SummaryCard from '../components/SummaryCard'
import TradeCard from '../components/TradeCard'
import { journals, summary, trades } from '../data/mockData'

function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isDark, setIsDark] = useState(true)

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen bg-stone-100 text-zinc-900 transition-colors duration-200 dark:bg-[#111315] dark:text-zinc-100">
        <div className="flex h-screen overflow-hidden">
          <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} journals={journals} />

          <main className="flex flex-1 flex-col overflow-hidden">
            <TopBar isDark={isDark} setIsDark={setIsDark} />

            <div className="subtle-scrollbar flex-1 overflow-y-auto p-6 md:p-8">
              <section className="mb-8 grid gap-4 md:grid-cols-3">
                {summary.map((item) => (
                  <SummaryCard key={item.label} item={item} />
                ))}
              </section>

              <section className="mb-5">
                <h2 className="text-xl font-semibold tracking-[-0.05em]">Recent trades</h2>
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                {trades.map((trade) => (
                  <TradeCard key={trade.id} trade={trade} />
                ))}
              </section>
            </div>
          </main>
        </div>
      </div>

    </div>
  )
}

export default Home