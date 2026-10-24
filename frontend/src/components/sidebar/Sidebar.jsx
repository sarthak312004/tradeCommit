import { Suspense, lazy, useContext, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useLocation, useMatch, useNavigate } from "react-router"
import { journalContext, plannerContext } from "../../context/Context"
import JournalCard from "./JournalCard"
import JournalCreateForm from "./JournalCreateForm"
import PlannerCard from "./PlannerCard"
import PlannerCreateForm from "./PlannerCreateForm"
import DialogSkeleton from "../common/DialogSkeleton"
import SidebarSection from "./SidebarSection"
import { ThemeCycleButton, ThemeSegmented } from "./ThemeToggle"
import { useFeedbackPrompt } from "../../hooks/useFeedbackPrompt"
import { useTheme } from "../../hooks/useTheme"
import { CalendarIcon, ChevronsLeftIcon, CloseIcon, FileIcon, LogoutIcon, MessageSquareIcon, PlusIcon } from "../../utils/Icons.jsx"
import { plannerApi } from "../../services/plannerApi"
import { preloadPlannerPage } from "../../utils/plannerPageLoader"
import { EASE, FADE_BASE, fade, focusRing, ghostBtn } from "./sidebarStyles"

const FeedbackDialog = lazy(() => import("../feedback/FeedbackDialog"))

function Sidebar({ isSidebarOpen: isSidebarOpenProp, setIsSidebarOpen, isMobile = false, isMobileOpen = false, onMobileClose, openFormSection, setOpenFormSection }) {
  // on phones the sidebar is a slide-over menu: always the full (expanded) layout, shown or hidden as a whole
  const isSidebarOpen = isMobile ? true : isSidebarOpenProp
  const { journals, selectedJournal, selectJournal } = useContext(journalContext)
  const { planners } = useContext(plannerContext)
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const { pathname } = useLocation()

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

  useEffect(() => {
    if (!isLogoutConfirmOpen) return
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !isLoggingOut) setIsLogoutConfirmOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isLogoutConfirmOpen, isLoggingOut])

  const toggleSidebar = () => (isMobile ? onMobileClose?.() : setIsSidebarOpen((prev) => !prev))

  // Escape puts the slide-over away (unless a dialog opened from it is using the key)
  useEffect(() => {
    if (!isMobile || !isMobileOpen || isLogoutConfirmOpen || isFeedbackOpen) return undefined
    const onKeyDown = (event) => {
      if (event.key === "Escape") onMobileClose?.()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isMobile, isMobileOpen, isLogoutConfirmOpen, isFeedbackOpen, onMobileClose])

  // choosing a journal or planner is the end of the menu's job on a phone
  const handleSectionsClick = (event) => {
    if (isMobile && event.target.closest("[data-nav-select]")) onMobileClose?.()
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

  // a nudge that shows only until the first planner exists, and only once the user has a journal with trades
  const hasLoggedTrades = journals.some((journal) => (journal.trades?.length ?? 0) > 0)
  const showCreatePlannerCta = hasLoggedTrades && planners.length === 0 && openFormSection !== "planners"

  const journalRailItems = journals.map((journal) => ({
    id: journal.id,
    label: journal.name,
    isSelected: activeJournalId === journal.id,
    onSelect: () => {
      selectJournal(journal.id)
      navigate(pathname === "/calendar" || pathname === "/analysis" ? pathname : "/")
    },
  }))

  const plannerRailItems = planners.map((planner) => ({
    id: planner.id,
    label: planner.name,
    isSelected: activePlannerId === planner.id,
    onSelect: () => {
      preloadPlannerPage().catch(() => {})
      plannerApi.listEntries(planner.id).catch(() => {})
      navigate(`/planner/${planner.id}`)
    },
  }))

  return (
    <aside
      aria-label="Sidebar"
      inert={isMobile && !isMobileOpen}
      className={
        isMobile
          ? // slides in with `left` (not a transform) so the dialogs rendered inside it keep covering the whole screen
            `fixed inset-y-0 z-40 flex w-[260px] flex-col overflow-hidden border-r border-zinc-600/40 bg-sidebar transition-[left,visibility] duration-300 ${EASE} motion-reduce:transition-none dark:border-white/[0.10] dark:bg-side ${
              isMobileOpen ? "visible left-0 shadow-2xl" : "invisible -left-[264px]"
            }`
          : `${
              isSidebarOpen ? "w-[260px]" : "w-[56px]"
            } relative flex shrink-0 flex-col overflow-hidden border-r border-zinc-600/40 bg-sidebar transition-[width] duration-300 ${EASE} will-change-[width] motion-reduce:transition-none dark:border-white/[0.10] dark:bg-side`
      }
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
              <img src="/favicon.svg" alt="" className="h-6 w-6 object-contain" />
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
            title={isMobile ? "Close menu" : "Collapse sidebar"}
            aria-label={isMobile ? "Close menu" : "Collapse sidebar"}
            aria-expanded={isSidebarOpen}
            className={`flex shrink-0 items-center justify-center rounded-md ${isMobile ? "h-9 w-9" : "h-7 w-7"} ${ghostBtn} ${FADE_BASE} ${fade(isSidebarOpen)}`}
          >
            {isMobile ? <CloseIcon className="h-4 w-4" /> : <ChevronsLeftIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* ------------------------------ Sections ------------------------------ */}
      <div className="flex min-h-0 flex-1 flex-col" onClick={handleSectionsClick}>
        <SidebarSection
          title="Journals"
          tourId="sidebar-journals"
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
          tourId="sidebar-planners"
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
          footer={
            showCreatePlannerCta && (
              <button
                type="button"
                onClick={() => setOpenFormSection("planners")}
                className={`mb-1 mt-1 flex h-8 w-full items-center gap-2 rounded-lg border border-zinc-500/55 bg-white/80 px-2.5 text-xs font-semibold text-zinc-800 shadow-[0_1px_3px_rgb(28_25_23/0.12)] transition-colors hover:border-[#c4623f]/55 hover:bg-white hover:text-zinc-950 dark:border-white/[0.16] dark:bg-white/[0.05] dark:text-zinc-200 dark:hover:border-[#e08a68]/40 dark:hover:bg-white/[0.09] dark:hover:text-zinc-50 ${focusRing}`}
              >
                <PlusIcon className="h-3.5 w-3.5 text-[#b95b3b] dark:text-[#e08a68]" />
                Create planner
              </button>
            )
          }
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
            data-tour="sidebar-feedback"
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
        <Suspense fallback={<DialogSkeleton variant="feedback" />}>
          <FeedbackDialog
            isAutoPrompt={isPromptOpen && !isFeedbackOpen}
            onClose={() => {
              setIsFeedbackOpen(false)
              if (isPromptOpen) closePrompt()
            }}
          />
        </Suspense>
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
