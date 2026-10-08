// Shared stroke-icon wrapper. Every icon inherits colour from `currentColor`,
// so colour is controlled with text-* classes on the parent button.
const Icon = ({ className = "h-3.5 w-3.5", strokeWidth = 1.75, children, ...props }) => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth={strokeWidth}
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
		aria-hidden="true"
		{...props}
	>
		{children}
	</svg>
)

export const PencilIcon = (props) => (
	<Icon {...props}>
		<path d="M12 20h9" />
		<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
	</Icon>
)

export const TrashIcon = (props) => (
	<Icon {...props}>
		<path d="M3 6h18" />
		<path d="M8 6V4h8v2" />
		<path d="m19 6-1 14H6L5 6" />
		<path d="M10 10v6M14 10v6" />
	</Icon>
)

export const CheckIcon = (props) => (
	<Icon {...props}>
		<path d="m5 12.5 4.5 4.5L19 7.5" />
	</Icon>
)

export const CloseIcon = (props) => (
	<Icon {...props}>
		<path d="M6 6l12 12M18 6 6 18" />
	</Icon>
)

export const FileIcon = (props) => (
	<Icon {...props}>
		<path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8Z" />
		<path d="M14 3v3.5A1.5 1.5 0 0 0 15.5 8H19" />
		<path d="M9 13h6M9 16.5h4" />
	</Icon>
)

export const PlusIcon = (props) => (
	<Icon {...props}>
		<path d="M12 5v14M5 12h14" />
	</Icon>
)

export const ChevronsLeftIcon = (props) => (
	<Icon {...props}>
		<path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />
	</Icon>
)

export const SunIcon = (props) => (
	<Icon {...props}>
		<circle cx="12" cy="12" r="4" />
		<path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
	</Icon>
)

export const MoonIcon = (props) => (
	<Icon {...props}>
		<path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" />
	</Icon>
)

export const MonitorIcon = (props) => (
	<Icon {...props}>
		<rect x="3" y="4" width="18" height="12" rx="2" />
		<path d="M8 20h8M12 16v4" />
	</Icon>
)

export const LogoutIcon = (props) => (
	<Icon {...props}>
		<path d="M9 21H5.5A2.5 2.5 0 0 1 3 18.5v-13A2.5 2.5 0 0 1 5.5 3H9" />
		<path d="m16 17 5-5-5-5M21 12H9" />
	</Icon>
)


/* ---- icons added for the trade planner ---------------------------------- */

export const CalendarIcon = (props) => (
	<Icon {...props}>
		<path d="M8 2v4M16 2v4" />
		<rect width="18" height="18" x="3" y="4" rx="2" />
		<path d="M3 10h18" />
	</Icon>
)

export const ChevronLeftIcon = (props) => (
	<Icon {...props}>
		<path d="m15 18-6-6 6-6" />
	</Icon>
)

export const ChevronRightIcon = (props) => (
	<Icon {...props}>
		<path d="m9 18 6-6-6-6" />
	</Icon>
)

export const BoldIcon = (props) => (
	<Icon {...props}>
		<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />
	</Icon>
)

export const ItalicIcon = (props) => (
	<Icon {...props}>
		<path d="M19 4h-9M14 20H5M15 4 9 20" />
	</Icon>
)

export const ListIcon = (props) => (
	<Icon {...props}>
		<path d="M3 6h.01M3 12h.01M3 18h.01M8 6h13M8 12h13M8 18h13" />
	</Icon>
)

export const ListOrderedIcon = (props) => (
	<Icon {...props}>
		<path d="M11 5h10M11 12h10M11 19h10M4 4h1v5M4 9h2" />
		<path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02" />
	</Icon>
)

export const QuoteIcon = (props) => (
	<Icon {...props}>
		<path d="M4 5v14M9 8h11M9 12h11M9 16h7" />
	</Icon>
)

export const ImageIcon = (props) => (
	<Icon {...props}>
		<rect width="18" height="18" x="3" y="3" rx="2" />
		<circle cx="9" cy="9" r="2" />
		<path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21" />
	</Icon>
)

export const MaximizeIcon = (props) => (
	<Icon {...props}>
		<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
	</Icon>
)

export const MinimizeIcon = (props) => (
	<Icon {...props}>
		<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
	</Icon>
)

/* ---- icons added for the profile menu ------------------------------------ */

export const UserIcon = (props) => (
	<Icon {...props}>
		<circle cx="12" cy="8" r="4" />
		<path d="M4 21a8 8 0 0 1 16 0" />
	</Icon>
)

export const AtSignIcon = (props) => (
	<Icon {...props}>
		<circle cx="12" cy="12" r="4" />
		<path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
	</Icon>
)

export const MailIcon = (props) => (
	<Icon {...props}>
		<rect width="20" height="16" x="2" y="4" rx="2" />
		<path d="m22 7-10 6L2 7" />
	</Icon>
)

export const LockIcon = (props) => (
	<Icon {...props}>
		<rect width="18" height="11" x="3" y="11" rx="2" />
		<path d="M7 11V7a5 5 0 0 1 10 0v4" />
	</Icon>
)

export const EyeIcon = (props) => (
	<Icon {...props}>
		<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
		<circle cx="12" cy="12" r="3" />
	</Icon>
)

export const EyeOffIcon = (props) => (
	<Icon {...props}>
		<path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-3.2 4.2M6.6 6.6A16.5 16.5 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.4-1.6" />
		<path d="M14.1 14.1a3 3 0 1 1-4.2-4.2M2 2l20 20" />
	</Icon>
)

export const ChevronDownIcon = (props) => (
	<Icon {...props}>
		<path d="m6 9 6 6 6-6" />
	</Icon>
)

/* ---- icons added for the feedback form ---------------------------------- */

export const StarIcon = (props) => (
	<Icon {...props}>
		<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />
	</Icon>
)

export const MessageSquareIcon = (props) => (
	<Icon {...props}>
		<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
	</Icon>
)