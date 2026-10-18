import { createPortal } from 'react-dom'

/**
 * A six-petal bloom. Three long petals sit at 0, 120 and 240 degrees, three short, fainter ones fill the gaps between
 * them, and a small core holds the centre. Layered like this it reads as a flower opening rather than a stock icon.
 */
function MentorMark({ className = 'h-6 w-6' }) {
  const long = [0, 120, 240]
  const short = [60, 180, 300]
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      {short.map((angle) => (
        <ellipse key={angle} cx="12" cy="7.9" rx="1.9" ry="3.3" opacity="0.42" transform={`rotate(${angle} 12 12)`} />
      ))}
      {long.map((angle) => (
        <ellipse key={angle} cx="12" cy="6.6" rx="2.3" ry="4.6" opacity="0.9" transform={`rotate(${angle} 12 12)`} />
      ))}
      <circle cx="12" cy="12" r="1.9" />
    </svg>
  )
}

/**
 * The way into the AI mentor: a quiet floating orb in the bottom-right corner of every journal tab.
 * Resting, it is a paper-white (or charcoal) disc with a hairline border and a slow clay glow orbiting its edge.
 * Hovered or focused, it unfolds leftwards into a pill that names itself, Notion-style, while the bloom turns and opens.
 * Rendered in a portal so no ancestor (the page header uses backdrop-blur) can trap its `fixed` position.
 */
function MentorOrb({ onOpen, onWarm }) {
  return createPortal(
    <div className="group fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-40 md:bottom-7 md:right-7" data-tour="mentor-orb">
      {/* slow clay glow orbiting the disc; fades out while the pill is open */}
      <span aria-hidden="true" className="mentor-orb-halo pointer-events-none absolute right-0 top-0 h-12 w-12 rounded-full transition-opacity duration-300 group-hover:opacity-0 group-focus-within:opacity-0" />

      <button
        type="button"
        onClick={onOpen}
        onPointerEnter={onWarm}
        onFocus={onWarm}
        aria-label="Open mentor review"
        title="Mentor review: feedback on a week or any date range, checked against your strategy"
        className="relative flex h-12 items-center overflow-hidden rounded-full border border-[#e3dccf] bg-gradient-to-b from-white to-[#f7f3ec] text-[#c4623f] shadow-[0_1px_2px_rgb(28_25_23/0.10),0_8px_20px_-6px_rgb(28_25_23/0.28)] transition-[box-shadow,border-color] duration-300 hover:border-[#d6a88f] hover:shadow-[0_2px_4px_rgb(28_25_23/0.12),0_14px_28px_-8px_rgb(196_98_63/0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c4623f] focus-visible:ring-offset-2 focus-visible:ring-offset-[#dfddd6] dark:border-white/[0.14] dark:from-[#242424] dark:to-[#1a1a1a] dark:text-[#e08a68] dark:shadow-[0_8px_24px_-8px_rgb(0_0_0/0.7)] dark:hover:border-[#e08a68]/50 dark:focus-visible:ring-[#e08a68] dark:focus-visible:ring-offset-[#111111]"
      >
        <span className="max-w-0 whitespace-nowrap pl-0 text-[13px] font-medium tracking-[-0.01em] text-zinc-800 opacity-0 transition-[max-width,padding,opacity] duration-300 ease-out group-hover:max-w-[9rem] group-hover:pl-4 group-hover:opacity-100 group-focus-within:max-w-[9rem] group-focus-within:pl-4 group-focus-within:opacity-100 motion-reduce:transition-none dark:text-zinc-100">
          Mentor review
        </span>
        <span className="grid h-12 w-12 shrink-0 place-items-center">
          <MentorMark className="h-6 w-6 transition-transform duration-700 ease-out group-hover:rotate-[60deg] group-hover:scale-110 motion-reduce:transition-none" />
        </span>
      </button>
    </div>,
    document.body
  )
}

export default MentorOrb
