/**
 * Upload de anexos pros 2 RRTs + 1 Projeto da DVI Produções já existentes
 * na plataforma. Idempotente: pula arquivos cujo `filename` já existe na
 * subcoleção `anexos`.
 *
 * Uso: npx dotenv -e .env.local -- npx tsx scripts/upload-anexos-dvi.ts [--dry]
 */
import { getAdminApp, adminDb } from './lib/admin'
import { getStorage } from 'firebase-admin/storage'
import type { App } from 'firebase-admin/app'
import { withAuditServer, migrationActor } from './lib/audit-server'
import { FieldValue } from 'firebase-admin/firestore'
import { readFileSync, existsSync } from 'node:fs'
import { basename, extname } from 'node:path'
import type { AnexoCategoria } from '../src/types'

const ROOT = 'C:/Users/VICTOR/Desktop/PESSOAL/RRTS/RG'
const DRY = process.argv.includes('--dry')

interface FileSpec {
  absPath: string
  filename: string
  categoria: AnexoCategoria
}

interface Target {
  parent: 'rrts' | 'projetos'
  parentId: string
  label: string
  files: FileSpec[]
}

function fs(absPath: string, categoria: AnexoCategoria): FileSpec {
  return { absPath, filename: basename(absPath), categoria }
}

const TARGETS: Target[] = [
  // --- OC 12946 BACKROOMS SP — RRT ---
  {
    parent: 'rrts',
    parentId: 'u0yfO5I3FbHdGuzOWTOh',
    label: 'RRT OC 12946 Backrooms SP',
    files: [
      fs(`${ROOT}/Ativacao Backrooms SP - Shopping Eldorado/RRT/Backrooms-SP-RRT-PROVISORIA.pdf`, 'PROVISORIA'),
      fs(`${ROOT}/Ativacao Backrooms SP - Shopping Eldorado/RRT/Backrooms-SP-RRT-BOLETO.pdf`, 'BOLETO'),
      fs(`${ROOT}/Ativacao Backrooms SP - Shopping Eldorado/RRT/Backrooms-SP-RRT-DEFINITIVA.pdf`, 'DEFINITIVA'),
      fs(`${ROOT}/Ativacao Backrooms SP - Shopping Eldorado/PDF/OC12946 - Ativacao Backrooms SP - Shopping Eldorado - nf.pdf`, 'NF'),
    ],
  },

  // --- OC 12946 BACKROOMS SP — Projeto ---
  {
    parent: 'projetos',
    parentId: 'sBnSoUjan2DnivGSrNBQ',
    label: 'Projeto Backrooms SP',
    files: [
      fs(`${ROOT}/Ativacao Backrooms SP - Shopping Eldorado/PROJETO/Ativacao Backrooms SP - Shopping Eldorado - Projeto.pdf`, 'PROJETO'),
      fs(`${ROOT}/Ativacao Backrooms SP - Shopping Eldorado/PROJETO/Ativacao Backrooms SP - Shopping Eldorado - Projeto v2.pdf`, 'PROJETO'),
      fs(`${ROOT}/Ativacao Backrooms SP - Shopping Eldorado/PROJETO/Ativacao Backrooms SP - Shopping Eldorado - Projeto v3.pdf`, 'PROJETO'),
      fs(`${ROOT}/Ativacao Backrooms SP - Shopping Eldorado/PROJETO/13.1-MEMORIAL-DESCRITIVO-CENOGRAFIA.pdf`, 'PROJETO'),
    ],
  },

  // --- OC 12903 DIABO VESTE PRADA — RRT ---
  {
    parent: 'rrts',
    parentId: 'gIMhT0CyCw47MjKotPRM',
    label: 'RRT OC 12903 Diabo Veste Prada',
    files: [
      fs(`${ROOT}/Diabo Veste Prada 2 - Iguatemi Faria Lima/RRT/Diabo Veste Prada 2 - Iguatemi Faria Lima - RRT EXECUÇÃO - PROVISORIA.pdf`, 'PROVISORIA'),
      fs(`${ROOT}/Diabo Veste Prada 2 - Iguatemi Faria Lima/RRT/Diabo Veste Prada 2 - Iguatemi Faria Lima - RRT EXECUÇÃO - BOLETO.pdf`, 'BOLETO'),
      fs(`${ROOT}/Diabo Veste Prada 2 - Iguatemi Faria Lima/RRT/Diabo Veste Prada 2 - Iguatemi Faria Lima - RRT EXECUÇÃO - DEFINITIVA.pdf`, 'DEFINITIVA'),
      fs(`${ROOT}/Diabo Veste Prada 2 - Iguatemi Faria Lima/PDF/OC12903  - Diabo Veste Prada 2 - Iguatemi Faria Lima - NF.pdf`, 'NF'),
    ],
  },
]

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
}

async function processTarget(t: Target, app: App) {
  const db = adminDb()
  const storage = getStorage(app)
  const bucket = storage.bucket('rrt-vault.firebasestorage.app')

  console.log(`\n=== ${t.label} (${t.parent}/${t.parentId}) ===`)
  const anexosRef = db.collection(t.parent).doc(t.parentId).collection('anexos')
  const existing = await anexosRef.get()
  const existingNames = new Set(
    existing.docs.map(d => String(d.data().filename ?? '').toLowerCase()),
  )

  for (const f of t.files) {
    const exists = existsSync(f.absPath)
    if (!exists) {
      console.log(`  [skip] arquivo local não encontrado: ${f.filename}`)
      continue
    }
    if (existingNames.has(f.filename.toLowerCase())) {
      console.log(`  [skip] já existe na plataforma: ${f.filename}`)
      continue
    }

    const ext = extname(f.absPath).toLowerCase()
    const mime = MIME[ext] ?? 'application/octet-stream'
    const buf = readFileSync(f.absPath)
    const size = buf.byteLength
    const storagePath = `${t.parent}/${t.parentId}/${f.categoria}/${Date.now()}-${f.filename}`

    if (DRY) {
      console.log(`  [DRY] ${f.filename} (${(size / 1024).toFixed(1)} KB) → ${storagePath}`)
      continue
    }

    // Upload pro Storage
    const file = bucket.file(storagePath)
    await file.save(buf, { contentType: mime })

    // Firestore doc
    await withAuditServer(
      db,
      migrationActor('upload-anexos-dvi@1'),
      {
        action: 'upload',
        resource: { type: 'anexo', id: f.filename, label: `${t.label}: ${f.filename}` },
      },
      async () => {
        await anexosRef.add({
          storagePath,
          filename: f.filename,
          mimeType: mime,
          size,
          uploadedBy: 'migration',
          uploadedByName: 'Migration Script',
          uploadedAt: FieldValue.serverTimestamp(),
          categoria: f.categoria,
          descricao: '',
          visibleToClient: true,
        })
      },
    )

    console.log(`  [OK]   ${f.filename} (${(size / 1024).toFixed(1)} KB) [${f.categoria}]`)
  }
}

async function main() {
  const app = getAdminApp()
  if (DRY) console.log('— DRY RUN, nada será gravado —')
  for (const t of TARGETS) await processTarget(t, app)
  console.log('\nFeito.')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
