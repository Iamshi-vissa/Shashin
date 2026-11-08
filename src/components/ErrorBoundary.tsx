import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
        <span className="font-jp text-5xl text-accent">写</span>
        <p className="text-lg font-semibold">Something went wrong</p>
        <p className="text-[14px] text-muted">{this.state.error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="h-12 rounded-2xl bg-accent px-6 font-semibold text-accent-ink"
        >
          Reload
        </button>
      </div>
    )
  }
}
