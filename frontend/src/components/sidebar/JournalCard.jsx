import { useContext } from "react"
import { useNavigate } from "react-router"
import { journalContext } from "../../context/Context.js"
import { FileIcon } from "../../utils/Icons.jsx"
import SidebarItemCard from "./SidebarItemCard"

function JournalCard({ journal, isSelected }) {
	const { updateJournal, deleteJournal, selectJournal } = useContext(journalContext)
	const navigate = useNavigate()

	const handleSelect = () => {
		selectJournal(journal.id)
		navigate("/") // journals live on the index route, planners on /planner/:id
	}

	return (
		<SidebarItemCard
			id={journal.id}
			label={journal.name}
			noun="journal"
			Icon={FileIcon}
			isSelected={isSelected}
			onSelect={handleSelect}
			onRename={(name) => updateJournal(journal.id, name)}
			onDelete={() => deleteJournal(journal.id)}
		/>
	)
}

export default JournalCard
