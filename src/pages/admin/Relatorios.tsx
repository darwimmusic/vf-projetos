import { useState } from 'react'
import { Download, FileText, TrendingUp, ScrollText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { listRRTs } from '@/lib/api/rrts'
import { listProjetos } from '@/lib/api/projetos'
import { listCompanies } from '@/lib/api/companies'
import { exportCsv } from '@/lib/reports/csv'
import { brl, formatDate } from '@/lib/format'
import { toast } from '@/components/ui/Toast'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AuditLog } from '@/types'

interface ReportCard {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ size?: number }>
  generate: () => Promise<void>
}

export default function AdminRelatorios() {
  const [busy, setBusy] = useState<string | null>(null)

  async function withBusy(id: string, fn: () => Promise<void>) {
    setBusy(id)
    try {
      await fn()
    } catch (e) {
      toast.error('Falha', e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(null)
    }
  }

  const reports: ReportCard[] = [
    {
      id: 'rrts',
      title: 'RRTs (lista completa)',
      description: 'Todas as RRTs com status, valores, contratantes e datas.',
      icon: FileText,
      generate: async () => {
        const rrts = await listRRTs()
        const rows = rrts.map(r => ({
          numero: r.numeroRRT ?? '',
          empresa: r.companyName,
          contratante: r.contratante,
          empresa_faturamento: r.empresaFaturamento,
          descricao: r.descricao,
          status: r.status,
          valor_bruto: (r.valorBruto / 100).toFixed(2).replace('.', ','),
          taxa_cau: (r.taxaCAU / 100).toFixed(2).replace('.', ','),
          valor_cobrado: (r.valorCobradoCliente / 100).toFixed(2).replace('.', ','),
          data_criacao: formatDate(r.dataCriacao),
          data_nf: formatDate(r.dataNF),
          data_pagamento: formatDate(r.dataPagamento),
        }))
        await exportCsv(rows, {
          filename: `relatorio-rrts-${new Date().toISOString().slice(0, 10)}.csv`,
          resourceLabel: 'Relatório RRTs',
          resourceId: 'report-rrts',
        })
        toast.success('Relatório gerado', `${rows.length} RRTs`)
      },
    },
    {
      id: 'financeiro',
      title: 'Financeiro consolidado',
      description: 'Soma de receitas por empresa, RRTs pagas e a receber.',
      icon: TrendingUp,
      generate: async () => {
        const [rrts, projetos, companies] = await Promise.all([
          listRRTs(),
          listProjetos(),
          listCompanies(),
        ])
        const rows = companies.map(c => {
          const cRRTs = rrts.filter(r => r.companyId === c.id)
          const cProjs = projetos.filter(p => p.companyId === c.id)
          const pago =
            cRRTs.filter(r => r.status === 'PAGO').reduce((s, r) => s + r.valorCobradoCliente, 0) +
            cProjs.filter(p => p.status === 'PAGO').reduce((s, p) => s + p.valor, 0)
          const aReceber =
            cRRTs
              .filter(r => ['DEFINITIVA', 'NF_EMITIDA'].includes(r.status))
              .reduce((s, r) => s + r.valorCobradoCliente, 0) +
            cProjs.filter(p => p.status === 'ENTREGUE').reduce((s, p) => s + p.valor, 0)
          return {
            empresa: c.name,
            cnpj: c.cnpj,
            qtd_rrts: cRRTs.length,
            qtd_projetos: cProjs.length,
            valor_pago: (pago / 100).toFixed(2).replace('.', ','),
            valor_a_receber: (aReceber / 100).toFixed(2).replace('.', ','),
          }
        })
        await exportCsv(rows, {
          filename: `relatorio-financeiro-${new Date().toISOString().slice(0, 10)}.csv`,
          resourceLabel: 'Relatório Financeiro',
          resourceId: 'report-financeiro',
        })
        toast.success('Relatório gerado', `${rows.length} empresas`)
      },
    },
    {
      id: 'audit',
      title: 'Trilha de auditoria',
      description: 'Últimas 500 ações registradas no sistema.',
      icon: ScrollText,
      generate: async () => {
        const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(500))
        const snap = await getDocs(q)
        const rows = snap.docs.map(d => {
          const log = d.data() as AuditLog
          return {
            data: formatDate(log.timestamp, 'dd/MM/yyyy HH:mm'),
            ator: log.actor.displayName,
            papel: log.actor.role,
            empresa: log.actor.companyName ?? '—',
            acao: log.action,
            recurso_tipo: log.resource.type,
            recurso: log.resource.label,
            notas: log.metadata?.notes ?? '',
          }
        })
        await exportCsv(rows, {
          filename: `auditoria-${new Date().toISOString().slice(0, 10)}.csv`,
          resourceLabel: 'Auditoria',
          resourceId: 'report-audit',
        })
        toast.success('Relatório gerado', `${rows.length} entradas`)
      },
    },
    {
      id: 'projetos',
      title: 'Projetos (lista completa)',
      description: 'Todos os projetos com status, valores e datas.',
      icon: FileText,
      generate: async () => {
        const projetos = await listProjetos()
        const rows = projetos.map(p => ({
          nome: p.nome,
          empresa: p.companyName,
          status: p.status,
          valor: brl(p.valor),
          data_criacao: formatDate(p.dataCriacao),
          data_entrega: formatDate(p.dataEntrega),
          data_pagamento: formatDate(p.dataPagamento),
        }))
        await exportCsv(rows, {
          filename: `relatorio-projetos-${new Date().toISOString().slice(0, 10)}.csv`,
          resourceLabel: 'Relatório Projetos',
          resourceId: 'report-projetos',
        })
        toast.success('Relatório gerado', `${rows.length} projetos`)
      },
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-4xl text-onyx">Relatórios</h1>
        <p className="mt-1 text-sm text-muted">
          Exportações em CSV (Excel BR-friendly: separador ;, BOM UTF-8).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {reports.map(r => {
          const Icon = r.icon
          return (
            <Card key={r.id}>
              <CardContent className="flex flex-col gap-3 p-6">
                <div className="flex items-center gap-3 text-muted">
                  <Icon size={20} />
                  <h3 className="font-serif text-xl text-onyx">{r.title}</h3>
                </div>
                <p className="text-sm text-muted">{r.description}</p>
                <div className="mt-auto pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => withBusy(r.id, r.generate)}
                    loading={busy === r.id}
                  >
                    <Download size={14} /> Gerar CSV
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
