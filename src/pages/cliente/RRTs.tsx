import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { RRTStatusPill } from '@/components/ui/StatusPill'
import { listRRTs } from '@/lib/api/rrts'
import { brl, formatDate } from '@/lib/format'
import type { RRT } from '@/types'

export default function ClienteRRTs() {
  const user = useAuthStore(s => s.user)
  const [rrts, setRRTs] = useState<RRT[] | null>(null)

  useEffect(() => {
    if (!user?.companyId) return
    void listRRTs({ companyId: user.companyId }).then(setRRTs)
  }, [user?.companyId])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-4xl text-onyx">RRTs</h1>
        <p className="mt-1 text-sm text-muted">{user?.companyName}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {rrts === null ? (
            <div className="p-6">
              <Skeleton className="h-32" />
            </div>
          ) : rrts.length === 0 ? (
            <EmptyState
              title="Sem RRTs ainda"
              description="Quando o Victor emitir uma RRT, ela aparece aqui."
            />
          ) : (
            <ul className="divide-y divide-border">
              {rrts.map(r => (
                <li key={r.id}>
                  <Link
                    to={`/c/rrts/${r.id}`}
                    className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-sunken"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-onyx">
                        {r.numeroRRT ?? r.descricao.slice(0, 60)}
                      </span>
                      <span className="text-xs text-muted">{formatDate(r.dataCriacao)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted">{brl(r.valorCobradoCliente)}</span>
                      <RRTStatusPill status={r.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
