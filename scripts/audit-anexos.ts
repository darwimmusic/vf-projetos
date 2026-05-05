/**
 * Lista todos anexos (rrts + projetos) com status do campo visibleToClient
 * pra detectar legacy docs que perderiam visibilidade pelas rules novas.
 */
import { getAdminApp, adminDb } from './lib/admin'

async function main() {
  getAdminApp()
  const db = adminDb()

  for (const parent of ['rrts', 'projetos'] as const) {
    console.log(`\n=== ${parent.toUpperCase()} anexos ===`)
    const parents = await db.collection(parent).get()
    for (const p of parents.docs) {
      const anexosSnap = await db.collection(parent).doc(p.id).collection('anexos').get()
      if (anexosSnap.empty) continue
      console.log(`  ${parent}/${p.id} (${anexosSnap.size} anexos):`)
      for (const a of anexosSnap.docs) {
        const d = a.data()
        const v = d.visibleToClient
        const flag = v === true ? '✓visible' : v === false ? '✗hidden' : '⚠undefined'
        console.log(`    [${flag}] ${d.filename} (cat=${d.categoria ?? '-'})`)
      }
    }
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
