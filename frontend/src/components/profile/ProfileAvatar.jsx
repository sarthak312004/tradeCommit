// Round avatar with the user's initials on a gradient picked from their username,
// so every account gets its own colour without needing an uploaded photo.

const hueFor = (seed = '') => [...seed].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 360, 7)

const getInitials = (fullname = '', username = '') => {
  const words = fullname.trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? username).slice(0, 2)
  return letters.toUpperCase() || '?'
}

function ProfileAvatar({ profile, className = 'h-9 w-9 text-[13px]' }) {
  if (!profile) {
    return <span className={`${className} inline-block animate-pulse rounded-full bg-zinc-200 dark:bg-white/10`} aria-hidden="true" />
  }

  const hue = hueFor(profile.username)
  return (
    <span
      aria-hidden="true"
      className={`${className} inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-wide text-white`}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 56%), hsl(${(hue + 45) % 360} 72% 46%))` }}
    >
      {getInitials(profile.fullname, profile.username)}
    </span>
  )
}

export default ProfileAvatar
