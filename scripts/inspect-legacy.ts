/**
 * Pré-flight B0.1 — inspeciona o Firestore legado `projeto-01-dc739`
 * e gera docs/schemas/legacy-firestore-schema.md com tipos inferidos.
 *
 * Uso: npm run inspect:legacy
 */
import { getAdminApp, adminDb } from './lib/admin'
import { writeFileSync } from 'node:fs'

function inferType(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return `Array<${value.length > 0 ? inferType(value[0]) : 'unknown'}>`
  if (typeof value === 'object') {
    const v = value as { _seconds?: number; toDate?: () => Date }
    if (v._seconds !== undefined || typeof v.toDate === 'function') return 'Timestamp'
    return 'object'
  }
  return typeof value
}

function inferShape(doc: Record<string, unknown>): Record<string, string> {
  const shape: Record<string, string> = {}
  for (const [k, v] of Object.entries(doc)) {
    shape[k] = inferType(v)
  }
  return shape
}

async function main() {
  console.info('[inspect-legacy] conectando em projeto-01-dc739…')
  getAdminApp('legacy', 'FIREBASE_SERVICE_ACCOUNT_OLD')
  const db = adminDb('legacy')

  const collections = await db.listCollections()
  console.info(`[inspect-legacy] ${collections.length} coleções encontradas`)

  const lines: string[] = [
    '---',
    'id: SCHEMA-LEGACY-FIRESTORE',
    'data: ' + new Date().toISOString().slice(0, 10),
    'fonte: projeto-01-dc739',
    'gerado_por: scripts/inspect-legacy.ts',
    '---',
    '',
    '# Schema Legado — `projeto-01-dc739`',
    '',
    '> Gerado automaticamente. Tipos inferidos do 1º documento de cada coleção.',
    '',
  ]

  const counts: Record<string, number> = {}

  for (const col of collections) {
    const snap = await col.limit(3).get()
    counts[col.id] = (await col.count().get()).data().count

    lines.push(`## \`${col.id}/{id}\` (${counts[col.id]} docs)`)
    lines.push('')

    if (snap.empty) {
      lines.push('_vazia_')
      lines.push('')
      continue
    }

    const sample = snap.docs[0].data()
    const shape = inferShape(sample)

    lines.push('```typescript')
    lines.push('interface ' + col.id.charAt(0).toUpperCase() + col.id.slice(1).replace(/s$/, '') + ' {')
    for (const [field, type] of Object.entries(shape)) {
      lines.push(`  ${field}: ${type}`)
    }
    lines.push('}')
    lines.push('```')
    lines.push('')

    if (snap.size > 1) {
      lines.push(`<details><summary>Sample (${snap.size} docs)</summary>`)
      lines.push('')
      lines.push('```json')
      lines.push(JSON.stringify(snap.docs.map(d => ({ id: d.id, ...d.data() })), null, 2).slice(0, 2000))
      lines.push('```')
      lines.push('')
      lines.push('</details>')
      lines.push('')
    }
  }

  lines.push('## Contagens totais')
  lines.push('')
  lines.push('| Coleção | Docs |')
  lines.push('|---|---|')
  for (const [name, count] of Object.entries(counts)) {
    lines.push(`| \`${name}\` | ${count} |`)
  }
  lines.push('')

  const out = 'docs/schemas/legacy-firestore-schema.md'
  writeFileSync(out, lines.join('\n'), 'utf-8')
  console.info(`\n✅ Schema legado salvo em ${out}`)
  console.info(`   Coleções: ${collections.map(c => c.id).join(', ')}`)
}

main().catch(e => {
  console.error('[inspect-legacy] FALHA:', e)
  process.exit(1)
})
