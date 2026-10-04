import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import GoogleButton from "../components/auth/GoogleButton"
import SignupFlow from "../components/auth/SignupFlow"
import { Field, PasswordField } from "../components/auth/fields"
import { SERIF, headingCls, linkBtnCls, messageCls, mutedCls, submitCls, tabCls } from "../components/auth/authStyles"
import { ThemeCycleButton } from "../components/sidebar/ThemeToggle"
import { useTheme } from "../hooks/useTheme"
import { authPost, errorText } from "../services/authApi"

const REDIRECT_AFTER_LOGIN = "/"

export default function AuthPage() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const [mode, setMode] = useState("login") // "login" | "register"
  const [login, setLogin] = useState({ identifier: "", password: "" })
  const [message, setMessage] = useState(null) // { type: "error" | "ok", text } for the login form
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/v1/auth/check", { credentials: "include" })
        if (res.ok) navigate(REDIRECT_AFTER_LOGIN, { replace: true })
      } catch {
        // Ignore and let the user sign in.
      }
    }
    checkAuth()
  }, [navigate])

  const switchMode = (next) => {
    setMode(next)
    setMessage(null)
  }

  const finishLogin = () => {
    window.dispatchEvent(new Event("auth-state-changed"))
    navigate(REDIRECT_AFTER_LOGIN)
  }

  const run = async (fn) => {
    setLoading(true)
    setMessage(null)
    try {
      await fn()
    } catch (error) {
      setMessage({ type: "error", text: errorText(error) })
    } finally {
      setLoading(false)
    }
  }

  const setLoginField = (key) => (event) => setLogin((state) => ({ ...state, [key]: event.target.value }))

  const handleLogin = (event) => {
    event.preventDefault()
    const identifier = login.identifier.trim()
    if (!identifier || !login.password) {
      return setMessage({ type: "error", text: "Enter your email or username and your password." })
    }
    // Backend accepts `email` or `username`
    const body = identifier.includes("@")
      ? { email: identifier, password: login.password }
      : { username: identifier, password: login.password }

    run(async () => {
      await authPost("/login", body)
      finishLogin()
    })
  }

  const handleGoogleCredential = (credential) =>
    run(async () => {
      await authPost("/google", { credential })
      finishLogin()
    })

  return (
    <div className="grid min-h-screen grid-cols-1 bg-canvas font-['Inter','Segoe_UI',sans-serif] text-[15px] leading-normal text-zinc-900 transition-colors duration-200 dark:bg-[#191919] dark:text-zinc-100 md:grid-cols-[1.05fr_1fr]">
      {/* Left: a peek at the journal */}
      <aside
        aria-hidden="true"
        className="hidden flex-col justify-between gap-10 border-r border-zinc-300/70 bg-sidebar px-14 pb-12 pt-12 dark:border-white/[0.07] dark:bg-[#202020] md:sticky md:top-0 md:flex md:h-screen md:self-start"
      >
        <div className={`${SERIF} text-[22px] font-medium tracking-[-0.01em]`}>Trade Commit</div>

        <div>
          <h1 className={`${SERIF} mb-4 max-w-[16ch] text-[42px] font-medium leading-[1.12] tracking-[-0.02em]`}>
            Every trade, written down.
          </h1>
          <p className={`max-w-[42ch] ${mutedCls}`}>
            Log entries, exits and what you were thinking. Review the pattern, not just the P&amp;L.
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-card dark:border-white/[0.07] dark:bg-[#252525] dark:shadow-none">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">Sample journal</p>
          <table className="w-full border-collapse text-[13px] tabular-nums">
            <thead>
              <tr className="text-left text-zinc-500 dark:text-zinc-400">
                <th className="border-b border-zinc-200 pb-2 font-medium dark:border-white/[0.07]">Setup</th>
                <th className="border-b border-zinc-200 pb-2 font-medium dark:border-white/[0.07]">Side</th>
                <th className="border-b border-zinc-200 pb-2 text-right font-medium dark:border-white/[0.07]">Result</th>
                <th className="border-b border-zinc-200 pb-2 pl-4 font-medium dark:border-white/[0.07]">Note</th>
              </tr>
            </thead>
            <tbody className="[&_td]:border-b [&_td]:border-zinc-100 [&_td]:py-2.5 [&_tr:last-child_td]:border-b-0 dark:[&_td]:border-white/[0.05]">
              <tr>
                <td>NIFTY 24500 CE</td><td>Long</td>
                <td className="text-right font-medium text-emerald-600 dark:text-emerald-400">+2.4R</td>
                <td className="pl-4 text-zinc-500 dark:text-zinc-400">Waited for retest</td>
              </tr>
              <tr>
                <td>BANKNIFTY fut</td><td>Short</td>
                <td className="text-right font-medium text-rose-600 dark:text-rose-400">−1.0R</td>
                <td className="pl-4 text-zinc-500 dark:text-zinc-400">Chased the open</td>
              </tr>
              <tr>
                <td>RELIANCE</td><td>Long</td>
                <td className="text-right font-medium text-emerald-600 dark:text-emerald-400">+1.6R</td>
                <td className="pl-4 text-zinc-500 dark:text-zinc-400">Followed plan</td>
              </tr>
            </tbody>
          </table>
        </div>
      </aside>

      {/* Right: forms */}
      <main className="relative flex items-start justify-center px-6 pb-12 pt-16 md:pt-[11vh]">
        <div className="absolute right-4 top-4">
          <ThemeCycleButton theme={theme} setTheme={setTheme} />
        </div>

        <div className="w-full max-w-[400px]">
          <div className={`${SERIF} mb-8 text-xl font-medium md:hidden`}>Trade Commit</div>

          <div className="mb-8 flex gap-6 border-b border-zinc-300/70 dark:border-white/[0.08]" role="tablist" aria-label="Account">
            <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => switchMode("login")} className={tabCls(mode === "login")}>
              Log in
            </button>
            <button type="button" role="tab" aria-selected={mode === "register"} onClick={() => switchMode("register")} className={tabCls(mode === "register")}>
              Create account
            </button>
          </div>

          {mode === "login" && (
            <form onSubmit={handleLogin} noValidate>
              <h2 className={`${headingCls} mb-1.5`}>Welcome back</h2>
              <p className={`mb-6 ${mutedCls}`}>Log in to open your journal.</p>

              {message && (
                <div role="alert" className={messageCls(message.type)}>
                  {message.text}
                </div>
              )}

              {/* Google is for logging in only; new accounts go through the email code */}
              <GoogleButton onCredential={handleGoogleCredential} disabled={loading} />

              <Field id="l-id" label="Email or username" value={login.identifier} onChange={setLoginField("identifier")} autoComplete="username" autoFocus />
              <PasswordField id="l-pw" label="Password" value={login.password} onChange={setLoginField("password")} autoComplete="current-password" />

              <button type="submit" disabled={loading} className={submitCls}>
                {loading ? "Logging in…" : "Log in"}
              </button>
              <p className={`mt-5 text-center text-[13px] ${mutedCls}`}>
                New here?{" "}
                <button type="button" onClick={() => switchMode("register")} className={linkBtnCls}>Create an account</button>
              </p>
            </form>
          )}

          {/* Stays mounted while hidden so a verified email isn't lost if the user peeks at the log-in tab */}
          <div hidden={mode !== "register"}>
            <SignupFlow onComplete={finishLogin} onLogin={() => switchMode("login")} />
          </div>
        </div>
      </main>
    </div>
  )
}
