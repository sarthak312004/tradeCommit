import { createPortal } from "react-dom"
import { useEffect, useId, useRef, useState } from "react"
import { CheckIcon, CloseIcon, PencilIcon, TrashIcon } from "../../utils/Icons.jsx"

// Generic sidebar row (select / rename / delete-with-confirmation).
// JournalCard and PlannerCard are thin wrappers that only supply the data and callbacks.

// ---- Styles -----------------------------------------------------------------

const rowBase = "group relative flex w-full items-center rounded-md transition-colors"

const rowStates = {
	selected: "bg-white shadow-card ring-1 ring-zinc-900/[0.06] dark:bg-white/[0.08] dark:shadow-none dark:ring-0",
	editing: "bg-black/[0.06] dark:bg-white/[0.05]",
	idle: "hover:bg-black/[0.06] dark:hover:bg-white/[0.05]",
}

const getRowClasses = ({ isEditing, isSelected }) => {
	if (isSelected) return `${rowBase} ${rowStates.selected}`
	if (isEditing) return `${rowBase} ${rowStates.editing}`
	return `${rowBase} ${rowStates.idle}`
}

const focusRing =
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60 dark:focus-visible:ring-zinc-500"

const iconButton = `flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors ${focusRing}`

const iconTone = {
	neutral:
		"text-zinc-500 hover:bg-zinc-900/[0.06] hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200",
	confirm:
		"text-zinc-600 hover:bg-zinc-900/[0.06] hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-600 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-zinc-50 dark:disabled:hover:text-zinc-300",
	danger:
		"text-zinc-500 hover:bg-rose-500/10 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400",
}

// ---- Component --------------------------------------------------------------

/**
 * @param {string}   id          unique id, used for the rename input
 * @param {string}   label       row title
 * @param {string}   noun        "journal" | "planner" ... used in aria labels and the delete prompt
 * @param {Component} Icon       leading icon
 * @param {string}   [badge]     small muted text after the title (e.g. planner type)
 * @param {boolean}  isSelected
 * @param {Function} onSelect
 * @param {Function} onRename    (newName) => void
 * @param {Function} onDelete    () => void
 */
function SidebarItemCard({ id, label, noun, Icon, badge, isSelected, onSelect, onRename, onDelete }) {
	const [isEditing, setIsEditing] = useState(false)
	const [draftName, setDraftName] = useState(label)
	const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false)
	const [isDeleting, setIsDeleting] = useState(false)
	const [deleteError, setDeleteError] = useState("")
	const dialogId = useId()
	const inputRef = useRef(null)

	useEffect(() => {
		if (!isEditing) return
		inputRef.current?.focus()
		inputRef.current?.select()
	}, [isEditing])

	useEffect(() => {
		if (!isDeleteConfirmationOpen) return
		const handleKeyDown = (event) => {
			if (event.key === "Escape" && !isDeleting) setIsDeleteConfirmationOpen(false)
		}
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [isDeleteConfirmationOpen, isDeleting])

	const handleStartEditing = () => {
		setDraftName(label)
		setIsEditing(true)
		setIsDeleteConfirmationOpen(false)
	}

	const handleUpdate = (event) => {
		event.preventDefault()

		const trimmedName = draftName.trim()
		if (!trimmedName) return

		onRename(trimmedName)
		setIsEditing(false)
	}

	const handleCancelEdit = () => {
		setDraftName(label)
		setIsEditing(false)
	}

	const handleInputKeyDown = (event) => {
		if (event.key === "Escape") handleCancelEdit()
	}

	const handleDelete = () => {
		if (isDeleting) return
		setIsDeleting(true)
		setDeleteError("")
		Promise.resolve(onDelete())
			.then(() => setIsDeleteConfirmationOpen(false))
			.catch((error) => setDeleteError(error.message || `Could not delete this ${noun}. Please try again.`))
			.finally(() => setIsDeleting(false))
	}

	const leadingIcon = (
		<Icon
			strokeWidth={1.5}
			className={`h-[15px] w-[15px] shrink-0 transition-colors ${
				isSelected ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-600 dark:text-zinc-400"
			}`}
		/>
	)

	return (
		<div className={getRowClasses({ isEditing, isSelected })}>
			{isEditing ? (
				<form onSubmit={handleUpdate} className="flex min-w-0 flex-1 items-center gap-1 py-1 pl-2 pr-1">
					<div className="flex min-w-0 flex-1 items-center gap-2">
						{leadingIcon}
						<label htmlFor={`edit-${noun}-${id}`} className="sr-only">
							{noun} name
						</label>
						{/* Pulled 4px left so the typed text sits exactly where the name was */}
						<input
							ref={inputRef}
							id={`edit-${noun}-${id}`}
							type="text"
							value={draftName}
							onChange={(event) => setDraftName(event.target.value)}
							onKeyDown={handleInputKeyDown}
							placeholder="Untitled"
							className="-ml-1 h-5 min-w-0 flex-1 rounded bg-white pl-1 pr-1.5 text-[13px] leading-5 text-zinc-900 shadow-sm outline-none ring-1 ring-zinc-900/10 transition-shadow placeholder:text-zinc-500 focus:ring-zinc-900/25 dark:bg-black/30 dark:text-zinc-50 dark:shadow-none dark:ring-white/[0.14] dark:focus:ring-white/30"
						/>
					</div>
					<button
						type="submit"
						disabled={!draftName.trim()}
						title="Save (Enter)"
						aria-label={`Save ${noun} name`}
						className={`${iconButton} ${iconTone.confirm}`}
					>
						<CheckIcon />
					</button>
					<button
						type="button"
						onClick={handleCancelEdit}
						title="Cancel (Esc)"
						aria-label="Cancel editing"
						className={`${iconButton} ${iconTone.neutral}`}
					>
						<CloseIcon />
					</button>
				</form>
			) : (
				<>
					<button
						type="button"
						onClick={onSelect}
						aria-current={isSelected ? "true" : undefined}
						className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md py-1 pl-2 pr-1 text-left focus-visible:ring-inset ${focusRing}`}
					>
						{leadingIcon}
						<span
							className={`truncate text-[13px] leading-5 ${
								isSelected ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-700 dark:text-zinc-300"
							}`}
						>
							{label}
						</span>
						{badge && (
							<span className="shrink-0 rounded bg-black/[0.05] px-1.5 text-[10px] leading-4 text-zinc-600 dark:bg-white/[0.07] dark:text-zinc-300">
								{badge}
							</span>
						)}
					</button>

					<div
						className={`flex items-center gap-0.5 pr-1 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${
							isDeleteConfirmationOpen ? "opacity-100" : "opacity-0"
						}`}
					>
						<button
							type="button"
							title={`Rename ${label}`}
							aria-label={`Rename ${label}`}
							onClick={handleStartEditing}
							className={`${iconButton} ${iconTone.neutral}`}
						>
							<PencilIcon />
						</button>
						<button
							type="button"
							title={`Delete ${label}`}
							aria-label={`Delete ${label}`}
							onClick={() => setIsDeleteConfirmationOpen(true)}
							className={`${iconButton} ${iconTone.danger}`}
						>
							<TrashIcon />
						</button>
					</div>

					{isDeleteConfirmationOpen && createPortal(
						<div
							className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
							onMouseDown={(event) => {
								if (event.target === event.currentTarget && !isDeleting) setIsDeleteConfirmationOpen(false)
							}}
						>
							<div
								role="alertdialog"
								aria-modal="true"
								aria-busy={isDeleting}
								aria-labelledby={`${dialogId}-title`}
								aria-describedby={`${dialogId}-description`}
								className="w-full max-w-[360px] rounded-xl border border-zinc-300 bg-white p-5 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.3)] dark:border-white/[0.13] dark:bg-panel-hi"
							>
								<h2 id={`${dialogId}-title`} className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
									Delete this {noun}?
								</h2>
								<p id={`${dialogId}-description`} role={deleteError ? "alert" : isDeleting ? "status" : undefined} aria-live="polite" className="mt-1.5 break-words text-[13px] leading-snug text-zinc-600 dark:text-zinc-300">
									{deleteError || (isDeleting ? `Deleting ${noun}...` : `“${label}” will be permanently deleted.`)}
								</p>
								<div className="mt-5 flex justify-end gap-2">
									<button
										type="button"
										autoFocus
										disabled={isDeleting}
										onClick={() => setIsDeleteConfirmationOpen(false)}
										className={`h-8 rounded-md px-3 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-900/[0.06] disabled:cursor-default disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-white/10 ${focusRing}`}
									>
										Cancel
									</button>
									<button
										type="button"
										disabled={isDeleting}
										onClick={handleDelete}
										className="inline-flex h-8 min-w-[92px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-rose-600 px-3 text-xs font-medium text-white transition-colors hover:bg-rose-700 disabled:cursor-default disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 dark:bg-rose-500 dark:hover:bg-rose-600"
									>
										{isDeleting && <span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border border-white/50 border-t-white" />}
										{isDeleting ? "Deleting..." : "Delete"}
									</button>
								</div>
							</div>
						</div>,
						document.body
					)}
				</>
			)}
		</div>
	)
}

export default SidebarItemCard
