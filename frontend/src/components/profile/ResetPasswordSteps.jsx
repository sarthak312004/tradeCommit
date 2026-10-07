import { useEffect, useRef, useState } from 'react'
import { EyeIcon, EyeOffIcon } from '../../utils/Icons.jsx'
import { dialogInputClass, linkButtonClass, primaryButtonClass } from './profileStyles'

export const OTP_LENGTH = 6
export const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 72

function StepHeader({ title, children }) {
  return (
    <>
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">{children}</p>
    </>
  )
}

function ErrorText({ children }) {
  return children ? <p role="alert" className="mt-3 text-xs text-rose-500">{children}</p> : null
}

/** Step 1: tell the user where the code goes, then send it. */
export function SendCodeStep({ email, hasPassword, isBusy, error, onSend }) {
  return (
    <div>
      <StepHeader title={hasPassword ? 'Reset your password' : 'Set a password'}>
        For your security we&apos;ll email a {OTP_LENGTH}-digit code to <span className="font-medium text-zinc-800 dark:text-zinc-100">{email}</span> before you can choose a new password.
      </StepHeader>
      <ErrorText>{error}</ErrorText>
      <button type="button" onClick={onSend} disabled={isBusy} className={`${primaryButtonClass} mt-5`}>
        {isBusy ? 'Sending…' : 'Send code'}
      </button>
    </div>
  )
}

/** Step 2: enter the emailed code. `cooldown` counts down until "Resend" works again. */
export function CodeStep({ email, notice, cooldown, isBusy, error, onVerify, onResend }) {
  const [code, setCode] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (event) => {
    event.preventDefault()
    if (code.length === OTP_LENGTH) onVerify(code)
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <StepHeader title="Enter the code">
        We sent a {OTP_LENGTH}-digit code to <span className="font-medium text-zinc-800 dark:text-zinc-100">{email}</span>. It expires in 10 minutes.
      </StepHeader>
      {notice && <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400">{notice}</p>}

      <input
        ref={inputRef}
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={OTP_LENGTH}
        placeholder="••••••"
        aria-label="Verification code"
        className={`${dialogInputClass} mt-4 h-12 text-center text-xl tabular-nums tracking-[0.5em]`}
      />
      <ErrorText>{error}</ErrorText>

      <button type="submit" disabled={isBusy || code.length !== OTP_LENGTH} className={`${primaryButtonClass} mt-4`}>
        {isBusy ? 'Verifying…' : 'Verify code'}
      </button>
      <div className="mt-3 text-center">
        <button type="button" onClick={onResend} disabled={cooldown > 0 || isBusy} className={linkButtonClass}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </form>
  )
}

function PasswordInput({ id, label, value, onChange, autoFocus, autoComplete = 'new-password' }) {
  const [visible, setVisible] = useState(false)
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          maxLength={MAX_PASSWORD_LENGTH}
          className={`${dialogInputClass} pr-10`}
        />
        <button
          type="button"
          onClick={() => setVisible((shown) => !shown)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-zinc-500 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          {visible ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

/** Step 3: choose the new password. */
export function NewPasswordStep({ hasPassword, isBusy, error, onSubmit }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localError, setLocalError] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    if (password.length < MIN_PASSWORD_LENGTH) return setLocalError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
    if (password !== confirm) return setLocalError("Passwords don't match.")
    setLocalError('')
    onSubmit(password)
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <StepHeader title="Choose a new password">
        Email confirmed. {hasPassword ? 'Pick a password you haven’t used here before.' : 'You’ll be able to log in with it as well as Google.'}
      </StepHeader>

      <div className="mt-4 space-y-3">
        <PasswordInput id="new-password" label="New password" value={password} onChange={setPassword} autoFocus />
        <PasswordInput id="confirm-password" label="Confirm new password" value={confirm} onChange={setConfirm} />
      </div>
      <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">At least {MIN_PASSWORD_LENGTH} characters.</p>
      <ErrorText>{localError || error}</ErrorText>

      <button type="submit" disabled={isBusy || !password || !confirm} className={`${primaryButtonClass} mt-4`}>
        {isBusy ? 'Updating…' : hasPassword ? 'Update password' : 'Set password'}
      </button>
    </form>
  )
}

/** Final step: success. */
export function DoneStep({ onClose }) {
  return (
    <div className="text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <h2 className="mt-3 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Password updated</h2>
      <p className="mt-1 text-[13px] text-zinc-600 dark:text-zinc-300">Other devices have been signed out. This one stays logged in.</p>
      <button type="button" onClick={onClose} className={`${primaryButtonClass} mt-5`}>Done</button>
    </div>
  )
}
