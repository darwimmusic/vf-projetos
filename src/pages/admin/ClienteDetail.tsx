import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { getCompany } from '@/lib/api/companies'
import { listProjetos } from '@/lib/api/projetos'
import { listRRTs } from '@/lib/api/rrts'
import { listUsers } from '@/lib/api/users'
import { brl, formatCnpj, formatDate } from '@/lib/format'
import { RRTStatusPill, ProjetoStatusPill } from '@/components/ui/StatusPill'
import type { Company, Projeto, RRT, User } from '@/types'

export default function AdminClienteDetail() {
  const { id } = useParams<{ id: string }>()
  const [company, setCompany] = useState<Company | null>(null)
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [rrts, setRRTs] = useState<RRT[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    void (async () => {
      setLoading(true)
      const [c, p, r, u] = await Promise.all([
        getCompany(id),
        listProjetos({ companyId: id }),
        listRRTs({ companyId: id }),
        listUsers({ companyId: id }),
      ])
      setCompany(c)
      setProjetos(p)
      setRRTs(r)
      setUsers(u)
      setLoading(false)
    })()
  }, [id])

  if (loading) return <Skeleton className="h-64" />
  if (!company) return <p className="text-sm text-muted">Empresa não encontrada.</p>

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/admin/clientes"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-onyx"
      >
        <ArrowLeft size={14} /> Clientes
      </Link>

      <div className="flex items-center gap-4">
        <Avatar name={company.name} src={company.logoUrl} size="lg" shape="square" />
        <div>
          <h1 className="font-serif text-4xl text-onyx">{company.name}</h1>
          <p className="text-sm text-muted">
            {formatCnpj(company.cnpj)} · slug <code>{company.slug}</code> · prazo NF{' '}
            {company.prazoNF}d
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KPI label="Usuários" value={users.length} />
        <KPI label="Projetos" value={projetos.length} />
        <KPI label="RRTs" value={rrts.length} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Usuários" />
          <CardContent>
            {users.length === 0 ? (
              <p className="text-sm text-muted">Sem usuários.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {users.map(u => (
                  <li key={u.uid} className="flex items-center gap-3 rounded-lg px-2 py-2">
                    <Avatar name={u.displayName} src={u.avatarUrl} size="sm" />
                    <div className="flex flex-1 flex-col">
                      <span className="text-sm font-semibold text-onyx">{u.displayName}</span>
                      <span className="text-xs text-muted">{u.email}</span>
                    </div>
                    <Badge variant={u.role === 'company_owner' ? 'premium' : 'neutral'}>
                      {u.role}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Projetos" />
          <CardContent>
            {projetos.length === 0 ? (
              <p className="text-sm text-muted">Sem projetos.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {projetos.map(p => (
                  <li key={p.id}>
                    <Link
                      to={`/admin/projetos/${p.id}`}
                      className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-sunken"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm text-onyx">{p.nome}</span>
                        <span className="text-xs text-muted">{formatDate(p.dataCriacao)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted">{brl(p.valor)}</span>
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

      <Card>
        <CardHeader title="RRTs" />
        <CardContent className="p-0">
          {rrts.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted">Sem RRTs.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rrts.map(r => (
                <li key={r.id}>
                  <Link
                    to={`/admin/rrts/${r.id}`}
                    className="flex items-center justify-between gap-4 px-6 py-3 hover:bg-sunken"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm text-onyx">
                        {r.numeroRRT ?? r.descricao.slice(0, 60)}
                      </span>
                      <span className="text-xs text-muted">{formatDate(r.dataCriacao)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted">{brl(r.valorCobradoCliente)}</span>
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

function KPI({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="px-6 py-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</div>
        <div className="mt-1 font-serif text-3xl text-onyx">{value}</div>
      </CardContent>
    </Card>
  )
}
