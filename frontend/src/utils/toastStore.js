// Tiny notification store: no library, no React. `ToastHost` (components/common) renders it.
// Toasts auto-dismiss, at most MAX_VISIBLE are shown at once (the oldest make room), and every timer is cleared
// when its toast is removed, so nothing keeps running after the last toast is gone.

export const TOAST_DURATION_MS = 3500
export const TOAST_EXIT_MS = 180
export const MAX_VISIBLE_TOASTS = 3

export function createToastStore({ duration = TOAST_DURATION_MS, exitMs = TOAST_EXIT_MS, maxVisible = MAX_VISIBLE_TOASTS } = {}) {
  let toasts = []
  let nextId = 1
  const listeners = new Set()
  const timers = new Map() // id -> { dismiss, remove }

  const emit = () => listeners.forEach((listener) => listener())
  const clearTimers = (id) => {
    const entry = timers.get(id)
    if (!entry) return
    clearTimeout(entry.dismiss)
    clearTimeout(entry.remove)
    timers.delete(id)
  }

  const remove = (id) => {
    clearTimers(id)
    if (!toasts.some((toast) => toast.id === id)) return
    toasts = toasts.filter((toast) => toast.id !== id)
    emit()
  }

  // plays the exit animation, then removes
  const dismiss = (id) => {
    const toast = toasts.find((item) => item.id === id)
    if (!toast || toast.leaving) return
    clearTimers(id)
    toasts = toasts.map((item) => (item.id === id ? { ...item, leaving: true } : item))
    timers.set(id, { remove: setTimeout(() => remove(id), exitMs) })
    emit()
  }

  const scheduleDismiss = (id, duration) => {
    if (duration === null) return
    timers.set(id, { dismiss: setTimeout(() => dismiss(id), duration) })
  }

  const show = ({ message, detail = '', tone = 'success', duration: toastDuration = duration }) => {
    const id = nextId++
    const staying = toasts.filter((toast) => !toast.leaving)
    for (const old of staying.slice(0, Math.max(0, staying.length - (maxVisible - 1)))) remove(old.id)
    toasts = [...toasts, { id, message, detail, tone, leaving: false }]
    scheduleDismiss(id, toastDuration)
    emit()
    return id
  }

  const update = (id, { message, detail = '', tone = 'success', duration: toastDuration = duration }) => {
    if (!toasts.some((toast) => toast.id === id)) return false
    clearTimers(id)
    toasts = toasts.map((toast) => (
      toast.id === id ? { ...toast, message, detail, tone, leaving: false } : toast
    ))
    scheduleDismiss(id, toastDuration)
    emit()
    return true
  }

  const clear = () => {
    for (const id of [...timers.keys()]) clearTimers(id)
    toasts = []
    emit()
  }

  return {
    show,
    update,
    dismiss,
    clear,
    getSnapshot: () => toasts,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export const toastStore = createToastStore()
export const showToast = (toast) => toastStore.show(toast)
export const updateToast = (id, toast) => toastStore.update(id, toast)
