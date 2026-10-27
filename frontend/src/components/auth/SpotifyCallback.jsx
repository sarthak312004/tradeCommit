import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router"
import { completeSpotifyAuthorization } from "../../services/spotifyAuth"

function SpotifyCallback() {
  const location = useLocation()
  const navigate = useNavigate()
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    completeSpotifyAuthorization(location.search)
      .then((returnTo) => {
        if (active) navigate(returnTo, { replace: true })
      })
      .catch((authorizationError) => {
        if (active) setError(authorizationError.message || "Could not connect Spotify.")
      })
    return () => { active = false }
  }, [location.search, navigate])

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f6f2] px-4 text-stone-800 dark:bg-[#111311] dark:text-stone-100">
      <section className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 text-center shadow-xl dark:border-white/10 dark:bg-[#1b1e1b]">
        <h1 className="text-sm font-semibold">Connecting Spotify</h1>
        {error
          ? <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>
          : <p role="status" className="mt-2 text-xs text-stone-500 dark:text-stone-400">Finishing secure authorization…</p>}
        {error && <button type="button" onClick={() => navigate("/", { replace: true })} className="mt-4 rounded-md px-3 py-1.5 text-xs font-medium hover:bg-stone-100 dark:hover:bg-white/[0.08]">Return to TradeCommit</button>}
      </section>
    </main>
  )
}

export default SpotifyCallback
