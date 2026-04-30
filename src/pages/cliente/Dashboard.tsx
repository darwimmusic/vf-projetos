import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { listRRTs } from '@/lib/api/rrts'
import { listProjetos } from '@/lib/api/projetos'
import { brl, formatDate } from '@/lib/format'
import { RRTStatusPill, ProjetoStatusPill } from '@/components/ui/StatusPill'
import { FileSignature, FolderKanban } from 'lucide-react'
import type { RRT, Projeto } from '@/types'

export default function ClienteDashboard() {
  const user = useAuthStore(s => s.user)
  const [rrts, setRRTs] = useState<RRT[] | null>(null)
  const [projetos, setProjetos] = useState<Projeto[] | null>(null)

  useEffect(() => {
    if (!user?.companyId) return
    void Promise.all([
      listRRTs({ companyId: user.companyId }),
      listProjetos({ companyId: user.companyId }),
    ]).then(([r, p]) => {
      setRRTs(r)
      setProjetos(p)
    })
  }, [user?.companyId])

  const totalEmAberto =
    rrts
      ?.filter(r => !['PAGO', 'CANCELADA'].includes(r.status))
      .reduce((sum, r) => sum + r.valorCobradoCliente, 0) ?? 0

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-4xl text-onyx">Olá, {user?.displayName?.split(' ')[0]}</h1>
        <p className="mt-1 text-sm text-muted">{user?.companyName}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KPI
          icon={<FolderKanban size={18} />}
          label="Projetos"
          value={projetos === null ? null : String(projetos.length)}
        />
        <KPI
          icon={<FileSignature size={18} />}
          label="RRTs"
          value={rrts === null ? null : String(rrts.length)}
        />
        <KPI label="A pagar" value={rrts === null ? null : brl(totalEmAberto)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader title="RRTs recentes" />
          <CardContent>
            {rrts === null ? (
              <Skeleton className="h-24" />
            ) : rrts.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma RRT ainda.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {rrts.slice(0, 5).map(r => (
                  <li key={r.id}>
                    <Link
                      to={`/c/rrts/${r.id}`}
                      className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-sunken"
                    >
                      <span className="truncate">
                        {r.numeroRRT ?? r.descricao.slice(0, 40)}
                        <span className="ml-2 text-xs text-muted">{formatDate(r.dataCriacao)}</span>
                      </span>
                      <RRTStatusPill status={r.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Projetos recentes" />
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
                      to={`/c/projetos/${p.id}`}
                      className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-sunken"
                    >
                      <span className="truncate">{p.nome}</span>
                      <ProjetoStatusPill status={p.status} />
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
}: {
  icon?: React.ReactNode
  label: string
  value: string | null
}) {
  return (
    <Card>
      <CardContent className="px-6 pt-6">
        {icon && (
          <div className="flex items-center gap-2 text-muted">
            {icon}
            <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
          </div>
        )}
        {!icon && (
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</div>
        )}
        {value === null ? (
          <Skeleton className="mt-3 h-9 w-24" />
        ) : (
          <div className="mt-2 font-serif text-3xl text-onyx">{value}</div>
        )}
      </CardContent>
    </Card>
  )
}
