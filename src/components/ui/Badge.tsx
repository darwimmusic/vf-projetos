import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'premium'

interface Props extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant
}

const VARIANT: Record<Variant, string> = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
  neutral: 'bg-sunken text-muted',
  premium: 'bg-premium/10 text-premium',
}

export function Badge({ variant = 'neutral', className, ...rest }: Props) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full px-2.5 text-[10px] font-semibold uppercase tracking-wider',
        VARIANT[variant],
        className,
      )}
      {...rest}
    />
  )
}
