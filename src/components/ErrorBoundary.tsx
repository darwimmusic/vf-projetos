import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Logo } from './Logo'
import { Button } from './ui/Button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
    // TODO: Sentry em W4 polish completo
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-linen px-4 py-8">
          <Logo size="md" />
          <div className="max-w-md text-center">
            <div className="font-serif text-4xl text-onyx">Algo deu errado</div>
            <p className="mt-3 text-sm text-muted">
              Um erro inesperado aconteceu. Tente recarregar.
            </p>
            {this.state.error && (
              <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-sunken p-3 text-left text-xs text-danger">
                {this.state.error.message}
              </pre>
            )}
          </div>
          <Button onClick={this.reset}>Voltar ao início</Button>
        </main>
      )
    }
    return this.props.children
  }
}
