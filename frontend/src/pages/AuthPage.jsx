import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"
import ForgotPasswordFlow from "../components/auth/ForgotPasswordFlow"
import GoogleButton from "../components/auth/GoogleButton"
import OtpLoginFlow from "../components/auth/OtpLoginFlow"
import SignupFlow from "../components/auth/SignupFlow"
import { Field, PasswordField } from "../components/auth/fields"
import { SERIF, headingCls, linkBtnCls, messageCls, mutedCls, submitCls, tabCls } from "../components/auth/authStyles"
import { ThemeCycleButton } from "../components/sidebar/ThemeToggle"
import { useTheme } from "../hooks/useTheme"
import { authPost, errorText } from "../services/authApi"

const REDIRECT_AFTER_LOGIN = "/"
const CURRENT_YEAR = new Date().getFullYear()
const PAGE_TITLE = "Trade Commit — Journal, plan and review your trades"

const features = [
  { number: "01", icon: "book", title: "Journal without friction", text: "Capture the setup, execution, result, and the lesson while the trade is still fresh." },
  { number: "02", icon: "calendar", title: "Plan before the market", text: "Turn ideas into dated trade plans with room for notes, screenshots, and context." },
  { number: "03", icon: "chart", title: "Review the pattern", text: "See your decisions over time and build a process around what actually works for you." },
]

// days of the month that show a "planned" dot in the calendar preview
const PLANNED_DAYS = [2, 6, 9, 13, 16, 20, 23, 27]
// two bars per weekday in the preview chart
const CHART_BARS = [38, 52, 46, 70, 60, 84, 74, 104, 90, 118]
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"]

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
const hasFinePointer = () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(pointer: fine)").matches)

// smooth-scrolls to a section (the fixed header is cleared by each section's scroll-mt)
const scrollToId = (id) => (event) => {
  const target = document.getElementById(id)
  if (!target) return
  event.preventDefault()
  target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" })
}

const scrollToTop = () => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" })

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60 dark:focus-visible:ring-zinc-500"

function Icon({ name, size = 18 }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }
  if (name === "arrow") return <svg {...common}><path d="M5 12h13"/><path d="m13 6 6 6-6 6"/></svg>
  if (name === "close") return <svg {...common}><path d="m18 6-12 12"/><path d="m6 6 12 12"/></svg>
  if (name === "chart") return <svg {...common}><path d="M4 19V5"/><path d="M4 19h16"/><path d="m7 15 3-4 3 2 5-7"/></svg>
  if (name === "calendar") return <svg {...common}><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M7 2.5v4M17 2.5v4M3 9h18"/><path d="M8 13h2M14 13h2M8 17h2"/></svg>
  if (name === "lock") return <svg {...common}><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
  if (name === "book") return <svg {...common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5Z"/><path d="M4 21.5V5.5"/><path d="M9 8h6M9 12h4"/></svg>
  return <svg {...common}><circle cx="12" cy="12" r="9"/></svg>
}

function DotGrid() {
  return <div aria-hidden="true" className="tc-dot-grid absolute inset-0 opacity-50 dark:opacity-35" />
}

// min-w-0 on every card: grid items default to min-width:auto, which is what let long text push past the frame
const previewCardBase = "min-w-0 rounded-2xl border border-zinc-200/80 bg-white dark:border-white/[0.06] dark:bg-[#222]"
const previewCard = `${previewCardBase} p-3.5 sm:p-4`
// zinc-600 on the cream/white card = 7.2:1 (was zinc-400, 2.4:1); zinc-400 on the dark card = 6.2:1
const previewLabel = "text-[10px] font-medium uppercase leading-4 tracking-[0.16em] text-zinc-600 dark:text-zinc-400"

function ProductPreview() {
  return (
    <div
      role="img"
      aria-label="Sample preview of the Trade Commit workspace"
      className="tc-preview relative mx-auto mt-9 w-full max-w-[720px] overflow-hidden rounded-[22px] border border-zinc-200/80 bg-white/75 p-1.5 shadow-[0_35px_100px_-45px_rgba(24,24,27,0.42)] backdrop-blur-xl sm:mt-10 sm:rounded-[30px] sm:p-2 dark:border-white/[0.08] dark:bg-[#171717]/80 dark:shadow-[0_35px_100px_-45px_rgba(0,0,0,0.9)]"
    >
      <div className="rounded-[17px] border border-zinc-200/80 bg-[#f7f6f2] p-3 text-left sm:rounded-[23px] sm:p-5 dark:border-white/[0.06] dark:bg-[#1c1c1c]">
        <div className="mb-4 flex items-center justify-between sm:mb-5">
          <div className="flex items-center gap-1.5 sm:gap-2" aria-hidden="true">
            {[0, 1, 2].map((dot) => <span key={dot} className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />)}
          </div>
          <span className="text-[10px] font-medium uppercase leading-4 tracking-[0.18em] text-zinc-600 dark:text-zinc-400">sample preview</span>
        </div>

        <div className="grid gap-2.5 sm:gap-3 md:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
          <div className="grid min-w-0 grid-cols-1 gap-2.5 min-[520px]:grid-cols-2 sm:gap-3 md:grid-cols-1 md:content-start">
            <div className={`${previewCard} flex flex-col`}>
              {/* wraps instead of overflowing: "on plan" drops under the label when the card is narrow */}
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                <span className={previewLabel}>today&apos;s focus</span>
                <span className="text-[10px] font-medium leading-4 text-emerald-700 dark:text-emerald-400">on plan</span>
              </div>
              {/* leading-snug + break-words: a wrapped second line gets its own room, and the bar below is pushed down by margin, not overlapped */}
              <p className="mt-2.5 break-words text-[13px] font-medium leading-snug text-zinc-900 sm:mt-3 sm:text-sm dark:text-zinc-100">Wait for confirmation</p>
              <div aria-hidden="true" className="mt-4 h-1.5 shrink-0 overflow-hidden rounded-full bg-zinc-200 sm:mt-5 dark:bg-white/[0.1]"><div className="h-full w-[72%] rounded-full bg-zinc-600 dark:bg-zinc-300" /></div>
            </div>
            <div className={previewCard}>
              <span className={previewLabel}>journal streak</span>
              <p className="mt-1.5 text-xl font-semibold leading-tight tracking-tight sm:mt-2 sm:text-2xl">12 days</p>
              <p className="mt-1 text-[11px] leading-4 text-zinc-600 dark:text-zinc-400">Showing up compounds.</p>
            </div>
          </div>

          <div className={`${previewCardBase} p-3.5 sm:p-5`}>
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
              <div className="min-w-0">
                <p className={previewLabel}>weekly review</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">+4.8R</p>
              </div>
              <span className="shrink-0 whitespace-nowrap rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[10px] font-medium leading-4 text-emerald-800 dark:border-emerald-400/15 dark:bg-emerald-400/10 dark:text-emerald-300">+12% vs last week</span>
            </div>
            <div className="tc-chart mt-6 flex h-[104px] items-end gap-1.5 px-0.5 sm:mt-8 sm:h-[130px] sm:gap-2 sm:px-1">
              {CHART_BARS.map((height, index) => <span key={index} style={{ height }} className="w-full max-h-full rounded-t-md bg-zinc-200/90 dark:bg-white/[0.09]" />)}
            </div>
            <div className="mt-2 grid grid-cols-5 text-center text-[10px] leading-4 text-zinc-600 dark:text-zinc-400">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Month grid for the current month, so the card never shows a stale date.
function CalendarPreview() {
  const [now] = useState(() => new Date())
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = now.getDate()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const offset = (new Date(year, month, 1).getDay() + 6) % 7 // weeks start on Monday
  const cellCount = Math.ceil((offset + daysInMonth) / 7) * 7
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" })

  return (
    <div className="tc-calendar-card w-full max-w-md justify-self-center self-center lg:max-w-none">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{monthLabel}</span>
        <span className="text-[10px] uppercase tracking-[.16em] text-zinc-400">trade planner</span>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1 text-center text-[11px] sm:mt-6" role="presentation">
        {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={index} className="pb-2 text-[10px] text-zinc-400">{day}</span>)}
        {Array.from({ length: cellCount }, (_, index) => {
          const day = index - offset + 1
          if (day < 1 || day > daysInMonth) return <span key={index} aria-hidden="true" />
          const isToday = day === today
          const isPlanned = PLANNED_DAYS.includes(day)
          return (
            <span
              key={index}
              className={`relative grid aspect-square place-items-center rounded-lg ${isToday ? "bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-500 dark:text-zinc-400"}`}
            >
              {day}
              {isPlanned && <i aria-hidden="true" className={`absolute bottom-1 h-1 w-1 rounded-full ${isToday ? "bg-white/70 dark:bg-zinc-900/60" : "bg-zinc-400 dark:bg-zinc-500"}`} />}
            </span>
          )
        })}
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-white/60 p-3 dark:border-white/[0.07] dark:bg-white/[0.03]">
        <span aria-hidden="true" className="h-8 w-1 shrink-0 rounded-full bg-emerald-500/70" />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-zinc-800 dark:text-zinc-100">Opening range breakout</p>
          <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">Intraday plan · 2 screenshots · 1 note</p>
        </div>
      </div>
    </div>
  )
}

function AuthPanel({ mode, login, setLogin, message, loading, showForgot, switchMode, handleLogin, handleGoogleCredential, finishLogin, finishRegistration, autoFocus = false }) {
  return (
    <div className="w-full max-w-[400px]">
      <div className="mb-5">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400">Your trading workspace</p>
        <h2 className={`${headingCls} text-[26px] sm:text-[29px]`}>{mode === "register" ? "Start with a clear mind." : mode === "login" ? "Welcome back." : "Let's get you back in."}</h2>
        <p className={`mt-1.5 text-[13px] ${mutedCls}`}>{mode === "register" ? "Create your space. Build your process." : "Your journal is ready when you are."}</p>
      </div>

      <div className="mb-5 flex gap-5 border-b border-zinc-300/70 dark:border-white/[0.08]" role="tablist" aria-label="Account">
        <button type="button" role="tab" aria-selected={mode !== "register"} onClick={() => switchMode("login")} className={tabCls(mode !== "register")}>Log in</button>
        <button type="button" role="tab" aria-selected={mode === "register"} onClick={() => switchMode("register")} className={tabCls(mode === "register")}>Create account</button>
      </div>

      {mode === "login" && (
        <form onSubmit={handleLogin} noValidate className="tc-form-enter">
          {message && <div role="alert" className={messageCls(message.type)}>{message.text}</div>}
          <GoogleButton onCredential={handleGoogleCredential} disabled={loading} />
          <Field id="l-id" label="Email or username" value={login.identifier} onChange={setLogin("identifier")} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus={autoFocus} />
          <PasswordField id="l-pw" label="Password" value={login.password} onChange={setLogin("password")} autoComplete="current-password" />
          <div className="-mt-1 mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <button type="button" onClick={() => switchMode("otp")} className={linkBtnCls}>Log in with email code</button>
            {showForgot && <button type="button" onClick={() => switchMode("forgot")} className={linkBtnCls}>Forgot password?</button>}
          </div>
          <button type="submit" disabled={loading} className={`${submitCls} tc-button-lift`}>{loading ? "Logging in…" : "Log in"}</button>
          <p className={`mt-3.5 text-center text-[12px] ${mutedCls}`}>New here? <button type="button" onClick={() => switchMode("register")} className={linkBtnCls}>Create an account</button></p>
        </form>
      )}

      {mode === "forgot" && <ForgotPasswordFlow initialEmail={login.identifier.includes("@") ? login.identifier.trim() : ""} onComplete={finishLogin} onBack={() => switchMode("login")} />}
      {mode === "otp" && <OtpLoginFlow initialEmail={login.identifier.includes("@") ? login.identifier.trim() : ""} onComplete={finishLogin} onBack={() => switchMode("login")} />}
      <div hidden={mode !== "register"} className="tc-form-enter"><SignupFlow onComplete={finishRegistration} onLogin={() => switchMode("login")} /></div>
      <p className="mt-5 text-center text-[10px] leading-4 text-zinc-500 dark:text-zinc-500">By continuing, you agree to use Trade Commit as a tool for reflection and disciplined decision-making.</p>
    </div>
  )
}

// Bottom sheet on phones, centered dialog from `sm` up. Scrolls inside itself when the form is taller than the screen.
function AuthModal({ open, onClose, children }) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const opener = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden" // keep the page from scrolling behind the sheet

    // inputs with autoFocus already hold focus; otherwise move it into the dialog for keyboard / screen-reader users
    if (panelRef.current && !panelRef.current.contains(document.activeElement)) panelRef.current.focus({ preventScroll: true })

    return () => {
      document.body.style.overflow = previousOverflow
      if (opener instanceof HTMLElement) opener.focus({ preventScroll: true })
    }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Trade Commit account">
      <button type="button" tabIndex={-1} aria-label="Close account form" onClick={onClose} className="absolute inset-0 cursor-default bg-zinc-950/35 backdrop-blur-sm dark:bg-black/60" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="tc-modal-enter relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-[24px] border border-zinc-200 bg-[#f7f6f2] shadow-[0_40px_120px_-40px_rgba(0,0,0,.55)] outline-none dark:border-white/[0.08] dark:bg-[#171717]"
      >
        <div className="flex shrink-0 justify-end px-5 pb-1 pt-4 sm:px-6">
          <button type="button" onClick={onClose} className="tc-icon-button" aria-label="Close form"><Icon name="close" size={16} /></button>
        </div>
        <div className="subtle-scrollbar overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6 sm:pb-6">{children}</div>
      </div>
    </div>
  )
}

const navLink = `rounded transition-colors hover:text-zinc-900 dark:hover:text-zinc-100 ${focusRing}`

export default function AuthPage() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const [mode, setMode] = useState("login")
  const [login, setLoginState] = useState({ identifier: "", password: "" })
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [inlineHeight, setInlineHeight] = useState(0)
  const inlineRef = useRef(null)

  const setLogin = (key) => (event) => setLoginState((state) => ({ ...state, [key]: event.target.value }))
  const switchMode = (next) => { setMode(next); setMessage(null); setAuthOpen(true) }
  // The inline form and the dialog share the same ids, so only one of them is mounted at a time.
  // The inline card keeps its height while the dialog is open so the page doesn't jump behind it.
  const openAuth = (next = "login") => { setInlineHeight(inlineRef.current?.offsetHeight ?? 0); setMode(next); setMessage(null); setAuthOpen(true) }
  const finishLogin = () => { window.dispatchEvent(new Event("auth-state-changed")); navigate(REDIRECT_AFTER_LOGIN) }
  const finishRegistration = () => { window.dispatchEvent(new Event("auth-state-changed")); navigate("/onboarding", { replace: true }) }

  useEffect(() => {
    const previousTitle = document.title
    document.title = PAGE_TITLE
    return () => { document.title = previousTitle }
  }, [])

  useEffect(() => {
    const checkAuth = async () => {
      try { const res = await fetch("/api/v1/auth/check", { credentials: "include" }); if (res.ok) navigate(REDIRECT_AFTER_LOGIN, { replace: true }) } catch { /* continue */ }
    }
    checkAuth()
  }, [navigate])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    if (!authOpen) return undefined
    const onKey = (event) => { if (event.key === "Escape") setAuthOpen(false) }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [authOpen])

  const run = async (fn) => {
    setLoading(true); setMessage(null)
    try { await fn() } catch (error) { setMessage({ type: "error", text: errorText(error) }) } finally { setLoading(false) }
  }
  const handleLogin = (event) => {
    event.preventDefault()
    const identifier = login.identifier.trim()
    if (!identifier || !login.password) return setMessage({ type: "error", text: "Enter your email or username and your password." })
    const body = identifier.includes("@") ? { email: identifier, password: login.password } : { username: identifier, password: login.password }
    run(async () => { setShowForgot(false); try { await authPost("/login", body) } catch (error) { if (error.status === 401) setShowForgot(true); throw error } finishLogin() })
  }
  const handleGoogleCredential = (credential) => run(async () => { await authPost("/google", { credential }); finishLogin() })

  const panelProps = { mode, login, setLogin, message, loading, showForgot, handleLogin, handleGoogleCredential, finishLogin, finishRegistration }

  return (
    <div className="tc-landing min-h-dvh overflow-x-hidden bg-canvas text-zinc-900 transition-colors duration-300 dark:bg-[#101010] dark:text-zinc-100">
      <a href="#how" onClick={scrollToId("how")} className="sr-only z-[90] rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3 dark:bg-zinc-100 dark:text-zinc-900">Skip to content</a>

      <header className={`tc-nav fixed inset-x-0 top-0 z-50 border-b backdrop-blur-xl ${scrolled ? "border-zinc-300/60 bg-[#e4e2dc]/80 dark:border-white/[0.07] dark:bg-[#101010]/80" : "border-transparent bg-[#e4e2dc]/0 dark:bg-[#101010]/0"}`}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:h-[68px] sm:px-8 lg:px-10">
          <button type="button" onClick={scrollToTop} aria-label="Trade Commit, back to top" className={`${SERIF} shrink-0 rounded text-[20px] font-semibold tracking-[-0.025em] sm:text-[22px] ${focusRing}`}>Trade Commit</button>
          <nav aria-label="Sections" className="hidden items-center gap-7 text-[13px] text-zinc-500 md:flex dark:text-zinc-400">
            <a href="#how" onClick={scrollToId("how")} className={navLink}>How it works</a>
            <a href="#planner" onClick={scrollToId("planner")} className={navLink}>Planner</a>
            <a href="#start" onClick={scrollToId("start")} className={navLink}>Start</a>
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeCycleButton theme={theme} setTheme={setTheme} />
            {/* phones: a single "Log in" button (the hero button already covers sign-up); sm and up: both.
                The responsive classes sit on wrappers because .tc-small-auth sets its own display. */}
            <span className="sm:hidden"><button type="button" onClick={() => openAuth("login")} className="tc-small-auth tc-small-auth-primary">Log in</button></span>
            <span className="hidden items-center gap-2 sm:flex">
              <button type="button" onClick={() => openAuth("login")} className="tc-small-auth">Log in</button>
              <button type="button" onClick={() => openAuth("register")} className="tc-small-auth tc-small-auth-primary">Register <Icon name="arrow" size={14} /></button>
            </span>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate flex items-center overflow-hidden px-5 pb-14 pt-[104px] sm:px-8 sm:pb-16 sm:pt-28 lg:min-h-dvh lg:px-10">
          <DotGrid /><div className="tc-orb tc-orb-one" /><div className="tc-orb tc-orb-two" />
          <div className="relative mx-auto w-full max-w-7xl">
            <div className="mx-auto max-w-4xl text-center">
              <div className="tc-reveal mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-zinc-300/70 bg-white/50 px-3 py-1.5 text-[10px] font-semibold uppercase leading-4 tracking-[0.16em] text-zinc-700 shadow-sm backdrop-blur sm:mb-6 sm:text-[11px] sm:tracking-[0.18em] dark:border-white/[0.14] dark:bg-white/[0.04] dark:text-zinc-300">
                <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-600 dark:bg-emerald-400" />A calmer trading workspace
              </div>
              <h1 className={`${SERIF} tc-reveal tc-delay-1 text-balance text-[clamp(40px,8.5vw,82px)] font-medium leading-[.96] tracking-[-.05em] text-zinc-950 sm:leading-[.92] sm:tracking-[-.055em] dark:text-zinc-50`}>
                Trade with clarity.<br /><span className="text-zinc-600 dark:text-zinc-400">Review with intention.</span>
              </h1>
              <p className="tc-reveal tc-delay-2 mx-auto mt-5 max-w-[590px] text-[15px] leading-6 text-zinc-600 sm:mt-6 sm:text-[17px] sm:leading-7 dark:text-zinc-400">
                Journal trades, plan setups, and understand your decisions in one quiet workspace designed to help you trade your process — not your emotions.
              </p>
              <div className="tc-reveal tc-delay-2 mx-auto mt-8 flex w-full max-w-sm flex-col items-stretch justify-center gap-4 sm:mt-7 sm:max-w-none sm:flex-row sm:items-center sm:gap-3">
                <button type="button" onClick={() => openAuth("register")} className="tc-hero-button tc-hero-button-primary">Create your workspace <Icon name="arrow" size={16} /></button>
                <a href="#how" onClick={scrollToId("how")} className="tc-hero-button">See how it works</a>
              </div>
            </div>
            <ProductPreview />
            <div className="mt-7 hidden justify-center sm:flex"><a href="#how" onClick={scrollToId("how")} className="tc-scroll-cue"><span className="tc-scroll-dot" />Scroll to explore</a></div>
          </div>
        </section>

        <section id="how" aria-labelledby="how-title" className="relative scroll-mt-16 border-y border-zinc-200/70 bg-[#dddcd6] px-5 py-14 sm:px-8 sm:py-20 lg:px-10 dark:border-white/[0.06] dark:bg-[#151515]">
          <div className="mx-auto grid max-w-7xl gap-9 sm:gap-12 xl:grid-cols-[.7fr_1.3fr] xl:gap-20">
            <div>
              <p className="tc-eyebrow">A simpler loop</p>
              <h2 id="how-title" className={`${SERIF} max-w-md text-balance text-[30px] font-medium leading-[1.05] tracking-[-.035em] sm:text-4xl`}>From idea to review, without losing the why.</h2>
              <p className="mt-4 max-w-md text-[15px] leading-6 text-zinc-500 sm:mt-5 dark:text-zinc-400">The best journal is the one that makes it easy to come back tomorrow.</p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-3xl border border-zinc-300/70 bg-zinc-300/70 md:grid-cols-3 dark:border-white/[0.07] dark:bg-white/[0.07]">
              {features.map((item) => (
                <article key={item.number} className="bg-[#e9e7e1] p-5 transition-colors hover:bg-[#eeece6] sm:p-6 dark:bg-[#1a1a1a] dark:hover:bg-[#1e1e1e]">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-[10px] font-medium tracking-[.18em]">{item.number}</span>
                    <Icon name={item.icon} size={18} />
                  </div>
                  <h3 className="mt-8 text-[16px] font-medium tracking-tight md:mt-12">{item.title}</h3>
                  <p className="mt-2.5 text-[15px] leading-6 text-zinc-500 dark:text-zinc-400">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="planner" aria-labelledby="planner-title" className="scroll-mt-16 px-5 py-12 sm:px-8 sm:py-16 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[26px] border border-zinc-200/80 bg-[#ebe9e3] p-5 sm:rounded-[32px] sm:p-8 lg:p-10 dark:border-white/[0.07] dark:bg-[#191919]">
            <div className="grid items-center gap-8 sm:gap-10 lg:grid-cols-[1fr_.9fr] lg:gap-12">
              <div>
                <p className="tc-eyebrow">Plan before you trade</p>
                <h2 id="planner-title" className={`${SERIF} max-w-xl text-balance text-[30px] font-medium leading-[1.04] tracking-[-.035em] sm:text-4xl`}>Give every setup a place to become a decision.</h2>
                <p className="mt-4 max-w-lg text-[15px] leading-6 text-zinc-500 sm:mt-5 dark:text-zinc-400">Use dated plans, notes, screenshots, and reviews to turn scattered market thoughts into a repeatable routine.</p>
                <button type="button" onClick={() => openAuth("register")} className="tc-text-link mt-5 sm:mt-6">Start planning <Icon name="arrow" size={15} /></button>
              </div>
              <CalendarPreview />
            </div>
          </div>
        </section>

        <section id="start" aria-labelledby="start-title" className="relative scroll-mt-16 border-t border-zinc-200/70 bg-[#e4e2dc] px-5 py-14 sm:px-8 sm:py-20 lg:px-10 dark:border-white/[0.06] dark:bg-[#111]">
          <div className="mx-auto grid max-w-7xl gap-9 sm:gap-12 lg:grid-cols-[1fr_440px] lg:items-start">
            <div className="lg:sticky lg:top-32">
              <p className="tc-eyebrow">Ready when you are</p>
              <h2 id="start-title" className={`${SERIF} max-w-xl text-balance text-[32px] font-medium leading-[1.02] tracking-[-.04em] sm:text-5xl sm:leading-[1]`}>Your next good trade starts with a better process.</h2>
              <p className="mt-4 max-w-md text-[14px] leading-6 text-zinc-500 sm:mt-5 dark:text-zinc-400">Create your account and make this the place where your trading decisions become easier to understand.</p>
              <div className="mt-6 flex flex-wrap gap-2 sm:mt-8">
                <span className="tc-trust-pill"><Icon name="lock" size={13} /> Secure account</span>
                <span className="tc-trust-pill"><Icon name="calendar" size={13} /> Trade planner</span>
                <span className="tc-trust-pill"><Icon name="chart" size={13} /> Review patterns</span>
              </div>
            </div>

            <div
              ref={inlineRef}
              style={authOpen && inlineHeight ? { minHeight: inlineHeight } : undefined}
              className="mx-auto w-full max-w-[440px] rounded-[24px] border border-zinc-200/80 bg-[#f7f6f2] p-5 shadow-[0_30px_90px_-55px_rgba(24,24,27,.4)] sm:rounded-[26px] sm:p-6 lg:mx-0 lg:justify-self-end dark:border-white/[0.07] dark:bg-[#181818]"
            >
              {!authOpen && <AuthPanel {...panelProps} switchMode={(next) => { setMode(next); setMessage(null) }} />}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200/70 px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 sm:px-8 lg:px-10 dark:border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-[12px] text-zinc-500 sm:flex-row sm:items-center sm:justify-between dark:text-zinc-400">
          <div className="flex flex-col gap-1">
            <span className={`${SERIF} text-base text-zinc-700 dark:text-zinc-300`}>Trade Commit</span>
            <span>Journal. Plan. Review. Trade deliberately.</span>
          </div>
          <div className="flex items-center gap-5">
            <button type="button" onClick={scrollToTop} className={`rounded transition-colors hover:text-zinc-900 dark:hover:text-zinc-100 ${focusRing}`}>Back to top</button>
            <span>© {CURRENT_YEAR} Trade Commit</span>
          </div>
        </div>
      </footer>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)}>
        <AuthPanel {...panelProps} switchMode={switchMode} autoFocus={hasFinePointer()} />
      </AuthModal>
    </div>
  )
}