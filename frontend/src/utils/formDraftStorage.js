const read = (key) => {
  if (!key || typeof window === 'undefined') return null
  try {
    const value = window.localStorage.getItem(key)
    return value ? JSON.parse(value) : null
  } catch (error) {
    console.error('Could not read the saved form draft:', error)
    return null
  }
}

const write = (key, value) => {
  if (!key || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error('Could not save the form draft:', error)
  }
}

const clear = (key) => {
  if (!key || typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch (error) {
    console.error('Could not clear the form draft:', error)
  }
}

export { read as readFormDraft, write as writeFormDraft, clear as clearFormDraft }
