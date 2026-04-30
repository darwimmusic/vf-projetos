import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { brl } from '@/lib/format'
import { listRRTs } from '@/lib/api/rrts'
import { listProjetos } from '@/lib/api/projetos'
import type { RRT, Projeto } from '@/types'
import { Plus, Building2, FileSignature, FolderKanban, Coins } from 'lucide-react'

export default function AdminDashboard() {
  const [rrts, setRRTs] = useState<RRT[] | null>(null)
  const [projetos, setProjetos] = useState<Projeto[] | null>(null)

  useEffect(() => {
    void Promise.all([listRRTs(), listProjetos()]).then(([r, p]) => {
      setRRTs(r)
      setProjetos(p)
    })
  }, [])

  const totalReceber =
    rrts
      ?.filter(r => ['DEFINITIVA', 'NF_EMITIDA'].includes(r.status))
      .reduce((sum, r) => sum + r.valorCobradoCliente, 0) ?? 0

  const rrtsAtivas = rrts?.filter(r => !['PAGO', 'CANCELADA'].includes(r.status)).length ?? 0
  const projetosAtivos =
    projetos?.filter(p => !['PAGO', 'CANCELADO'].includes(p.status)).length ?? 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-4xl text-onyx">Painel</h1>
          <p className="mt-1 text-sm text-muted">Visão executiva do dia.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/rrts">
            <Button>
              <Plus size={16} /> Nova RRT
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KPI
          icon={<Coins size={18} />}
          label="A receber"
          value={rrts === null ? null : brl(totalReceber)}
        />
        <KPI
          icon={<FileSignature size={18} />}
          label="RRTs ativas"
          value={rrts === null ? null : String(rrtsAtivas)}
        />
        <KPI
          icon={<FolderKanban size={18} />}
          label="Projetos ativos"
          value={projetos === null ? null : String(projetosAtivos)}
        />
        <KPI
          icon={<Building2 size={18} />}
          label="Clientes"
          value="—"
          subtitle="ver /clientes"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Últimas RRTs" />
          <CardContent>
            {rrts === null ? (
              <Skeleton className="h-24" />
            ) : rrts.length === 0 ? (
              <p className="text-sm text-muted">Sem RRTs ainda.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {rrts.slice(0, 5).map(r => (
                  <li key={r.id}>
                    <Link
                      to={`/admin/rrts/${r.id}`}
                      className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-sunken"
                    >
                      <span className="truncate">
                        {r.numeroRRT ?? r.descricao.slice(0, 40)}
                        <span className="ml-2 text-xs text-muted">{r.companyName}</span>
                      </span>
                      <span className="text-xs text-muted">{brl(r.valorCobradoCliente)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Próximos projetos" />
          <CardContent>
            {projetos === null ? (
              <Skeleton className="h-24" />
            ) : projetos.length === 0 ? (
              <p className="text-sm text-muted">Sem projetos.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {projetos.slice(0, 5).map(p => (
                  <li key={p.id}>
                    <Link
                      to={`/admin/projetos/${p.id}`}
                      className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-sunken"
                    >
                      <span className="truncate">
                        {p.nome}
                        <span className="ml-2 text-xs text-muted">{p.companyName}</span>
                      </span>
                      <span className="text-xs text-muted">{brl(p.valor)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function KPI({
  icon,
  label,
  value,
  subtitle,
}: {
  icon: React.ReactNode
  label: string
  value: string | null
  subtitle?: string
}) {
  return (
    <Card>
      <CardContent className="px-6 pt-6">
        <div className="flex items-center gap-2 text-muted">
          {icon}
          <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        </div>
        {value === null ? (
          <Skeleton className="mt-3 h-9 w-24" />
        ) : (
          <div className="mt-2 font-serif text-3xl text-onyx">{value}</div>
        )}
        {subtitle && <div className="mt-1 text-xs text-muted">{subtitle}</div>}
      </CardContent>
    </Card>
  )
}
