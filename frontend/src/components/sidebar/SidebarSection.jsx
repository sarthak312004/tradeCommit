import { PlusIcon } from "../../utils/Icons.jsx"
import { EASE, FADE_BASE, fade, ghostBtn } from "./sidebarStyles"

/**
 * One labelled sidebar section: header with a "+" button, an animated create form,
 * a scrollable list (expanded sidebar) and a scrollable icon rail (collapsed sidebar).
 *
 * Sections size to their content and shrink independently, so when several sections
 * compete for space each one scrolls on its own instead of pushing the footer away.
 *
 * @param {string}    title
 * @param {string}    addLabel         tooltip / aria label of the "+" button
 * @param {boolean}   isSidebarOpen
 * @param {Function}  setIsSidebarOpen
 * @param {Function}  renderForm       ({ open, close }) => ReactNode, the create form
 * @param {Array}     railItems        [{ id, label, isSelected, onSelect }] shown when collapsed
 * @param {boolean}   isEmpty
 * @param {string}    emptyText
 * @param {ReactNode} children         expanded list rows
 */
function SidebarSection({
  title,
  addLabel,
  isSidebarOpen,
  setIsSidebarOpen,
  isFormOpen,
  onFormOpenChange,
  renderForm,
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
    <section aria-label={title} className="flex min-h-[88px] min-w-0 shrink flex-col">
      {/* Header: label + add */}
      <div className="relative h-8 shrink-0">
        <div
          className={`absolute inset-y-0 left-0 flex w-[260px] items-center justify-between pl-4 pr-2 ${FADE_BASE} ${fade(isSidebarOpen)}`}
        >
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-500">
            {title}
          </span>
          <button
            type="button"
            onClick={handleAddClick}
            aria-expanded={showForm}
            title={addLabel}
            aria-label={addLabel}
            className={`flex h-6 w-6 items-center justify-center rounded-md ${ghostBtn}`}
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>
        <div
          className={`absolute inset-y-0 left-0 flex w-[56px] items-center justify-center ${FADE_BASE} ${fade(!isSidebarOpen)}`}
        >
          <button
            type="button"
            onClick={handleAddClick}
            title={addLabel}
            aria-label={addLabel}
            className={`flex h-8 w-8 items-center justify-center rounded-md ${ghostBtn}`}
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Create form */}
      <div
        className={`grid shrink-0 transition-[grid-template-rows,opacity,visibility] duration-200 ${EASE} motion-reduce:transition-none ${
          showForm ? "visible grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">{renderForm({ open: showForm, close: closeForm })}</div>
      </div>

      {/* List */}
      {isSidebarOpen ? (
        <div className="subtle-scrollbar min-h-0 w-[260px] flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
          {isEmpty ? (
            <p className="px-2 py-3 text-[13px] text-zinc-600 dark:text-zinc-500">{emptyText}</p>
          ) : (
            <div className="space-y-px">{children}</div>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 w-[56px] flex-1 flex-col items-center gap-1 overflow-y-auto overscroll-contain py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                  ? "bg-black/[0.07] text-zinc-900 dark:bg-white/[0.1] dark:text-zinc-50"
                  : "text-zinc-500 hover:bg-black/[0.05] dark:text-zinc-400 dark:hover:bg-white/[0.07]"
              }`}
            >
              {item.label.slice(0, 2).toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

export default SidebarSection
