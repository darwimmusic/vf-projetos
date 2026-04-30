import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { completeMagicLink } from '@/lib/auth'
import { Logo } from '@/components/Logo'

export default function AcceptInvite() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    completeMagicLink()
      .then(user => {
        if (user) {
          setStatus('success')
        } else {
          setStatus('error')
          setErrorMsg('Link inválido. Solicite um novo.')
        }
      })
      .catch((e: unknown) => {
        setStatus('error')
        setErrorMsg(e instanceof Error ? e.message : 'Falha ao validar link.')
      })
  }, [])

  if (status === 'success') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="w-[360px] text-center">
      <div className="mb-12">
        <Logo size="lg" />
      </div>
      <div className="rounded-2xl border border-border bg-elevated px-6 py-8">
        {status === 'loading' ? (
          <>
            <div className="font-serif text-2xl text-onyx">Validando…</div>
            <p className="mt-3 text-sm text-muted">Só um instante.</p>
          </>
        ) : (
          <>
            <div className="font-serif text-2xl text-danger">Link inválido</div>
            <p className="mt-3 text-sm text-muted">
              {errorMsg ?? 'Tente fazer login novamente para receber um novo link.'}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
