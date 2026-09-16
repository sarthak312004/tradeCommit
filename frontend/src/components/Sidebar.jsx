function Sidebar({ isSidebarOpen, setIsSidebarOpen, journals }) {
  return (
    <aside
      className={`${isSidebarOpen ? 'w-[300px]' : 'w-[65px]'} flex shrink-0 flex-col border-r border-zinc-200 bg-stone-100/80 backdrop-blur-sm transition-all duration-200 ease-in dark:border-zinc-800 dark:bg-[#171a1d]/80`}
    >
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <div className={`flex items-center gap-3 ${!isSidebarOpen && 'w-full justify-center'}`}>
          <div onClick={() => setIsSidebarOpen((prev) => !prev)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-violet-400 text-sm font-bold text-white shadow-sm">
            T
          </div>
          {isSidebarOpen && <span className="text-sm font-semibold">TradeCommit</span>}
        </div>

        {isSidebarOpen?
        <button
          type="button"
          onClick={() => setIsSidebarOpen((prev) => !prev)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-lg text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-white"
          aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >←</button>
        :null}
      </div>

      <div className="flex flex-1 flex-col p-3">
        {isSidebarOpen ? (
          <>
            <button
              type="button"
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300 bg-white/10 px-3 py-3 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-white/10 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-200 dark:hover:border-zinc-500"
            >
              <span className="text-lg">＋</span>
              Create new journal
            </button>

            <div className="space-y-2">
              {journals.map((journal) => (
                <button
                  key={journal.id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl border border-transparent bg-transparent px-2 py-2 text-left transition hover:border-zinc-200 hover:bg-white/80 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/70"
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${journal.accent}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{journal.name}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{journal.updated}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-3">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-lg text-zinc-700 shadow-sm ring-1 ring-zinc-200 transition hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700 dark:hover:bg-zinc-800"
              title="Create new journal"
              aria-label="Create new journal"
            >
              ＋
            </button>

            {journals.map((journal) => (
              <div
                key={journal.id}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[10px] font-semibold text-zinc-700 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700"
                title={journal.name}
              >
                {journal.name.slice(0, 2).toUpperCase()}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

export default Sidebar
