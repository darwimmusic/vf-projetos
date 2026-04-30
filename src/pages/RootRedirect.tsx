import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'

export default function RootRedirect() {
  const user = useAuthStore(s => s.user)
  const initialized = useAuthStore(s => s.initialized)

  if (!initialized) {
    return (
      <div className="grid min-h-screen place-items-center bg-linen text-sm text-muted">
        carregando…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'admin') return <Navigate to="/admin" replace />
  return <Navigate to="/c" replace />
}
