import { useState } from "react"
import { authPost, errorText } from "../../services/authApi"
import OtpForm from "./OtpForm"
import { Field } from "./fields"
import { eyebrowCls, headingCls, linkBtnCls, messageCls, mutedCls, submitCls } from "./authStyles"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESEND_SECONDS = 60

/**
 * Log in with an emailed code instead of a password: 1) email  2) code from that email -> logged in.
 * Same email-code check as sign-up and forgot-password.
 *
 * @param {string}   initialEmail  address to pre-fill (taken from the log-in form when it was an email)
 * @param {Function} onComplete    called once the code is accepted and the user is logged in
 * @param {Function} onBack        go back to the password log-in form
 */
export default function OtpLoginFlow({ initialEmail = "", onComplete, onBack }) {
  const [step, setStep] = useState("email") // "email" | "otp"
  const [email, setEmail] = useState(initialEmail)
  const [cooldown, setCooldown] = useState(RESEND_SECONDS)
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)

  const cleanEmail = email.trim().toLowerCase()

  const requestCode = async () => {
    const { data } = await authPost("/login/send-otp", { email: cleanEmail })
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
    await authPost("/login/verify-otp", { email: cleanEmail, otp: code })
    onComplete()
  }

  if (step === "otp") {
    return (
      <OtpForm
        email={cleanEmail}
        initialCooldown={cooldown}
        onVerify={handleVerify}
        onResend={requestCode}
        onChangeEmail={() => {
          setMessage(null)
          setStep("email")
        }}
        eyebrow="Step 2 of 2 · Verify"
        submitLabel="Verify & log in"
      />
    )
  }

  return (
    <form onSubmit={handleSendCode} noValidate>
      <p className={eyebrowCls}>Step 1 of 2 · Email</p>
      <h2 className={`${headingCls} mb-1.5`}>Log in with a code</h2>
      <p className={`mb-6 ${mutedCls}`}>Enter your email and we&apos;ll send you a code. No password needed.</p>

      {message && (
        <div role="alert" className={messageCls(message.type)}>
          {message.text}
        </div>
      )}

      <Field
        id="o-email"
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
        {loading ? "Sending code…" : "Send login code"}
      </button>
      <p className={`mt-5 text-center text-[13px] ${mutedCls}`}>
        Prefer a password?{" "}
        <button type="button" onClick={onBack} className={linkBtnCls}>Back to log in</button>
      </p>
    </form>
  )
}
