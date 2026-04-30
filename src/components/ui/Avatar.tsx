import { initials } from '@/lib/format'
import { cn } from '@/lib/cn'

type Size = 'sm' | 'md' | 'lg'
type Shape = 'circle' | 'square'

interface Props {
  src?: string
  name?: string
  size?: Size
  shape?: Shape
  className?: string
}

const SIZE: Record<Size, { box: string; text: string }> = {
  sm: { box: 'h-8 w-8', text: 'text-[10px]' },
  md: { box: 'h-10 w-10', text: 'text-xs' },
  lg: { box: 'h-14 w-14', text: 'text-base' },
}

export function Avatar({ src, name, size = 'md', shape = 'circle', className }: Props) {
  const s = SIZE[size]
  const radius = shape === 'circle' ? 'rounded-full' : 'rounded-xl'

  if (src) {
    return (
      <img
        src={src}
        alt={name ?? 'avatar'}
        className={cn('object-cover', s.box, radius, className)}
      />
    )
  }

  return (
    <span
      aria-label={name}
      className={cn(
        'inline-flex items-center justify-center bg-onyx text-linen font-semibold',
        s.box,
        s.text,
        radius,
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
