import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Bell, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNotifStore } from '@/stores/notif.store'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/cn'

export function NotifBell() {
  const list = useNotifStore(s => s.list)
  const unread = useNotifStore(s => s.unreadCount)
  const markRead = useNotifStore(s => s.markRead)
  const navigate = useNavigate()

  async function handleClick(id: string, link?: string, read?: boolean) {
    if (!read) await markRead(id)
    if (link) navigate(link)
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="relative rounded-md p-1.5 text-muted hover:bg-sunken hover:text-onyx focus:outline-none focus-visible:ring-2 focus-visible:ring-onyx"
        aria-label="Notificações"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-linen">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 max-h-[480px] w-[360px] overflow-y-auto rounded-2xl border border-border bg-elevated shadow-xl"
        >
          <div className="border-b border-border px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">
              Notificações
            </div>
          </div>
          {list.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted">Nada novo por aqui.</div>
          ) : (
            <ul>
              {list.map(n => (
                <li key={n.id}>
                  <button
                    onClick={() => handleClick(n.id, n.link, n.read)}
                    className={cn(
                      'flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-sunken',
                      !n.read && 'bg-info/5',
                    )}
                  >
                    {!n.read ? (
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-info" />
                    ) : (
                      <Check size={12} className="mt-1 text-muted" />
                    )}
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-onyx">{n.title}</div>
                      <div className="text-xs text-muted">{n.body}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted">
                        {formatDateTime(n.createdAt)}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
