function TopBar({ label = 'Journal', title }) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-300/70 bg-white px-6 py-4 shadow-sm backdrop-blur-sm dark:border-white/[0.07] dark:bg-[#191919]/80 dark:shadow-none">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</p>
        <h1 className="mt-1 truncate text-2xl font-semibold tracking-[-0.06em]">{title}</h1>
      </div>
    </header>
  )
}

export default TopBar
