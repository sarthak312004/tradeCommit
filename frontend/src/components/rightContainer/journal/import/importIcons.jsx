// Stroke icons for the import dialog, drawn like the ones in utils/Icons.jsx.
const Icon = ({ className = 'h-3.5 w-3.5', strokeWidth = 1.75, children, ...props }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...props}>
    {children}
  </svg>
)

export const UploadIcon = (props) => (
  <Icon {...props}>
    <path d="M12 15V3" />
    <path d="m7 8 5-5 5 5" />
    <path d="M4 20h16" />
  </Icon>
)

export const SheetIcon = (props) => (
  <Icon {...props}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M4 9h16M4 15h16M10 3v18" />
  </Icon>
)

export const SplitIcon = (props) => (
  <Icon {...props}>
    <path d="M12 21v-7" />
    <path d="M12 14c0-4-6-3-6-8" />
    <path d="M12 14c0-4 6-3 6-8" />
    <path d="m3.5 8 2.5-3 2.5 3M15.5 8 18 5l2.5 3" />
  </Icon>
)
