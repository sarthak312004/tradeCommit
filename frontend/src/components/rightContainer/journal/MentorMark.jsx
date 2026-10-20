/** The six-petal bloom used by the mentor orb and the unlock badge. */
function MentorMark({ className = 'h-6 w-6', fill = 'currentColor' }) {
  const long = [0, 120, 240]
  const short = [60, 180, 300]
  return (
    <svg viewBox="0 0 24 24" fill={fill} className={className} aria-hidden="true">
      {short.map((angle) => (
        <ellipse key={angle} cx="12" cy="7.9" rx="1.9" ry="3.3" opacity="0.42" transform={`rotate(${angle} 12 12)`} />
      ))}
      {long.map((angle) => (
        <ellipse key={angle} cx="12" cy="6.6" rx="2.3" ry="4.6" opacity="0.9" transform={`rotate(${angle} 12 12)`} />
      ))}
      <circle cx="12" cy="12" r="1.9" />
    </svg>
  )
}

export default MentorMark
