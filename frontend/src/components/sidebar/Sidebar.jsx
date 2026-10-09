import { useContext, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useMatch, useNavigate } from "react-router"
import { journalContext, plannerContext } from "../../context/Context"
import JournalCard from "./JournalCard"
import JournalCreateForm from "./JournalCreateForm"
import PlannerCard from "./PlannerCard"
import PlannerCreateForm from "./PlannerCreateForm"
import FeedbackDialog from "../feedback/FeedbackDialog"
import SidebarSection from "./SidebarSection"
import { ThemeCycleButton, ThemeSegmented } from "./ThemeToggle"
import { useFeedbackPrompt } from "../../hooks/useFeedbackPrompt"
import { useTheme } from "../../hooks/useTheme"
import { CalendarIcon, ChevronsLeftIcon, FileIcon, LogoutIcon, MessageSquareIcon } from "../../utils/Icons.jsx"
import { EASE, FADE_BASE, fade, ghostBtn } from "./sidebarStyles"

function Sidebar({ isSidebarOpen, setIsSidebarOpen }) {
  const { journals, selectedJournal, selectJournal } = useContext(journalContext)
  const { planners } = useContext(plannerContext)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  // which page is showing decides which section highlights its selected row
  const plannerMatch = useMatch("/planner/:plannerId")
  const activePlannerId = plannerMatch?.params.plannerId ?? null
  const activeJournalId = activePlannerId ? null : selectedJournal?.id ?? null

  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)

  // pops the feedback dialog up by itself once, after the user's first 10 trades
  const tradeCount = journals.reduce((total, journal) => total + (journal.trades?.length ?? 0), 0)
  const { isPromptOpen, closePrompt } = useFeedbackPrompt(tradeCount)
  const [openFormSection, setOpenFormSection] = useState(null)

  useEffect(() => {
    if (!isLogoutConfirmOpen) return
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !isLoggingOut) setIsLogoutConfirmOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isLogoutConfirmOpen, isLoggingOut])

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev)

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

  const journalRailItems = journals.map((journal) => ({
    id: journal.id,
    label: journal.name,
    isSelected: activeJournalId === journal.id,
    onSelect: () => {
      selectJournal(journal.id)
      navigate("/")
    },
  }))

  const plannerRailItems = planners.map((planner) => ({
    id: planner.id,
    label: planner.name,
    isSelected: activePlannerId === planner.id,
    onSelect: () => navigate(`/planner/${planner.id}`),
  }))

  return (
    <aside
      aria-label="Sidebar"
      className={`${
        isSidebarOpen ? "w-[260px]" : "w-[56px]"
      } relative flex shrink-0 flex-col overflow-hidden border-r border-zinc-300 bg-sidebar transition-[width] duration-300 ${EASE} will-change-[width] motion-reduce:transition-none dark:border-white/[0.10] dark:bg-side`}
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
                <img src="../../../public/favicon.svg" alt="T" />
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

      {/* ------------------------------ Sections ------------------------------ */}
      <div className="flex min-h-0 flex-1 flex-col">
        <SidebarSection
          title="Journals"
          addLabel="New journal"
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          isFormOpen={openFormSection === "journals"}
          onFormOpenChange={(isOpen) => setOpenFormSection(isOpen ? "journals" : null)}
          renderForm={({ open, close, reopen }) => <JournalCreateForm open={open} onClose={close} onReopen={reopen} />}
          railIcon={FileIcon}
          railItems={journalRailItems}
          isEmpty={journals.length === 0}
          emptyText="No journals yet."
        >
          {journals.map((journal) => (
            <JournalCard key={journal.id} journal={journal} isSelected={activeJournalId === journal.id} />
          ))}
        </SidebarSection>

        <div className="mx-3 shrink-0 border-t border-zinc-300 dark:border-white/[0.10]" />

        <SidebarSection
          title="Trade planner"
          addLabel="New trade planner"
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          isFormOpen={openFormSection === "planners"}
          onFormOpenChange={(isOpen) => setOpenFormSection(isOpen ? "planners" : null)}
          renderForm={({ open, close }) => <PlannerCreateForm open={open} onClose={close} />}
          railIcon={CalendarIcon}
          railItems={plannerRailItems}
          isEmpty={planners.length === 0}
          emptyText="No planners yet."
        >
          {planners.map((planner) => (
            <PlannerCard key={planner.id} planner={planner} isSelected={activePlannerId === planner.id} />
          ))}
        </SidebarSection>
      </div>

      {/* ------------------------------ Footer ------------------------------ */}
      <div className="relative h-[132px] shrink-0 border-t border-zinc-300 dark:border-white/[0.10]">
        {/* Expanded */}
        <div
          className={`absolute inset-y-0 left-0 flex w-[260px] flex-col justify-center gap-1 px-2 ${FADE_BASE} ${fade(isSidebarOpen)}`}
        >
          {/* all three rows are h-8 with the same px-2 inset, so label, icons and text share two left edges */}
          <div className="flex h-8 items-center justify-between px-2">
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Theme</span>
            <ThemeSegmented theme={theme} setTheme={setTheme} />
          </div>
          <button
            type="button"
            onClick={() => setIsFeedbackOpen(true)}
            className={`flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] ${ghostBtn}`}
          >
            <MessageSquareIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">Feedback &amp; bugs</span>
          </button>
          <button
            type="button"
            onClick={() => setIsLogoutConfirmOpen(true)}
            className={`flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] ${ghostBtn}`}
          >
            <LogoutIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">Log out</span>
          </button>
        </div>

        {/* Collapsed */}
        <div
          className={`absolute inset-y-0 left-0 flex w-[56px] flex-col items-center justify-center gap-1 ${FADE_BASE} ${fade(!isSidebarOpen)}`}
        >
          <ThemeCycleButton theme={theme} setTheme={setTheme} />
          <button
            type="button"
            onClick={() => setIsFeedbackOpen(true)}
            title="Feedback & bugs"
            aria-label="Feedback and bug reports"
            className={`flex h-8 w-8 items-center justify-center rounded-md ${ghostBtn}`}
          >
            <MessageSquareIcon className="h-4 w-4" />
          </button>
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
      {(isFeedbackOpen || isPromptOpen) && (
        <FeedbackDialog
          isAutoPrompt={isPromptOpen && !isFeedbackOpen}
          onClose={() => {
            setIsFeedbackOpen(false)
            if (isPromptOpen) closePrompt()
          }}
        />
      )}
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
              className="w-full max-w-[340px] rounded-xl border border-zinc-300 bg-white p-5 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.3)] dark:border-white/[0.13] dark:bg-panel-hi"
            >
              <h2
                id="logout-title"
                className="text-sm font-semibold text-zinc-900 dark:text-zinc-50"
              >
                Log out of TradeCommit?
              </h2>
              <p
                id="logout-desc"
                className="mt-1.5 text-[13px] leading-snug text-zinc-600 dark:text-zinc-300"
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
