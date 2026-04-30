import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { Logo } from '../Logo'
import { Avatar } from '../ui/Avatar'
import { NotifBell } from '../NotifBell'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/cn'

const NAV = [
  { to: '/c', label: 'Início', end: true },
  { to: '/c/projetos', label: 'Projetos' },
  { to: '/c/rrts', label: 'RRTs' },
  { to: '/c/chamados', label: 'Chamados' },
  { to: '/c/calendario', label: 'Agenda' },
  { to: '/c/relatorios', label: 'Relatórios' },
  { to: '/c/time', label: 'Time' },
] as const

export function ClienteLayout() {
  const user = useAuthStore(s => s.user)
  const signOut = useAuthStore(s => s.signOut)
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-linen">
      <header className="border-b border-border bg-elevated">
        <div className="mx-auto flex h-16 max-w-[1080px] items-center justify-between px-6">
          <Logo size="sm" />
          <nav className="flex items-center gap-1">
            {NAV.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={'end' in item ? item.end : false}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-sunken font-semibold text-onyx'
                      : 'text-muted hover:bg-sunken hover:text-onyx',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <NotifBell />
            <Avatar name={user?.displayName} size="sm" />
            <button
              onClick={handleSignOut}
              aria-label="Sair"
              className="rounded-md p-1.5 text-muted hover:bg-sunken hover:text-onyx"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1080px] px-6 py-10">
        <Outlet />
      </main>
    </div>
  )
}
