import { useContext, useEffect, useRef, useState } from "react"
import { journalContext } from "../../context/Context"
import JournalCard from "./JournalCard"


const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]"

const FADE_BASE =
  "transition-[opacity,transform,visibility] duration-200 ease-out motion-reduce:transition-none"

const fade = (visible) =>
  visible
    ? "visible translate-x-0 opacity-100 delay-100"
    : "invisible -translate-x-2 opacity-0"

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"

/* ----------------------------- Icons ------------------------------ */
const PlusIcon = (props) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M10 4.5v11M4.5 10h11" />
  </svg>
)

const ChevronsLeftIcon = (props) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M9.5 5 4.5 10l5 5M15.5 5l-5 5 5 5" />
  </svg>
)

/* ---------------------------- Component --------------------------- */

function Sidebar({ isSidebarOpen, setIsSidebarOpen, journals }) {
  const { createJournal, selectedJournal } = useContext(journalContext)

  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false)
  const [journalName, setJournalName] = useState("")
  const inputRef = useRef(null)

  const showForm = isSidebarOpen && isCreateFormOpen

  useEffect(() => {
    if (!showForm) return
    const id = setTimeout(
      () => inputRef.current?.focus({ preventScroll: true }),
      60
    )
    return () => clearTimeout(id)
  }, [showForm])

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev)

  const handleCreateClick = () => {
    if (!isSidebarOpen) {
      setIsSidebarOpen(true)
      setIsCreateFormOpen(true)
      return
    }
    setIsCreateFormOpen((prev) => !prev)
  }

  // Trim the name so whitespace-only names are ignored.
  const handleCreateJournal = (event) => {
    event.preventDefault()

    const trimmedName = journalName.trim()
    if (!trimmedName) return

    createJournal(trimmedName)
    setJournalName("")
    setIsCreateFormOpen(false)
  }

  const handleCancelCreate = () => {
    setJournalName("")
    setIsCreateFormOpen(false)
  }

  return (
    <aside
      aria-label="Journals"
      className={`${
        isSidebarOpen ? "w-[300px]" : "w-[68px]"
      } relative flex shrink-0 flex-col overflow-hidden border-r border-zinc-200 bg-stone-100/80 backdrop-blur-sm transition-[width] duration-500 ${EASE} will-change-[width] motion-reduce:transition-none dark:border-zinc-800 dark:bg-[#171a1d]/80`}
    >
      {/* ------------------------------ Header ------------------------------ */}
      <div className="flex h-16 shrink-0 items-center border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex w-[300px] shrink-0 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-violet-400 text-sm font-bold text-white shadow-sm transition-transform duration-150 hover:scale-105 active:scale-95 ${focusRing}`}
            >
              T
            </button>
            <span
              className={`whitespace-nowrap text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 ${FADE_BASE} ${fade(
                isSidebarOpen
              )}`}
            >
              TradeCommit
            </span>
          </div>

          <button
            type="button"
            onClick={toggleSidebar}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
            aria-expanded={isSidebarOpen}
            className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white ${focusRing} ${FADE_BASE} ${fade(
              isSidebarOpen
            )}`}
          >
            <ChevronsLeftIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* --------------------------- Create button --------------------------- */}
      <div className="shrink-0 px-4 pt-4">
        <button
          type="button"
          onClick={handleCreateClick}
          aria-expanded={showForm}
          title="Create new journal"
          aria-label="Create new journal"
          className={`flex h-9 w-full cursor-pointer items-center overflow-hidden rounded-xl border border-dashed border-zinc-300 text-sm font-medium text-zinc-600 transition-colors duration-150 hover:border-sky-400 hover:bg-sky-500/5 hover:text-sky-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-sky-500 dark:hover:text-sky-300 ${focusRing}`}
        >
          <span className="flex h-full w-[34px] shrink-0 items-center justify-center">
            <PlusIcon className="h-[18px] w-[18px]" />
          </span>
          <span
            className={`whitespace-nowrap pr-3 ${FADE_BASE} ${fade(
              isSidebarOpen
            )}`}
          >
            Create new journal
          </span>
        </button>
      </div>

      <div
        className={`grid shrink-0 transition-[grid-template-rows,opacity,visibility] duration-300 ${EASE} motion-reduce:transition-none ${
          showForm
            ? "visible grid-rows-[1fr] opacity-100"
            : "invisible grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <form
            onSubmit={handleCreateJournal}
            className="w-[300px] shrink-0 px-4 pt-3"
          >
            <div className="rounded-xl border border-zinc-200 bg-white/70 p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60">
              <label htmlFor="journal-name" className="sr-only">
                Journal name
              </label>
              <input
                ref={inputRef}
                id="journal-name"
                type="text"
                value={journalName}
                onChange={(event) => setJournalName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") handleCancelCreate()
                }}
                placeholder="Journal name"
                autoComplete="off"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-sky-500"
              />
              <div className="mt-2.5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancelCreate}
                  className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${focusRing}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!journalName.trim()}
                  className={`cursor-pointer rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
                >
                  Create
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div className="mx-4 mt-4 shrink-0 border-t border-zinc-200 dark:border-zinc-800" />

      {/* ------------------------------ Journals ------------------------------ */}
      <div className="relative min-h-0 flex-1">
        <div
          className={`absolute inset-y-0 left-0 w-[300px] overflow-y-auto overscroll-contain px-4 py-4 [scrollbar-width:thin] ${FADE_BASE} ${fade(
            isSidebarOpen
          )}`}
        >
          {journals.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No journals yet. Create one to get started.
            </p>
          ) : (
            <div className="relative space-y-1 pl-5 before:absolute before:bottom-3 before:left-2 before:top-3 before:w-px before:bg-zinc-300 dark:before:bg-zinc-700 [&>*]:cursor-pointer">
              {journals.map((journal) => (
                <JournalCard
                  key={journal.id}
                  journal={journal}
                  isSelected={selectedJournal?.id === journal.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Collapsed layer: fixed 68px rail of journal badges */}
        <div
          className={`absolute inset-y-0 left-0 flex w-[68px] flex-col items-center gap-2 overflow-y-auto overscroll-contain py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${FADE_BASE} ${fade(
            !isSidebarOpen
          )}`}
        >
          {journals.map((journal) => {
            const isSelected = selectedJournal?.id === journal.id
            return (
              <div
                key={journal.id}
                title={journal.name}
                aria-label={journal.name}
                aria-current={isSelected ? "true" : undefined}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold ring-1 transition-colors duration-150 ${
                  isSelected
                    ? "bg-sky-500/10 text-sky-700 ring-sky-500/40 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/40"
                    : "bg-white text-zinc-700 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700"
                }`}
              >
                {journal.name.slice(0, 2).toUpperCase()}
              </div>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

export default Sidebar