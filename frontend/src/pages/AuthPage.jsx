import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import GoogleButton from "../components/auth/GoogleButton";
import OtpForm from "../components/auth/OtpForm";
import { SERIF, inputCls, labelCls, linkBtnCls, messageCls, submitCls } from "../components/auth/authStyles";
import { authPost as post } from "../services/authApi";

const REDIRECT_AFTER_LOGIN = "/";

function PasswordField({ id, label, value, onChange, autoComplete, hint }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="mb-4">
      <label htmlFor={id} className={labelCls}>{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required
          className={`${inputCls} pr-16`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer px-2 py-1.5 text-[13px] font-medium text-[#8b97a8]"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {hint && <div className="mt-[5px] text-[12.5px] text-[#8b97a8]">{hint}</div>}
    </div>
  );
}

function Field({ id, label, className = "", ...props }) {
  return (
    <div className={`mb-4 ${className}`}>
      <label htmlFor={id} className={labelCls}>{label}</label>
      <input id={id} required className={inputCls} {...props} />
    </div>
  );
}

const emptyLogin = { identifier: "", password: "" };
const emptyRegister = { fullname: "", username: "", email: "", password: "", confirm: "" };

export default function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // "login" | "register" | "verify"
  const [pendingEmail, setPendingEmail] = useState(""); // address waiting for its code (verify step)
  const [verifyNotice, setVerifyNotice] = useState("");
  const [login, setLogin] = useState(emptyLogin);
  const [reg, setReg] = useState(emptyRegister);
  const [message, setMessage] = useState(null); // { type: "error" | "ok", text }
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/v1/auth/check", { credentials: "include" });
        if (res.ok) {
          navigate(REDIRECT_AFTER_LOGIN, { replace: true });
        }
      } catch {
        // Ignore and let the user sign in.
      }
    };

    checkAuth();
  }, [navigate]);

  const switchMode = (next, keepMessage = false) => {
    setMode(next);
    if (!keepMessage) setMessage(null);
  };

  const setLoginField = (k) => (e) => setLogin((s) => ({ ...s, [k]: e.target.value }));
  const setRegField = (k) => (e) => setReg((s) => ({ ...s, [k]: e.target.value }));

  const finishLogin = () => {
    window.dispatchEvent(new Event("auth-state-changed"));
    navigate(REDIRECT_AFTER_LOGIN);
  };

  // login/register answer `needsVerification` instead of logging in when the email isn't confirmed yet
  const goToVerify = (email, notice) => {
    setPendingEmail(email);
    setVerifyNotice(notice);
    setMessage(null);
    setMode("verify");
  };

  const run = async (fn) => {
    setLoading(true);
    setMessage(null);
    try {
      await fn();
    } catch (err) {
      setMessage({
        type: "error",
        text:
          err instanceof TypeError
            ? "Can't reach the server. Check your connection and try again."
            : err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const identifier = login.identifier.trim();
    if (!identifier || !login.password) {
      return setMessage({ type: "error", text: "Enter your email or username and your password." });
    }
    // Backend accepts `email` or `username`
    const body = identifier.includes("@")
      ? { email: identifier, password: login.password }
      : { username: identifier, password: login.password };

    run(async () => {
      const { data } = await post("/login", body);
      if (data?.needsVerification) {
        goToVerify(data.email, "Your email isn't verified yet. We sent you a new code.");
        return;
      }
      finishLogin();
    });
  };

  const handleRegister = (e) => {
    e.preventDefault();
    const { fullname, username, email, password, confirm } = reg;
    if (![fullname, username, email, password].every((v) => v.trim())) {
      return setMessage({ type: "error", text: "Fill in all fields." });
    }
    if (password.length < 8) {
      return setMessage({ type: "error", text: "Password must be at least 8 characters." });
    }
    if (password !== confirm) {
      return setMessage({ type: "error", text: "Passwords don't match." });
    }

    run(async () => {
      const { data } = await post("/register", {
        fullname: fullname.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
      });
      if (data?.needsVerification) {
        goToVerify(data.email, "");
        return;
      }
      throw new Error("Registration did not request email verification.");
    });
  };

  const handleGoogleCredential = (credential) =>
    run(async () => {
      await post("/google", { credential });
      finishLogin();
    });

  const tabCls = (active) =>
    `-mb-px cursor-pointer border-b-2 pb-3 text-[15px] font-medium ${
      active ? "border-[#e5b567] text-[#e6eaf0]" : "border-transparent text-[#8b97a8]"
    }`;

  return (
    <div className="grid min-h-screen grid-cols-1 bg-[#10151c] font-['Instrument_Sans',system-ui,sans-serif] text-[15px] leading-normal text-[#e6eaf0] md:grid-cols-[1.05fr_1fr]">
      {/* Left: sample journal */}
      <aside
        aria-hidden="true"
        className="hidden flex-col justify-between gap-10 border-r border-[#27313f] bg-[#171e28] px-14 pb-10 pt-14 md:flex"
      >
        <div className={`${SERIF} text-[22px] font-semibold`}>Trade Commit</div>
        <div>
          <h1 className={`${SERIF} mb-3 max-w-[16ch] text-[40px] font-medium leading-[1.15]`}>
            Every trade, written down.
          </h1>
          <p className="max-w-[42ch] text-[#8b97a8]">
            Log entries, exits and what you were thinking. Review the pattern, not just the P&amp;L.
          </p>
        </div>
        <table className="w-full border-collapse text-sm tabular-nums">
          <thead>
            <tr className="text-left text-[#8b97a8]">
              <th className="border-b border-[#27313f] pb-2.5 font-medium">Setup</th>
              <th className="border-b border-[#27313f] pb-2.5 font-medium">Side</th>
              <th className="border-b border-[#27313f] pb-2.5 text-right font-medium">Result</th>
              <th className="border-b border-[#27313f] pb-2.5 font-medium">Note</th>
            </tr>
          </thead>
          <tbody className="[&_td]:border-b [&_td]:border-[#27313f] [&_td]:py-3">
            <tr><td>NIFTY 24500 CE</td><td>Long</td><td className="text-right text-[#5fb98a]">+2.4R</td><td className="text-[#8b97a8]">Waited for retest</td></tr>
            <tr><td>BANKNIFTY fut</td><td>Short</td><td className="text-right text-[#e07a6f]">−1.0R</td><td className="text-[#8b97a8]">Chased the open</td></tr>
            <tr><td>RELIANCE</td><td>Long</td><td className="text-right text-[#5fb98a]">+1.6R</td><td className="text-[#8b97a8]">Followed plan</td></tr>
          </tbody>
        </table>
      </aside>

      {/* Right: forms */}
      <main className="flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-[400px]">
          {mode !== "verify" && (
          <div className="mb-7 flex gap-6 border-b border-[#27313f]" role="tablist" aria-label="Account">
            <button role="tab" aria-selected={mode === "login"} onClick={() => switchMode("login")} className={tabCls(mode === "login")}>
              Log in
            </button>
            <button role="tab" aria-selected={mode === "register"} onClick={() => switchMode("register")} className={tabCls(mode === "register")}>
              Create account
            </button>
          </div>
          )}

          {message && mode !== "verify" && (
            <div role="alert" className={messageCls(message.type)}>
              {message.text}
            </div>
          )}

          {mode !== "verify" && <GoogleButton onCredential={handleGoogleCredential} disabled={loading} />}

          {mode === "verify" ? (
            <OtpForm
              email={pendingEmail}
              notice={verifyNotice}
              onVerified={finishLogin}
              onBack={() => switchMode("login")}
            />
          ) : mode === "login" ? (
            <form onSubmit={handleLogin} noValidate>
              <h2 className={`${SERIF} mb-1.5 text-[28px] font-medium`}>Welcome back</h2>
              <p className="mb-6 text-[#8b97a8]">Log in to open your journal.</p>

              <Field id="l-id" label="Email or username" value={login.identifier} onChange={setLoginField("identifier")} autoComplete="username" autoFocus />
              <PasswordField id="l-pw" label="Password" value={login.password} onChange={setLoginField("password")} autoComplete="current-password" />

              <button type="submit" disabled={loading} className={submitCls}>
                {loading ? "Logging in…" : "Log in"}
              </button>
              <p className="mt-5 text-center text-sm text-[#8b97a8]">
                New here?{" "}
                <button type="button" onClick={() => switchMode("register")} className={linkBtnCls}>Create an account</button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister} noValidate>
              <h2 className={`${SERIF} mb-1.5 text-[28px] font-medium`}>Start your journal</h2>
              <p className="mb-6 text-[#8b97a8]">Create an account to begin logging trades.</p>

              <Field id="r-name" label="Full name" value={reg.fullname} onChange={setRegField("fullname")} autoComplete="name" autoFocus />
              <div className="grid grid-cols-1 gap-x-3 min-[420px]:grid-cols-2">
                <Field id="r-user" label="Username" value={reg.username} onChange={setRegField("username")} autoComplete="username" />
                <Field id="r-email" type="email" label="Email" value={reg.email} onChange={setRegField("email")} autoComplete="email" />
              </div>
              <PasswordField id="r-pw" label="Password" value={reg.password} onChange={setRegField("password")} autoComplete="new-password" hint="At least 8 characters." />
              <Field id="r-pw2" type="password" label="Confirm password" value={reg.confirm} onChange={setRegField("confirm")} autoComplete="new-password" />

              <button type="submit" disabled={loading} className={submitCls}>
                {loading ? "Creating account…" : "Create account"}
              </button>
              <p className="mt-5 text-center text-sm text-[#8b97a8]">
                Already registered?{" "}
                <button type="button" onClick={() => switchMode("login")} className={linkBtnCls}>Log in</button>
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
