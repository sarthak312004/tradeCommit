import { useContext, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router"
import { journalContext } from "../../context/Context"
import JournalCard from "./JournalCard"
import { ThemeCycleButton, ThemeSegmented } from "./ThemeToggle"
import { useTheme } from "../../hooks/useTheme"
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from "../../utils/currencies"
import { ChevronsLeftIcon, LogoutIcon, PlusIcon } from "../../utils/Icons.jsx"

const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]"

const FADE_BASE =
  "transition-[opacity,transform,visibility] duration-200 ease-out motion-reduce:transition-none"

const fade = (visible) =>
  visible
    ? "visible translate-x-0 opacity-100 delay-100"
    : "invisible -translate-x-2 opacity-0"

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60"

const ghostBtn = `cursor-pointer text-zinc-600 transition-colors hover:bg-black/[0.05] hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.07] dark:hover:text-zinc-100 ${focusRing}`

const fieldCls =
  "w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[13px] text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"

function Sidebar({ isSidebarOpen, setIsSidebarOpen, journals }) {
  const { createJournal, selectedJournal } = useContext(journalContext)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false)
  const [journalName, setJournalName] = useState("")
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const inputRef = useRef(null)

  const showForm = isSidebarOpen && isCreateFormOpen

  useEffect(() => {
    if (!showForm) return
    const id = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60)
    return () => clearTimeout(id)
  }, [showForm])

  useEffect(() => {
    if (!isLogoutConfirmOpen) return
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !isLoggingOut) setIsLogoutConfirmOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isLogoutConfirmOpen, isLoggingOut])

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev)

  const handleCreateClick = () => {
    if (!isSidebarOpen) {
      setIsSidebarOpen(true)
      setIsCreateFormOpen(true)
      return
    }
    setIsCreateFormOpen((prev) => !prev)
  }

  const resetForm = () => {
    setJournalName("")
    setCurrency(DEFAULT_CURRENCY)
    setIsCreateFormOpen(false)
  }

  const handleCreateJournal = (event) => {
    event.preventDefault()
    const trimmedName = journalName.trim()
    if (!trimmedName) return
    createJournal(trimmedName, currency)
    resetForm()
  }

  // Uses the existing POST /api/v1/auth/logout controller (clears cookies + refresh token).
  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "include",
      })
    } catch {
      /* network failure: still leave the session view */
    } finally {
      window.dispatchEvent(new Event("auth-state-changed"))
      navigate("/auth", { replace: true })
    }
  }

  return (
    <aside
      aria-label="Sidebar"
      className={`${
        isSidebarOpen ? "w-[260px]" : "w-[56px]"
      } relative flex shrink-0 flex-col overflow-hidden border-r border-zinc-200/80 bg-[#f7f7f5] transition-[width] duration-300 ${EASE} will-change-[width] motion-reduce:transition-none dark:border-white/[0.07] dark:bg-[#202020]`}
    >
      {/* ------------------------------ Header ------------------------------ */}
      <div className="flex h-12 shrink-0 items-center">
        <div className="flex w-[260px] shrink-0 items-center justify-between pl-[10px] pr-2">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md ${ghostBtn}`}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded bg-zinc-900 text-[11px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                T
              </span>
            </button>
            <span
              className={`whitespace-nowrap text-sm font-medium text-zinc-800 dark:text-zinc-100 ${FADE_BASE} ${fade(isSidebarOpen)}`}
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
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${ghostBtn} ${FADE_BASE} ${fade(isSidebarOpen)}`}
          >
            <ChevronsLeftIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* --------------------------- Section label + add --------------------------- */}
      <div className="relative h-8 shrink-0">
        <div
          className={`absolute inset-y-0 left-0 flex w-[260px] items-center justify-between pl-4 pr-2 ${FADE_BASE} ${fade(isSidebarOpen)}`}
        >
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Journals
          </span>
          <button
            type="button"
            onClick={handleCreateClick}
            aria-expanded={showForm}
            title="New journal"
            aria-label="New journal"
            className={`flex h-6 w-6 items-center justify-center rounded-md ${ghostBtn}`}
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>
        <div
          className={`absolute inset-y-0 left-0 flex w-[56px] items-center justify-center ${FADE_BASE} ${fade(!isSidebarOpen)}`}
        >
          <button
            type="button"
            onClick={handleCreateClick}
            title="New journal"
            aria-label="New journal"
            className={`flex h-8 w-8 items-center justify-center rounded-md ${ghostBtn}`}
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ------------------------------ Create form ------------------------------ */}
      <div
        className={`grid shrink-0 transition-[grid-template-rows,opacity,visibility] duration-200 ${EASE} motion-reduce:transition-none ${
          showForm
            ? "visible grid-rows-[1fr] opacity-100"
            : "invisible grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <form onSubmit={handleCreateJournal} className="w-[260px] shrink-0 px-3 pb-2 pt-1">
            <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-white/[0.09] dark:bg-[#2a2a2a]">
              <label
                htmlFor="journal-name"
                className="mb-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400"
              >
                Name
              </label>
              <input
                ref={inputRef}
                id="journal-name"
                type="text"
                value={journalName}
                onChange={(e) => setJournalName(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && resetForm()}
                placeholder="e.g. Swing trades"
                autoComplete="off"
                className={fieldCls}
              />

              <label
                htmlFor="journal-currency"
                className="mb-1 mt-3 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400"
              >
                Currency
              </label>
              <select
                id="journal-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && resetForm()}
                className={`${fieldCls} cursor-pointer [color-scheme:light] dark:[color-scheme:dark]`}
              >
                {CURRENCY_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] leading-snug text-zinc-400 dark:text-zinc-500">
                Used for all P&amp;L here. Can&apos;t be changed later.
              </p>

              <div className="mt-3 flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={resetForm}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${ghostBtn}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!journalName.trim()}
                  className={`cursor-pointer rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white ${focusRing}`}
                >
                  Create
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* ------------------------------ Journals ------------------------------ */}
      <div className="relative min-h-0 flex-1">
        <div
          className={`subtle-scrollbar absolute inset-y-0 left-0 w-[260px] overflow-y-auto overscroll-contain px-2 pb-2 ${FADE_BASE} ${fade(isSidebarOpen)}`}
        >
          {journals.length === 0 ? (
            <p className="px-2 py-4 text-[13px] text-zinc-400 dark:text-zinc-500">
              No journals yet.
            </p>
          ) : (
            <div className="space-y-px">
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

        {/* Collapsed rail */}
        <div
          className={`absolute inset-y-0 left-0 flex w-[56px] flex-col items-center gap-1 overflow-y-auto overscroll-contain py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${FADE_BASE} ${fade(!isSidebarOpen)}`}
        >
          {journals.map((journal) => {
            const isSelected = selectedJournal?.id === journal.id
            return (
              <div
                key={journal.id}
                title={journal.name}
                aria-label={journal.name}
                aria-current={isSelected ? "true" : undefined}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[11px] font-medium transition-colors ${
                  isSelected
                    ? "bg-black/[0.07] text-zinc-900 dark:bg-white/[0.1] dark:text-zinc-50"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {journal.name.slice(0, 2).toUpperCase()}
              </div>
            )
          })}
        </div>
      </div>

      {/* ------------------------------ Footer ------------------------------ */}
      <div className="relative h-[84px] shrink-0 border-t border-zinc-200/80 dark:border-white/[0.07]">
        {/* Expanded */}
        <div
          className={`absolute inset-y-0 left-0 flex w-[260px] flex-col justify-center gap-1 px-2 ${FADE_BASE} ${fade(isSidebarOpen)}`}
        >
          <div className="flex items-center justify-between pl-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Theme</span>
            <ThemeSegmented theme={theme} setTheme={setTheme} />
          </div>
          <button
            type="button"
            onClick={() => setIsLogoutConfirmOpen(true)}
            className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-[13px] ${ghostBtn}`}
          >
            <LogoutIcon className="h-4 w-4" />
            Log out
          </button>
        </div>

        {/* Collapsed */}
        <div
          className={`absolute inset-y-0 left-0 flex w-[56px] flex-col items-center justify-center gap-1 ${FADE_BASE} ${fade(!isSidebarOpen)}`}
        >
          <ThemeCycleButton theme={theme} setTheme={setTheme} />
          <button
            type="button"
            onClick={() => setIsLogoutConfirmOpen(true)}
            title="Log out"
            aria-label="Log out"
            className={`flex h-8 w-8 items-center justify-center rounded-md ${ghostBtn}`}
          >
            <LogoutIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      {isLogoutConfirmOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !isLoggingOut) {
                setIsLogoutConfirmOpen(false)
              }
            }}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="logout-title"
              aria-describedby="logout-desc"
              className="w-full max-w-[340px] rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.3)] dark:border-white/[0.09] dark:bg-[#2a2a2a]"
            >
              <h2
                id="logout-title"
                className="text-sm font-semibold text-zinc-900 dark:text-zinc-50"
              >
                Log out of TradeCommit?
              </h2>
              <p
                id="logout-desc"
                className="mt-1.5 text-[13px] leading-snug text-zinc-500 dark:text-zinc-400"
              >
                You&apos;ll need to sign in again to access your journals.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  autoFocus
                  disabled={isLoggingOut}
                  onClick={() => setIsLogoutConfirmOpen(false)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${ghostBtn}`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="cursor-pointer rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 disabled:cursor-wait disabled:opacity-60 dark:bg-rose-500 dark:hover:bg-rose-600"
                >
                  {isLoggingOut ? "Logging out…" : "Log out"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </aside>
  )
}

export default Sidebar
