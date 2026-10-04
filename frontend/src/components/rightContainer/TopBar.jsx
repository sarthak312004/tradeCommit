import ProfileMenu from '../profile/ProfileMenu'

function TopBar({ label = 'Journal', title }) {
  return (
    <header className="relative z-30 flex items-center justify-between gap-4 border-b border-zinc-300 bg-white px-6 py-4 shadow-sm dark:border-white/[0.10] dark:bg-panel dark:shadow-none">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">{label}</p>
        <h1 className="mt-1 truncate text-2xl font-semibold tracking-[-0.06em]">{title}</h1>
      </div>
      <ProfileMenu />
    </header>
  )
}

export default TopBar
