import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/stores/auth.store'
import { Logo } from '@/components/Logo'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function Login() {
  const user = useAuthStore(s => s.user)
  const initialized = useAuthStore(s => s.initialized)
  const signInWithUsername = useAuthStore(s => s.signInWithUsername)
  const error = useAuthStore(s => s.error)
  const setError = useAuthStore(s => s.setError)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => () => setError(null), [setError])

  if (initialized && user) {
    if (user.role === 'admin') return <Navigate to="/admin" replace />
    return <Navigate to="/c" replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!username.trim()) return
    setSubmitting(true)
    try {
      const result = await signInWithUsername(username, showPassword ? password : undefined)
      if (result.requirePassword) {
        setShowPassword(true)
      } else if (!showPassword) {
        setEmailSent(true)
      }
    } catch {
      // erro já no store
    } finally {
      setSubmitting(false)
    }
  }

  if (emailSent) {
    return (
      <div className="w-[360px] text-center">
        <div className="mb-12">
          <Logo size="lg" />
        </div>
        <div className="rounded-2xl border border-border bg-elevated px-6 py-8">
          <div className="font-serif text-2xl text-onyx">Verifique seu email</div>
          <p className="mt-3 text-sm text-muted">
            Enviamos um link de acesso. Clique nele para entrar — pode demorar alguns segundos.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-6"
            onClick={() => {
              setEmailSent(false)
              setUsername('')
            }}
          >
            Voltar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-[360px]">
      <div className="mb-12 text-center">
        <Logo size="lg" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Usuário"
          autoFocus
          autoComplete="username"
          placeholder="dvi.joao"
          value={username}
          onChange={e => setUsername(e.target.value)}
          disabled={submitting}
          error={error && !showPassword ? error : undefined}
        />

        <AnimatePresence>
          {showPassword && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Input
                label="Senha"
                type="password"
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={submitting}
                error={error && showPassword ? error : undefined}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <Button type="submit" loading={submitting} className="mt-2">
          {showPassword ? 'Entrar' : 'Continuar'}
        </Button>
      </form>
    </div>
  )
}
