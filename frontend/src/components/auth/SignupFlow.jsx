import { useState } from "react"
import { authPost, errorText } from "../../services/authApi"
import OtpForm from "./OtpForm"
import { Field, PasswordField } from "./fields"
import { eyebrowCls, headingCls, inputCls, labelCls, linkBtnCls, messageCls, mutedCls, submitCls } from "./authStyles"

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESEND_SECONDS = 60

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3.5 8.5 3 3 6-7" />
    </svg>
  )
}

/**
 * Create-account flow: 1) email  2) code from that email  3) name, username, password.
 * The account does not exist until step 3 is submitted with the proof from step 2.
 *
 * @param {Function} onComplete  called after the account is created and the user is logged in
 * @param {Function} onLogin     switch to the log-in tab
 */
export default function SignupFlow({ onComplete, onLogin }) {
  const [step, setStep] = useState("email") // "email" | "otp" | "details"
  const [email, setEmail] = useState("")
  const [cooldown, setCooldown] = useState(RESEND_SECONDS)
  const [signupToken, setSignupToken] = useState("")
  const [form, setForm] = useState({ fullname: "", username: "", password: "", confirm: "" })
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)

  const setField = (key) => (event) => setForm((state) => ({ ...state, [key]: event.target.value }))
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
    const { data } = await authPost("/signup/verify-otp", { email: cleanEmail, otp: code })
    setSignupToken(data.signupToken)
    setMessage(null)
    setStep("details")
  }

  const backToEmail = (notice = null) => {
    setSignupToken("")
    setMessage(notice)
    setStep("email")
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    const { fullname, username, password, confirm } = form
    const cleanUsername = username.trim().toLowerCase()

    if (!fullname.trim() || !cleanUsername || !password) {
      return setMessage({ type: "error", text: "Fill in all fields." })
    }
    if (!USERNAME_PATTERN.test(cleanUsername)) {
      return setMessage({ type: "error", text: "Username must be 3-20 characters: letters, numbers or underscores." })
    }
    if (password.length < 8) {
      return setMessage({ type: "error", text: "Password must be at least 8 characters." })
    }
    if (password !== confirm) {
      return setMessage({ type: "error", text: "Passwords don't match." })
    }

    setLoading(true)
    setMessage(null)
    try {
      await authPost("/register", {
        email: cleanEmail,
        signupToken,
        fullname: fullname.trim(),
        username: cleanUsername,
        password,
      })
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
      />
    )
  }

  if (step === "details") {
    return (
      <form onSubmit={handleCreate} noValidate>
        <p className={eyebrowCls}>Step 3 of 3 · Your details</p>
        <h2 className={`${headingCls} mb-1.5`}>Almost there</h2>
        <p className={`mb-6 ${mutedCls}`}>Your email is confirmed. Pick a username and password to finish.</p>

        {message && (
          <div role="alert" className={messageCls(message.type)}>
            {message.text}
          </div>
        )}

        <div className="mb-4">
          <label htmlFor="r-email-verified" className={labelCls}>Email</label>
          <div className="relative">
            <input id="r-email-verified" value={cleanEmail} readOnly tabIndex={-1} className={`${inputCls} pr-24`} />
            <span className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CheckIcon /> Verified
            </span>
          </div>
        </div>

        <Field id="r-name" label="Full name" value={form.fullname} onChange={setField("fullname")} autoComplete="name" autoFocus required />
        <Field
          id="r-user"
          label="Username"
          value={form.username}
          onChange={setField("username")}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          hint="3-20 characters: letters, numbers or underscores."
          required
        />
        <PasswordField id="r-pw" label="Password" value={form.password} onChange={setField("password")} autoComplete="new-password" hint="At least 8 characters." required />
        <Field id="r-pw2" type="password" label="Confirm password" value={form.confirm} onChange={setField("confirm")} autoComplete="new-password" required />

        <button type="submit" disabled={loading} className={submitCls}>
          {loading ? "Creating account…" : "Create account"}
        </button>
        <p className={`mt-5 text-center text-[13px] ${mutedCls}`}>
          Wrong email?{" "}
          <button type="button" onClick={() => backToEmail()} className={linkBtnCls}>Start over</button>
        </p>
      </form>
    )
  }

  return (
    <form onSubmit={handleSendCode} noValidate>
      <p className={eyebrowCls}>Step 1 of 3 · Email</p>
      <h2 className={`${headingCls} mb-1.5`}>Start your journal</h2>
      <p className={`mb-6 ${mutedCls}`}>Enter your email and we&apos;ll send you a code to confirm it&apos;s yours.</p>

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
