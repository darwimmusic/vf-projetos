import { useState } from 'react'
import { Download, FileText, TrendingUp } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { listRRTs } from '@/lib/api/rrts'
import { listProjetos } from '@/lib/api/projetos'
import { exportCsv } from '@/lib/reports/csv'
import { formatDate } from '@/lib/format'
import { toast } from '@/components/ui/Toast'

export default function ClienteRelatorios() {
  const user = useAuthStore(s => s.user)
  const [busy, setBusy] = useState<string | null>(null)

  async function handleRRTs() {
    if (!user?.companyId) return
    setBusy('rrts')
    try {
      const rrts = await listRRTs({ companyId: user.companyId })
      const rows = rrts.map(r => ({
        numero: r.numeroRRT ?? '',
        descricao: r.descricao,
        status: r.status,
        valor_cobrado: (r.valorCobradoCliente / 100).toFixed(2).replace('.', ','),
        data_criacao: formatDate(r.dataCriacao),
        data_pagamento: formatDate(r.dataPagamento),
      }))
      await exportCsv(rows, {
        filename: `${user.companyName}-rrts-${new Date().toISOString().slice(0, 10)}.csv`,
        resourceLabel: `RRTs ${user.companyName}`,
        resourceId: `c-rrts-${user.companyId}`,
      })
      toast.success('Exportado', `${rows.length} RRTs`)
    } catch (e) {
      toast.error('Falha', e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(null)
    }
  }

  async function handleProjetos() {
    if (!user?.companyId) return
    setBusy('projetos')
    try {
      const projetos = await listProjetos({ companyId: user.companyId })
      const rows = projetos.map(p => ({
        nome: p.nome,
        status: p.status,
        valor: (p.valor / 100).toFixed(2).replace('.', ','),
        data_criacao: formatDate(p.dataCriacao),
        data_entrega: formatDate(p.dataEntrega),
      }))
      await exportCsv(rows, {
        filename: `${user.companyName}-projetos-${new Date().toISOString().slice(0, 10)}.csv`,
        resourceLabel: `Projetos ${user.companyName}`,
        resourceId: `c-projetos-${user.companyId}`,
      })
      toast.success('Exportado', `${rows.length} projetos`)
    } catch (e) {
      toast.error('Falha', e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-4xl text-onyx">Relatórios</h1>
        <p className="mt-1 text-sm text-muted">Exportar dados da {user?.companyName} em CSV.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <div className="flex items-center gap-3 text-muted">
              <FileText size={20} />
              <h3 className="font-serif text-xl text-onyx">RRTs</h3>
            </div>
            <p className="text-sm text-muted">
              Lista completa de RRTs com status, valores e datas.
            </p>
            <div className="mt-auto pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRRTs}
                loading={busy === 'rrts'}
              >
                <Download size={14} /> Baixar CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <div className="flex items-center gap-3 text-muted">
              <TrendingUp size={20} />
              <h3 className="font-serif text-xl text-onyx">Projetos</h3>
            </div>
            <p className="text-sm text-muted">
              Lista de projetos da empresa com status e valores.
            </p>
            <div className="mt-auto pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleProjetos}
                loading={busy === 'projetos'}
              >
                <Download size={14} /> Baixar CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
