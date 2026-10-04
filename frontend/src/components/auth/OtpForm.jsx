import { useEffect, useRef, useState } from "react"
import { errorText } from "../../services/authApi"
import { eyebrowCls, headingCls, inputCls, labelCls, linkBtnCls, messageCls, mutedCls, submitCls } from "./authStyles"

export const OTP_LENGTH = 6

/**
 * "Enter the code we emailed you" step of the sign-up.
 *
 * @param {string}   email           address the code was sent to
 * @param {number}   initialCooldown seconds until "Resend" unlocks
 * @param {Function} onVerify        async (code) => void; throw to show an error
 * @param {Function} onResend        async () => { sent: boolean, retryAfter: number }
 * @param {Function} onChangeEmail   go back and type a different address
 */
export default function OtpForm({ email, initialCooldown, onVerify, onResend, onChangeEmail }) {
  const [code, setCode] = useState("")
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(initialCooldown)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const id = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  const submit = async (value) => {
    if (loading) return
    if (value.length !== OTP_LENGTH) {
      return setMessage({ type: "error", text: `Enter the ${OTP_LENGTH}-digit code.` })
    }
    setLoading(true)
    setMessage(null)
    try {
      await onVerify(value)
    } catch (error) {
      setMessage({ type: "error", text: errorText(error) })
      setCode("")
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 0) // the field was disabled while checking
    }
  }

  const handleChange = (event) => {
    const next = event.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH)
    setCode(next)
    if (next.length === OTP_LENGTH) submit(next) // pasted or typed in full: no need to press the button
  }

  const handleResend = async () => {
    setMessage(null)
    try {
      const { sent, retryAfter } = await onResend()
      setCooldown(retryAfter)
      if (sent) {
        setCode("")
        setMessage({ type: "ok", text: "A new code is on its way. Check your inbox and spam folder." })
        inputRef.current?.focus()
      } else {
        setMessage({ type: "ok", text: "A code was just sent. Give it a moment to arrive." })
      }
    } catch (error) {
      setMessage({ type: "error", text: errorText(error) })
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit(code)
      }}
      noValidate
    >
      <p className={eyebrowCls}>Step 2 of 3 · Verify</p>
      <h2 className={`${headingCls} mb-1.5`}>Check your email</h2>
      <p className={`mb-6 ${mutedCls}`}>
        We sent a {OTP_LENGTH}-digit code to{" "}
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{email}</span>. It expires in 10 minutes.
      </p>

      {message && (
        <div role="alert" className={messageCls(message.type)}>
          {message.text}
        </div>
      )}

      <label htmlFor="otp" className={labelCls}>Verification code</label>
      <input
        ref={inputRef}
        id="otp"
        value={code}
        onChange={handleChange}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={OTP_LENGTH}
        placeholder="000000"
        disabled={loading}
        className={`${inputCls} h-12 text-center text-xl font-medium tracking-[0.5em] tabular-nums placeholder:tracking-[0.5em]`}
      />

      <button type="submit" disabled={loading} className={`${submitCls} mt-4`}>
        {loading ? "Verifying…" : "Verify email"}
      </button>

      <div className="mt-5 flex items-center justify-between">
        <button type="button" onClick={onChangeEmail} className={linkBtnCls}>
          Use a different email
        </button>
        <button type="button" onClick={handleResend} disabled={cooldown > 0} className={linkBtnCls}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
      </div>
    </form>
  )
}
