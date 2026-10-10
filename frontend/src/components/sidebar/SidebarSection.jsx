import { PlusIcon } from "../../utils/Icons.jsx"
import { EASE, FADE_BASE, fade, focusRing, ghostBtn } from "./sidebarStyles"

/**
 * One labelled sidebar section: header with a "+" button, an animated create form,
 * a scrollable list (expanded sidebar) and a scrollable icon rail (collapsed sidebar).
 *
 * Sections size to their content and shrink independently, so when several sections
 * compete for space each one scrolls on its own instead of pushing the footer away.
 *
 * @param {string}    title
 * @param {string}    addLabel         tooltip / aria label of the "+" button
 * @param {string}    [tourId]         lets the first-run tour point at this section's header
 * @param {boolean}   isSidebarOpen
 * @param {Function}  setIsSidebarOpen
 * @param {Function}  renderForm       ({ open, close, reopen }) => ReactNode, the create form
 * @param {Function} railIcon         icon component that labels this section in the collapsed rail
 * @param {Array}     railItems        [{ id, label, isSelected, onSelect }] shown when collapsed
 * @param {boolean}   isEmpty
 * @param {string}    emptyText
 * @param {ReactNode} children         expanded list rows
 */
function SidebarSection({
  title,
  tourId,
  addLabel,
  isSidebarOpen,
  setIsSidebarOpen,
  isFormOpen,
  onFormOpenChange,
  renderForm,
  railIcon: RailIcon,
  railItems,
  isEmpty,
  emptyText,
  children,
}) {
  const showForm = isSidebarOpen && isFormOpen
  const closeForm = () => onFormOpenChange(false)

  const handleAddClick = () => {
    if (!isSidebarOpen) {
      setIsSidebarOpen(true)
      onFormOpenChange(true)
      return
    }
    onFormOpenChange(!isFormOpen)
  }

  return (
    <section aria-label={title} className={`flex min-w-0 shrink flex-col ${isSidebarOpen ? "min-h-[88px]" : "min-h-0"}`}>
      {/* Header: label + add */}
      <div data-tour={tourId} className="relative h-9 shrink-0">
        <div
          className={`absolute inset-y-0 left-0 flex w-[260px] items-center justify-between pl-4 pr-2 pt-1 ${FADE_BASE} ${fade(isSidebarOpen)}`}
        >
          <span className="text-[11px] font-semibold uppercase leading-none tracking-wider text-zinc-700 dark:text-zinc-400">
            {title}
          </span>
          <button
            type="button"
            onClick={handleAddClick}
            aria-expanded={showForm}
            title={addLabel}
            aria-label={addLabel}
            className={`flex h-7 w-7 items-center justify-center rounded-md ${ghostBtn}`}
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>
        <div
          className={`absolute inset-y-0 left-0 flex w-[56px] items-center justify-center ${FADE_BASE} ${fade(!isSidebarOpen)}`}
        >
          {/* collapsed: an icon names the section; the "+" sits at the end of its items below */}
          <span
            title={title}
            role="img"
            aria-label={title}
            className="flex h-8 w-8 items-center justify-center pt-1 text-zinc-700 dark:text-zinc-400"
          >
            <RailIcon className="h-4 w-4" />
          </span>
        </div>
      </div>

      {/* Create form */}
      <div
        className={`grid shrink-0 transition-[grid-template-rows,opacity,visibility] duration-200 ${EASE} motion-reduce:transition-none ${
          showForm ? "visible grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">{renderForm({ open: showForm, close: closeForm, reopen: () => onFormOpenChange(true) })}</div>
      </div>

      {/* List */}
      {isSidebarOpen ? (
        <div className="subtle-scrollbar min-h-0 w-[260px] flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
          {isEmpty ? (
            <p className="px-2 py-3 text-[13px] text-zinc-600 dark:text-zinc-400">{emptyText}</p>
          ) : (
            <div className="space-y-px">{children}</div>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 w-[56px] flex-1 flex-col items-center gap-1 overflow-y-auto overscroll-contain pb-2 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {railItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onSelect}
              title={item.label}
              aria-label={item.label}
              aria-current={item.isSelected ? "true" : undefined}
              className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-[11px] font-medium transition-colors ${
                item.isSelected
                  ? "bg-white font-semibold text-zinc-900 shadow-card ring-1 ring-zinc-900/20 dark:bg-white/[0.12] dark:text-zinc-50 dark:shadow-none dark:ring-white/[0.16]"
                  : "text-zinc-700 hover:bg-black/[0.05] dark:text-zinc-300 dark:hover:bg-white/[0.07]"
              }`}
            >
              {item.label.slice(0, 2).toUpperCase()}
            </button>
          ))}
          <button
            type="button"
            onClick={handleAddClick}
            title={addLabel}
            aria-label={addLabel}
            className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-dashed border-zinc-500 text-zinc-700 transition-colors hover:border-zinc-700 hover:bg-black/[0.05] hover:text-zinc-900 dark:border-white/[0.24] dark:text-zinc-400 dark:hover:bg-white/[0.07] dark:hover:text-zinc-100 ${focusRing}`}
          >
            <PlusIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </section>
  )
}

export default SidebarSection
