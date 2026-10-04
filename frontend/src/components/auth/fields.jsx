import { useState } from "react"
import { hintCls, inputCls, labelCls } from "./authStyles"

export function Field({ id, label, hint, className = "mb-4", ...props }) {
  return (
    <div className={className}>
      <label htmlFor={id} className={labelCls}>{label}</label>
      <input id={id} className={inputCls} {...props} />
      {hint && <p className={hintCls}>{hint}</p>}
    </div>
  )
}

export function PasswordField({ id, label, hint, className = "mb-4", ...props }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className={className}>
      <label htmlFor={id} className={labelCls}>{label}</label>
      <div className="relative">
        <input id={id} type={visible ? "text" : "password"} className={`${inputCls} pr-14`} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer rounded px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {hint && <p className={hintCls}>{hint}</p>}
    </div>
  )
}
