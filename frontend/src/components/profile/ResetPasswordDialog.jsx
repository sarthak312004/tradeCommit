import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { errorText } from '../../services/authApi'
import { passwordApi } from '../../services/profileApi'
import { CloseIcon } from '../../utils/Icons.jsx'
import { CodeStep, DoneStep, NewPasswordStep, SendCodeStep } from './ResetPasswordSteps'
import { focusRing } from './profileStyles'

const STEPS = ['send', 'code', 'password', 'done']
const SESSION_EXPIRED_STATUS = 410

/**
 * Modal that walks the logged-in user through: email code -> confirm code -> new password.
 * Rendered in a portal because the page header uses backdrop-blur, which would otherwise trap `fixed` children.
 */
function ResetPasswordDialog({ email, hasPassword, onClose }) {
  const [step, setStep] = useState('send')
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [resetToken, setResetToken] = useState('')

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const id = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  useEffect(() => {
    const handleKeyDown = (event) => event.key === 'Escape' && !isBusy && onClose()
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isBusy, onClose])

  // runs one request with shared busy/error handling; the action returns nothing and moves the step itself
  const run = async (action) => {
    setIsBusy(true)
    setError('')
    try {
      await action()
    } catch (requestError) {
      if (requestError.status === SESSION_EXPIRED_STATUS) {
        setStep('send') // the proof expired: start over
        setResetToken('')
      }
      setError(errorText(requestError))
    } finally {
      setIsBusy(false)
    }
  }

  const sendCode = ({ isResend = false } = {}) =>
    run(async () => {
      const { sent, retryAfter } = await passwordApi.sendCode()
      setCooldown(retryAfter)
      setNotice(
        !sent ? 'A code was sent a moment ago. Check your inbox and spam folder.' : isResend ? 'A new code is on its way.' : ''
      )
      setStep('code')
    })

  const verifyCode = (code) =>
    run(async () => {
      const data = await passwordApi.verifyCode(code)
      setResetToken(data.resetToken)
      setStep('password')
    })

  const setPassword = (newPassword) =>
    run(async () => {
      await passwordApi.setPassword(resetToken, newPassword)
      setResetToken('')
      setStep('done')
    })

  const stepNumber = STEPS.indexOf(step)

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => event.target === event.currentTarget && !isBusy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={hasPassword ? 'Reset password' : 'Set password'}
        className="relative w-full max-w-sm rounded-2xl border border-zinc-300 bg-white p-6 shadow-2xl dark:border-white/[0.14] dark:bg-panel"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={isBusy}
          aria-label="Close"
          className={`absolute right-3 top-3 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-zinc-200 ${focusRing}`}
        >
          <CloseIcon className="h-4 w-4" />
        </button>

        {step !== 'done' && (
          <div className="mb-5 flex gap-1.5" aria-hidden="true">
            {STEPS.slice(0, 3).map((name, index) => (
              <span
                key={name}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${index <= stepNumber ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-200 dark:bg-white/10'}`}
              />
            ))}
          </div>
        )}

        {step === 'send' && <SendCodeStep email={email} hasPassword={hasPassword} isBusy={isBusy} error={error} onSend={() => sendCode()} />}
        {step === 'code' && (
          <CodeStep
            email={email}
            notice={notice}
            cooldown={cooldown}
            isBusy={isBusy}
            error={error}
            onVerify={verifyCode}
            onResend={() => sendCode({ isResend: true })}
          />
        )}
        {step === 'password' && <NewPasswordStep hasPassword={hasPassword} isBusy={isBusy} error={error} onSubmit={setPassword} />}
        {step === 'done' && <DoneStep onClose={onClose} />}
      </div>
    </div>,
    document.body
  )
}

export default ResetPasswordDialog
