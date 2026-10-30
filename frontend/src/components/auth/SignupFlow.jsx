import { useState } from "react"
import { authPost, errorText } from "../../services/authApi"
import OtpForm from "./OtpForm"
import { Field } from "./fields"
import { eyebrowCls, headingCls, linkBtnCls, messageCls, mutedCls, submitCls } from "./authStyles"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESEND_SECONDS = 60

/**
 * Create-account flow: 1) email  2) code from that email -> the account is created and the user is logged in.
 * There is no details form: the name, username and an optional password are added later in the Profile section.
 *
 * @param {Function} onComplete  called after the code is accepted, the account exists and the user is logged in
 * @param {Function} onLogin     switch to the log-in tab
 */
export default function SignupFlow({ onComplete, onLogin }) {
  const [step, setStep] = useState("email") // "email" | "otp"
  const [email, setEmail] = useState("")
  const [cooldown, setCooldown] = useState(RESEND_SECONDS)
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)

  const cleanEmail = email.trim().toLowerCase()

  const requestCode = async () => {
    const { data } = await authPost("/signup/send-otp", { email: cleanEmail })
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
    // the server accepts the code, creates the account if needed and sets the session cookies
    await authPost("/signup/verify-otp", { email: cleanEmail, otp: code })
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
        submitLabel="Verify & continue"
      />
    )
  }

  return (
    <form onSubmit={handleSendCode} noValidate>
      <p className={eyebrowCls}>Step 1 of 2 · Email</p>
      <h2 className={`${headingCls} mb-1.5`}>Start your journal</h2>
      <p className={`mb-6 ${mutedCls}`}>Enter your email and we&apos;ll send you a code. No password or form to fill in.</p>

      {message && (
        <div role="alert" className={messageCls(message.type)}>
          {message.text}
        </div>
      )}

      <Field id="r-email" type="email" label="Email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" autoFocus required />

      <button type="submit" disabled={loading} className={submitCls}>
        {loading ? "Sending code…" : "Send verification code"}
      </button>
      <p className={`mt-5 text-center text-[13px] ${mutedCls}`}>
        Already registered?{" "}
        <button type="button" onClick={onLogin} className={linkBtnCls}>Log in</button>
      </p>
    </form>
  )
}
