/**
 * Import específico: 2 RRTs reais sob a empresa DVI Produções e Eventos.
 *
 * - Cria company "DVI Produções e Eventos" se não existir
 * - Cria 2 RRTs com status NF_EMITIDA (todos os PDFs já foram gerados)
 * - Faz upload de TODOS os PDFs (provisória, boleto, definitiva, NF) como anexos
 *
 * Uso: npm run import:rrts-dvi
 */
import { getAdminApp, adminDb } from './lib/admin'
import { getStorage } from 'firebase-admin/storage'
import { withAuditServer, migrationActor } from './lib/audit-server'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, basename, extname } from 'node:path'

const DVI_NAME = 'DVI Produções e Eventos'
const DVI_SLUG = 'dvi'
const DVI_CNPJ = '18285404000134'
const DVI_EMAIL = 'pp@rgproducoes.com.br'

interface RRTInput {
  folderPath: string
  contratante: string
  cnpjContratante: string
  oc: string
  descricao: string
  evento: string
  local: string
  cep: string
  enderecoCompleto: string
  valorBrutoCentavos: number
  taxaCAUCentavos: number
  boletoPorMim: boolean // true se cobrou bruto, false se cobrou líquido
  dataMontagem?: Date
  dataEvento?: Date
  dataDesmontagem?: Date
}

const RRTS: RRTInput[] = [
  {
    folderPath: 'C:/Users/VICTOR/Desktop/PESSOAL/RRTS/RG/Diabo Veste Prada 2 - Iguatemi Faria Lima',
    contratante: 'Iguatemi Empresa de Shopping Centers S/A',
    cnpjContratante: '53991378000160',
    oc: '12903',
    descricao:
      'Sessão Especial - O Diabo Veste Prada 2 - Iguatemi Faria Lima. Estrutura cenográfica (backdrop fotográfico + balcão de apoio) montada no foyer para sessão especial de pré-estreia. Edificação efêmera, estrutura metálica, estruturas mistas, estrutura de madeira.',
    evento: 'Sessão Especial - O Diabo Veste Prada 2',
    local: 'Iguatemi Faria Lima',
    cep: '01451-000',
    enderecoCompleto: 'Av. Brig. Faria Lima, 2232, Jardim Paulistano, São Paulo/SP',
    valorBrutoCentavos: 45000, // R$ 450,00
    taxaCAUCentavos: 13064, // R$ 130,64
    boletoPorMim: false, // RG/DVI paga o boleto separado
    dataMontagem: new Date('2026-04-29T22:00:00-03:00'),
    dataEvento: new Date('2026-04-30T09:00:00-03:00'),
  },
  {
    folderPath: 'C:/Users/VICTOR/Desktop/PESSOAL/RRTS/RG/Ativacao Backrooms SP - Shopping Eldorado',
    contratante: 'WMIX Distribuidora LTDA',
    cnpjContratante: '03918609000132',
    oc: '12946',
    descricao:
      'Ativação Backrooms SP - Shopping Eldorado. Estrutura tipo caixa cenográfica ("corredor Backrooms") em box truss Q15 com fechamento em lona impressa frente e verso, iluminação LED 5 plafons, instalação elétrica 220V monofásico 500W. Atividades: edificação efêmera, estruturas mistas, estrutura metálica, instalações elétricas baixa tensão, luminotecnia.',
    evento: 'Ativação Backrooms SP',
    local: 'Shopping Eldorado',
    cep: '05402-600',
    enderecoCompleto: 'Av. Rebouças, 3970, Pinheiros, São Paulo/SP',
    valorBrutoCentavos: 45000, // RRT cobrada R$450 (RG produções é separado)
    taxaCAUCentavos: 12540, // R$ 125,40
    boletoPorMim: false,
    dataMontagem: new Date('2026-05-03T22:00:00-03:00'),
    dataEvento: new Date('2026-05-04T00:00:00-03:00'),
    dataDesmontagem: new Date('2026-06-04T22:00:00-03:00'),
  },
]

function normalizeCnpj(s: string): string {
  return s.replace(/\D/g, '')
}

async function findOrCreateDVI(db: FirebaseFirestore.Firestore): Promise<string> {
  const snap = await db.collection('companies').where('cnpj', '==', DVI_CNPJ).limit(1).get()
  if (!snap.empty) {
    console.info(`[dvi] empresa já existe: ${snap.docs[0].id}`)
    return snap.docs[0].id
  }

  const ref = await db.collection('companies').add({
    name: DVI_NAME,
    slug: DVI_SLUG,
    cnpj: DVI_CNPJ,
    contactEmail: DVI_EMAIL,
    prazoNF: 10,
    ownerId: '',
    active: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  console.info(`[dvi] empresa criada: ${ref.id}`)
  return ref.id
}

async function uploadAnexo(
  db: FirebaseFirestore.Firestore,
  rrtId: string,
  _rrtLabel: string,
  filePath: string,
  categoria: 'PROVISORIA' | 'BOLETO' | 'DEFINITIVA' | 'NF' | 'PROJETO' | 'OUTRO',
): Promise<void> {
  const filename = basename(filePath)
  const buffer = readFileSync(filePath)
  const ext = extname(filename).toLowerCase()
  const contentType = ext === '.pdf' ? 'application/pdf' : 'application/octet-stream'

  const storagePath = `rrts/${rrtId}/${categoria}/${filename}`
  const bucket = getStorage(adminApp).bucket('rrt-vault.firebasestorage.app')
  const file = bucket.file(storagePath)
  await file.save(buffer, {
    contentType,
    metadata: {
      contentType,
      metadata: { entityType: 'rrt', entityId: rrtId, categoria },
    },
  })

  // Cria doc anexo na subcoleção
  await db.collection('rrts').doc(rrtId).collection('anexos').add({
    storagePath,
    filename,
    mimeType: contentType,
    size: buffer.length,
    uploadedBy: 'migration',
    uploadedByName: 'Import Script',
    uploadedAt: FieldValue.serverTimestamp(),
    categoria,
    descricao: `Importado de ${filePath.split('\\').slice(-3).join('/')}`,
    visibleToClient: true,
  })

  console.info(`  ✓ ${categoria}: ${filename} (${(buffer.length / 1024).toFixed(0)}KB)`)
}

async function importRRT(
  db: FirebaseFirestore.Firestore,
  companyId: string,
  input: RRTInput,
): Promise<void> {
  const valorLiquido = input.valorBrutoCentavos - input.taxaCAUCentavos
  const valorCobradoCliente = input.boletoPorMim ? input.valorBrutoCentavos : valorLiquido

  const rrtData: Record<string, unknown> = {
    companyId,
    companyName: DVI_NAME,
    empresaFaturamento: DVI_NAME,
    cnpjFaturamento: DVI_CNPJ,
    contratante: input.contratante,
    cnpjContratante: normalizeCnpj(input.cnpjContratante),
    oc: input.oc,
    descricao: input.descricao,
    evento: input.evento,
    local: input.local,
    cep: input.cep,
    enderecoCompleto: input.enderecoCompleto,
    valorBruto: input.valorBrutoCentavos,
    taxaCAU: input.taxaCAUCentavos,
    valorLiquido,
    valorCobradoCliente,
    boletoPorMim: input.boletoPorMim,
    status: 'NF_EMITIDA', // todos os PDFs estão prontos = NF emitida
    dataCriacao: input.dataMontagem ? Timestamp.fromDate(input.dataMontagem) : FieldValue.serverTimestamp(),
    dataBoleto: input.dataMontagem ? Timestamp.fromDate(input.dataMontagem) : FieldValue.serverTimestamp(),
    dataDefinitiva: input.dataMontagem ? Timestamp.fromDate(input.dataMontagem) : FieldValue.serverTimestamp(),
    dataNF: input.dataMontagem ? Timestamp.fromDate(input.dataMontagem) : FieldValue.serverTimestamp(),
    ...(input.dataMontagem && { dataMontagem: Timestamp.fromDate(input.dataMontagem) }),
    ...(input.dataEvento && { dataEvento: Timestamp.fromDate(input.dataEvento) }),
    ...(input.dataDesmontagem && { dataDesmontagem: Timestamp.fromDate(input.dataDesmontagem) }),
    createdBy: 'migration',
    updatedAt: FieldValue.serverTimestamp(),
  }

  const ref = await withAuditServer(
    db,
    migrationActor('import-rrts-dvi'),
    {
      action: 'create',
      resource: { type: 'rrt', id: 'pending', label: input.evento },
    },
    async () => db.collection('rrts').add(rrtData),
  )

  console.info(`\n[rrt] criada: ${input.evento} (${ref.id})`)

  // Upload anexos
  const rrtFolder = resolve(input.folderPath, 'RRT')
  const pdfFolder = resolve(input.folderPath, 'PDF')
  const projetoFolder = resolve(input.folderPath, 'PROJETO')

  // RRT/ — PROVISORIA, BOLETO, DEFINITIVA
  if (existsSync(rrtFolder)) {
    for (const f of readdirSync(rrtFolder)) {
      if (!f.toLowerCase().endsWith('.pdf')) continue
      const fpath = resolve(rrtFolder, f)
      const upper = f.toUpperCase()
      let cat: 'PROVISORIA' | 'BOLETO' | 'DEFINITIVA' | 'OUTRO' = 'OUTRO'
      if (upper.includes('PROVISOR')) cat = 'PROVISORIA'
      else if (upper.includes('BOLETO')) cat = 'BOLETO'
      else if (upper.includes('DEFINITIVA')) cat = 'DEFINITIVA'
      await uploadAnexo(db, ref.id, input.evento, fpath, cat)
    }
  }

  // PDF/ — NF
  if (existsSync(pdfFolder)) {
    for (const f of readdirSync(pdfFolder)) {
      if (!f.toLowerCase().endsWith('.pdf')) continue
      const fpath = resolve(pdfFolder, f)
      const cat: 'NF' | 'OUTRO' = f.toLowerCase().includes('nf') ? 'NF' : 'OUTRO'
      await uploadAnexo(db, ref.id, input.evento, fpath, cat)
    }
  }

  // PROJETO/ — uploads de imagens/PDFs do projeto técnico (skip .skp e .layout)
  if (existsSync(projetoFolder)) {
    for (const f of readdirSync(projetoFolder)) {
      const ext = extname(f).toLowerCase()
      if (!['.pdf', '.png', '.jpg', '.jpeg', '.webp'].includes(ext)) continue
      const fpath = resolve(projetoFolder, f)
      await uploadAnexo(db, ref.id, input.evento, fpath, 'PROJETO')
    }
  }
}

let adminApp: import('firebase-admin/app').App

async function main() {
  console.info('[import-rrts-dvi] iniciando…')
  adminApp = getAdminApp('default', 'FIREBASE_SERVICE_ACCOUNT_NEW')
  const db = adminDb()

  // Limpa RRTs já importadas pra rodar idempotente (1ª RRT do run anterior ficou órfã)
  const orphanSnap = await db.collection('rrts').where('createdBy', '==', 'migration').get()
  if (orphanSnap.size > 0) {
    console.info(`[cleanup] removendo ${orphanSnap.size} RRTs órfãs do run anterior`)
    for (const doc of orphanSnap.docs) {
      // Deleta também subcoleção anexos
      const anexosSnap = await doc.ref.collection('anexos').get()
      for (const a of anexosSnap.docs) await a.ref.delete()
      await doc.ref.delete()
    }
  }

  const companyId = await findOrCreateDVI(db)

  for (const input of RRTS) {
    await importRRT(db, companyId, input)
  }

  console.info('\n✅ Import completo.')
  console.info(`   Login no painel: https://vf-projetos.vercel.app/admin/clientes/${companyId}`)
}

main().catch(e => {
  console.error('[import] FALHA:', e)
  process.exit(1)
})
