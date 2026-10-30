import GoogleButton from "./GoogleButton"
import { eyebrowCls, headingCls, linkBtnCls, messageCls, mutedCls } from "./authStyles"

/**
 * Create-account: one click with Google. No form, no emailed code, no password.
 * The name and username come from the Google profile and can be edited later in the Profile section.
 *
 * @param {Function} onCredential  (idToken) => void, signs up (or logs in) through POST /auth/google
 * @param {Function} onLogin       switch to the log-in tab
 * @param {boolean}  loading       a request is running
 * @param {object}   message       optional { type, text } error to show
 */
export default function SignupFlow({ onCredential, onLogin, loading = false, message = null }) {
  return (
    <div>
      <p className={eyebrowCls}>Create account</p>
      <h2 className={`${headingCls} mb-1.5`}>Start your journal</h2>
      <p className={`mb-6 ${mutedCls}`}>Continue with Google. No password or form to fill in, and your name is picked up from your Google profile.</p>

      {message && (
        <div role="alert" className={messageCls(message.type)}>
          {message.text}
        </div>
      )}

      <GoogleButton onCredential={onCredential} disabled={loading} label="Continue with Google" gisText="continue_with" divider={false} />

      <p className={`mt-5 text-center text-[13px] ${mutedCls}`}>
        Already registered?{" "}
        <button type="button" onClick={onLogin} className={linkBtnCls}>Log in</button>
      </p>
    </div>
  )
}
