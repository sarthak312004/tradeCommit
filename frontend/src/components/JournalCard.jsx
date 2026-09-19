import { useContext, useState } from "react"
import { journalContext } from "../context/Context"

function JournalCard({ journal, isSelected}) {
	const {updateJournal, deleteJournal, selectJournal,} = useContext(journalContext)

	const [isEditing, setIsEditing] = useState(false)
	const [journalName, setJournalName] = useState(journal.name)
	const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false)

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

	const handleDelete = () => {
		deleteJournal(journal.id)
		setIsDeleteConfirmationOpen(false)
	}

	return (
		<div
			className={`group relative flex w-full items-center rounded-lg border shadow-sm transition before:absolute before:-left-3 before:top-1/2 before:h-px before:w-3 before:bg-zinc-300 dark:before:bg-zinc-700 ${isSelected ? 'border-sky-200 bg-sky-100/60 dark:border-sky-900 dark:bg-sky-950/40' : 'border-zinc-200/80 bg-white/40 hover:border-zinc-300 hover:bg-white/80 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/70'}`}
		>
			<span className=" absolute -left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-zinc-400 ring-2 ring-stone-100 dark:bg-zinc-500 dark:ring-[#171a1d]" />
			{isEditing ? (
				<form onSubmit={handleUpdate} className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5">
					<label htmlFor={`edit-journal-${journal.id}`} className="sr-only">
						Edit journal name
					</label>
					<input
						id={`edit-journal-${journal.id}`}
						type="text"
						value={journalName}
						onChange={(event) => setJournalName(event.target.value)}
						autoFocus
						className="min-w-0 flex-1 rounded-md border border-sky-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none ring-2 ring-sky-400/15 dark:border-sky-700 dark:bg-zinc-950 dark:text-zinc-100"
					/>
					<button
						type="submit"
						disabled={!journalName.trim()}
						className="rounded-md bg-sky-500 px-2 py-1 text-[10px] font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Save
					</button>
					<button
						type="button"
						onClick={handleCancelEdit}
						className="rounded-md px-1.5 py-1 text-[10px] font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
					>
						Cancel
					</button>
				</form>
			) : (
				<>
					<button
						type="button"
						onClick={() => selectJournal(journal.id)}
						className="cursor-pointer min-w-0 flex-1 rounded-md bg-transparent px-2 py-1.5 text-left transition"
					>
						<p className="truncate text-xs font-medium">{journal.name}</p>
						<p className="text-[10px] text-zinc-500 dark:text-zinc-400">{journal.updated}</p>
					</button>
					<button
						type="button"
						title={`Edit ${journal.name}`}
						aria-label={`Edit ${journal.name}`}
						onClick={handleStartEditing}
						className=" flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-zinc-400 opacity-0 transition hover:bg-sky-100 hover:text-sky-600 group-hover:opacity-100 focus-visible:opacity-100 dark:text-zinc-500 dark:hover:bg-sky-950/60 dark:hover:text-sky-300"
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
							<path d="M12 20h9" />
							<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
						</svg>
					</button>
					<button
						type="button"
						title={`Delete ${journal.name}`}
						aria-label={`Delete ${journal.name}`}
						onClick={() => setIsDeleteConfirmationOpen(true)}
						className="mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-zinc-400 opacity-0 transition hover:bg-rose-100 hover:text-rose-600 group-hover:opacity-100 focus-visible:opacity-100 dark:text-zinc-500 dark:hover:bg-rose-950/60 dark:hover:text-rose-300"
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
							<path d="M3 6h18" />
							<path d="M8 6V4h8v2" />
							<path d="m19 6-1 14H6L5 6" />
							<path d="M10 10v6M14 10v6" />
						</svg>
					</button>
					{isDeleteConfirmationOpen && (
						<div className="absolute right-1 top-[calc(100%+6px)] z-10 w-44 rounded-lg border border-zinc-200 bg-white p-2.5 text-left shadow-lg shadow-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/30">
							<p className="text-[11px] font-medium text-zinc-700 dark:text-zinc-200">Delete this journal?</p>
							<div className="mt-2 flex justify-end gap-1.5">
								<button
									type="button"
									onClick={() => setIsDeleteConfirmationOpen(false)}
									className="rounded-md px-2 py-1 text-[10px] font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
								>
									Cancel
								</button>
								<button
									type="button"
									onClick={handleDelete}
									className="rounded-md bg-rose-500 px-2 py-1 text-[10px] font-medium text-white transition hover:bg-rose-600"
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
