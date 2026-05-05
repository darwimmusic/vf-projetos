/**
 * Lista todos os RRTs e Projetos com seus anexos atuais.
 * Uso: npx dotenv -e .env.local -- npx tsx scripts/inspect-rrts-projetos.ts
 */
import { getAdminApp, adminDb } from './lib/admin'

async function main() {
  getAdminApp()
  const db = adminDb()

  const companies = await db.collection('companies').get()
  const cmap = new Map<string, string>()
  companies.forEach(c => cmap.set(c.id, String(c.data().slug ?? c.id)))

  console.log('\n=== RRTs ===')
  const rrts = await db.collection('rrts').orderBy('dataCriacao', 'desc').get()
  for (const r of rrts.docs) {
    const d = r.data()
    const anexosSnap = await db.collection('rrts').doc(r.id).collection('anexos').get()
    const cats = anexosSnap.docs.map(a => a.data().categoria ?? '?').join(',') || '∅'
    console.log(
      `  ${cmap.get(d.companyId) ?? '?'}/${r.id}  oc=${d.oc ?? '-'}  status=${d.status}  numeroRRT=${d.numeroRRT ?? '-'}  anexos=[${cats}]`,
    )
  }

  console.log('\n=== PROJETOS ===')
  const projs = await db.collection('projetos').orderBy('dataCriacao', 'desc').get()
  for (const p of projs.docs) {
    const d = p.data()
    const anexosSnap = await db.collection('projetos').doc(p.id).collection('anexos').get()
    const cats = anexosSnap.docs.map(a => a.data().categoria ?? '?').join(',') || '∅'
    console.log(
      `  ${cmap.get(d.companyId) ?? '?'}/${p.id}  nome="${d.nome}"  oc=${d.oc ?? '-'}  status=${d.status}  anexos=[${cats}]`,
    )
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
