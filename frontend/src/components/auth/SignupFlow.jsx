import { useState } from "react"
import GoogleButton from "./GoogleButton"
import OtpForm from "./OtpForm"
import { authPost, errorText } from "../../services/authApi"
import { Field } from "./fields"
import { eyebrowCls, linkBtnCls, messageCls, mutedCls, submitCls } from "./authStyles"

/**
 * Create an account with Google or verify an email address with a one-time code.
 *
 * @param {Function} onCredential  (idToken) => void, signs up (or logs in) through POST /auth/google
 * @param {Function} onLogin       switch to the log-in tab
 * @param {boolean}  loading       a request is running
 * @param {object}   message       optional { type, text } error to show
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESEND_SECONDS = 60

export default function SignupFlow({ onCredential, onComplete, onLogin, loading = false, message = null }) {
  const [step, setStep] = useState("form")
  const [email, setEmail] = useState("")
  const [cooldown, setCooldown] = useState(RESEND_SECONDS)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailMessage, setEmailMessage] = useState(null)

  const cleanEmail = email.trim().toLowerCase()

  const requestCode = async () => {
    const { data } = await authPost("/signup/send-otp", { email: cleanEmail })
    return { sent: data?.sent !== false, retryAfter: data?.retryAfter ?? RESEND_SECONDS }
  }

  const handleSendCode = async (event) => {
    event.preventDefault()
    if (!EMAIL_PATTERN.test(cleanEmail)) {
      setEmailMessage({ type: "error", text: "Enter a valid email address." })
      return
    }
    setEmailLoading(true)
    setEmailMessage(null)
    try {
      const { retryAfter } = await requestCode()
      setCooldown(retryAfter)
      setStep("otp")
    } catch (error) {
      setEmailMessage({ type: "error", text: errorText(error) })
    } finally {
      setEmailLoading(false)
    }
  }

  const handleVerify = async (code) => {
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
        onChangeEmail={() => setStep("email")}
        eyebrow="Step 2 of 2 · Verify"
        submitLabel="Verify & continue"
      />
    )
  }

  return (
    <div>
      <p className={eyebrowCls}>Create account</p>

      {message && (
        <div role="alert" className={messageCls(message.type)}>
          {message.text}
        </div>
      )}

      <GoogleButton onCredential={onCredential} disabled={loading} label="Continue with Google" gisText="continue_with" />

      <form onSubmit={handleSendCode} noValidate>
        {emailMessage && <div role="alert" className={messageCls(emailMessage.type)}>{emailMessage.text}</div>}
        <Field
          id="s-email"
          type="email"
          label="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
        <button type="submit" disabled={emailLoading || loading} className={submitCls}>
          {emailLoading ? "Sending code…" : "Continue with email"}
        </button>
      </form>

      <p className={`mt-5 text-center text-[13px] ${mutedCls}`}>
        Already registered?{" "}
        <button type="button" onClick={onLogin} className={linkBtnCls}>Log in</button>
      </p>
    </div>
  )
}
