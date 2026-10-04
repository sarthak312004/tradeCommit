function SummaryCard({ item }) {
  return (
    <div className="rounded-2xl border border-zinc-300 bg-white/80 p-4 shadow-sm dark:border-white/[0.12] dark:bg-panel">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{item.label}</p>
      <p className={`mt-4 text-3xl font-semibold tracking-[-0.06em] ${item.tone}`}>
        {item.value}
      </p>
    </div>
  )
}

export default SummaryCard
