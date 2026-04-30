import { cn } from '@/lib/cn'

interface Props {
  className?: string
}

export function Skeleton({ className }: Props) {
  return <div className={cn('animate-pulse rounded-xl bg-sunken', className)} aria-busy="true" />
}
