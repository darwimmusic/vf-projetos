interface Props {
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: { fontSize: 18 },
  md: { fontSize: 28 },
  lg: { fontSize: 56 },
} as const

export function Logo({ size = 'md' }: Props) {
  const s = SIZES[size]
  return (
    <span
      style={{
        fontFamily: 'var(--font-serif)',
        fontSize: s.fontSize,
        letterSpacing: '-0.02em',
        color: 'var(--color-onyx)',
        lineHeight: 1,
        userSelect: 'none',
      }}
    >
      VF · PROJETOS
    </span>
  )
}
