import { useEffect, useRef, useState } from 'react'
import { useProfile } from '../../hooks/useProfile'
import { AtSignIcon, ChevronDownIcon, LockIcon, MailIcon, UserIcon } from '../../utils/Icons.jsx'
import ProfileAvatar from './ProfileAvatar'
import ResetPasswordDialog from './ResetPasswordDialog'
import { focusRing } from './profileStyles'

function DetailRow({ Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 px-1 py-1.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-400">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{label}</p>
        <p className="truncate text-[13px] text-zinc-800 dark:text-zinc-100" title={value}>{value}</p>
      </div>
    </div>
  )
}

/** Avatar toggle for the right side of the page header: opens a card with the account details. */
function ProfileMenu() {
  const { profile, error, retry } = useProfile()
  const [isOpen, setIsOpen] = useState(false)
  const [isResetOpen, setIsResetOpen] = useState(false)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false)
    }
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      setIsOpen(false)
      buttonRef.current?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const openReset = () => {
    setIsOpen(false)
    setIsResetOpen(true)
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Open profile"
        title={profile?.fullname ?? 'Profile'}
        className={`group flex cursor-pointer items-center gap-1.5 rounded-full p-0.5 pr-1.5 transition-colors hover:bg-zinc-100 dark:hover:bg-white/[0.07] ${focusRing} ${isOpen ? 'bg-zinc-100 dark:bg-white/[0.07]' : ''}`}
      >
        <span className="rounded-full ring-2 ring-transparent transition group-hover:ring-zinc-200 dark:group-hover:ring-white/15">
          <ProfileAvatar profile={profile} />
        </span>
        <ChevronDownIcon className={`h-3.5 w-3.5 text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <div
        role="dialog"
        aria-label="Your profile"
        aria-hidden={!isOpen}
        className={`absolute right-0 top-[calc(100%+8px)] z-40 w-72 origin-top-right rounded-xl border border-zinc-200 bg-white p-3 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.2)] transition duration-150 ease-out motion-reduce:transition-none dark:border-white/10 dark:bg-[#252525] dark:shadow-black/50 ${
          isOpen ? 'visible translate-y-0 scale-100 opacity-100' : 'pointer-events-none invisible -translate-y-1 scale-95 opacity-0'
        }`}
      >
        {profile ? (
          <>
            <div className="flex items-center gap-3 pb-3">
              <ProfileAvatar profile={profile} className="h-11 w-11 text-base" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{profile.fullname}</p>
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">@{profile.username}</p>
              </div>
            </div>

            <div className="border-t border-zinc-100 py-1.5 dark:border-white/[0.07]">
              <DetailRow Icon={UserIcon} label="Full name" value={profile.fullname} />
              <DetailRow Icon={AtSignIcon} label="Username" value={profile.username} />
              <DetailRow Icon={MailIcon} label="Email" value={profile.email} />
            </div>

            <button
              type="button"
              onClick={openReset}
              tabIndex={isOpen ? 0 : -1}
              className={`mt-1.5 flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-200 text-[13px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/[0.06] ${focusRing}`}
            >
              <LockIcon className="h-3.5 w-3.5" />
              {profile.hasPassword ? 'Reset password' : 'Set a password'}
            </button>
          </>
        ) : error ? (
          <div className="py-2 text-center">
            <p className="text-xs text-rose-500">{error}</p>
            <button type="button" onClick={retry} className="mt-2 cursor-pointer text-xs font-medium text-zinc-600 underline underline-offset-2 dark:text-zinc-300">
              Try again
            </button>
          </div>
        ) : (
          <p className="py-3 text-center text-xs text-zinc-400">Loading…</p>
        )}
      </div>

      {isResetOpen && profile && (
        <ResetPasswordDialog email={profile.email} hasPassword={profile.hasPassword} onClose={() => setIsResetOpen(false)} />
      )}
    </div>
  )
}

export default ProfileMenu
