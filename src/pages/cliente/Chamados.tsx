import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, MessageSquare } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ChamadoStatusPill } from '@/components/ui/StatusPill'
import { listChamados, formatChamadoAge } from '@/lib/api/chamados'
import { formatDate } from '@/lib/format'
import type { Chamado } from '@/types'

export default function ClienteChamados() {
  const user = useAuthStore(s => s.user)
  const [chamados, setChamados] = useState<Chamado[] | null>(null)

  useEffect(() => {
    if (!user?.companyId) return
    void listChamados({ companyId: user.companyId }).then(setChamados)
  }, [user?.companyId])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-4xl text-onyx">Chamados</h1>
          <p className="mt-1 text-sm text-muted">Conversas e pedidos com o Victor.</p>
        </div>
        <Link to="/c/chamados/novo">
          <Button>
            <Plus size={16} /> Abrir chamado
          </Button>
        </Link>
      </div>

      {chamados === null ? (
        <Skeleton className="h-32" />
      ) : chamados.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<MessageSquare size={32} />}
              title="Sem chamados ainda"
              description="Abra um chamado para começar uma conversa com o Victor."
              action={
                <Link to="/c/chamados/novo">
                  <Button>
                    <Plus size={16} /> Abrir chamado
                  </Button>
                </Link>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {chamados.map(c => (
            <Link key={c.id} to={`/c/chamados/${c.id}`}>
              <Card className="h-full transition-colors hover:border-onyx/30">
                <CardContent className="flex flex-col gap-2 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-onyx">{c.titulo}</span>
                    <ChamadoStatusPill status={c.status} />
                  </div>
                  <p className="line-clamp-2 text-sm text-muted">{c.descricao}</p>
                  <div className="mt-auto flex items-center gap-3 pt-2 text-[11px] uppercase tracking-wider text-muted">
                    <span>{formatDate(c.dataAbertura)}</span>
                    <span>·</span>
                    <span>{c.qtdMensagens} msg</span>
                    <span>·</span>
                    <span>{formatChamadoAge(c.ultimaInteracao)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
