import { useContext } from "react"
import { useNavigate } from "react-router"
import { plannerContext } from "../../context/Context.js"
import { CalendarIcon } from "../../utils/Icons.jsx"
import SidebarItemCard from "./SidebarItemCard"

function PlannerCard({ planner, isSelected }) {
	const { updatePlanner, deletePlanner } = useContext(plannerContext)
	const navigate = useNavigate()

	const handleDelete = async () => {
		await deletePlanner(planner.id)
		if (isSelected) navigate("/")
	}

	return (
		<SidebarItemCard
			id={planner.id}
			label={planner.name}
			noun="planner"
			Icon={CalendarIcon}
			badge={planner.type}
			isSelected={isSelected}
			onSelect={() => navigate(`/planner/${planner.id}`)}
			onRename={(name) => updatePlanner(planner.id, name)}
			onDelete={handleDelete}
		/>
	)
}

export default PlannerCard
