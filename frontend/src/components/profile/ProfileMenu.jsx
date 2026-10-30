import { useEffect, useRef, useState } from 'react'
import { useProfile } from '../../hooks/useProfile'
import { errorText } from '../../services/authApi'
import { updateProfile } from '../../services/profileApi'
import { AtSignIcon, CheckIcon, ChevronDownIcon, CloseIcon, LockIcon, MailIcon, PencilIcon, UserIcon } from '../../utils/Icons.jsx'
import ProfileAvatar from './ProfileAvatar'
import ResetPasswordDialog from './ResetPasswordDialog'
import { CompassIcon } from '../tour/tourIcons'
import { replayProductTour } from '../../utils/productTour'
import { focusRing } from './profileStyles'

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/

function DetailRow({ Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 px-1 py-1.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{label}</p>
        <p className="truncate text-[13px] text-zinc-800 dark:text-zinc-100" title={value}>{value}</p>
      </div>
    </div>
  )
}

const iconButton = `flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-white/[0.08] dark:hover:text-zinc-100 ${focusRing}`

/**
 * A detail row that edits in place: a pencil appears on hover, it turns into a small field with a tick and a cross.
 * Enter saves, Escape cancels (without closing the profile card). `validate` returns an error text or ''.
 */
function EditableRow({ Icon, label, value, emptyText, maxLength, validate, normalize, onSave, tabbable }) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const start = () => {
    setDraft(value ?? '')
    setError('')
    setIsEditing(true)
  }

  const cancel = () => {
    if (!isSaving) setIsEditing(false)
  }

  const save = async (event) => {
    event.preventDefault()
    if (isSaving) return
    const next = normalize(draft)
    if (next === (value ?? '')) return setIsEditing(false)
    const problem = validate(next)
    if (problem) return setError(problem)

    setIsSaving(true)
    setError('')
    try {
      await onSave(next)
      setIsEditing(false)
    } catch (saveError) {
      setError(errorText(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (event) => {
    if (event.key !== 'Escape') return
    event.stopPropagation() // closes this field only, not the whole profile card
    cancel()
  }

  return (
    <div className="group/row flex items-center gap-3 px-1 py-1.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
        <Icon className="h-3.5 w-3.5" />
      </span>
      {isEditing ? (
        <form onSubmit={save} noValidate className="min-w-0 flex-1">
          <label htmlFor={`profile-${label}`} className="text-[10px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{label}</label>
          <div className="flex items-center gap-1">
            <input
              id={`profile-${label}`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={maxLength}
              autoFocus
              autoCapitalize="none"
              spellCheck={false}
              disabled={isSaving}
              aria-invalid={Boolean(error)}
              className="h-7 min-w-0 flex-1 border-b border-zinc-300 bg-transparent px-0 text-[13px] text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-500 disabled:opacity-60 dark:border-white/[0.18] dark:text-zinc-100 dark:focus:border-white/40"
            />
            <button type="submit" disabled={isSaving} aria-label={`Save ${label.toLowerCase()}`} className={iconButton}>
              <CheckIcon className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={cancel} disabled={isSaving} aria-label="Cancel" className={iconButton}>
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          {error && <p role="alert" className="mt-1 text-[11px] leading-snug text-rose-500">{error}</p>}
        </form>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{label}</p>
            <p className={`truncate text-[13px] ${value ? 'text-zinc-800 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500'}`} title={value}>
              {value || emptyText}
            </p>
          </div>
          <button
            type="button"
            onClick={start}
            tabIndex={tabbable ? 0 : -1}
            aria-label={`Edit ${label.toLowerCase()}`}
            className={`${iconButton} opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100`}
          >
            <PencilIcon className="h-3.5 w-3.5" />
          </button>
        </>
      )}
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

  const startTour = () => {
    setIsOpen(false)
    replayProductTour()
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
        <ChevronDownIcon className={`h-3.5 w-3.5 text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <div
        role="dialog"
        aria-label="Your profile"
        aria-hidden={!isOpen}
        className={`absolute right-0 top-[calc(100%+8px)] z-40 w-72 origin-top-right rounded-xl border border-zinc-300 bg-white p-3 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.2)] transition duration-150 ease-out motion-reduce:transition-none dark:border-white/[0.14] dark:bg-panel-hi dark:shadow-black/50 ${
          isOpen ? 'visible translate-y-0 scale-100 opacity-100' : 'pointer-events-none invisible -translate-y-1 scale-95 opacity-0'
        }`}
      >
        {profile ? (
          <>
            <div className="flex items-center gap-3 pb-3">
              <ProfileAvatar profile={profile} className="h-11 w-11 text-base" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{profile.fullname || `@${profile.username}`}</p>
                <p className="truncate text-xs text-zinc-600 dark:text-zinc-300">{profile.fullname ? `@${profile.username}` : profile.email}</p>
              </div>
            </div>

            <div className="border-t border-zinc-200 py-1.5 dark:border-white/[0.10]">
              <EditableRow
                Icon={UserIcon}
                label="Full name"
                value={profile.fullname}
                emptyText="Add your name"
                maxLength={80}
                tabbable={isOpen}
                normalize={(text) => text.trim().replace(/\s+/g, ' ')}
                validate={(text) => (text.length > 80 ? 'Name is too long.' : '')}
                onSave={(fullname) => updateProfile({ fullname })}
              />
              <EditableRow
                Icon={AtSignIcon}
                label="Username"
                value={profile.username}
                maxLength={20}
                tabbable={isOpen}
                normalize={(text) => text.trim().toLowerCase()}
                validate={(text) => (USERNAME_PATTERN.test(text) ? '' : '3-20 characters: letters, numbers or underscores.')}
                onSave={(username) => updateProfile({ username })}
              />
              <DetailRow Icon={MailIcon} label="Email" value={profile.email} />
            </div>

            <button
              type="button"
              onClick={openReset}
              tabIndex={isOpen ? 0 : -1}
              className={`mt-1.5 flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-300 text-[13px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-white/[0.14] dark:text-zinc-200 dark:hover:bg-white/[0.06] ${focusRing}`}
            >
              <LockIcon className="h-3.5 w-3.5" />
              {profile.hasPassword ? 'Reset password' : 'Set a password (optional)'}
            </button>

            <button
              type="button"
              onClick={startTour}
              tabIndex={isOpen ? 0 : -1}
              className={`mt-1.5 flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-300 text-[13px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-white/[0.14] dark:text-zinc-200 dark:hover:bg-white/[0.06] ${focusRing}`}
            >
              <CompassIcon className="h-3.5 w-3.5" />
              Take the product tour
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
          <p className="py-3 text-center text-xs text-zinc-500">Loading…</p>
        )}
      </div>

      {isResetOpen && profile && (
        <ResetPasswordDialog email={profile.email} hasPassword={profile.hasPassword} onClose={() => setIsResetOpen(false)} />
      )}
    </div>
  )
}

export default ProfileMenu
