import { useContext } from "react"
import { useNavigate } from "react-router"
import { plannerContext } from "../../context/Context.js"
import { CalendarIcon } from "../../utils/Icons.jsx"
import { plannerApi } from "../../services/plannerApi.js"
import { preloadPlannerPage } from "../../utils/plannerPageLoader.js"
import SidebarItemCard from "./SidebarItemCard"

function PlannerCard({ planner, isSelected }) {
	const { updatePlanner, deletePlanner } = useContext(plannerContext)
	const navigate = useNavigate()

	const handleDelete = async () => {
		await deletePlanner(planner.id)
		if (isSelected) navigate("/")
	}

	const handleSelect = () => {
		preloadPlannerPage().catch(() => {})
		plannerApi.listEntries(planner.id).catch(() => {})
		navigate(`/planner/${planner.id}`)
	}

	return (
		<SidebarItemCard
			id={planner.id}
			label={planner.name}
			noun="planner"
			Icon={CalendarIcon}
			badge={planner.type}
			isSelected={isSelected}
			onSelect={handleSelect}
			onRename={(name) => updatePlanner(planner.id, name)}
			onDelete={handleDelete}
		/>
	)
}

export default PlannerCard
