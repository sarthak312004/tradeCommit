import { Component } from 'react'

/** Keeps a failure inside one analytics view from blanking the whole journal. */
class AnalyticsBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error('analytics view failed', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" className="grid place-items-center px-6 py-14 text-center">
        <div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">This view couldn&apos;t be drawn.</p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Your trades are safe. Try again, or switch to another tab.</p>
          <button
            type="button"
            onClick={() => this.setState({ failed: false })}
            className="mt-3 cursor-pointer text-xs font-medium text-sky-800 underline-offset-2 transition hover:underline dark:text-sky-300"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }
}

export default AnalyticsBoundary
