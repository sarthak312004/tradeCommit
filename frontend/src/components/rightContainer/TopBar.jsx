import ProfileMenu from '../profile/ProfileMenu'

function TopBar({ label = 'Journal', title }) {
  return (
    <header className="relative z-30 flex min-h-[72px] items-center justify-between gap-4 border-b border-zinc-300 bg-white px-6 py-3 shadow-sm dark:border-white/[0.10] dark:bg-panel dark:shadow-none">
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium uppercase leading-4 tracking-[0.14em] text-zinc-600 dark:text-zinc-400">{label}</p>
        {/* fixed line-height + normal tracking: crisp glyphs, and the title baseline never shifts with font fallback */}
        <h1 className="mt-0.5 truncate text-2xl font-semibold leading-8 tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h1>
      </div>
      <ProfileMenu />
    </header>
  )
}

export default TopBar
