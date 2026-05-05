/**
 * Lista o storagePath de cada anexo + verifica se a 2ª "pasta" do path bate
 * com a categoria — Storage rules usam a categoria do path pra autorizar.
 */
import { getAdminApp, adminDb } from './lib/admin'

async function main() {
  getAdminApp()
  const db = adminDb()

  for (const parent of ['rrts', 'projetos'] as const) {
    const parents = await db.collection(parent).get()
    for (const p of parents.docs) {
      const anexosSnap = await db.collection(parent).doc(p.id).collection('anexos').get()
      for (const a of anexosSnap.docs) {
        const d = a.data()
        const path = String(d.storagePath ?? '')
        const segs = path.split('/')
        // esperado: parent/parentId/category/filename
        const pathCategory = segs[2] ?? '∅'
        const okShape = segs[0] === parent && segs[1] === p.id
        const flag = okShape ? '' : '⚠SHAPE '
        console.log(`  ${flag}${parent}/${p.id}  cat=${d.categoria ?? '-'}  pathCat=${pathCategory}  path=${path}`)
      }
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
