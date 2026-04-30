/**
 * Adiciona o Projeto técnico (RG Produções) do Backrooms — R$ 500.
 * Separado da RRT, vinculado à mesma empresa DVI.
 */
import { getAdminApp, adminDb } from './lib/admin'
import { getStorage } from 'firebase-admin/storage'
import { withAuditServer, migrationActor } from './lib/audit-server'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, basename, extname } from 'node:path'

const DVI_CNPJ = '18285404000134'

let adminApp: import('firebase-admin/app').App

async function uploadAnexo(
  db: FirebaseFirestore.Firestore,
  parentId: string,
  filePath: string,
): Promise<void> {
  const filename = basename(filePath)
  const buffer = readFileSync(filePath)
  const storagePath = `projetos/${parentId}/PROJETO/${filename}`
  const bucket = getStorage(adminApp).bucket('rrt-vault.firebasestorage.app')
  await bucket.file(storagePath).save(buffer, {
    contentType: 'application/pdf',
    metadata: { contentType: 'application/pdf', metadata: { entityType: 'projeto', entityId: parentId } },
  })

  await db.collection('projetos').doc(parentId).collection('anexos').add({
    storagePath,
    filename,
    mimeType: 'application/pdf',
    size: buffer.length,
    uploadedBy: 'migration',
    uploadedByName: 'Import Script',
    uploadedAt: FieldValue.serverTimestamp(),
    categoria: 'PROJETO',
    descricao: 'Projeto técnico RG Produções',
    visibleToClient: true,
  })

  console.info(`  ✓ ${filename} (${(buffer.length / 1024).toFixed(0)}KB)`)
}

async function main() {
  console.info('[import-backrooms-projeto] iniciando…')
  adminApp = getAdminApp('default', 'FIREBASE_SERVICE_ACCOUNT_NEW')
  const db = adminDb()

  // Acha empresa DVI
  const compSnap = await db.collection('companies').where('cnpj', '==', DVI_CNPJ).limit(1).get()
  if (compSnap.empty) throw new Error('Empresa DVI não encontrada — rode npm run import:rrts-dvi antes')
  const company = compSnap.docs[0]
  const companyId = company.id
  const companyName = (company.data() as { name: string }).name

  // Acha RRT do Backrooms (pelo OC) pra vincular
  const rrtSnap = await db.collection('rrts').where('oc', '==', '12946').limit(1).get()
  const rrtId = rrtSnap.empty ? undefined : rrtSnap.docs[0].id

  const folderPath = 'C:/Users/VICTOR/Desktop/PESSOAL/RRTS/RG/Ativacao Backrooms SP - Shopping Eldorado'

  // Cria Projeto técnico de R$ 500
  const projetoData: Record<string, unknown> = {
    companyId,
    companyName,
    nome: 'Projeto Técnico - Ativação Backrooms SP',
    descricao:
      'Projeto técnico (RG Produções): plantas, perspectivas, memorial descritivo de cenografia e iluminação para Ativação Backrooms SP no Shopping Eldorado.',
    oc: '12946',
    empresaFaturamento: companyName,
    cnpjFaturamento: DVI_CNPJ,
    valor: 50000, // R$ 500,00 em centavos
    status: 'ENTREGUE', // já entregue (PDFs prontos)
    local: 'Shopping Eldorado',
    endereco: {
      logradouro: 'Av. Rebouças',
      numero: '3970',
      bairro: 'Pinheiros',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '05402-600',
    },
    dataMontagem: Timestamp.fromDate(new Date('2026-05-03T22:00:00-03:00')),
    dataEvento: Timestamp.fromDate(new Date('2026-05-04T00:00:00-03:00')),
    dataDesmontagem: Timestamp.fromDate(new Date('2026-06-04T22:00:00-03:00')),
    dataEntrega: Timestamp.fromDate(new Date('2026-04-29T00:00:00-03:00')),
    rrtIds: rrtId ? [rrtId] : [],
    tags: ['rg-producoes', 'projeto-tecnico'],
    createdBy: 'migration',
    dataCriacao: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }

  const ref = await withAuditServer(
    db,
    migrationActor('import-backrooms-projeto'),
    {
      action: 'create',
      resource: { type: 'projeto', id: 'pending', label: 'Projeto Técnico Backrooms SP' },
    },
    async () => db.collection('projetos').add(projetoData),
  )

  console.info(`\n[projeto] criado: ${ref.id}`)
  console.info(`           valor: R$ 500,00 · status: ENTREGUE`)
  if (rrtId) console.info(`           vinculado à RRT: ${rrtId}`)

  // Vincula RRT → Projeto também (back-reference)
  if (rrtId) {
    await db.collection('rrts').doc(rrtId).update({ projetoId: ref.id })
    console.info(`           RRT atualizada com projetoId`)
  }

  // Upload do PDF do projeto técnico (apenas o PDF principal)
  const projetoFolder = resolve(folderPath, 'PROJETO')
  if (existsSync(projetoFolder)) {
    for (const f of readdirSync(projetoFolder)) {
      const ext = extname(f).toLowerCase()
      // Apenas PDFs — skipa .skp, .layout, .jpg/.png (que ficam só no escopo da RRT)
      if (ext !== '.pdf') continue
      await uploadAnexo(db, ref.id, resolve(projetoFolder, f))
    }
  }

  console.info('\n✅ Projeto Backrooms importado.')
  console.info(`   Painel: https://vf-projetos.vercel.app/admin/projetos/${ref.id}`)
}

main().catch(e => {
  console.error('[import] FALHA:', e)
  process.exit(1)
})
