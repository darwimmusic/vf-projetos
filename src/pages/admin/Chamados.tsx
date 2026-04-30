import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ChamadoStatusPill } from '@/components/ui/StatusPill'
import { Badge } from '@/components/ui/Badge'
import { listChamados, formatChamadoAge } from '@/lib/api/chamados'
import { formatDate } from '@/lib/format'
import type { Chamado } from '@/types'

const PRIORIDADE_VARIANT: Record<Chamado['prioridade'], Parameters<typeof Badge>[0]['variant']> = {
  baixa: 'neutral',
  media: 'info',
  alta: 'warning',
  critica: 'danger',
}

export default function AdminChamados() {
  const [chamados, setChamados] = useState<Chamado[] | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    void listChamados().then(setChamados)
  }, [])

  const filtered =
    chamados?.filter(c => {
      if (!search) return true
      const s = search.toLowerCase()
      return (
        c.titulo.toLowerCase().includes(s) ||
        c.companyName.toLowerCase().includes(s) ||
        c.openedByName.toLowerCase().includes(s)
      )
    }) ?? []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-4xl text-onyx">Chamados</h1>
        <p className="mt-1 text-sm text-muted">Inbox de pedidos e conversas com clientes.</p>
      </div>

      <div className="relative w-80">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input
          placeholder="Buscar por título, empresa, autor…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {chamados === null ? (
            <div className="p-6">
              <Skeleton className="h-32" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title={search ? 'Nada encontrado' : 'Sem chamados'}
              description={
                search
                  ? 'Tente outro termo.'
                  : 'Quando clientes abrirem chamados, eles aparecem aqui.'
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map(c => (
                <li key={c.id}>
                  <Link
                    to={`/admin/chamados/${c.id}`}
                    className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-sunken"
                  >
                    <div className="flex flex-1 flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-onyx">{c.titulo}</span>
                        <Badge variant={PRIORIDADE_VARIANT[c.prioridade]}>{c.prioridade}</Badge>
                      </div>
                      <span className="text-xs text-muted">
                        {c.companyName} · {c.openedByName} · {formatDate(c.dataAbertura)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted">
                      <span>{c.qtdMensagens} msg</span>
                      <span>{formatChamadoAge(c.ultimaInteracao)}</span>
                      <ChamadoStatusPill status={c.status} />
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
