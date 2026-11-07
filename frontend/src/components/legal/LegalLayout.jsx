import { useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import { SERIF } from '../auth/authStyles'
import { focusRing } from '../common/controlStyles'
import { ThemeCycleButton } from '../sidebar/ThemeToggle'
import { LEGAL_CONFIG, LEGAL_PAGES } from '../../config/legal'
import { useTheme } from '../../hooks/useTheme'

const CURRENT_YEAR = new Date().getFullYear()

function TradeCommitMark({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={`shrink-0 ${className}`}>
      <rect width="64" height="64" rx="15" className="fill-zinc-900 dark:fill-zinc-100" />
      <g
        transform="translate(8.2 10) scale(0.9167)"
        fill="none"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-zinc-100 dark:stroke-zinc-900"
      >
        <path d="M10 8H42" />
        <path d="M26 8V42.75" strokeLinecap="butt" />
        <path d="M42 8H30a4 4 0 0 0-4 4V36a4 4 0 0 0 4 4H42" />
      </g>
    </svg>
  )
}

function ArrowLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5" />
      <path d="m11 18-6-6 6-6" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

/**
 * Renders a legal/contact field from LEGAL_CONFIG.
 * When confirmed via env/config, renders as plain text (or mailto link if `mailto` is true).
 * When unconfirmed, renders a subtle, unmistakable placeholder badge so unverified legal/contact
 * details are never fabricated or silently mistaken for final text.
 */
export function LegalField({ field, mailto = false }) {
  if (!field) return null
  if (field.confirmed) {
    if (mailto) {
      return (
        <a
          href={`mailto:${field.value}`}
          className={`font-medium text-zinc-900 underline decoration-zinc-400 underline-offset-4 transition-colors hover:decoration-zinc-900 dark:text-zinc-100 dark:decoration-zinc-500 dark:hover:decoration-zinc-100 ${focusRing}`}
        >
          {field.value}
        </a>
      )
    }
    return <span className="font-medium text-zinc-900 dark:text-zinc-100">{field.value}</span>
  }

  return (
    <span
      title={`Owner confirmation required before production launch: ${field.placeholderLabel}`}
      className="inline-flex items-baseline rounded border border-amber-500/40 bg-amber-500/[0.08] px-1.5 py-0.5 font-mono text-[12px] font-medium text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/[0.08] dark:text-amber-200"
    >
      {field.value}
    </span>
  )
}

/**
 * Numbered Notion/Claude-style document section.
 */
export function LegalSection({ number, id, title, children }) {
  const formattedNumber = typeof number === 'number' ? String(number).padStart(2, '0') : number
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-heading` : undefined}
      className="scroll-mt-24 border-t border-zinc-300/65 py-8 first:border-t-0 first:pt-2 sm:py-10 dark:border-white/[0.07]"
    >
      <div className="mb-3.5 flex items-baseline gap-3">
        {formattedNumber && (
          <span className="font-mono text-[11px] font-medium tracking-[0.14em] text-zinc-400 select-none dark:text-zinc-500">
            {formattedNumber}
          </span>
        )}
        <h2
          id={id ? `${id}-heading` : undefined}
          className={`${SERIF} text-[21px] font-medium leading-snug tracking-[-0.02em] text-zinc-900 sm:text-[23px] dark:text-zinc-50`}
        >
          {title}
        </h2>
      </div>
      <div className="space-y-4 text-[14.5px] leading-[1.75] text-zinc-700 sm:text-[15px] dark:text-zinc-300">
        {children}
      </div>
    </section>
  )
}

export function LegalSubheading({ children }) {
  return (
    <h3 className="pt-2 text-[14.5px] font-semibold tracking-[-0.01em] text-zinc-900 sm:text-[15px] dark:text-zinc-100">
      {children}
    </h3>
  )
}

export function LegalList({ items }) {
  return (
    <ul className="space-y-2 pl-4 text-[14.5px] leading-[1.7] text-zinc-700 sm:text-[15px] dark:text-zinc-300">
      {items.map((item, idx) => (
        <li key={idx} className="relative pl-2.5 before:absolute before:top-[0.68em] before:-left-2 before:h-1 before:w-1 before:rounded-full before:bg-zinc-400 dark:before:bg-zinc-500">
          {item}
        </li>
      ))}
    </ul>
  )
}

export function LegalCallout({ label, children, tone = 'neutral' }) {
  const toneCls =
    tone === 'warm'
      ? 'border-[#b95b3b]/30 bg-[#b95b3b]/[0.05] dark:border-[#e08a68]/25 dark:bg-[#e08a68]/[0.05]'
      : 'border-zinc-300/80 bg-[#ebe9e3]/75 dark:border-white/[0.08] dark:bg-[#171717]'
  return (
    <aside className={`my-4 rounded-xl border px-4 py-3.5 text-[13.5px] leading-relaxed text-zinc-700 sm:px-5 sm:py-4 dark:text-zinc-300 ${toneCls}`}>
      {label && (
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
          {label}
        </p>
      )}
      <div className="space-y-2">{children}</div>
    </aside>
  )
}

export const inlineLinkCls = `font-medium text-zinc-900 underline decoration-zinc-400 underline-offset-4 transition-colors hover:decoration-zinc-900 dark:text-zinc-100 dark:decoration-zinc-500 dark:hover:decoration-zinc-100 ${focusRing}`

/**
 * Shared Claude × Notion document shell for TradeCommit's public legal and support pages.
 */
export default function LegalLayout({
  category = 'Legal',
  title,
  description,
  lastUpdated = LEGAL_CONFIG.lastUpdated,
  sections = [],
  children,
}) {
  const { theme, setTheme } = useTheme()
  const location = useLocation()

  const currentIndex = LEGAL_PAGES.findIndex((p) => p.path === location.pathname)
  const prevPage = currentIndex > 0 ? LEGAL_PAGES[currentIndex - 1] : null
  const nextPage = currentIndex >= 0 && currentIndex < LEGAL_PAGES.length - 1 ? LEGAL_PAGES[currentIndex + 1] : null

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [location.pathname])

  useEffect(() => {
    const previousTitle = document.title
    document.title = `${title} — TradeCommit`

    let meta = document.querySelector('meta[name="description"]')
    const createdMeta = !meta
    const previousDescription = meta?.getAttribute('content') ?? null

    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    if (description) {
      meta.setAttribute('content', description)
    }

    return () => {
      document.title = previousTitle
      if (createdMeta && meta?.parentNode) {
        meta.parentNode.removeChild(meta)
      } else if (meta && previousDescription !== null) {
        meta.setAttribute('content', previousDescription)
      }
    }
  }, [title, description])

  return (
    <div className="min-h-dvh bg-canvas text-zinc-900 transition-colors duration-200 dark:bg-[#101010] dark:text-zinc-100">
      <a
        href="#legal-document-body"
        className="sr-only z-[90] rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3 dark:bg-zinc-100 dark:text-zinc-900"
      >
        Skip to document content
      </a>

      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-zinc-300/65 bg-[#e4e2dc]/85 backdrop-blur-xl dark:border-white/[0.07] dark:bg-[#101010]/85">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Link
              to="/"
              className={`${SERIF} inline-flex shrink-0 items-center gap-2 rounded text-[18px] font-semibold tracking-[-0.025em] text-zinc-900 sm:text-[19px] dark:text-zinc-100 ${focusRing}`}
            >
              <TradeCommitMark size={24} />
              <span>Trade Commit</span>
            </Link>
            <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">/</span>
            <Link
              to="/auth"
              className={`inline-flex items-center gap-1.5 rounded text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 ${focusRing}`}
            >
              <ArrowLeftIcon />
              <span className="hidden sm:inline">Back to TradeCommit</span>
              <span className="sm:hidden">Home</span>
            </Link>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <nav aria-label="Legal and support pages" className="hidden items-center gap-1 md:flex">
              {LEGAL_PAGES.map((page) => {
                const active = location.pathname === page.path
                return (
                  <Link
                    key={page.path}
                    to={page.path}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${focusRing} ${
                      active
                        ? 'bg-zinc-900/[0.07] text-zinc-900 dark:bg-white/[0.10] dark:text-zinc-50'
                        : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }`}
                  >
                    {page.shortLabel}
                  </Link>
                )
              })}
            </nav>
            <ThemeCycleButton theme={theme} setTheme={setTheme} />
          </div>
        </div>

        {/* Compact horizontal switcher on mobile/tablet below md */}
        <nav
          aria-label="Legal pages mobile navigation"
          className="no-scrollbar flex items-center gap-1 overflow-x-auto border-t border-zinc-300/50 px-4 py-2 md:hidden dark:border-white/[0.05]"
        >
          {LEGAL_PAGES.map((page) => {
            const active = location.pathname === page.path
            return (
              <Link
                key={page.path}
                to={page.path}
                aria-current={active ? 'page' : undefined}
                className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${focusRing} ${
                  active
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                {page.shortLabel}
              </Link>
            )
          })}
        </nav>
      </header>

      {/* Main Document Container */}
      <main id="legal-document-body" className="mx-auto max-w-3xl px-5 pt-10 pb-16 sm:px-8 sm:pt-14 sm:pb-24">
        {/* Document Header */}
        <header className="border-b border-zinc-300/75 pb-8 sm:pb-10 dark:border-white/[0.08]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b95b3b] dark:text-[#e08a68]">
            {category}
          </p>
          <h1
            className={`${SERIF} mt-2.5 text-balance text-[32px] font-medium leading-[1.08] tracking-[-0.03em] text-zinc-950 sm:text-[42px] dark:text-zinc-50`}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-3.5 max-w-2xl text-[15px] leading-relaxed text-zinc-600 sm:text-[16px] dark:text-zinc-400">
              {description}
            </p>
          )}
          {lastUpdated && (
            <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
              Last updated: <time>{lastUpdated}</time>
            </p>
          )}

          {/* Optional quiet section index for long documents */}
          {sections.length > 0 && (
            <nav aria-label="On this page" className="mt-6 rounded-xl border border-zinc-300/70 bg-[#ebe9e3]/60 p-3.5 sm:p-4 dark:border-white/[0.07] dark:bg-[#161616]">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                Contents
              </p>
              <ol className="grid gap-x-6 gap-y-1.5 text-[12.5px] sm:grid-cols-2">
                {sections.map((sec, idx) => (
                  <li key={sec.id} className="truncate">
                    <a
                      href={`#${sec.id}`}
                      className={`inline-flex items-baseline gap-2 text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100 ${focusRing}`}
                    >
                      <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="truncate">{sec.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}
        </header>

        {/* Document Body */}
        <article className="divide-y divide-zinc-300/65 dark:divide-white/[0.07]">
          {children}
        </article>

        {/* Bottom Support & Previous/Next Navigation */}
        <footer className="mt-12 space-y-8 border-t border-zinc-300/75 pt-8 dark:border-white/[0.08]">
          <div className="flex flex-col justify-between gap-3 rounded-xl border border-zinc-300/75 bg-[#ebe9e3]/65 px-4 py-4 sm:flex-row sm:items-center sm:px-5 dark:border-white/[0.07] dark:bg-[#161616]">
            <div className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">Need help with your account or billing?</span>{' '}
              Reach out on our support page or manage your plan directly in your workspace.
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3 text-xs font-medium">
              {location.pathname !== '/contact' && (
                <Link to="/contact" className={inlineLinkCls}>
                  Contact &amp; Support
                </Link>
              )}
              <Link to="/billing" className={inlineLinkCls}>
                Plan &amp; billing
              </Link>
            </div>
          </div>

          {(prevPage || nextPage) && (
            <nav aria-label="Adjacent policy pages" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {prevPage ? (
                <Link
                  to={prevPage.path}
                  className={`group flex flex-col rounded-xl border border-zinc-300/70 bg-white/45 px-4 py-3.5 text-left transition-colors hover:border-zinc-400 hover:bg-white/75 dark:border-white/[0.07] dark:bg-white/[0.02] dark:hover:border-white/[0.15] dark:hover:bg-white/[0.04] ${focusRing}`}
                >
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <ArrowLeftIcon /> Previous
                  </span>
                  <span className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">{prevPage.title}</span>
                </Link>
              ) : (
                <div className="hidden sm:block" />
              )}

              {nextPage ? (
                <Link
                  to={nextPage.path}
                  className={`group flex flex-col items-end rounded-xl border border-zinc-300/70 bg-white/45 px-4 py-3.5 text-right transition-colors hover:border-zinc-400 hover:bg-white/75 dark:border-white/[0.07] dark:bg-white/[0.02] dark:hover:border-white/[0.15] dark:hover:bg-white/[0.04] ${focusRing}`}
                >
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Next <ArrowRightIcon />
                  </span>
                  <span className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">{nextPage.title}</span>
                </Link>
              ) : (
                <div className="hidden sm:block" />
              )}
            </nav>
          )}
        </footer>
      </main>

      {/* Site Footer */}
      <footer className="border-t border-zinc-300/65 px-5 pt-7 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-8 dark:border-white/[0.06]">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 text-[12px] text-zinc-500 sm:flex-row sm:items-center sm:justify-between dark:text-zinc-400">
          <div className="flex items-center gap-2.5">
            <Link to="/" className={`${SERIF} inline-flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 ${focusRing}`}>
              <TradeCommitMark size={18} />
              <span>Trade Commit</span>
            </Link>
            <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">·</span>
            <span>© {CURRENT_YEAR} Trade Commit</span>
          </div>

          <nav aria-label="Footer legal links" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {LEGAL_PAGES.map((page) => (
              <Link
                key={page.path}
                to={page.path}
                className={`rounded transition-colors hover:text-zinc-900 dark:hover:text-zinc-100 ${focusRing}`}
              >
                {page.shortLabel === 'Terms' || page.shortLabel === 'Privacy' ? page.shortLabel : page.title}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  )
}
