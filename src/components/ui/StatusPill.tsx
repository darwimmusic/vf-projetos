import { Badge } from './Badge'
import type { ProjetoStatus, RRTStatus, ChamadoStatus } from '@/types'

const RRT_MAP: Record<RRTStatus, { variant: Parameters<typeof Badge>[0]['variant']; label: string }> = {
  PROVISORIA: { variant: 'warning', label: 'Provisória' },
  BOLETO_PAGO: { variant: 'info', label: 'Boleto pago' },
  DEFINITIVA: { variant: 'success', label: 'Definitiva' },
  NF_EMITIDA: { variant: 'info', label: 'NF emitida' },
  PAGO: { variant: 'success', label: 'Pago' },
  CANCELADA: { variant: 'neutral', label: 'Cancelada' },
}

const PROJETO_MAP: Record<
  ProjetoStatus,
  { variant: Parameters<typeof Badge>[0]['variant']; label: string }
> = {
  BRIEFING: { variant: 'neutral', label: 'Briefing' },
  EM_DESENVOLVIMENTO: { variant: 'warning', label: 'Em desenvolvimento' },
  ENTREGUE: { variant: 'info', label: 'Entregue' },
  PAGO: { variant: 'success', label: 'Pago' },
  CANCELADO: { variant: 'neutral', label: 'Cancelado' },
}

const CHAMADO_MAP: Record<
  ChamadoStatus,
  { variant: Parameters<typeof Badge>[0]['variant']; label: string }
> = {
  ABERTO: { variant: 'warning', label: 'Aberto' },
  EM_ANALISE: { variant: 'info', label: 'Em análise' },
  EM_ANDAMENTO: { variant: 'info', label: 'Em andamento' },
  AGUARDANDO_CLIENTE: { variant: 'warning', label: 'Aguardando' },
  FECHADO: { variant: 'neutral', label: 'Fechado' },
  CONVERTIDO: { variant: 'success', label: 'Convertido' },
}

export function RRTStatusPill({ status }: { status: RRTStatus }) {
  const m = RRT_MAP[status]
  return <Badge variant={m.variant}>{m.label}</Badge>
}

export function ProjetoStatusPill({ status }: { status: ProjetoStatus }) {
  const m = PROJETO_MAP[status]
  return <Badge variant={m.variant}>{m.label}</Badge>
}

export function ChamadoStatusPill({ status }: { status: ChamadoStatus }) {
  const m = CHAMADO_MAP[status]
  return <Badge variant={m.variant}>{m.label}</Badge>
}
