import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/Logo'

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-linen px-4 py-8">
      <Logo size="md" />
      <div className="text-center">
        <div className="font-serif text-6xl text-onyx">404</div>
        <p className="mt-2 text-sm text-muted">Esta página não existe.</p>
      </div>
      <Link to="/">
        <Button variant="secondary">Voltar para o início</Button>
      </Link>
    </main>
  )
}
