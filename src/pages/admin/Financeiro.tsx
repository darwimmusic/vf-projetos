import { useEffect, useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { Download } from 'lucide-react'
import { listRRTs } from '@/lib/api/rrts'
import { listProjetos } from '@/lib/api/projetos'
import { listCompanies } from '@/lib/api/companies'
import { brl, formatDate } from '@/lib/format'
import { exportCsv } from '@/lib/reports/csv'
import { toast } from '@/components/ui/Toast'
import type { RRT, Projeto, Company } from '@/types'

const COLORS = ['#1a7f5a', '#1f5fb3', '#b56a00', '#b3261e', '#6b3fa0', '#6b6b66']

export default function AdminFinanceiro() {
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

  const kpis = useMemo(() => {
    if (!rrts || !projetos) return null
    // Filtra fora itens consolidados em outro (não somam — NF está no principal)
    const rrtsCount = rrts.filter(r => !r.billingPrincipalId)
    const projetosCount = projetos.filter(p => !p.billingPrincipalId)

    const receita =
      rrtsCount
        .filter(r => r.status === 'PAGO')
        .reduce((sum, r) => sum + r.valorCobradoCliente, 0) +
      projetosCount
        .filter(p => p.status === 'PAGO')
        .reduce((sum, p) => sum + p.valor, 0)

    const aReceber =
      rrtsCount
        .filter(r => ['DEFINITIVA', 'NF_EMITIDA'].includes(r.status))
        .reduce((sum, r) => sum + r.valorCobradoCliente, 0) +
      projetosCount
        .filter(p => ['ENTREGUE', 'NF_EMITIDA' as never].includes(p.status))
        .reduce((sum, p) => sum + p.valor, 0)

    const now = new Date()
    const inadimplencia = rrtsCount
      .filter(r => r.status === 'NF_EMITIDA' && r.previsaoPagamento && r.previsaoPagamento.toDate() < now)
      .reduce((sum, r) => sum + r.valorCobradoCliente, 0)

    const taxaCAUTotal = rrts
      .filter(r => r.status !== 'CANCELADA' && r.boletoPorMim)
      .reduce((sum, r) => sum + r.taxaCAU, 0)

    return { receita, aReceber, inadimplencia, taxaCAUTotal }
  }, [rrts, projetos])

  const receitaPorMes = useMemo(() => {
    if (!rrts || !projetos) return []
    const m = new Map<string, number>()
    rrts
      .filter(r => !r.billingPrincipalId && r.status === 'PAGO' && r.dataPagamento)
      .forEach(r => {
        const key = formatDate(r.dataPagamento, 'yyyy-MM')
        m.set(key, (m.get(key) ?? 0) + r.valorCobradoCliente)
      })
    projetos
      .filter(p => !p.billingPrincipalId && p.status === 'PAGO' && p.dataPagamento)
      .forEach(p => {
        const key = formatDate(p.dataPagamento, 'yyyy-MM')
        m.set(key, (m.get(key) ?? 0) + p.valor)
      })
    return Array.from(m.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([mes, valor]) => ({ mes, valor: valor / 100 }))
  }, [rrts, projetos])

  const statusDist = useMemo(() => {
    if (!rrts) return []
    const m = new Map<string, number>()
    rrts.forEach(r => m.set(r.status, (m.get(r.status) ?? 0) + 1))
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }))
  }, [rrts])

  const topClientes = useMemo(() => {
    if (!rrts || !projetos) return []
    const m = new Map<string, number>()
    rrts
      .filter(r => !r.billingPrincipalId)
      .forEach(r => {
        if (['PAGO', 'NF_EMITIDA', 'DEFINITIVA'].includes(r.status)) {
          m.set(r.companyName, (m.get(r.companyName) ?? 0) + r.valorCobradoCliente)
        }
      })
    projetos
      .filter(p => !p.billingPrincipalId)
      .forEach(p => {
        if (['PAGO', 'ENTREGUE'].includes(p.status)) {
          m.set(p.companyName, (m.get(p.companyName) ?? 0) + p.valor)
        }
      })
    return Array.from(m.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([cliente, total]) => ({ cliente, total: total / 100 }))
  }, [rrts, projetos])

  async function handleExportCsv() {
    if (!rrts) return
    const rows = rrts.map(r => ({
      numero: r.numeroRRT ?? '',
      empresa: r.companyName,
      contratante: r.contratante,
      descricao: r.descricao,
      status: r.status,
      valor_bruto: (r.valorBruto / 100).toFixed(2).replace('.', ','),
      taxa_cau: (r.taxaCAU / 100).toFixed(2).replace('.', ','),
      valor_liquido: (r.valorLiquido / 100).toFixed(2).replace('.', ','),
      valor_cobrado: (r.valorCobradoCliente / 100).toFixed(2).replace('.', ','),
      data_criacao: formatDate(r.dataCriacao),
      data_pagamento: formatDate(r.dataPagamento),
    }))
    try {
      await exportCsv(rows, {
        filename: `rrts-financeiro-${new Date().toISOString().slice(0, 10)}.csv`,
        resourceLabel: 'RRTs financeiro',
        resourceId: 'export',
      })
      toast.success('CSV gerado', `${rows.length} linhas`)
    } catch (e) {
      toast.error('Falha', e instanceof Error ? e.message : 'Erro')
    }
  }

  if (!kpis) return <Skeleton className="h-96" />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-4xl text-onyx">Financeiro</h1>
          <p className="mt-1 text-sm text-muted">
            Receita, a receber, inadimplência e top clientes.
          </p>
        </div>
        <Button onClick={handleExportCsv}>
          <Download size={14} /> Exportar RRTs (CSV)
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KPI label="Receita realizada" value={brl(kpis.receita)} variant="success" />
        <KPI label="A receber" value={brl(kpis.aReceber)} variant="info" />
        <KPI label="Inadimplência" value={brl(kpis.inadimplencia)} variant="danger" />
        <KPI label="Taxa CAU paga" value={brl(kpis.taxaCAUTotal)} variant="neutral" />
      </div>

      <Card>
        <CardHeader title="Receita mensal (12 meses)" />
        <CardContent>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={receitaPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6e6e0" />
                <XAxis dataKey="mes" stroke="#6b6b66" fontSize={11} />
                <YAxis stroke="#6b6b66" fontSize={11} />
                <Tooltip formatter={(v: unknown) => `R$ ${Number(v).toFixed(2)}`} />
                <Line type="monotone" dataKey="valor" stroke="#0a0a0a" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Distribuição por status" />
          <CardContent>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={statusDist} dataKey="value" nameKey="name" outerRadius={80} label>
                    {statusDist.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Top 5 clientes (receita)" />
          <CardContent>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={topClientes} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6e6e0" />
                  <XAxis type="number" stroke="#6b6b66" fontSize={11} />
                  <YAxis type="category" dataKey="cliente" stroke="#6b6b66" fontSize={11} width={100} />
                  <Tooltip formatter={(v: unknown) => `R$ ${Number(v).toFixed(2)}`} />
                  <Bar dataKey="total" fill="#0a0a0a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title={`Empresas ativas (${companies.length})`} />
        <CardContent>
          <p className="text-sm text-muted">
            Para análise por empresa específica, vá em <code>/admin/clientes/&#123;id&#125;</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function KPI({
  label,
  value,
  variant,
}: {
  label: string
  value: string
  variant: 'success' | 'info' | 'danger' | 'neutral'
}) {
  const COLOR = {
    success: 'text-success',
    info: 'text-info',
    danger: 'text-danger',
    neutral: 'text-onyx',
  }
  return (
    <Card>
      <CardContent className="px-6 py-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</div>
        <div className={`mt-1 font-serif text-3xl ${COLOR[variant]}`}>{value}</div>
      </CardContent>
    </Card>
  )
}
