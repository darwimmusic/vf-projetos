import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { Logo } from '../Logo'
import { Avatar } from '../ui/Avatar'
import { NotifBell } from '../NotifBell'
import {
  LayoutDashboard,
  Building2,
  FolderKanban,
  FileSignature,
  Ticket,
  Calendar,
  KanbanSquare,
  Coins,
  BarChart3,
  Library,
  ScrollText,
  Settings,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/cn'

const NAV = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/clientes', icon: Building2, label: 'Clientes' },
  { to: '/admin/projetos', icon: FolderKanban, label: 'Projetos' },
  { to: '/admin/rrts', icon: FileSignature, label: 'RRTs' },
  { to: '/admin/chamados', icon: Ticket, label: 'Chamados', wave: 2 },
  { to: '/admin/kanban', icon: KanbanSquare, label: 'Kanban', wave: 2 },
  { to: '/admin/calendario', icon: Calendar, label: 'Calendário', wave: 2 },
  { to: '/admin/financeiro', icon: Coins, label: 'Financeiro', wave: 3 },
  { to: '/admin/relatorios', icon: BarChart3, label: 'Relatórios', wave: 3 },
  { to: '/admin/public-lib', icon: Library, label: 'Biblioteca', wave: 2 },
  { to: '/admin/audit', icon: ScrollText, label: 'Auditoria' },
  { to: '/admin/config', icon: Settings, label: 'Configurações' },
] as const

export function AdminLayout() {
  const user = useAuthStore(s => s.user)
  const signOut = useAuthStore(s => s.signOut)
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-linen">
      <aside className="fixed left-0 top-0 flex h-screen w-60 flex-col border-r border-border bg-elevated">
        <div className="px-6 py-6">
          <Logo size="sm" />
        </div>
        <nav className="flex-1 overflow-y-auto px-3">
          {NAV.map(item => {
            const Icon = item.icon
            const wave = 'wave' in item ? item.wave : undefined
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={'end' in item ? item.end : false}
                className={({ isActive }) =>
                  cn(
                    'mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-sunken font-semibold text-onyx'
                      : 'text-muted hover:bg-sunken hover:text-onyx',
                  )
                }
              >
                <Icon size={16} />
                <span className="flex-1">{item.label}</span>
                {wave && (
                  <span className="rounded bg-warning/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-warning">
                    W{wave}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>
        <div className="border-t border-border px-3 py-4">
          <div className="flex items-center gap-2 px-3 py-2">
            <Avatar name={user?.displayName} size="sm" />
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="truncate text-sm font-semibold text-onyx">{user?.displayName}</div>
              <div className="truncate text-[10px] uppercase tracking-wider text-muted">
                {user?.role}
              </div>
            </div>
            <NotifBell />
            <button
              onClick={handleSignOut}
              aria-label="Sair"
              className="rounded-md p-1.5 text-muted hover:bg-sunken hover:text-onyx"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
      <main className="ml-60 flex-1">
        <div className="mx-auto max-w-[1400px] px-8 py-10">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
