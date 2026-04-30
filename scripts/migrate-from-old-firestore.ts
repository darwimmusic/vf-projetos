/**
 * Migration `projeto-01-dc739` (legado) → `rrt-vault` (novo).
 * Mapeamento determinístico em docs/schemas/firestore-schema.md §3.5.
 *
 * Pré-condições:
 *   - npm run inspect:legacy executado (para conferir schema legado real)
 *   - service accounts em FIREBASE_SERVICE_ACCOUNT_OLD/NEW
 *   - npm run seed (admin já criado em rrt-vault)
 *
 * Idempotência: usa `legacyId` como chave dedup. Sem --force, pula docs já migrados.
 *
 * Uso:
 *   npm run migrate                       # migra com prompt de confirmação
 *   npm run migrate -- --dry-run          # simula sem escrever
 *   npm run migrate -- --force            # reimporta sobrescrevendo
 */
import { getAdminApp, adminDb } from './lib/admin'
import { withAuditServer, migrationActor } from './lib/audit-server'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const DRY = args.includes('--dry-run')
const FORCE = args.includes('--force')

interface Counts {
  rrtsImportadas: number
  projetosImportados: number
  companiesCriadas: number
  skipped: number
  errors: number
}

const counts: Counts = {
  rrtsImportadas: 0,
  projetosImportados: 0,
  companiesCriadas: 0,
  skipped: 0,
  errors: 0,
}

function normalizeCnpj(s: string | undefined | null): string {
  if (!s) return ''
  return String(s).replace(/\D/g, '')
}

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function toCentavos(v: unknown): number {
  if (typeof v === 'number') return Math.round(v * 100)
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.'))
    return isNaN(n) ? 0 : Math.round(n * 100)
  }
  return 0
}

function asTimestamp(v: unknown): Timestamp | undefined {
  if (!v) return undefined
  if (v instanceof Timestamp) return v
  const obj = v as { _seconds?: number; toDate?: () => Date }
  if (obj._seconds !== undefined) return new Timestamp(obj._seconds, 0)
  if (typeof obj.toDate === 'function') return Timestamp.fromDate(obj.toDate())
  if (v instanceof Date) return Timestamp.fromDate(v)
  return undefined
}

async function backup(legacyDb: FirebaseFirestore.Firestore) {
  console.info('[migrate] criando backup JSON…')
  const backup: Record<string, unknown[]> = {}
  const collections = await legacyDb.listCollections()
  for (const col of collections) {
    const snap = await col.get()
    backup[col.id] = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }
  const path = `migration-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  writeFileSync(path, JSON.stringify(backup, null, 2), 'utf-8')
  console.info(`[migrate] backup salvo: ${path}`)
}

async function findOrCreateCompany(
  newDb: FirebaseFirestore.Firestore,
  cache: Map<string, string>,
  contratante: string,
  cnpjContratante?: string,
): Promise<string> {
  const cnpj = normalizeCnpj(cnpjContratante)
  const cacheKey = cnpj || `name:${slugify(contratante)}`

  const cached = cache.get(cacheKey)
  if (cached) return cached

  // Busca por CNPJ
  if (cnpj) {
    const byCnpj = await newDb.collection('companies').where('cnpj', '==', cnpj).limit(1).get()
    if (!byCnpj.empty) {
      const id = byCnpj.docs[0].id
      cache.set(cacheKey, id)
      return id
    }
  }

  // Busca por nome (fuzzy não — só exato; admin reclassifica órfãos)
  const byName = await newDb.collection('companies').where('name', '==', contratante).limit(1).get()
  if (!byName.empty) {
    const id = byName.docs[0].id
    cache.set(cacheKey, id)
    return id
  }

  // Cria
  const slug = slugify(contratante).slice(0, 40) || 'cliente-' + Math.random().toString(36).slice(2, 8)
  if (DRY) {
    console.info(`  [DRY] criaria company "${contratante}" cnpj=${cnpj || '—'}`)
    cache.set(cacheKey, '__dry__')
    return '__dry__'
  }

  const ref = await newDb.collection('companies').add({
    name: contratante,
    slug,
    cnpj: cnpj || '',
    contactEmail: '',
    prazoNF: 10,
    ownerId: '',
    active: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  counts.companiesCriadas++
  cache.set(cacheKey, ref.id)
  console.info(`  ✓ company criada: ${contratante} (${ref.id})`)
  return ref.id
}

async function migrateRRTs(
  legacyDb: FirebaseFirestore.Firestore,
  newDb: FirebaseFirestore.Firestore,
  companyCache: Map<string, string>,
) {
  const snap = await legacyDb.collection('rrts').get()
  console.info(`[migrate] ${snap.size} RRTs legadas`)

  for (const doc of snap.docs) {
    const legacy = doc.data() as Record<string, unknown>
    const legacyId = doc.id

    try {
      // Idempotência
      if (!FORCE) {
        const existing = await newDb
          .collection('rrts')
          .where('legacyId', '==', legacyId)
          .limit(1)
          .get()
        if (!existing.empty) {
          counts.skipped++
          continue
        }
      }

      const contratante = String(legacy.contratante ?? legacy.empresa ?? 'Sem nome')
      const cnpjContratante = legacy.cnpjContratante as string | undefined

      const companyId = await findOrCreateCompany(newDb, companyCache, contratante, cnpjContratante)
      const company = companyId === '__dry__' ? null : (await newDb.collection('companies').doc(companyId).get()).data()

      const valorBruto = toCentavos(legacy.valorBruto ?? 450)
      const taxaCAU = toCentavos(legacy.taxaCAU ?? 130.64)
      const boletoPorMim = legacy.boletoPagoPorMim === true || legacy.boletoPorMim === true
      const valorLiquido = valorBruto - taxaCAU
      const valorCobradoCliente = boletoPorMim ? valorBruto : valorLiquido

      const newDoc: Record<string, unknown> = {
        companyId,
        companyName: company?.name ?? contratante,
        legacyId,
        empresaFaturamento: String(legacy.empresa ?? ''),
        cnpjFaturamento: normalizeCnpj(legacy.cnpj as string),
        contratante,
        cnpjContratante: normalizeCnpj(cnpjContratante),
        descricao: String(legacy.descricao ?? ''),
        evento: legacy.evento,
        local: legacy.local,
        cep: legacy.cep,
        enderecoCompleto: legacy.enderecoCompleto,
        numeroRRT: legacy.numeroRRT,
        numeroNF: legacy.numeroNF,
        oc: legacy.oc,
        valorBruto,
        taxaCAU,
        valorLiquido,
        valorCobradoCliente,
        boletoPorMim,
        status: legacy.status ?? 'PROVISORIA',
        dataCriacao: asTimestamp(legacy.dataCriacao) ?? FieldValue.serverTimestamp(),
        dataBoleto: asTimestamp(legacy.dataBoleto),
        dataDefinitiva: asTimestamp(legacy.dataDefinitiva),
        dataNF: asTimestamp(legacy.dataNF),
        dataPagamento: asTimestamp(legacy.dataPagamento),
        observacoes: legacy.observacoes,
        createdBy: 'migration',
        updatedAt: FieldValue.serverTimestamp(),
      }

      // Limpeza: remove undefined (Firestore não aceita)
      Object.keys(newDoc).forEach(k => newDoc[k] === undefined && delete newDoc[k])

      if (DRY) {
        console.info(`  [DRY] importaria RRT ${legacyId} → companyId=${companyId}`)
      } else {
        await withAuditServer(
          newDb,
          migrationActor('migrate-v1'),
          {
            action: 'create',
            resource: { type: 'rrt', id: legacyId, label: String(legacy.numeroRRT ?? legacyId) },
          },
          async () => {
            await newDb.collection('rrts').add(newDoc)
          },
        )
      }
      counts.rrtsImportadas++
    } catch (e) {
      counts.errors++
      console.error(`  ✗ RRT ${legacyId}:`, e instanceof Error ? e.message : e)
    }
  }
}

async function migrateProjetos(
  legacyDb: FirebaseFirestore.Firestore,
  newDb: FirebaseFirestore.Firestore,
  companyCache: Map<string, string>,
) {
  let snap: FirebaseFirestore.QuerySnapshot
  try {
    snap = await legacyDb.collection('projetos').get()
  } catch {
    console.info('[migrate] coleção `projetos` não existe no legado, skip')
    return
  }
  console.info(`[migrate] ${snap.size} projetos legados`)

  for (const doc of snap.docs) {
    const legacy = doc.data() as Record<string, unknown>
    const legacyId = doc.id

    try {
      if (!FORCE) {
        const existing = await newDb
          .collection('projetos')
          .where('legacyId', '==', legacyId)
          .limit(1)
          .get()
        if (!existing.empty) {
          counts.skipped++
          continue
        }
      }

      const contratante = String(legacy.cliente ?? legacy.empresa ?? legacy.contratante ?? 'Sem nome')
      const companyId = await findOrCreateCompany(
        newDb,
        companyCache,
        contratante,
        legacy.cnpjCliente as string | undefined,
      )
      const company =
        companyId === '__dry__'
          ? null
          : (await newDb.collection('companies').doc(companyId).get()).data()

      const newDoc: Record<string, unknown> = {
        companyId,
        companyName: company?.name ?? contratante,
        legacyId,
        nome: String(legacy.nome ?? legacy.titulo ?? 'Projeto sem nome'),
        descricao: String(legacy.descricao ?? ''),
        empresaFaturamento: String(legacy.empresa ?? ''),
        cnpjFaturamento: normalizeCnpj(legacy.cnpj as string),
        valor: toCentavos(legacy.valor),
        status: legacy.status ?? 'BRIEFING',
        dataCriacao: asTimestamp(legacy.dataCriacao) ?? FieldValue.serverTimestamp(),
        rrtIds: [],
        observacoes: legacy.observacoes,
        createdBy: 'migration',
        updatedAt: FieldValue.serverTimestamp(),
      }
      Object.keys(newDoc).forEach(k => newDoc[k] === undefined && delete newDoc[k])

      if (DRY) {
        console.info(`  [DRY] importaria Projeto ${legacyId}`)
      } else {
        await newDb.collection('projetos').add(newDoc)
      }
      counts.projetosImportados++
    } catch (e) {
      counts.errors++
      console.error(`  ✗ Projeto ${legacyId}:`, e instanceof Error ? e.message : e)
    }
  }
}

async function main() {
  console.info(`[migrate] modo: ${DRY ? 'DRY-RUN' : FORCE ? 'FORCE' : 'NORMAL'}`)

  getAdminApp('legacy', 'FIREBASE_SERVICE_ACCOUNT_OLD')
  getAdminApp('new', 'FIREBASE_SERVICE_ACCOUNT_NEW')
  const legacyDb = adminDb('legacy')
  const newDb = adminDb('new')

  if (!DRY) {
    await backup(legacyDb)
  }

  const companyCache = new Map<string, string>()

  await migrateRRTs(legacyDb, newDb, companyCache)
  await migrateProjetos(legacyDb, newDb, companyCache)

  console.info('\n=== RELATÓRIO ===')
  console.info(JSON.stringify(counts, null, 2))

  const reportPath = `migration-report-${new Date().toISOString().slice(0, 10)}.md`
  const report = `# Migration Report

Data: ${new Date().toISOString()}
Modo: ${DRY ? 'DRY-RUN' : FORCE ? 'FORCE' : 'NORMAL'}

## Counts

\`\`\`json
${JSON.stringify(counts, null, 2)}
\`\`\`

${counts.errors > 0 ? `## ⚠️ Erros: ${counts.errors}\n\nVer logs do console acima.` : '✅ Sem erros.'}
`
  writeFileSync(reportPath, report, 'utf-8')
  console.info(`\n📄 Relatório: ${reportPath}`)

  if (counts.errors > 0) process.exit(1)
}

main().catch(e => {
  console.error('[migrate] FALHA GERAL:', e)
  process.exit(1)
})
