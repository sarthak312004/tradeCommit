// Toolbar icons the shared set in utils/Icons.jsx does not have yet. Same 24px stroke style, colour from currentColor.
const Icon = ({ className = 'h-4 w-4', strokeWidth = 1.75, children, ...props }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...props}>
    {children}
  </svg>
)

export const UnderlineIcon = (props) => (
  <Icon {...props}>
    <path d="M6 4v6a6 6 0 0 0 12 0V4" />
    <path d="M4 20h16" />
  </Icon>
)

export const StrikeIcon = (props) => (
  <Icon {...props}>
    <path d="M16 4H9a3 3 0 0 0-2.83 4" />
    <path d="M14 12a4 4 0 0 1 0 8H6" />
    <path d="M4 12h16" />
  </Icon>
)

export const CodeIcon = (props) => (
  <Icon {...props}>
    <path d="m16 18 6-6-6-6" />
    <path d="m8 6-6 6 6 6" />
  </Icon>
)

export const LinkIcon = (props) => (
  <Icon {...props}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </Icon>
)

export const ChecklistIcon = (props) => (
  <Icon {...props}>
    <rect x="3" y="5" width="6" height="6" rx="1" />
    <path d="m3 17 2 2 4-4" />
    <path d="M13 6h8M13 12h8M13 18h8" />
  </Icon>
)

export const DividerIcon = (props) => (
  <Icon {...props}>
    <path d="M4 12h16" />
    <path d="M8 6h8M8 18h8" opacity="0.45" />
  </Icon>
)

export const GripIcon = (props) => (
  <Icon {...props} strokeWidth={2.4}>
    <path d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01" />
  </Icon>
)

export const AlignLeftIcon = (props) => (
  <Icon {...props}>
    <path d="M4 6h16M4 12h10M4 18h14" />
  </Icon>
)

export const AlignCenterIcon = (props) => (
  <Icon {...props}>
    <path d="M4 6h16M7 12h10M5 18h14" />
  </Icon>
)

export const AlignRightIcon = (props) => (
  <Icon {...props}>
    <path d="M4 6h16M10 12h10M6 18h14" />
  </Icon>
)
