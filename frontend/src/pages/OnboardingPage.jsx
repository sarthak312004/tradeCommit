import { useState } from "react"
import { useNavigate } from "react-router"
import { useProfile } from "../hooks/useProfile"
import { requestJson } from "../utils/http"
import { clearProfileCache } from "../services/profileApi"
import { SERIF } from "../components/auth/authStyles"

const STYLES = [
  { id: "intraday", label: "Intraday", description: "Plan and review trades within the same session.", icon: "◷" },
  { id: "swing", label: "Swing", description: "Hold setups for days to a few weeks.", icon: "↗" },
  { id: "position", label: "Position", description: "Build around longer-term market moves.", icon: "⌁" },
  { id: "hybrid", label: "Hybrid", description: "Combine intraday, swing, and position approaches.", icon: "✦" },
]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { profile, error: profileError } = useProfile()
  const [step, setStep] = useState(0)
  const [style, setStyle] = useState("intraday")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  const finish = async (selectedStyle = style) => {
    setLoading(true)
    setMessage("")
    try {
      await requestJson("/api/v1/auth/onboarding/complete", {
        method: "POST",
        body: { tradingStyle: selectedStyle },
      })
      // The profile hook caches the pre-onboarding profile. Clear it before
      // returning home so Home does not redirect the user back to onboarding.
      clearProfileCache()
      navigate("/", { replace: true })
    } catch (error) {
      setMessage(error.message || "Could not save your setup. Please try again.")
      setLoading(false)
    }
  }

  if (profileError) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas px-6 text-sm text-zinc-600 dark:bg-night dark:text-zinc-300">
        Could not load your profile. Please refresh and try again.
      </div>
    )
  }

  if (!profile) {
    return <div className="grid min-h-screen place-items-center bg-canvas text-sm text-zinc-500 dark:bg-night dark:text-zinc-400">Setting up your workspace…</div>
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-canvas text-zinc-900 dark:bg-night dark:text-zinc-100">
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(circle_at_20%_15%,rgba(120,113,108,0.10),transparent_32%),radial-gradient(circle_at_80%_80%,rgba(120,113,108,0.08),transparent_30%)] dark:opacity-40" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-7 sm:px-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-zinc-900 text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">T</span>
            <span className="text-sm font-medium tracking-[-0.01em]">TradeCommit</span>
          </div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Workspace setup</div>
        </header>

        <section className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-2xl">
            <div className="mb-10 flex items-center gap-2" aria-label={`Step ${step + 1} of 3`}>
              {[0, 1, 2].map((item) => (
                <span key={item} className={`h-1 flex-1 rounded-full ${item <= step ? "bg-zinc-800 dark:bg-zinc-200" : "bg-zinc-300/80 dark:bg-white/10"}`} />
              ))}
            </div>

            {step === 0 && (
              <div className="animate-[fadeIn_.25s_ease-out]">
                <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">Welcome, {profile.fullname.split(" ")[0]}</p>
                <h1 className={`${SERIF} max-w-xl text-5xl font-medium leading-[1.04] tracking-[-0.035em] sm:text-6xl`}>
                  A calmer place to think about your trades.
                </h1>
                <p className="mt-6 max-w-xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
                  TradeCommit keeps your decisions, plans and reviews together. Let&apos;s take a few seconds to shape your workspace.
                </p>

                <div className="mt-10 grid gap-3 sm:grid-cols-3">
                  {[
                    ["Write", "Capture the reason before the result."],
                    ["Plan", "Turn ideas into dated trade plans."],
                    ["Review", "Spot patterns across your journal."],
                  ].map(([title, body]) => (
                    <div key={title} className="rounded-lg border border-zinc-200/90 bg-white/70 p-4 shadow-card backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.025] dark:shadow-none">
                      <p className="text-sm font-medium">{title}</p>
                      <p className="mt-1.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{body}</p>
                    </div>
                  ))}
                </div>

                <button onClick={() => setStep(1)} className="mt-10 inline-flex h-10 items-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white">
                  Set up my workspace <span className="ml-2">→</span>
                </button>
              </div>
            )}

            {step === 1 && (
              <div>
                <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">Step 2 · Your style</p>
                <h1 className={`${SERIF} text-4xl font-medium tracking-[-0.025em] sm:text-5xl`}>What do you trade most?</h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">This helps us give your first Trade Planner a useful starting point. You can create other planner types anytime.</p>

                <div className="mt-8 grid gap-3">
                  {STYLES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setStyle(item.id)}
                      className={`group flex w-full items-center gap-4 rounded-xl border p-4 text-left transition ${
                        style === item.id
                          ? "border-zinc-700 bg-white shadow-card dark:border-zinc-400 dark:bg-panel"
                          : "border-zinc-200 bg-white/50 hover:border-zinc-400 dark:border-white/[0.08] dark:bg-white/[0.025] dark:hover:border-white/20"
                      }`}
                    >
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-lg ${style === item.id ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-400"}`}>{item.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{item.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">{item.description}</span>
                      </span>
                      <span className={`h-4 w-4 rounded-full border ${style === item.id ? "border-[5px] border-zinc-800 dark:border-zinc-200" : "border-zinc-300 dark:border-zinc-600"}`} />
                    </button>
                  ))}
                </div>

                <div className="mt-8 flex items-center justify-between">
                  <button onClick={() => setStep(0)} className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">← Back</button>
                  <button onClick={() => setStep(2)} className="h-10 rounded-md bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white">Continue</button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">Step 3 · You&apos;re ready</p>
                <h1 className={`${SERIF} text-4xl font-medium tracking-[-0.025em] sm:text-5xl`}>Your workspace is yours now.</h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">We&apos;ll start you with a clean journal and your preferred <span className="font-medium text-zinc-800 dark:text-zinc-200">{style}</span> planning mindset. Nothing is locked in.</p>

                <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-card dark:border-white/[0.08] dark:bg-panel dark:shadow-none">
                  <div className="border-b border-zinc-200 px-5 py-4 dark:border-white/[0.08]">
                    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">Your setup</p>
                  </div>
                  <div className="divide-y divide-zinc-100 dark:divide-white/[0.06]">
                    <div className="flex items-center justify-between px-5 py-4 text-sm"><span className="text-zinc-500">Trading style</span><span className="font-medium capitalize">{style}</span></div>
                    <div className="flex items-center justify-between px-5 py-4 text-sm"><span className="text-zinc-500">Journal</span><span className="font-medium">Ready</span></div>
                    <div className="flex items-center justify-between px-5 py-4 text-sm"><span className="text-zinc-500">Trade Planner</span><span className="font-medium">Ready</span></div>
                  </div>
                </div>

                {message && <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-400">{message}</p>}

                <div className="mt-8 flex items-center justify-between">
                  <button onClick={() => setStep(1)} disabled={loading} className="text-sm text-zinc-500 hover:text-zinc-900 disabled:opacity-50 dark:hover:text-zinc-100">← Back</button>
                  <button onClick={() => finish()} disabled={loading} className="h-10 rounded-md bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white">
                    {loading ? "Saving…" : "Enter TradeCommit →"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <footer className="flex items-center justify-between text-[11px] text-zinc-500">
          <span>Private by default. Built for deliberate decisions.</span>
          <span>{step + 1} / 3</span>
        </footer>
      </div>
    </main>
  )
}
