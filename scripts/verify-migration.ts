/**
 * Verifica integridade pós-migration: contagens batem.
 * Uso: npm run migrate:verify
 */
import { getAdminApp, adminDb } from './lib/admin'

async function main() {
  getAdminApp('legacy', 'FIREBASE_SERVICE_ACCOUNT_OLD')
  getAdminApp('new', 'FIREBASE_SERVICE_ACCOUNT_NEW')
  const legacyDb = adminDb('legacy')
  const newDb = adminDb('new')

  console.info('[verify] contando docs…')

  const [legacyRrts, legacyProjs] = await Promise.all([
    legacyDb.collection('rrts').count().get(),
    legacyDb
      .collection('projetos')
      .count()
      .get()
      .catch(() => ({ data: () => ({ count: 0 }) })),
  ])

  const [newRrts, newProjs] = await Promise.all([
    newDb.collection('rrts').where('legacyId', '!=', null).count().get(),
    newDb.collection('projetos').where('legacyId', '!=', null).count().get(),
  ])

  const lr = legacyRrts.data().count
  const lp = legacyProjs.data().count
  const nr = newRrts.data().count
  const np = newProjs.data().count

  console.info(`\n  RRTs:     legacy=${lr}  new=${nr}  diff=${nr - lr}`)
  console.info(`  Projetos: legacy=${lp}  new=${np}  diff=${np - lp}\n`)

  if (nr !== lr || np !== lp) {
    console.error('⚠️  Contagens divergem. Investigar logs ou rodar `npm run migrate -- --force`.')
    process.exit(1)
  }

  console.info('✅ Migration íntegra.')
}

main().catch(e => {
  console.error('[verify] FALHA:', e)
  process.exit(1)
})
