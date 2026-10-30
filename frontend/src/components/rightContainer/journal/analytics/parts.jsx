/* Small shared building blocks for the analytics tabs. */

export function Section({ title, note, children, className = '' }) {
  return (
    <section className={className}>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <h3 className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{title}</h3>
        {note && <p className="text-[11px] text-zinc-600 dark:text-zinc-400">{note}</p>}
      </div>
      {children}
    </section>
  )
}

export function EmptyNote({ title, children }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-5 text-center dark:border-white/[0.14]">
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-xs leading-snug text-zinc-600 dark:text-zinc-400">{children}</p>}
    </div>
  )
}

export function TabLoading() {
  return (
    <div aria-busy="true" className="space-y-6 p-5 sm:p-6">
      <span role="status" className="sr-only">Loading analytics…</span>
      {[0, 1, 2].map((item) => (
        <div key={item} aria-hidden="true">
          <div className="h-3 w-28 animate-pulse rounded bg-zinc-200 dark:bg-white/[0.08]" />
          <div className="mt-3 h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-white/[0.05]" />
        </div>
      ))}
    </div>
  )
}

export const toneText = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-rose-500 dark:text-rose-400',
  neutral: 'text-zinc-900 dark:text-zinc-100'
}
