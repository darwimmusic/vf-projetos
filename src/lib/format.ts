import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Timestamp } from 'firebase/firestore'

/** Formata centavos como BRL: 45000 → "R$ 450,00" */
export function brl(centavos: number | undefined | null): string {
  const n = centavos ?? 0
  return (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Formata Timestamp ou Date como data brasileira */
export function formatDate(ts: Timestamp | Date | undefined | null, pattern = 'dd/MM/yyyy'): string {
  if (!ts) return '—'
  const date = ts instanceof Date ? ts : ts.toDate()
  return format(date, pattern, { locale: ptBR })
}

/** Formata Timestamp ou Date como data+hora brasileira */
export function formatDateTime(ts: Timestamp | Date | undefined | null): string {
  return formatDate(ts, "dd/MM/yyyy 'às' HH:mm")
}

/** Slug determinístico — minúsculas, sem acentos, sem espaços */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Normaliza CNPJ removendo pontuação (para dedup) */
export function normalizeCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, '')
}

/** Formata CNPJ: 12345678000190 → 12.345.678/0001-90 */
export function formatCnpj(cnpj: string): string {
  const n = normalizeCnpj(cnpj)
  if (n.length !== 14) return cnpj
  return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12)}`
}

/** Trunca string com ellipsis */
export function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, n - 1) + '…'
}

/** Iniciais para Avatar fallback: "Victor Lima Ferreira" → "VL" */
export function initials(name: string | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
