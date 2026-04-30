import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { KanbanBoard, type KanbanCard } from '@/components/domain/KanbanBoard'
import { listRRTs, advanceRRTStatus, nextValidRRTStatuses } from '@/lib/api/rrts'
import {
  listProjetos,
  advanceProjetoStatus,
  nextValidStatuses as nextValidProjetoStatuses,
} from '@/lib/api/projetos'
import { brl, formatDate } from '@/lib/format'
import { toast } from '@/components/ui/Toast'
import type { RRT, RRTStatus, Projeto, ProjetoStatus } from '@/types'

const RRT_COLS: { value: RRTStatus; label: string }[] = [
  { value: 'PROVISORIA', label: 'Provisória' },
  { value: 'BOLETO_PAGO', label: 'Boleto pago' },
  { value: 'DEFINITIVA', label: 'Definitiva' },
  { value: 'NF_EMITIDA', label: 'NF emitida' },
  { value: 'PAGO', label: 'Pago' },
]

const PROJETO_COLS: { value: ProjetoStatus; label: string }[] = [
  { value: 'BRIEFING', label: 'Briefing' },
  { value: 'EM_DESENVOLVIMENTO', label: 'Em dev' },
  { value: 'ENTREGUE', label: 'Entregue' },
  { value: 'PAGO', label: 'Pago' },
]

export default function AdminKanban() {
  const [mode, setMode] = useState<'rrts' | 'projetos'>('rrts')
  const [rrts, setRRTs] = useState<RRT[] | null>(null)
  const [projetos, setProjetos] = useState<Projeto[] | null>(null)

  async function reload() {
    if (mode === 'rrts') {
      setRRTs(null)
      setRRTs(await listRRTs())
    } else {
      setProjetos(null)
      setProjetos(await listProjetos())
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  if (mode === 'rrts') {
    const cards: KanbanCard<RRTStatus>[] =
      rrts
        ?.filter(r => r.status !== 'CANCELADA')
        .map(r => ({
          id: r.id,
          status: r.status,
          render: (
            <Link to={`/admin/rrts/${r.id}`} className="block">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-onyx">
                  {r.numeroRRT ?? 'em rascunho'}
                </span>
                <Badge variant="neutral">{brl(r.valorCobradoCliente)}</Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted">{r.descricao}</p>
              <p className="mt-2 text-[10px] uppercase tracking-wider text-muted">
                {r.companyName} · {formatDate(r.dataCriacao)}
              </p>
            </Link>
          ),
        })) ?? []

    return (
      <div className="flex flex-col gap-6">
        <Header mode={mode} onChange={setMode} />
        {rrts === null ? (
          <Skeleton className="h-96" />
        ) : (
          <KanbanBoard<RRTStatus>
            columns={RRT_COLS}
            cards={cards}
            canMove={(from, to) => nextValidRRTStatuses(from).includes(to)}
            onMove={async (id, _from, to) => {
              try {
                await advanceRRTStatus(id, to)
                toast.success('Status atualizado')
                await reload()
              } catch (e) {
                toast.error('Falha', e instanceof Error ? e.message : 'Erro')
                throw e
              }
            }}
          />
        )}
      </div>
    )
  }

  const cards: KanbanCard<ProjetoStatus>[] =
    projetos
      ?.filter(p => p.status !== 'CANCELADO')
      .map(p => ({
        id: p.id,
        status: p.status,
        render: (
          <Link to={`/admin/projetos/${p.id}`} className="block">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-semibold text-onyx">{p.nome}</span>
              <Badge variant="neutral">{brl(p.valor)}</Badge>
            </div>
            <p className="mt-2 text-[10px] uppercase tracking-wider text-muted">
              {p.companyName} · {formatDate(p.dataCriacao)}
            </p>
          </Link>
        ),
      })) ?? []

  return (
    <div className="flex flex-col gap-6">
      <Header mode={mode} onChange={setMode} />
      {projetos === null ? (
        <Skeleton className="h-96" />
      ) : (
        <KanbanBoard<ProjetoStatus>
          columns={PROJETO_COLS}
          cards={cards}
          canMove={(from, to) => nextValidProjetoStatuses(from).includes(to)}
          onMove={async (id, _from, to) => {
            try {
              await advanceProjetoStatus(id, to)
              toast.success('Status atualizado')
              await reload()
            } catch (e) {
              toast.error('Falha', e instanceof Error ? e.message : 'Erro')
              throw e
            }
          }}
        />
      )}
    </div>
  )
}

function Header({
  mode,
  onChange,
}: {
  mode: 'rrts' | 'projetos'
  onChange(m: 'rrts' | 'projetos'): void
}) {
  return (
    <div className="flex items-end justify-between">
      <div>
        <h1 className="font-serif text-4xl text-onyx">Kanban</h1>
        <p className="mt-1 text-sm text-muted">
          Arraste e solte para mover entre colunas. Reverter = via página de detalhe.
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          variant={mode === 'rrts' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => onChange('rrts')}
        >
          RRTs
        </Button>
        <Button
          variant={mode === 'projetos' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => onChange('projetos')}
        >
          Projetos
        </Button>
      </div>
    </div>
  )
}
