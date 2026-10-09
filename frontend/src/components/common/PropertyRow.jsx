// Notion-style "icon + label : value" row used at the top of the forms.
// Label zinc-600 / zinc-400 (AA), the value inside is zinc-900 / zinc-50 (see formStyles.inputClass).
function PropertyRow({ Icon, label, hint, htmlFor, error, children }) {
  const Label = htmlFor ? 'label' : 'div'
  const labelProps = htmlFor ? { htmlFor } : {}

  return (
    <div className="flex items-start gap-3 py-0.5">
      <Label {...labelProps} className="flex h-8 w-36 shrink-0 items-center gap-2 text-[13px] text-zinc-600 dark:text-zinc-400">
        <span className="shrink-0"><Icon className="h-[15px] w-[15px]" /></span>
        <span className="truncate">{label}</span>
        {hint && <span className="text-[11px] text-zinc-500 dark:text-zinc-400">({hint})</span>}
      </Label>
      <div className="min-w-0 flex-1">
        {children}
        {error && <p role="alert" className="mt-0.5 px-2 text-[11px] font-medium text-rose-700 dark:text-rose-300">{error}</p>}
      </div>
    </div>
  )
}

export default PropertyRow
