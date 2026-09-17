import { useContext, useState } from "react"
import { journalContext } from "../context/Context"
import JournalCard from "./JournalCard"

function Sidebar({ isSidebarOpen, setIsSidebarOpen, journals }) {
  const {createJournal, updateJournal, deleteJournal, selectedJournal, selectJournal} = useContext(journalContext)

  // These states control the three short-lived journal actions in the sidebar.
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false)
  const [journalName, setJournalName] = useState('')

  // Trim the name before creating a journal so whitespace-only names are ignored.
  const handleCreateJournal = (event) => {
    event.preventDefault()

    const trimmedName = journalName.trim()
    if (!trimmedName) return

    createJournal(trimmedName)
    setJournalName('')
    setIsCreateFormOpen(false)
  }

  const handleCancelCreate = () => {
    setJournalName('')
    setIsCreateFormOpen(false)
  }

  return (
    <aside
      className={`${isSidebarOpen ? 'w-[300px]' : 'w-[65px]'} flex shrink-0 flex-col border-r border-zinc-200 bg-stone-100/80 backdrop-blur-sm transition-all duration-200 ease-in dark:border-zinc-800 dark:bg-[#171a1d]/80`}
    >
      <div className="flex cursor-pointer items-center justify-between border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
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
          className="flex cursor-pointer h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-lg text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-white"
          aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >←</button>
        :null}
      </div>

      <div className="w-full flex items-center flex-1 flex-col p-3">
        {isSidebarOpen ? (
          <>
            <button
              type="button"
              aria-expanded={isCreateFormOpen}
              onClick={() => setIsCreateFormOpen((prev) => !prev)}
              className="mb-3 flex w-[70%] cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300 bg-white/10 px-2 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-white/10 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-200 dark:hover:border-zinc-500"
            >
              <span className="text-lg">＋</span>
              Create new journal
            </button>

            {isCreateFormOpen && (
              <form
                onSubmit={handleCreateJournal}
                className="mb-4 rounded-xl border border-zinc-200 bg-white/60 p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60"
              >
                <label htmlFor="journal-name" className="sr-only">
                  Journal name
                </label>
                <input
                  id="journal-name"
                  type="text"
                  value={journalName}
                  onChange={(event) => setJournalName(event.target.value)}
                  placeholder="Journal name"
                  autoFocus
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-sky-500"
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCancelCreate}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-sky-500 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!journalName.trim()}
                  >
                    Create
                  </button>
                </div>
              </form>
            )}

            <div className="w-full relative cursor-pointer space-y-1 pl-5 before:absolute before:bottom-3 before:left-2 before:top-3 before:w-px before:bg-zinc-300 dark:before:bg-zinc-700">
              {journals.map((journal) => (
                <JournalCard
                  key={journal.id}
                  journal={journal}
                  isSelected={selectedJournal?.id === journal.id}
                  onSelect={selectJournal}
                  onUpdate={updateJournal}
                  onDelete={deleteJournal}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(true)
                setIsCreateFormOpen(true)
              }}
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
