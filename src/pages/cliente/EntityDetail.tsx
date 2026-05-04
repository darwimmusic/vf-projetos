import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { RRTStatusPill, ProjetoStatusPill } from '@/components/ui/StatusPill'
import { AnexosList } from '@/components/domain/AnexosList'
import { getRRT, alertBoletoPaid, alertRRTPayment } from '@/lib/api/rrts'
import { getProjeto, alertProjetoPayment } from '@/lib/api/projetos'
import { brl, formatCnpj, formatDate } from '@/lib/format'
import { toast } from '@/components/ui/Toast'
import { useAuthStore } from '@/stores/auth.store'
import type { Projeto, RRT } from '@/types'

export default function ClienteEntityDetail() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const isRRT = location.pathname.includes('/rrts/')

  const [data, setData] = useState<RRT | Projeto | null | undefined>(undefined)

  async function reload() {
    if (!id) return
    setData(isRRT ? await getRRT(id) : await getProjeto(id))
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isRRT])

  if (data === undefined) return <Skeleton className="h-64" />
  if (data === null)
    return <p className="text-sm text-muted">Item não encontrado.</p>

  if (isRRT) return <RRTView rrt={data as RRT} reload={reload} />
  return <ProjetoView projeto={data as Projeto} reload={reload} />
}

function RRTView({ rrt, reload }: { rrt: RRT; reload(): void }) {
  const role = useAuthStore(s => s.user?.role)
  const isOwner = role === 'company_owner' || role === 'admin'
  const canAlertBoleto = isOwner && rrt.status === 'PROVISORIA' && !rrt.boletoAlertedAt
  const canAlertPayment = isOwner && rrt.status === 'NF_EMITIDA' && !rrt.paymentAlertedAt

  async function handleAlertBoleto() {
    try {
      await alertBoletoPaid(rrt.id)
      toast.success('Alerta enviado', 'Victor foi notificado.')
      reload()
    } catch (e) {
      toast.error('Falha', e instanceof Error ? e.message : 'Erro')
    }
  }

  async function handleAlertPayment() {
    try {
      await alertRRTPayment(rrt.id)
      toast.success('Alerta enviado', 'Victor foi notificado.')
      reload()
    } catch (e) {
      toast.error('Falha', e instanceof Error ? e.message : 'Erro')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/c/rrts" className="inline-flex items-center gap-1 text-sm text-muted hover:text-onyx">
        <ArrowLeft size={14} /> RRTs
      </Link>

      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-4xl text-onyx">
              {rrt.numeroRRT ?? 'RRT em emissão'}
            </h1>
            <RRTStatusPill status={rrt.status} />
          </div>
          <p className="mt-1 text-sm text-muted">{formatDate(rrt.dataCriacao)}</p>
        </div>
        <div className="flex gap-2">
          {canAlertBoleto && <Button onClick={handleAlertBoleto}>Alertar boleto pago</Button>}
          {canAlertPayment && <Button onClick={handleAlertPayment}>Alertar pagamento NF</Button>}
        </div>
      </div>

      {(rrt.boletoAlertedAt || rrt.paymentAlertedAt) && (
        <Card>
          <CardContent className="px-6 py-4 text-sm text-muted">
            {rrt.boletoAlertedAt && (
              <p>✓ Boleto alertado em {formatDate(rrt.boletoAlertedAt)}</p>
            )}
            {rrt.paymentAlertedAt && (
              <p>✓ Pagamento alertado em {formatDate(rrt.paymentAlertedAt)}</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Field label="Valor" value={brl(rrt.valorCobradoCliente)} />
        <Field label="Faturamento" value={`${rrt.empresaFaturamento} · ${formatCnpj(rrt.cnpjFaturamento)}`} />
        <Field label="Contratante" value={rrt.contratante} />
        {rrt.numeroNF && <Field label="NF" value={rrt.numeroNF} />}
        {rrt.dataNF && <Field label="NF emitida em" value={formatDate(rrt.dataNF)} />}
        {rrt.previsaoPagamento && <Field label="Previsão pagamento" value={formatDate(rrt.previsaoPagamento)} />}
      </div>

      {rrt.descricao && (
        <Card>
          <CardHeader title="Descrição" />
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{rrt.descricao}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader title="Documentos" />
        <CardContent>
          <AnexosList parent="rrts" parentId={rrt.id} parentLabel={rrt.numeroRRT ?? 'RRT'} />
        </CardContent>
      </Card>
    </div>
  )
}

function ProjetoView({ projeto, reload }: { projeto: Projeto; reload(): void }) {
  const role = useAuthStore(s => s.user?.role)
  const isOwner = role === 'company_owner' || role === 'admin'
  const canAlertPayment = isOwner && projeto.status === 'ENTREGUE' && !projeto.paymentAlertedAt

  async function handleAlertPayment() {
    try {
      await alertProjetoPayment(projeto.id)
      toast.success('Alerta enviado')
      reload()
    } catch (e) {
      toast.error('Falha', e instanceof Error ? e.message : 'Erro')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/c/projetos" className="inline-flex items-center gap-1 text-sm text-muted hover:text-onyx">
        <ArrowLeft size={14} /> Projetos
      </Link>

      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-4xl text-onyx">{projeto.nome}</h1>
            <ProjetoStatusPill status={projeto.status} />
          </div>
          <p className="mt-1 text-sm text-muted">{formatDate(projeto.dataCriacao)}</p>
        </div>
        {canAlertPayment && <Button onClick={handleAlertPayment}>Alertar pagamento</Button>}
      </div>

      {projeto.paymentAlertedAt && (
        <Card>
          <CardContent className="px-6 py-4 text-sm text-muted">
            ✓ Pagamento alertado em {formatDate(projeto.paymentAlertedAt)}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Field label="Valor" value={brl(projeto.valor)} />
        <Field label="Faturamento" value={projeto.empresaFaturamento} />
        {projeto.local && <Field label="Local" value={projeto.local} />}
      </div>

      {projeto.descricao && (
        <Card>
          <CardHeader title="Descrição" />
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{projeto.descricao}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader title="Documentos" />
        <CardContent>
          <AnexosList parent="projetos" parentId={projeto.id} parentLabel={projeto.nome} />
        </CardContent>
      </Card>
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
