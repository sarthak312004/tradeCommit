// Date helpers for the planner calendar. Dates travel as "YYYY-MM-DD" keys built from
// local time, so a plan never slips to the neighbouring day because of timezones.

export const WEEK_STARTS_ON = 1 // 0 = Sunday, 1 = Monday (trading week)

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const getWeekdayLabels = () =>
  Array.from({ length: 7 }, (_, index) => WEEKDAY_LABELS[(index + WEEK_STARTS_ON) % 7])

const pad = (value) => String(value).padStart(2, '0')

export const toDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const fromDateKey = (key) => {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const todayKey = () => toDateKey(new Date())

export const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1)

export const addMonths = (date, amount) => new Date(date.getFullYear(), date.getMonth() + amount, 1)

export const formatMonthTitle = (date) =>
  date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

export const formatLongDate = (key) =>
  fromDateKey(key).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

/** Whole weeks covering the month, each day as `{ key, day, inMonth }`. */
export const buildMonthGrid = (monthDate) => {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const first = new Date(year, month, 1)
  const leading = (first.getDay() - WEEK_STARTS_ON + 7) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const weekCount = Math.ceil((leading + daysInMonth) / 7)

  return Array.from({ length: weekCount * 7 }, (_, index) => {
    const date = new Date(year, month, index - leading + 1)
    return { key: toDateKey(date), day: date.getDate(), inMonth: date.getMonth() === month }
  })
}
