import { MOD_LABEL } from '../../hooks/useFormShortcuts'

const keyClass = 'rounded border border-zinc-300 px-1 py-px font-sans text-[10px] text-zinc-500 dark:border-white/[0.16] dark:text-zinc-400'

/** Small "Esc close · Ctrl Enter save" reminder for form footers. */
function ShortcutHint({ className = '' }) {
  return (
    <p className={`text-[11px] text-zinc-400 dark:text-zinc-500 ${className}`}>
      <kbd className={keyClass}>Esc</kbd> close
      <span aria-hidden="true" className="mx-1.5 opacity-60">&middot;</span>
      <kbd className={keyClass}>{MOD_LABEL}</kbd> <kbd className={keyClass}>Enter</kbd> save
    </p>
  )
}

export default ShortcutHint
