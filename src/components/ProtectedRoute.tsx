import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import type { Role } from '@/types'

interface Props {
  allow: Role[]
  redirectTo?: string
}

export function ProtectedRoute({ allow, redirectTo = '/login' }: Props) {
  const user = useAuthStore(s => s.user)
  const initialized = useAuthStore(s => s.initialized)
  const loading = useAuthStore(s => s.loading)
  const location = useLocation()

  if (!initialized || loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--color-linen)',
          color: 'var(--color-muted)',
          fontFamily: 'var(--font-sans)',
          fontSize: 14,
        }}
      >
        carregando…
      </div>
    )
  }

  if (!user || !allow.includes(user.role)) {
    return <Navigate to={redirectTo} state={{ from: location.pathname }} replace />
  }

  return <Outlet />
}
