import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { RRTStatusPill } from '@/components/ui/StatusPill'
import { StatusPipeline, RRT_PIPELINE } from '@/components/domain/StatusPipeline'
import { FileUploader } from '@/components/domain/FileUploader'
import { AnexosList } from '@/components/domain/AnexosList'
import { BillingConsolidation } from '@/components/domain/BillingConsolidation'
import {
  getRRT,
  advanceRRTStatus,
  revertRRTStatus,
  nextValidRRTStatuses,
} from '@/lib/api/rrts'
import { brl, formatCnpj, formatDate } from '@/lib/format'
import { toast } from '@/components/ui/Toast'
import type { RRT, RRTStatus } from '@/types'

export default function AdminRRTDetail() {
  const { id } = useParams<{ id: string }>()
  const [rrt, setRRT] = useState<RRT | null | undefined>(undefined)
  const [refreshKey, setRefreshKey] = useState(0)
  const [revertOpen, setRevertOpen] = useState(false)
  const [revertTo, setRevertTo] = useState<RRTStatus | null>(null)
  const [revertReason, setRevertReason] = useState('')

  async function reload() {
    if (!id) return
    setRRT(await getRRT(id))
  }

  useEffect(() => {
    if (!id) return
    void getRRT(id).then(setRRT)
  }, [id])

  if (rrt === undefined) return <Skeleton className="h-64" />
  if (rrt === null) return <p className="text-sm text-muted">RRT não encontrada.</p>

  const nextStatuses = nextValidRRTStatuses(rrt.status).filter(s => s !== 'CANCELADA')
  const isCancelled = rrt.status === 'CANCELADA'

  async function handleAdvance(to: RRTStatus) {
    try {
      await advanceRRTStatus(rrt!.id, to)
      toast.success(`Status: ${to}`)
      void reload()
    } catch (e) {
      toast.error('Falha', e instanceof Error ? e.message : 'Erro')
    }
  }

  async function handleRevert() {
    if (!revertTo || revertReason.length < 20) return
    try {
      await revertRRTStatus(rrt!.id, revertTo, revertReason)
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
        to="/admin/rrts"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-onyx"
      >
        <ArrowLeft size={14} /> RRTs
      </Link>

      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-4xl text-onyx">
              {rrt.numeroRRT ?? 'RRT em rascunho'}
            </h1>
            <RRTStatusPill status={rrt.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            <Link to={`/admin/clientes/${rrt.companyId}`} className="hover:text-onyx">
              {rrt.companyName}
            </Link>{' '}
            · {formatDate(rrt.dataCriacao)}
          </p>
        </div>
        <div className="flex gap-2">
          {nextStatuses.map(s => (
            <Button key={s} onClick={() => handleAdvance(s)}>
              Avançar → {s}
            </Button>
          ))}
          {rrt.status !== 'PROVISORIA' && !isCancelled && (
            <Button variant="ghost" onClick={() => setRevertOpen(true)}>
              Reverter
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="px-8 py-6">
          <StatusPipeline
            steps={RRT_PIPELINE}
            current={rrt.status as (typeof RRT_PIPELINE)[number]['value']}
            cancelled={isCancelled}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Valor bruto" value={brl(rrt.valorBruto)} />
        <Field label="Taxa CAU" value={brl(rrt.taxaCAU)} />
        <Field label="Valor cobrado" value={brl(rrt.valorCobradoCliente)} />
        <Field label="Valor líquido (Victor)" value={brl(rrt.valorLiquido)} />
        <Field label="Boleto por mim" value={rrt.boletoPorMim ? 'Sim' : 'Não'} />
        <Field label="Faturamento" value={`${rrt.empresaFaturamento} · ${formatCnpj(rrt.cnpjFaturamento)}`} />
        <Field label="Contratante" value={rrt.contratante} />
        {rrt.numeroNF && <Field label="NF" value={rrt.numeroNF} />}
        {rrt.oc && <Field label="OC" value={rrt.oc} />}
        {rrt.dataBoleto && <Field label="Boleto pago em" value={formatDate(rrt.dataBoleto)} />}
        {rrt.dataDefinitiva && <Field label="Definitiva em" value={formatDate(rrt.dataDefinitiva)} />}
        {rrt.dataNF && <Field label="NF emitida em" value={formatDate(rrt.dataNF)} />}
        {rrt.dataPagamento && <Field label="Pago em" value={formatDate(rrt.dataPagamento)} />}
      </div>

      <BillingConsolidation
        selfType="rrt"
        selfId={rrt.id}
        selfLabel={rrt.numeroRRT ?? rrt.descricao.slice(0, 40)}
        companyId={rrt.companyId}
        billingConsolidates={rrt.billingConsolidates}
        billingPrincipalId={rrt.billingPrincipalId}
        onChange={() => void reload()}
      />

      {rrt.descricao && (
        <Card>
          <CardHeader title="Descrição" />
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{rrt.descricao}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Anexos"
          action={
            <FileUploader
              parent="rrts"
              parentId={rrt.id}
              parentLabel={rrt.numeroRRT ?? rrt.descricao.slice(0, 40)}
              onUploaded={() => setRefreshKey(k => k + 1)}
            />
          }
        />
        <CardContent>
          <AnexosList
            parent="rrts"
            parentId={rrt.id}
            parentLabel={rrt.numeroRRT ?? rrt.descricao.slice(0, 40)}
            refreshKey={refreshKey}
          />
        </CardContent>
      </Card>

      <Modal
        open={revertOpen}
        onOpenChange={setRevertOpen}
        title="Reverter status"
        description="Justifique a reversão (mínimo 20 caracteres)."
      >
        <div className="flex flex-col gap-4">
          <select
            value={revertTo ?? ''}
            onChange={e => setRevertTo(e.target.value as RRTStatus)}
            className="h-12 rounded-xl border border-transparent bg-sunken px-4 text-base focus:border-onyx focus:bg-elevated"
          >
            <option value="">Reverter para…</option>
            {(['PROVISORIA', 'BOLETO_PAGO', 'DEFINITIVA', 'NF_EMITIDA'] as RRTStatus[])
              .filter(s => s !== rrt.status)
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
