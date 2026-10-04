// Notion-style "icon + label : value" row used at the top of the forms.
function PropertyRow({ Icon, label, htmlFor, error, children }) {
  const Label = htmlFor ? 'label' : 'div'
  const labelProps = htmlFor ? { htmlFor } : {}

  return (
    <div className="flex items-start gap-2 py-0.5">
      <Label {...labelProps} className="flex h-8 w-32 shrink-0 items-center gap-2 text-[13px] text-zinc-600 dark:text-zinc-300">
        <span className="text-zinc-500 dark:text-zinc-400"><Icon className="h-[15px] w-[15px]" /></span>
        <span className="truncate">{label}</span>
      </Label>
      <div className="min-w-0 flex-1">
        {children}
        {error && <p className="mt-0.5 px-1 text-[11px] text-rose-500">{error}</p>}
      </div>
    </div>
  )
}

export default PropertyRow
