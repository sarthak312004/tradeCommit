import { useState } from "react"
import { authPost, errorText } from "../../services/authApi"
import OtpForm from "./OtpForm"
import { Field, PasswordField } from "./fields"
import { eyebrowCls, headingCls, linkBtnCls, messageCls, mutedCls, submitCls } from "./authStyles"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESEND_SECONDS = 60
const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 72

/**
 * Forgot-password flow for someone who can't log in: 1) email  2) code from that email  3) new password.
 * Same email-code check as sign-up; the password only changes with the proof from step 2.
 *
 * @param {string}   initialEmail  address to pre-fill (taken from the log-in form when it was an email)
 * @param {Function} onComplete    called after the password is updated and the user is logged in
 * @param {Function} onBack        go back to the log-in form
 */
export default function ForgotPasswordFlow({ initialEmail = "", onComplete, onBack }) {
  const [step, setStep] = useState("email") // "email" | "otp" | "password"
  const [email, setEmail] = useState(initialEmail)
  const [cooldown, setCooldown] = useState(RESEND_SECONDS)
  const [resetToken, setResetToken] = useState("")
  const [form, setForm] = useState({ password: "", confirm: "" })
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)

  const cleanEmail = email.trim().toLowerCase()
  const setField = (key) => (event) => setForm((state) => ({ ...state, [key]: event.target.value }))

  const requestCode = async () => {
    const { data } = await authPost("/forgot-password/send-otp", { email: cleanEmail })
    return { sent: data?.sent !== false, retryAfter: data?.retryAfter ?? RESEND_SECONDS }
  }

  const handleSendCode = async (event) => {
    event.preventDefault()
    if (!EMAIL_PATTERN.test(cleanEmail)) {
      return setMessage({ type: "error", text: "Enter a valid email address." })
    }
    setLoading(true)
    setMessage(null)
    try {
      const { retryAfter } = await requestCode()
      setCooldown(retryAfter)
      setStep("otp")
    } catch (error) {
      setMessage({ type: "error", text: errorText(error) })
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (code) => {
    const { data } = await authPost("/forgot-password/verify-otp", { email: cleanEmail, otp: code })
    setResetToken(data.resetToken)
    setMessage(null)
    setStep("password")
  }

  const backToEmail = (notice = null) => {
    setResetToken("")
    setForm({ password: "", confirm: "" })
    setMessage(notice)
    setStep("email")
  }

  const handleReset = async (event) => {
    event.preventDefault()
    const { password, confirm } = form
    if (!password) return setMessage({ type: "error", text: "Enter a new password." })
    if (password.length < MIN_PASSWORD_LENGTH) {
      return setMessage({ type: "error", text: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` })
    }
    if (password !== confirm) return setMessage({ type: "error", text: "Passwords don't match." })

    setLoading(true)
    setMessage(null)
    try {
      await authPost("/forgot-password/reset", { email: cleanEmail, resetToken, newPassword: password })
      onComplete()
    } catch (error) {
      if (error.status === 410) {
        // the proof expired: the address has to be confirmed again
        backToEmail({ type: "error", text: error.message })
      } else {
        setMessage({ type: "error", text: errorText(error) })
      }
      setLoading(false)
    }
  }

  if (step === "otp") {
    return (
      <OtpForm
        email={cleanEmail}
        initialCooldown={cooldown}
        onVerify={handleVerify}
        onResend={requestCode}
        onChangeEmail={() => backToEmail()}
        eyebrow="Step 2 of 3 · Verify"
        submitLabel="Verify code"
      />
    )
  }

  if (step === "password") {
    return (
      <form onSubmit={handleReset} noValidate>
        <p className={eyebrowCls}>Step 3 of 3 · New password</p>
        <h2 className={`${headingCls} mb-1.5`}>Choose a new password</h2>
        <p className={`mb-6 ${mutedCls}`}>Your email is confirmed. Pick a password you haven&apos;t used here before.</p>

        {message && (
          <div role="alert" className={messageCls(message.type)}>
            {message.text}
          </div>
        )}

        <PasswordField
          id="f-pw"
          label="New password"
          value={form.password}
          onChange={setField("password")}
          autoComplete="new-password"
          maxLength={MAX_PASSWORD_LENGTH}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          autoFocus
        />
        <Field
          id="f-pw2"
          type="password"
          label="Confirm new password"
          value={form.confirm}
          onChange={setField("confirm")}
          autoComplete="new-password"
          maxLength={MAX_PASSWORD_LENGTH}
        />

        <button type="submit" disabled={loading} className={submitCls}>
          {loading ? "Updating…" : "Update password & log in"}
        </button>
        <p className={`mt-5 text-center text-[13px] ${mutedCls}`}>
          <button type="button" onClick={() => backToEmail()} className={linkBtnCls}>Start over</button>
        </p>
      </form>
    )
  }

  return (
    <form onSubmit={handleSendCode} noValidate>
      <p className={eyebrowCls}>Step 1 of 3 · Email</p>
      <h2 className={`${headingCls} mb-1.5`}>Reset your password</h2>
      <p className={`mb-6 ${mutedCls}`}>Enter the email on your account and we&apos;ll send you a code to confirm it&apos;s you.</p>

      {message && (
        <div role="alert" className={messageCls(message.type)}>
          {message.text}
        </div>
      )}

      <Field
        id="f-email"
        type="email"
        label="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        placeholder="you@example.com"
        autoFocus
        required
      />

      <button type="submit" disabled={loading} className={submitCls}>
        {loading ? "Sending code…" : "Send verification code"}
      </button>
      <p className={`mt-5 text-center text-[13px] ${mutedCls}`}>
        Remembered it?{" "}
        <button type="button" onClick={onBack} className={linkBtnCls}>Back to log in</button>
      </p>
    </form>
  )
}
