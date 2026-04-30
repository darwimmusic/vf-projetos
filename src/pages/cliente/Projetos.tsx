import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProjetoStatusPill } from '@/components/ui/StatusPill'
import { listProjetos } from '@/lib/api/projetos'
import { brl, formatDate } from '@/lib/format'
import type { Projeto } from '@/types'

export default function ClienteProjetos() {
  const user = useAuthStore(s => s.user)
  const [projetos, setProjetos] = useState<Projeto[] | null>(null)

  useEffect(() => {
    if (!user?.companyId) return
    void listProjetos({ companyId: user.companyId }).then(setProjetos)
  }, [user?.companyId])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-4xl text-onyx">Projetos</h1>
        <p className="mt-1 text-sm text-muted">{user?.companyName}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {projetos === null ? (
            <div className="p-6">
              <Skeleton className="h-32" />
            </div>
          ) : projetos.length === 0 ? (
            <EmptyState
              title="Sem projetos ainda"
              description="Quando o Victor criar projetos para sua empresa, eles aparecem aqui."
            />
          ) : (
            <ul className="divide-y divide-border">
              {projetos.map(p => (
                <li key={p.id}>
                  <Link
                    to={`/c/projetos/${p.id}`}
                    className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-sunken"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-onyx">{p.nome}</span>
                      <span className="text-xs text-muted">{formatDate(p.dataCriacao)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted">{brl(p.valor)}</span>
                      <ProjetoStatusPill status={p.status} />
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
