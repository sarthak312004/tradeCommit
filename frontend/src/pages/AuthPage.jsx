import { useEffect, useState } from "react"
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

const features = [
  { number: "01", title: "Journal without friction", text: "Capture the setup, execution, result, and the lesson while the trade is still fresh." },
  { number: "02", title: "Plan before the market", text: "Turn ideas into dated trade plans with room for notes, screenshots, and context." },
  { number: "03", title: "Review the pattern", text: "See your decisions over time and build a process around what actually works for you." },
]

function Icon({ name, size = 18 }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }
  if (name === "arrow") return <svg {...common}><path d="M5 12h13"/><path d="m13 6 6 6-6 6"/></svg>
  if (name === "close") return <svg {...common}><path d="m18 6-12 12"/><path d="m6 6 12 12"/></svg>
  if (name === "moon") return <svg {...common}><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"/></svg>
  if (name === "spark") return <svg {...common}><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"/><path d="m19 17 .7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7L19 17Z"/></svg>
  if (name === "chart") return <svg {...common}><path d="M4 19V5"/><path d="M4 19h16"/><path d="m7 15 3-4 3 2 5-7"/></svg>
  if (name === "calendar") return <svg {...common}><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M7 2.5v4M17 2.5v4M3 9h18"/><path d="M8 13h2M14 13h2M8 17h2"/></svg>
  if (name === "lock") return <svg {...common}><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
  return <svg {...common}><circle cx="12" cy="12" r="9"/></svg>
}

function DotGrid() {
  return <div aria-hidden="true" className="tc-dot-grid absolute inset-0 opacity-50 dark:opacity-35" />
}

function ProductPreview() {
  return (
    <div className="tc-preview relative mx-auto mt-10 w-full max-w-[720px] overflow-hidden rounded-[30px] border border-zinc-200/80 bg-white/75 p-2 shadow-[0_35px_100px_-45px_rgba(24,24,27,0.42)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#171717]/80 dark:shadow-[0_35px_100px_-45px_rgba(0,0,0,0.9)]">
      <div className="rounded-[23px] border border-zinc-200/80 bg-[#f7f6f2] p-4 sm:p-5 dark:border-white/[0.06] dark:bg-[#1c1c1c]">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600"/><span className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600"/><span className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600"/></div>
          <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-zinc-400">trade workspace</span>
        </div>
        <div className="grid gap-3 lg:grid-cols-[.8fr_1.2fr]">
          <div className="space-y-2">
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-white/[0.06] dark:bg-[#222]">
              <div className="flex items-center justify-between"><span className="text-[9px] uppercase tracking-[0.16em] text-zinc-400">today's focus</span><span className="text-[10px] text-emerald-600 dark:text-emerald-400">on plan</span></div>
              <p className="mt-3 text-sm font-medium text-zinc-800 dark:text-zinc-100">Wait for confirmation</p>
              <div className="mt-4 h-1 rounded-full bg-zinc-100 dark:bg-white/[0.07]"><div className="h-1 w-[72%] rounded-full bg-zinc-500 dark:bg-zinc-400"/></div>
            </div>
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-white/[0.06] dark:bg-[#222]">
              <span className="text-[9px] uppercase tracking-[0.16em] text-zinc-400">journal streak</span><p className="mt-2 text-2xl font-semibold tracking-tight">12 days</p><p className="mt-1 text-[10px] text-zinc-500">Showing up compounds.</p>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-white/[0.06] dark:bg-[#222] sm:p-5">
            <div className="flex items-start justify-between"><div><p className="text-[9px] uppercase tracking-[0.16em] text-zinc-400">weekly review</p><p className="mt-1 text-3xl font-semibold tracking-tight">+4.8R</p></div><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-medium text-emerald-700 dark:border-emerald-400/15 dark:bg-emerald-400/10 dark:text-emerald-300">on plan</span></div>
            <div className="tc-chart mt-8 flex h-[130px] items-end gap-2 px-1">{[34,48,42,64,55,77,69,96,82,108,94,120].map((height,index)=><span key={index} style={{height}} className="w-full rounded-t-md bg-zinc-200/90 dark:bg-white/[0.09]"/>)}</div>
            <div className="mt-2 flex justify-between text-[9px] text-zinc-400"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AuthPanel({ mode, login, setLogin, message, loading, showForgot, switchMode, handleLogin, handleGoogleCredential, finishLogin, finishRegistration }) {
  return (
    <div className="w-full max-w-[400px]">
      <div className="mb-5">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400">Your trading workspace</p>
        <h2 className={`${headingCls} text-[27px] sm:text-[29px]`}>{mode === "register" ? "Start with a clear mind." : mode === "login" ? "Welcome back." : "Let's get you back in."}</h2>
        <p className={`mt-1.5 text-[13px] ${mutedCls}`}>{mode === "register" ? "Create your space. Build your process." : "Your journal is ready when you are."}</p>
      </div>

      <div className="mb-5 flex gap-5 border-b border-zinc-300/70 dark:border-white/[0.08]" role="tablist" aria-label="Account">
        <button type="button" role="tab" aria-selected={mode !== "register"} onClick={() => switchMode("login")} className={tabCls(mode !== "register")}>Log in</button>
        <button type="button" role="tab" aria-selected={mode === "register"} onClick={() => switchMode("register")} className={tabCls(mode === "register")}>Create account</button>
      </div>

      {mode === "login" && <form onSubmit={handleLogin} noValidate className="tc-form-enter">
        {message && <div role="alert" className={messageCls(message.type)}>{message.text}</div>}
        <GoogleButton onCredential={handleGoogleCredential} disabled={loading}/>
        <Field id="l-id" label="Email or username" value={login.identifier} onChange={setLogin("identifier")} autoComplete="username" autoFocus/>
        <PasswordField id="l-pw" label="Password" value={login.password} onChange={setLogin("password")} autoComplete="current-password"/>
        <div className="-mt-1 mb-3 flex items-center justify-between gap-3"><button type="button" onClick={() => switchMode("otp")} className={linkBtnCls}>Log in with email code</button>{showForgot && <button type="button" onClick={() => switchMode("forgot")} className={linkBtnCls}>Forgot password?</button>}</div>
        <button type="submit" disabled={loading} className={`${submitCls} tc-button-lift`}>{loading ? "Logging in…" : "Log in"}</button>
        <p className={`mt-3.5 text-center text-[12px] ${mutedCls}`}>New here? <button type="button" onClick={() => switchMode("register")} className={linkBtnCls}>Create an account</button></p>
      </form>}

      {mode === "forgot" && <ForgotPasswordFlow initialEmail={login.identifier.includes("@") ? login.identifier.trim() : ""} onComplete={finishLogin} onBack={() => switchMode("login")}/>}
      {mode === "otp" && <OtpLoginFlow initialEmail={login.identifier.includes("@") ? login.identifier.trim() : ""} onComplete={finishLogin} onBack={() => switchMode("login")}/>}
      <div hidden={mode !== "register"} className="tc-form-enter"><SignupFlow onComplete={finishRegistration} onLogin={() => switchMode("login")}/></div>
      <p className="mt-5 text-center text-[9px] leading-4 text-zinc-400 dark:text-zinc-600">By continuing, you agree to use Trade Commit as a tool for reflection and disciplined decision-making.</p>
    </div>
  )
}

function AuthModal({ open, onClose, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-3 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Trade Commit account">
      <button aria-label="Close account form" onClick={onClose} className="absolute inset-0 cursor-default bg-zinc-950/35 backdrop-blur-sm dark:bg-black/60"/>
      <div className="tc-modal-enter relative w-full max-w-[430px] rounded-[24px] border border-zinc-200 bg-[#f7f6f2] p-5 shadow-[0_40px_120px_-40px_rgba(0,0,0,.55)] sm:p-6 dark:border-white/[0.08] dark:bg-[#171717]">
        <div className="mb-3 flex justify-end"><button type="button" onClick={onClose} className="tc-icon-button" aria-label="Close form"><Icon name="close" size={16}/></button></div>
        {children}
      </div>
    </div>
  )
}

export default function AuthPage() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const [mode, setMode] = useState("login")
  const [login, setLoginState] = useState({ identifier: "", password: "" })
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)

  const setLogin = (key) => (event) => setLoginState((state) => ({ ...state, [key]: event.target.value }))
  const switchMode = (next) => { setMode(next); setMessage(null); setAuthOpen(true) }
  const openAuth = (next = "login") => { setMode(next); setMessage(null); setAuthOpen(true) }
  const finishLogin = () => { window.dispatchEvent(new Event("auth-state-changed")); navigate(REDIRECT_AFTER_LOGIN) }
  const finishRegistration = () => { window.dispatchEvent(new Event("auth-state-changed")); navigate("/onboarding", { replace: true }) }

  useEffect(() => {
    const checkAuth = async () => {
      try { const res = await fetch("/api/v1/auth/check", { credentials: "include" }); if (res.ok) navigate(REDIRECT_AFTER_LOGIN, { replace: true }) } catch { /* continue */ }
    }
    checkAuth()
  }, [navigate])

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


  return (
    <div className="tc-landing min-h-screen overflow-x-hidden bg-canvas text-zinc-900 transition-colors duration-300 dark:bg-[#101010] dark:text-zinc-100">
      <header className="tc-nav fixed left-0 right-0 top-0 z-50 border-b border-zinc-200/60 bg-[#e4e2dc]/75 backdrop-blur-xl dark:border-white/[0.06] dark:bg-[#101010]/75">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className={`${SERIF} text-[22px] font-semibold tracking-[-0.025em]`}>Trade Commit</button>
          <nav className="hidden items-center gap-7 text-[13px] text-zinc-500 md:flex dark:text-zinc-400">
            <a href="#how" className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">How it works</a>
            <a href="#start" className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">Start</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeCycleButton theme={theme} setTheme={setTheme}/>
            <button onClick={() => openAuth("login")} className="tc-small-auth hidden sm:inline-flex">Log in</button>
            <button onClick={() => openAuth("register")} className="tc-small-auth tc-small-auth-primary">Register <Icon name="arrow" size={14}/></button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate flex min-h-[760px] items-center overflow-hidden px-5 pb-16 pt-28 sm:px-8 lg:min-h-screen lg:px-10">
          <DotGrid/><div className="tc-orb tc-orb-one"/><div className="tc-orb tc-orb-two"/>
          <div className="relative mx-auto w-full max-w-7xl">
            <div className="mx-auto max-w-4xl text-center">
              <div className="tc-reveal mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-300/70 bg-white/50 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500 shadow-sm backdrop-blur dark:border-white/[0.08] dark:bg-white/[0.035] dark:text-zinc-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"/>A calmer trading workspace</div>
              <h1 className={`${SERIF} tc-reveal tc-delay-1 text-[clamp(46px,7vw,82px)] font-medium leading-[.92] tracking-[-.055em] text-zinc-950 dark:text-zinc-50`}>Trade with clarity.<br/><span className="text-zinc-400 dark:text-zinc-600">Review with intention.</span></h1>
              <p className="tc-reveal tc-delay-2 mx-auto mt-6 max-w-[590px] text-[15px] leading-6 text-zinc-600 sm:text-[17px] dark:text-zinc-400">Journal trades, plan setups, and understand your decisions in one quiet workspace designed to help you trade your process — not your emotions.</p>
              <div className="tc-reveal tc-delay-2 mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row"><button onClick={() => openAuth("register")} className="tc-hero-button tc-hero-button-primary">Create your workspace <Icon name="arrow" size={16}/></button><a href="#how" className="tc-hero-button">See how it works</a></div>
            </div>
            <ProductPreview/>
            <div className="mt-7 flex justify-center"><a href="#how" className="tc-scroll-cue"><span className="tc-scroll-dot"/>Scroll to explore</a></div>
          </div>
        </section>

        <section id="how" className="relative border-y border-zinc-200/70 bg-[#dddcd6] px-5 py-20 sm:px-8 lg:px-10 dark:border-white/[0.06] dark:bg-[#151515]">
          <div className="mx-auto max-w-7xl"><div className="grid gap-12 lg:grid-cols-[.7fr_1.3fr] lg:gap-20"><div><p className="tc-eyebrow">A simpler loop</p><h2 className={`${SERIF} max-w-md text-3xl font-medium leading-[1.04] tracking-[-.035em] sm:text-4xl`}>From idea to review, without losing the why.</h2><p className="mt-5 max-w-md text-[15px] leading-6 text-zinc-500 dark:text-zinc-400">The best journal is the one that makes it easy to come back tomorrow.</p></div><div className="grid gap-px overflow-hidden rounded-3xl border border-zinc-300/70 bg-zinc-300/70 dark:border-white/[0.07] dark:bg-white/[0.07] md:grid-cols-3">{features.map((item)=><article key={item.number} className="bg-[#e9e7e1] p-6 dark:bg-[#1a1a1a]"><span className="text-[10px] font-medium tracking-[.18em] text-zinc-400">{item.number}</span><h3 className="mt-12 text-[16px] font-medium tracking-tight">{item.title}</h3><p className="mt-3 text-[15px] leading-6 text-zinc-500 dark:text-zinc-400">{item.text}</p></article>)}</div></div></div>
        </section>


        <section className="px-5 py-10 sm:py-15 lg:py-20 sm:px-8 lg:px-10"><div className="mx-auto max-w-7xl overflow-hidden rounded-[32px] border border-zinc-200/80 bg-[#ebe9e3] p-6 sm:p-8 lg:p-10 dark:border-white/[0.07] dark:bg-[#191919]"><div className="grid items-center gap-10 lg:grid-cols-[1fr_.9fr]"><div><p className="tc-eyebrow">Plan before you trade</p><h2 className={`${SERIF} max-w-xl text-3xl font-medium leading-[1.02] tracking-[-.035em] sm:text-4xl`}>Give every setup a place to become a decision.</h2><p className="mt-5 max-w-lg text-[15px] leading-6 text-zinc-500 dark:text-zinc-400">Use dated plans, notes, screenshots, and reviews to turn scattered market thoughts into a repeatable routine.</p><button onClick={() => openAuth("register")} className="tc-text-link mt-6">Start planning <Icon name="arrow" size={15}/></button></div><div className="tc-calendar-card self-center"><div className="flex items-center justify-between"><span className="text-xs font-medium">October 2026</span><span className="text-[9px] uppercase tracking-[.16em] text-zinc-400">trade planner</span></div><div className="mt-6 grid grid-cols-7 gap-1 text-center text-[9px] text-zinc-400">{["M","T","W","T","F","S","S"].map(d=><span key={d} className="pb-2">{d}</span>)}{Array.from({length:35},(_,i)=><span key={i} className={`rounded-lg py-2 ${i===15?"bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900":"text-zinc-500 dark:text-zinc-400"}`}>{i<31?i+1:""}</span>)}</div></div></div></div></section>

        <section id="start" className="relative border-t border-zinc-200/70 bg-[#e4e2dc] px-5 py-22 sm:px-8 lg:px-10 dark:border-white/[0.06] dark:bg-[#111]">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_440px] lg:items-start"><div className="lg:sticky lg:top-32"><p className="tc-eyebrow">Ready when you are</p><h2 className={`${SERIF} max-w-xl text-4xl font-medium leading-[1] tracking-[-.04em] sm:text-5xl`}>Your next good trade starts with a better process.</h2><p className="mt-5 max-w-md text-[14px] leading-6 text-zinc-500 dark:text-zinc-400">Scroll down, create your account, and make this the place where your trading decisions become easier to understand.</p><div className="mt-8 flex flex-wrap gap-2"><span className="tc-trust-pill"><Icon name="lock" size={13}/> Secure account</span><span className="tc-trust-pill"><Icon name="calendar" size={13}/> Trade planner</span><span className="tc-trust-pill"><Icon name="chart" size={13}/> Review patterns</span></div></div><div className="w-full max-w-[440px] justify-self-end rounded-[26px] border border-zinc-200/80 bg-[#f7f6f2] p-5 shadow-[0_30px_90px_-55px_rgba(24,24,27,.4)] dark:border-white/[0.07] dark:bg-[#181818]"><AuthPanel mode={mode} login={login} setLogin={setLogin} message={message} loading={loading} showForgot={showForgot} switchMode={(next)=>{setMode(next);setMessage(null)}} handleLogin={handleLogin} handleGoogleCredential={handleGoogleCredential} finishLogin={finishLogin} finishRegistration={finishRegistration}/></div></div>
        </section>
      </main>

      <footer className="border-t border-zinc-200/70 px-5 py-8 sm:px-8 lg:px-10 dark:border-white/[0.06]"><div className="mx-auto flex max-w-7xl flex-col gap-3 text-[11px] text-zinc-400 sm:flex-row sm:items-center sm:justify-between"><span className={`${SERIF} text-base text-zinc-600 dark:text-zinc-300`}>Trade Commit</span><span>Journal. Plan. Review. Trade deliberately.</span></div></footer>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)}><AuthPanel mode={mode} login={login} setLogin={setLogin} message={message} loading={loading} showForgot={showForgot} switchMode={switchMode} handleLogin={handleLogin} handleGoogleCredential={handleGoogleCredential} finishLogin={finishLogin} finishRegistration={finishRegistration}/></AuthModal>
    </div>
  )
}
