import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

interface Props<T extends string> {
  steps: readonly { value: T; label: string }[]
  current: T
  cancelled?: boolean
}

export function StatusPipeline<T extends string>({ steps, current, cancelled }: Props<T>) {
  const currentIdx = steps.findIndex(s => s.value === current)

  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => {
        const done = i < currentIdx
        const active = i === currentIdx && !cancelled
        return (
          <div key={s.value} className="flex flex-1 items-center gap-1">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors',
                  done && 'bg-success text-linen',
                  active && 'bg-onyx text-linen',
                  !done && !active && 'bg-sunken text-muted',
                  cancelled && 'bg-danger/20 text-danger',
                )}
              >
                {done ? <Check size={14} /> : i + 1}
              </div>
              <span
                className={cn(
                  'text-[10px] uppercase tracking-wider',
                  active ? 'font-semibold text-onyx' : 'text-muted',
                )}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'mx-1 h-0.5 flex-1 -translate-y-3',
                  done ? 'bg-success' : 'bg-border',
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export const RRT_PIPELINE = [
  { value: 'PROVISORIA' as const, label: 'Provisória' },
  { value: 'BOLETO_PAGO' as const, label: 'Boleto' },
  { value: 'DEFINITIVA' as const, label: 'Definitiva' },
  { value: 'NF_EMITIDA' as const, label: 'NF' },
  { value: 'PAGO' as const, label: 'Pago' },
] as const

export const PROJETO_PIPELINE = [
  { value: 'BRIEFING' as const, label: 'Briefing' },
  { value: 'EM_DESENVOLVIMENTO' as const, label: 'Dev' },
  { value: 'ENTREGUE' as const, label: 'Entregue' },
  { value: 'PAGO' as const, label: 'Pago' },
] as const
