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
