function TopBar({ journalName }) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 bg-stone-100/80 px-6 py-4 backdrop-blur-sm dark:border-zinc-800 dark:bg-[#111315]/80">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Journal</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.06em]">{journalName || 'Home'}</h1>
      </div>

      {/* <button
        type="button"
        onClick={() => setIsDark((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600"
      >
        <span>{isDark ? '☀️' : '🌙'}</span>
        {isDark ? 'Light' : 'Dark'}
      </button> */}
    </header>
  )
}

export default TopBar
