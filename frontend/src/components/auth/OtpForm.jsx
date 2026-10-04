import { useEffect, useRef, useState } from "react"
import { authPost } from "../../services/authApi"
import { SERIF, inputCls, labelCls, linkBtnCls, messageCls, submitCls } from "./authStyles"

const OTP_LENGTH = 6
const RESEND_SECONDS = 60

/**
 * "Enter the code we emailed you" step.
 *
 * @param {string}   email       address the code was sent to
 * @param {Function} onVerified  called after the server accepted the code (it has already set the login cookies)
 * @param {Function} onBack      go back to the sign-up / login form
 * @param {string}   [notice]    info shown above the form (e.g. "We sent a code to ...")
 */
export default function OtpForm({ email, onVerified, onBack, notice }) {
  const [code, setCode] = useState("")
  const [message, setMessage] = useState(notice ? { type: "ok", text: notice } : null)
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_SECONDS) // a code was just sent
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const id = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  const handleChange = (event) => {
    setCode(event.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (code.length !== OTP_LENGTH) {
      return setMessage({ type: "error", text: `Enter the ${OTP_LENGTH}-digit code.` })
    }

    setLoading(true)
    setMessage(null)
    try {
      await authPost("/verify-email", { email, otp: code })
      onVerified()
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof TypeError ? "Can't reach the server. Check your connection and try again." : error.message,
      })
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setMessage(null)
    try {
      await authPost("/resend-otp", { email })
      setCode("")
      setCooldown(RESEND_SECONDS)
      setMessage({ type: "ok", text: "A new code is on its way. Check your inbox and spam folder." })
      inputRef.current?.focus()
    } catch (error) {
      setMessage({ type: "error", text: error.message })
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className={`${SERIF} mb-1.5 text-[28px] font-medium`}>Check your email</h2>
      <p className="mb-6 text-[#8b97a8]">
        We sent a {OTP_LENGTH}-digit code to <span className="text-[#e6eaf0]">{email}</span>. It expires in 10 minutes.
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
        placeholder="••••••"
        className={`${inputCls} text-center text-xl tracking-[0.5em] tabular-nums`}
      />

      <button type="submit" disabled={loading} className={submitCls}>
        {loading ? "Verifying…" : "Verify email"}
      </button>

      <div className="mt-5 flex items-center justify-between text-sm text-[#8b97a8]">
        <button type="button" onClick={onBack} className={linkBtnCls}>
          Back
        </button>
        <button type="button" onClick={handleResend} disabled={cooldown > 0} className={linkBtnCls}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
      </div>
    </form>
  )
}
