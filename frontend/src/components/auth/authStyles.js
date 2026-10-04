// Class strings shared by the auth page and its sub-forms.

export const SERIF = "font-['Newsreader',Georgia,serif]"

export const inputCls =
  "w-full rounded-lg border border-[#27313f] bg-[#0d1219] px-3 py-[11px] text-[15px] text-[#e6eaf0] placeholder:text-[#566274] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5b567]"

export const labelCls = "mb-1.5 block text-[13px] font-medium"

export const submitCls =
  "mt-2 w-full cursor-pointer rounded-lg bg-[#e5b567] py-3 text-[15px] font-semibold text-[#1a1305] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5b567] disabled:cursor-wait disabled:opacity-60"

export const linkBtnCls =
  "cursor-pointer text-sm font-medium text-[#e5b567] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5b567] disabled:cursor-not-allowed disabled:opacity-50"

export const messageCls = (type) =>
  `mb-4 rounded-lg border px-3 py-2.5 text-sm ${
    type === "error"
      ? "border-[#5a2c27] bg-[#2a1816] text-[#f1b8b1]"
      : "border-[#24503a] bg-[#12251c] text-[#a9dcc2]"
  }`
