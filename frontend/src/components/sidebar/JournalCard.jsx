import { useContext, useEffect, useRef, useState } from "react"
import { journalContext } from "../../context/Context.js"
import { CheckIcon, CloseIcon, FileIcon, PencilIcon, TrashIcon } from "../../utils/Icons.jsx"

// ---- Styles -----------------------------------------------------------------

const rowBase =
	"group relative flex w-full items-center rounded-md border transition-colors before:absolute before:-left-3 before:top-1/2 before:h-px before:w-3 before:bg-zinc-300 dark:before:bg-zinc-700"

// colour underneath instead of fighting it. Blue is reserved for the tree dot.
const rowStates = {
	selected:
		"border-zinc-900/[0.15] bg-zinc-900/[0.07] dark:border-white/[0.14] dark:bg-white/[0.09]",
	editing:
		"border-zinc-900/[0.1] bg-zinc-900/[0.05] dark:border-white/[0.1] dark:bg-white/[0.06]",
	idle: "border-zinc-900/[0.08] bg-zinc-900/[0.03] hover:border-zinc-900/[0.12] hover:bg-zinc-900/[0.055] dark:border-white/[0.07] dark:bg-white/[0.04] dark:hover:border-white/[0.11] dark:hover:bg-white/[0.065]",
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
		"text-zinc-400 hover:bg-zinc-900/[0.06] hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-white/10 dark:hover:text-zinc-200",
	confirm:
		"text-zinc-600 hover:bg-zinc-900/[0.06] hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-600 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-zinc-50 dark:disabled:hover:text-zinc-300",
	danger:
		"text-zinc-400 hover:bg-rose-500/10 hover:text-rose-600 dark:text-zinc-500 dark:hover:text-rose-400",
}

// ---- Component --------------------------------------------------------------

function JournalCard({ journal, isSelected }) {
	const { updateJournal, deleteJournal, selectJournal } = useContext(journalContext)

	const [isEditing, setIsEditing] = useState(false)
	const [journalName, setJournalName] = useState(journal.name)
	const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false)
	const inputRef = useRef(null)

	useEffect(() => {
		if (!isEditing) return
		inputRef.current?.focus()
		inputRef.current?.select()
	}, [isEditing])

	const handleStartEditing = () => {
		setJournalName(journal.name)
		setIsEditing(true)
		setIsDeleteConfirmationOpen(false)
	}

	const handleUpdate = (event) => {
		event.preventDefault()

		const trimmedName = journalName.trim()
		if (!trimmedName) return

		updateJournal(journal.id, trimmedName)
		setIsEditing(false)
	}

	const handleCancelEdit = () => {
		setJournalName(journal.name)
		setIsEditing(false)
	}

	const handleInputKeyDown = (event) => {
		if (event.key === "Escape") handleCancelEdit()
	}

	const handleDelete = () => {
		deleteJournal(journal.id)
		setIsDeleteConfirmationOpen(false)
	}

	const fileIcon = (
		<FileIcon
			strokeWidth={1.5}
			className={`h-4 w-4 shrink-0 transition-colors ${
				isSelected ? "text-zinc-600 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-500"
			}`}
		/>
	)

	return (
		<div className={getRowClasses({ isEditing, isSelected })}>
			{/* Tree node: the only blue on the card, turns on when selected */}
			<span
				aria-hidden="true"
				className={`absolute -left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full ring-2 ring-stone-100 transition-colors dark:ring-[#171a1d] ${
					isSelected ? "bg-sky-500" : "bg-zinc-400 dark:bg-zinc-500"
				}`}
			/>

			{isEditing ? (
				<form onSubmit={handleUpdate} className="flex min-w-0 flex-1 items-center gap-1 py-1.5 pl-2 pr-1">
					<div className="flex min-w-0 flex-1 items-center gap-2">
						{fileIcon}
						<label htmlFor={`edit-journal-${journal.id}`} className="sr-only">
							Journal name
						</label>
						{/* Pulled 4px left so the typed text sits exactly where the name was */}
						<input
							ref={inputRef}
							id={`edit-journal-${journal.id}`}
							type="text"
							value={journalName}
							onChange={(event) => setJournalName(event.target.value)}
							onKeyDown={handleInputKeyDown}
							placeholder="Untitled"
							className="-ml-1 h-5 min-w-0 flex-1 rounded bg-white pl-1 pr-1.5 text-[13px] leading-5 text-zinc-900 shadow-sm outline-none ring-1 ring-zinc-900/10 transition-shadow placeholder:text-zinc-400 focus:ring-zinc-900/25 dark:bg-black/30 dark:text-zinc-50 dark:shadow-none dark:ring-white/[0.14] dark:focus:ring-white/30"
						/>
					</div>
					<button
						type="submit"
						disabled={!journalName.trim()}
						title="Save (Enter)"
						aria-label="Save journal name"
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
						onClick={() => selectJournal(journal.id)}
						aria-current={isSelected ? "true" : undefined}
						className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md py-1.5 pl-2 pr-1 text-left focus-visible:ring-inset ${focusRing}`}
					>
						{fileIcon}
						<span
							className={`truncate text-[13px] leading-5 ${
								isSelected ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-700 dark:text-zinc-300"
							}`}
						>
							{journal.name}
						</span>
					</button>

					<div
						className={`flex items-center gap-0.5 pr-1 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${
							isDeleteConfirmationOpen ? "opacity-100" : "opacity-0"
						}`}
					>
						<button
							type="button"
							title={`Rename ${journal.name}`}
							aria-label={`Rename ${journal.name}`}
							onClick={handleStartEditing}
							className={`${iconButton} ${iconTone.neutral}`}
						>
							<PencilIcon />
						</button>
						<button
							type="button"
							title={`Delete ${journal.name}`}
							aria-label={`Delete ${journal.name}`}
							onClick={() => setIsDeleteConfirmationOpen(true)}
							className={`${iconButton} ${iconTone.danger}`}
						>
							<TrashIcon />
						</button>
					</div>

					{isDeleteConfirmationOpen && (
						<div
							role="alertdialog"
							aria-label={`Delete ${journal.name}?`}
							onKeyDown={(event) => event.key === "Escape" && setIsDeleteConfirmationOpen(false)}
							className="absolute right-0 top-[calc(100%+6px)] z-10 w-52 rounded-lg border border-zinc-900/10 bg-white p-3 text-left shadow-[0_8px_24px_-6px_rgba(0,0,0,0.18)] dark:border-white/10 dark:bg-zinc-900 dark:shadow-black/50"
						>
							<p className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">Delete this journal?</p>
							<p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{journal.name}</p>
							<div className="mt-3 flex justify-end gap-1.5">
								<button
									type="button"
									autoFocus
									onClick={() => setIsDeleteConfirmationOpen(false)}
									className={`rounded-md px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-900/[0.06] dark:text-zinc-300 dark:hover:bg-white/10 ${focusRing}`}
								>
									Cancel
								</button>
								<button
									type="button"
									onClick={handleDelete}
									className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 dark:bg-rose-500 dark:hover:bg-rose-600"
								>
									Delete
								</button>
							</div>
						</div>
					)}
				</>
			)}
		</div>
	)
}

export default JournalCard