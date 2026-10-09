import { MonitorIcon, MoonIcon, SunIcon } from "../../utils/Icons.jsx"

const OPTIONS = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
]

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 dark:focus-visible:ring-sky-400"

/** Expanded: segmented control with all three options. */
export function ThemeSegmented({ theme, setTheme }) {
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="flex h-8 items-center gap-0.5 rounded-lg bg-black/[0.08] p-0.5 dark:bg-white/[0.07]"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={`flex h-full w-9 cursor-pointer items-center justify-center rounded-md transition-colors ${focusRing} ${
              active
                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-900/10 dark:bg-zinc-600 dark:text-white dark:ring-0"
                : "text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        )
      })}
    </div>
  )
}

/** Collapsed rail: single button that cycles light → dark → system. */
export function ThemeCycleButton({ theme, setTheme }) {
  const index = OPTIONS.findIndex((o) => o.value === theme)
  const current = OPTIONS[index === -1 ? 2 : index]
  const next = OPTIONS[(index + 1) % OPTIONS.length]
  const { Icon } = current

  return (
    <button
      type="button"
      onClick={() => setTheme(next.value)}
      title={`Theme: ${current.label} (click for ${next.label})`}
      aria-label={`Theme: ${current.label}. Switch to ${next.label}`}
      className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-zinc-700 transition-colors hover:bg-black/[0.05] hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/[0.07] dark:hover:text-zinc-100 ${focusRing}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}
