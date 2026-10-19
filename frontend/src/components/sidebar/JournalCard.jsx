import { useContext } from "react"
import { useLocation, useNavigate } from "react-router"
import { journalContext } from "../../context/Context.js"
import { FileIcon } from "../../utils/Icons.jsx"
import SidebarItemCard from "./SidebarItemCard"

function JournalCard({ journal, isSelected }) {
	const { updateJournal, deleteJournal, selectJournal } = useContext(journalContext)
	const navigate = useNavigate()
	const { pathname } = useLocation()

	const handleSelect = () => {
		selectJournal(journal.id)
		// journals live on /, /calendar and /analysis (stay on the current view), planners on /planner/:id
		navigate(pathname === "/calendar" || pathname === "/analysis" ? pathname : "/")
	}

	return (
		<SidebarItemCard
			id={journal.id}
			label={journal.name}
			noun="journal"
			Icon={FileIcon}
			badge={journal.syncState === "saving" ? "Creating…" : undefined}
			isSelected={isSelected}
			onSelect={handleSelect}
			onRename={(name) => updateJournal(journal.id, name)}
			onDelete={() => deleteJournal(journal.id)}
		/>
	)
}

export default JournalCard
