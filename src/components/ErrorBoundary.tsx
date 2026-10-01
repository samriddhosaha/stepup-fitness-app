import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './ui'

interface State {
  failed: boolean
  exportMessage: string | null
}

/** Last-resort screen: calm wording, a way back, and a way to get the data out. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false, exportMessage: null }

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[StepUp] unexpected error', error, info.componentStack)
  }

  exportData = async () => {
    try {
      const { exportAllData } = await import('../lib/backup')
      await exportAllData()
      this.setState({ exportMessage: 'Your backup is ready.' })
    } catch {
      this.setState({ exportMessage: 'The export didn’t work. Your data is still on this device.' })
    }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="min-h-dvh bg-canvas flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <h1 className="font-display font-semibold text-3xl mb-3">Something went wrong.</h1>
          <p className="text-faint mb-6">
            That’s on us, not you. Your workouts and progress are safe on this device. Reloading usually fixes it.
          </p>
          <div className="flex flex-col gap-3">
            <Button onClick={() => window.location.assign('/')}>Reload StepUp</Button>
            <Button variant="secondary" onClick={this.exportData}>
              Export my data first
            </Button>
          </div>
          {this.state.exportMessage && (
            <p role="status" className="text-sm text-faint mt-4">
              {this.state.exportMessage}
            </p>
          )}
        </div>
      </main>
    )
  }
}
