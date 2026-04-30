import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Receipt, Link2, Unlink } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { listRRTs } from '@/lib/api/rrts'
import { listProjetos } from '@/lib/api/projetos'
import { consolidateBilling, unconsolidate } from '@/lib/api/billing'
import { brl } from '@/lib/format'
import { toast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import type { BillingRef, RRT, Projeto } from '@/types'

interface Props {
  /** Tipo desta entidade */
  selfType: 'rrt' | 'projeto'
  /** ID desta entidade */
  selfId: string
  /** Label legível */
  selfLabel: string
  /** Empresa pra filtrar candidatos */
  companyId: string
  /** Itens consolidados aqui (a NF está nesta entidade) */
  billingConsolidates?: BillingRef[]
  /** Se preenchido, esta entidade está consolidada em outra (não detém NF) */
  billingPrincipalId?: BillingRef
  /** Callback após mudança */
  onChange(): void
}

export function BillingConsolidation({
  selfType,
  selfId,
  selfLabel,
  companyId,
  billingConsolidates,
  billingPrincipalId,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false)

  // Caso: está consolidada em outro
  if (billingPrincipalId) {
    return (
      <Card>
        <CardHeader title="Faturamento" />
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted">
            <Link2 size={14} />
            <span>NF emitida em conjunto com:</span>
            <Link
              to={
                billingPrincipalId.startsWith('rrt:')
                  ? `/admin/rrts/${billingPrincipalId.slice(4)}`
                  : `/admin/projetos/${billingPrincipalId.slice(8)}`
              }
              className="font-semibold text-onyx hover:underline"
            >
              {billingPrincipalId.startsWith('rrt:') ? 'RRT' : 'Projeto'} →
            </Link>
          </div>
          <p className="mt-2 text-xs text-muted">
            Este item não soma no financeiro (a NF está no item principal).
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Faturamento"
          action={
            <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
              <Receipt size={14} /> Consolidar
            </Button>
          }
        />
        <CardContent>
          {!billingConsolidates || billingConsolidates.length === 0 ? (
            <p className="text-sm text-muted">
              NF própria. Use "Consolidar" se este item compartilha NF com outro.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {billingConsolidates.map(ref => (
                <ConsolidatedItem
                  key={ref}
                  refId={ref}
                  onRemove={async () => {
                    try {
                      await unconsolidate(
                        { type: selfType, id: selfId, label: selfLabel },
                        ref,
                      )
                      toast.success('Removido')
                      onChange()
                    } catch (e) {
                      toast.error('Falha', e instanceof Error ? e.message : 'Erro')
                    }
                  }}
                />
              ))}
              <p className="mt-2 text-xs text-muted">
                A NF deste item agrega o valor dos itens acima.
              </p>
            </ul>
          )}
        </CardContent>
      </Card>

      <ConsolidateModal
        open={open}
        onOpenChange={setOpen}
        selfType={selfType}
        selfId={selfId}
        selfLabel={selfLabel}
        companyId={companyId}
        existing={billingConsolidates ?? []}
        onDone={onChange}
      />
    </>
  )
}

function ConsolidatedItem({
  refId,
  onRemove,
}: {
  refId: BillingRef
  onRemove(): void
}) {
  const isRrt = refId.startsWith('rrt:')
  const id = isRrt ? refId.slice(4) : refId.slice(8)
  const path = isRrt ? `/admin/rrts/${id}` : `/admin/projetos/${id}`

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-sunken px-3 py-2">
      <Badge variant="info">{isRrt ? 'RRT' : 'Projeto'}</Badge>
      <Link to={path} className="flex-1 truncate text-sm text-onyx hover:underline">
        {id.slice(0, 8)}…
      </Link>
      <button
        onClick={onRemove}
        aria-label="Desconsolidar"
        className="rounded-md p-1.5 text-muted hover:bg-elevated hover:text-danger"
      >
        <Unlink size={14} />
      </button>
    </li>
  )
}

function ConsolidateModal({
  open,
  onOpenChange,
  selfType,
  selfId,
  selfLabel,
  companyId,
  existing,
  onDone,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  selfType: 'rrt' | 'projeto'
  selfId: string
  selfLabel: string
  companyId: string
  existing: BillingRef[]
  onDone(): void
}) {
  const [rrts, setRRTs] = useState<RRT[]>([])
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [selected, setSelected] = useState<Set<BillingRef>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    void Promise.all([listRRTs({ companyId }), listProjetos({ companyId })]).then(
      ([r, p]) => {
        setRRTs(r)
        setProjetos(p)
        setSelected(new Set())
      },
    )
  }, [open, companyId])

  function toggle(ref: BillingRef) {
    const s = new Set(selected)
    if (s.has(ref)) s.delete(ref)
    else s.add(ref)
    setSelected(s)
  }

  async function handleSubmit() {
    if (selected.size === 0) return
    setSubmitting(true)
    try {
      await consolidateBilling(
        { type: selfType, id: selfId, label: selfLabel },
        Array.from(selected),
      )
      toast.success('Consolidado', `${selected.size} item(ns) agrupados`)
      onOpenChange(false)
      onDone()
    } catch (e) {
      toast.error('Falha', e instanceof Error ? e.message : 'Erro')
    } finally {
      setSubmitting(false)
    }
  }

  // Lista candidatos: mesma company, !self, não-já-consolidado, não-já-selecionado-existente
  const existingSet = new Set(existing)
  const candidatos: { ref: BillingRef; label: string; valor: number; status: string }[] = []

  for (const r of rrts) {
    const ref: BillingRef = `rrt:${r.id}`
    if (selfType === 'rrt' && r.id === selfId) continue
    if (existingSet.has(ref)) continue
    if (r.billingPrincipalId) continue
    if (r.billingConsolidates && r.billingConsolidates.length > 0) continue
    candidatos.push({
      ref,
      label: r.numeroRRT ?? r.descricao.slice(0, 40),
      valor: r.valorCobradoCliente,
      status: r.status,
    })
  }
  for (const p of projetos) {
    const ref: BillingRef = `projeto:${p.id}`
    if (selfType === 'projeto' && p.id === selfId) continue
    if (existingSet.has(ref)) continue
    if (p.billingPrincipalId) continue
    if (p.billingConsolidates && p.billingConsolidates.length > 0) continue
    candidatos.push({ ref, label: p.nome, valor: p.valor, status: p.status })
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Consolidar faturamento"
      description="Marque os itens cuja NF foi emitida junto com este. O valor deles para de somar no financeiro (a NF deste item agrega o total)."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            loading={submitting}
            disabled={selected.size === 0}
          >
            Consolidar {selected.size > 0 && `(${selected.size})`}
          </Button>
        </>
      }
    >
      {candidatos.length === 0 ? (
        <p className="text-sm text-muted">
          Nenhum item disponível para consolidar (mesma empresa, sem consolidação já feita).
        </p>
      ) : (
        <ul className="flex max-h-[400px] flex-col gap-2 overflow-y-auto">
          {candidatos.map(c => {
            const isRrt = c.ref.startsWith('rrt:')
            const isSel = selected.has(c.ref)
            return (
              <li key={c.ref}>
                <button
                  onClick={() => toggle(c.ref)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
                    isSel
                      ? 'border-onyx bg-onyx/5'
                      : 'border-border bg-elevated hover:bg-sunken',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggle(c.ref)}
                    onClick={e => e.stopPropagation()}
                  />
                  <Badge variant={isRrt ? 'info' : 'premium'}>{isRrt ? 'RRT' : 'Projeto'}</Badge>
                  <span className="flex-1 truncate text-sm text-onyx">{c.label}</span>
                  <span className="text-xs text-muted">{brl(c.valor)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
