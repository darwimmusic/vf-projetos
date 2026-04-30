import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { brl, formatDate } from '@/lib/format'
import { listRRTs } from '@/lib/api/rrts'
import { listProjetos } from '@/lib/api/projetos'
import { listCompanies } from '@/lib/api/companies'
import type { RRT, Projeto, Company } from '@/types'
import {
  Plus,
  Building2,
  FileSignature,
  FolderKanban,
  Coins,
  AlertCircle,
  Calendar as CalendarIcon,
  TrendingUp,
} from 'lucide-react'
import { RRTStatusPill, ProjetoStatusPill } from '@/components/ui/StatusPill'

export default function AdminDashboard() {
  const [rrts, setRRTs] = useState<RRT[] | null>(null)
  const [projetos, setProjetos] = useState<Projeto[] | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])

  useEffect(() => {
    void Promise.all([listRRTs(), listProjetos(), listCompanies()]).then(([r, p, c]) => {
      setRRTs(r)
      setProjetos(p)
      setCompanies(c)
    })
  }, [])

  const m = useMemo(() => {
    if (!rrts || !projetos) return null

    const rrtsBilling = rrts.filter(r => !r.billingPrincipalId)
    const projetosBilling = projetos.filter(p => !p.billingPrincipalId)

    const now = new Date()
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1)
    const seteDias = new Date(now.getTime() + 7 * 86400000)

    const receitaMes =
      rrtsBilling
        .filter(r => r.status === 'PAGO' && r.dataPagamento && r.dataPagamento.toDate() >= inicioMes)
        .reduce((s, r) => s + r.valorCobradoCliente, 0) +
      projetosBilling
        .filter(p => p.status === 'PAGO' && p.dataPagamento && p.dataPagamento.toDate() >= inicioMes)
        .reduce((s, p) => s + p.valor, 0)

    const aReceber =
      rrtsBilling
        .filter(r => ['DEFINITIVA', 'NF_EMITIDA'].includes(r.status))
        .reduce((s, r) => s + r.valorCobradoCliente, 0) +
      projetosBilling
        .filter(p => p.status === 'ENTREGUE')
        .reduce((s, p) => s + p.valor, 0)

    const inadimplencia = rrtsBilling
      .filter(r => r.status === 'NF_EMITIDA' && r.previsaoPagamento && r.previsaoPagamento.toDate() < now)
      .reduce((s, r) => s + r.valorCobradoCliente, 0)

    const rrtsAtivas = rrts.filter(r => !['PAGO', 'CANCELADA'].includes(r.status)).length
    const projetosAtivos = projetos.filter(p => !['PAGO', 'CANCELADO'].includes(p.status)).length

    // Boletos vencendo nos próximos 7 dias
    const boletosVencendo = rrts.filter(
      r =>
        r.status === 'PROVISORIA' &&
        r.vencimentoBoleto &&
        r.vencimentoBoleto.toDate() <= seteDias &&
        r.vencimentoBoleto.toDate() >= now,
    )

    // Alertas inteligentes
    const alertas: { msg: string; link: string; level: 'warning' | 'danger' | 'info' }[] = []

    rrts.forEach(r => {
      if (r.status === 'PROVISORIA' && !r.numeroRRT) {
        const days = Math.floor((now.getTime() - r.dataCriacao.toDate().getTime()) / 86400000)
        if (days >= 7) {
          alertas.push({
            msg: `RRT sem número há ${days}d (${r.companyName})`,
            link: `/admin/rrts/${r.id}`,
            level: 'warning',
          })
        }
      }
      if (r.status === 'NF_EMITIDA' && r.dataNF) {
        const days = Math.floor((now.getTime() - r.dataNF.toDate().getTime()) / 86400000)
        if (days >= 30) {
          alertas.push({
            msg: `NF há ${days}d sem pagamento (${r.companyName})`,
            link: `/admin/rrts/${r.id}`,
            level: 'danger',
          })
        }
      }
    })

    projetos.forEach(p => {
      if (p.status === 'ENTREGUE') {
        const days = Math.floor((now.getTime() - (p.dataEntrega?.toDate().getTime() ?? p.dataCriacao.toDate().getTime())) / 86400000)
        if (days >= 30) {
          alertas.push({
            msg: `Projeto entregue há ${days}d sem pagamento (${p.companyName})`,
            link: `/admin/projetos/${p.id}`,
            level: 'warning',
          })
        }
      }
    })

    // Receita 6 meses
    const receitaPorMes = new Map<string, number>()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = formatDate(d, 'yyyy-MM')
      receitaPorMes.set(key, 0)
    }
    rrtsBilling
      .filter(r => r.status === 'PAGO' && r.dataPagamento)
      .forEach(r => {
        const key = formatDate(r.dataPagamento, 'yyyy-MM')
        if (receitaPorMes.has(key)) {
          receitaPorMes.set(key, (receitaPorMes.get(key) ?? 0) + r.valorCobradoCliente)
        }
      })
    projetosBilling
      .filter(p => p.status === 'PAGO' && p.dataPagamento)
      .forEach(p => {
        const key = formatDate(p.dataPagamento, 'yyyy-MM')
        if (receitaPorMes.has(key)) {
          receitaPorMes.set(key, (receitaPorMes.get(key) ?? 0) + p.valor)
        }
      })
    const receita6m = Array.from(receitaPorMes.entries()).map(([mes, valor]) => ({
      mes: mes.slice(5),
      valor: valor / 100,
    }))

    // Próximas datas (eventos, montagens, vencimentos)
    interface Proxima {
      id: string
      label: string
      date: Date
      type: 'evento' | 'montagem' | 'vencimento' | 'entrega'
      link: string
    }
    const proximas: Proxima[] = []
    rrts.forEach(r => {
      if (r.dataEvento && r.dataEvento.toDate() >= now) {
        proximas.push({
          id: `${r.id}-evt`,
          label: r.evento ?? r.numeroRRT ?? 'RRT',
          date: r.dataEvento.toDate(),
          type: 'evento',
          link: `/admin/rrts/${r.id}`,
        })
      }
      if (r.vencimentoBoleto && r.vencimentoBoleto.toDate() >= now) {
        proximas.push({
          id: `${r.id}-vct`,
          label: `Boleto ${r.numeroRRT ?? r.id.slice(0, 6)}`,
          date: r.vencimentoBoleto.toDate(),
          type: 'vencimento',
          link: `/admin/rrts/${r.id}`,
        })
      }
    })
    projetos.forEach(p => {
      if (p.dataEvento && p.dataEvento.toDate() >= now) {
        proximas.push({
          id: `${p.id}-evt`,
          label: p.nome,
          date: p.dataEvento.toDate(),
          type: 'evento',
          link: `/admin/projetos/${p.id}`,
        })
      }
      if (p.dataEntregaPrevista && p.dataEntregaPrevista.toDate() >= now) {
        proximas.push({
          id: `${p.id}-ent`,
          label: `Entrega: ${p.nome}`,
          date: p.dataEntregaPrevista.toDate(),
          type: 'entrega',
          link: `/admin/projetos/${p.id}`,
        })
      }
    })
    proximas.sort((a, b) => a.date.getTime() - b.date.getTime())

    return {
      receitaMes,
      aReceber,
      inadimplencia,
      rrtsAtivas,
      projetosAtivos,
      boletosVencendo: boletosVencendo.length,
      alertas: alertas.slice(0, 6),
      receita6m,
      proximas: proximas.slice(0, 6),
      companiesAtivas: companies.filter(c => c.active !== false).length,
    }
  }, [rrts, projetos, companies])

  if (!m) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-4xl text-onyx">Painel</h1>
          <p className="mt-1 text-sm text-muted">Visão executiva do seu mês.</p>
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
          icon={<TrendingUp size={18} />}
          label="Receita do mês"
          value={brl(m.receitaMes)}
          variant="success"
        />
        <KPI
          icon={<Coins size={18} />}
          label="A receber"
          value={brl(m.aReceber)}
          variant="info"
        />
        <KPI
          icon={<AlertCircle size={18} />}
          label="Inadimplência"
          value={brl(m.inadimplencia)}
          variant={m.inadimplencia > 0 ? 'danger' : 'neutral'}
        />
        <KPI
          icon={<CalendarIcon size={18} />}
          label="Boletos 7d"
          value={String(m.boletosVencendo)}
          variant={m.boletosVencendo > 0 ? 'warning' : 'neutral'}
        />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KPI
          icon={<FileSignature size={18} />}
          label="RRTs ativas"
          value={String(m.rrtsAtivas)}
        />
        <KPI
          icon={<FolderKanban size={18} />}
          label="Projetos ativos"
          value={String(m.projetosAtivos)}
        />
        <KPI
          icon={<Building2 size={18} />}
          label="Empresas"
          value={String(m.companiesAtivas)}
        />
        <Card>
          <CardContent className="px-6 py-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">
              Atalhos
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link to="/admin/financeiro">
                <Button size="sm" variant="secondary">Financeiro</Button>
              </Link>
              <Link to="/admin/kanban">
                <Button size="sm" variant="secondary">Kanban</Button>
              </Link>
              <Link to="/admin/calendario">
                <Button size="sm" variant="secondary">Calendário</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Receita 6 meses" />
        <CardContent>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <LineChart data={m.receita6m}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6e6e0" />
                <XAxis dataKey="mes" stroke="#6b6b66" fontSize={11} />
                <YAxis stroke="#6b6b66" fontSize={11} />
                <Tooltip formatter={(v: unknown) => `R$ ${Number(v).toFixed(2)}`} />
                <Line
                  type="monotone"
                  dataKey="valor"
                  stroke="#0a0a0a"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Próximas datas" subtitle="eventos, montagens, vencimentos" />
          <CardContent>
            {m.proximas.length === 0 ? (
              <p className="text-sm text-muted">Nada agendado nos próximos dias.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {m.proximas.map(p => (
                  <li key={p.id}>
                    <Link
                      to={p.link}
                      className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-sunken"
                    >
                      <span className="truncate">
                        <Badge
                          variant={
                            p.type === 'vencimento'
                              ? 'warning'
                              : p.type === 'evento'
                                ? 'info'
                                : 'neutral'
                          }
                          className="mr-2"
                        >
                          {p.type}
                        </Badge>
                        {p.label}
                      </span>
                      <span className="text-xs text-muted">{formatDate(p.date)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Alertas" subtitle="situações que merecem atenção" />
          <CardContent>
            {m.alertas.length === 0 ? (
              <p className="text-sm text-muted">Nada pendente. ✓</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {m.alertas.map((a, i) => (
                  <li key={i}>
                    <Link
                      to={a.link}
                      className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-sunken"
                    >
                      <AlertCircle
                        size={14}
                        className={
                          a.level === 'danger'
                            ? 'text-danger'
                            : a.level === 'warning'
                              ? 'text-warning'
                              : 'text-info'
                        }
                      />
                      <span className="text-onyx">{a.msg}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Últimas RRTs" />
          <CardContent>
            {!rrts || rrts.length === 0 ? (
              <p className="text-sm text-muted">Sem RRTs.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {rrts.slice(0, 5).map(r => (
                  <li key={r.id}>
                    <Link
                      to={`/admin/rrts/${r.id}`}
                      className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-sunken"
                    >
                      <span className="truncate">
                        {r.numeroRRT ?? r.descricao.slice(0, 32)}
                        <span className="ml-2 text-xs text-muted">{r.companyName}</span>
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
          <CardHeader title="Últimos projetos" />
          <CardContent>
            {!projetos || projetos.length === 0 ? (
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
  variant = 'neutral',
}: {
  icon: React.ReactNode
  label: string
  value: string
  variant?: 'success' | 'info' | 'danger' | 'warning' | 'neutral'
}) {
  const COLOR = {
    success: 'text-success',
    info: 'text-info',
    danger: 'text-danger',
    warning: 'text-warning',
    neutral: 'text-onyx',
  }
  return (
    <Card>
      <CardContent className="px-6 py-5">
        <div className="flex items-center gap-2 text-muted">
          {icon}
          <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        </div>
        <div className={`mt-2 font-serif text-3xl ${COLOR[variant]}`}>{value}</div>
      </CardContent>
    </Card>
  )
}
