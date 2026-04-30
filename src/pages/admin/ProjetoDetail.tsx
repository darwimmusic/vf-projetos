import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ProjetoStatusPill } from '@/components/ui/StatusPill'
import { StatusPipeline, PROJETO_PIPELINE } from '@/components/domain/StatusPipeline'
import { FileUploader } from '@/components/domain/FileUploader'
import { AnexosList } from '@/components/domain/AnexosList'
import { BillingConsolidation } from '@/components/domain/BillingConsolidation'
import {
  getProjeto,
  advanceProjetoStatus,
  revertProjetoStatus,
  nextValidStatuses,
} from '@/lib/api/projetos'
import { brl, formatCnpj, formatDate } from '@/lib/format'
import { toast } from '@/components/ui/Toast'
import type { Projeto, ProjetoStatus } from '@/types'

export default function AdminProjetoDetail() {
  const { id } = useParams<{ id: string }>()
  const [projeto, setProjeto] = useState<Projeto | null | undefined>(undefined)
  const [refreshKey, setRefreshKey] = useState(0)
  const [revertOpen, setRevertOpen] = useState(false)
  const [revertTo, setRevertTo] = useState<ProjetoStatus | null>(null)
  const [revertReason, setRevertReason] = useState('')

  async function reload() {
    if (!id) return
    setProjeto(await getProjeto(id))
  }

  useEffect(() => {
    if (!id) return
    void getProjeto(id).then(setProjeto)
  }, [id])

  if (projeto === undefined) return <Skeleton className="h-64" />
  if (projeto === null) return <p className="text-sm text-muted">Projeto não encontrado.</p>

  const nextStatuses = nextValidStatuses(projeto.status).filter(s => s !== 'CANCELADO')
  const isCancelled = projeto.status === 'CANCELADO'

  async function handleAdvance(to: ProjetoStatus) {
    try {
      await advanceProjetoStatus(projeto!.id, to)
      toast.success(`Status atualizado: ${to}`)
      void reload()
    } catch (e) {
      toast.error('Falha', e instanceof Error ? e.message : 'Erro')
    }
  }

  async function handleRevert() {
    if (!revertTo || revertReason.length < 20) return
    try {
      await revertProjetoStatus(projeto!.id, revertTo, revertReason)
      toast.success('Status revertido')
      setRevertOpen(false)
      setRevertReason('')
      void reload()
    } catch (e) {
      toast.error('Falha', e instanceof Error ? e.message : 'Erro')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/admin/projetos"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-onyx"
      >
        <ArrowLeft size={14} /> Projetos
      </Link>

      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-4xl text-onyx">{projeto.nome}</h1>
            <ProjetoStatusPill status={projeto.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            <Link to={`/admin/clientes/${projeto.companyId}`} className="hover:text-onyx">
              {projeto.companyName}
            </Link>{' '}
            · {formatDate(projeto.dataCriacao)}
          </p>
        </div>
        <div className="flex gap-2">
          {nextStatuses.map(s => (
            <Button key={s} onClick={() => handleAdvance(s)}>
              Avançar → {s}
            </Button>
          ))}
          {projeto.status !== 'BRIEFING' && !isCancelled && (
            <Button variant="ghost" onClick={() => setRevertOpen(true)}>
              Reverter
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="px-8 py-6">
          <StatusPipeline
            steps={PROJETO_PIPELINE}
            current={projeto.status as (typeof PROJETO_PIPELINE)[number]['value']}
            cancelled={isCancelled}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Valor" value={brl(projeto.valor)} />
        <Field label="Empresa faturamento" value={projeto.empresaFaturamento} />
        <Field label="CNPJ" value={formatCnpj(projeto.cnpjFaturamento)} />
        {projeto.oc && <Field label="OC" value={projeto.oc} />}
        {projeto.local && <Field label="Local" value={projeto.local} />}
        {projeto.dataEntrega && (
          <Field label="Data de entrega" value={formatDate(projeto.dataEntrega)} />
        )}
        {projeto.dataPagamento && (
          <Field label="Data de pagamento" value={formatDate(projeto.dataPagamento)} />
        )}
      </div>

      <BillingConsolidation
        selfType="projeto"
        selfId={projeto.id}
        selfLabel={projeto.nome}
        companyId={projeto.companyId}
        billingConsolidates={projeto.billingConsolidates}
        billingPrincipalId={projeto.billingPrincipalId}
        onChange={() => void reload()}
      />

      {projeto.descricao && (
        <Card>
          <CardHeader title="Descrição" />
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-onyx">{projeto.descricao}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Anexos"
          action={
            <FileUploader
              parent="projetos"
              parentId={projeto.id}
              parentLabel={projeto.nome}
              onUploaded={() => setRefreshKey(k => k + 1)}
            />
          }
        />
        <CardContent>
          <AnexosList
            parent="projetos"
            parentId={projeto.id}
            parentLabel={projeto.nome}
            refreshKey={refreshKey}
          />
        </CardContent>
      </Card>

      <Modal
        open={revertOpen}
        onOpenChange={setRevertOpen}
        title="Reverter status"
        description="Justifique a reversão (mínimo 20 caracteres). Será registrado em auditoria."
      >
        <div className="flex flex-col gap-4">
          <select
            value={revertTo ?? ''}
            onChange={e => setRevertTo(e.target.value as ProjetoStatus)}
            className="h-12 rounded-xl border border-transparent bg-sunken px-4 text-base text-onyx focus:border-onyx focus:bg-elevated"
          >
            <option value="">Reverter para…</option>
            {(['BRIEFING', 'EM_DESENVOLVIMENTO', 'ENTREGUE'] as ProjetoStatus[])
              .filter(s => s !== projeto.status)
              .map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
          </select>
          <textarea
            value={revertReason}
            onChange={e => setRevertReason(e.target.value)}
            rows={3}
            placeholder="Razão da reversão…"
            className="rounded-xl border border-transparent bg-sunken px-4 py-3 text-sm focus:border-onyx focus:bg-elevated"
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setRevertOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleRevert}
              disabled={!revertTo || revertReason.length < 20}
            >
              Reverter
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
      <span className="mt-1 text-sm text-onyx">{value}</span>
    </div>
  )
}
