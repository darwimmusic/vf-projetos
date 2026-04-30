/**
 * Migração one-shot: NF do Backrooms saiu junto (R$ 824,60).
 * Projeto vira principal, RRT entra como consolidada.
 *   - Projeto.valor = 82460 (R$ 824,60 = total real da NF)
 *   - Projeto.billingConsolidates = ['rrt:<rrt-id>']
 *   - Projeto.status = NF_EMITIDA (já tem NF)
 *   - RRT.billingPrincipalId = 'projeto:<projeto-id>'
 */
import { getAdminApp, adminDb } from './lib/admin'
import { withAuditServer, migrationActor } from './lib/audit-server'
import { FieldValue } from 'firebase-admin/firestore'

async function main() {
  console.info('[fix-backrooms-billing] iniciando…')
  getAdminApp('default', 'FIREBASE_SERVICE_ACCOUNT_NEW')
  const db = adminDb()

  // Acha RRT do Backrooms (OC 12946)
  const rrtSnap = await db.collection('rrts').where('oc', '==', '12946').limit(1).get()
  if (rrtSnap.empty) throw new Error('RRT Backrooms (OC 12946) não encontrada')
  const rrtDoc = rrtSnap.docs[0]
  const rrtId = rrtDoc.id

  // Acha Projeto Backrooms (mesma OC, vinculado à RRT)
  const projSnap = await db
    .collection('projetos')
    .where('oc', '==', '12946')
    .limit(1)
    .get()
  if (projSnap.empty) throw new Error('Projeto Backrooms (OC 12946) não encontrado')
  const projDoc = projSnap.docs[0]
  const projetoId = projDoc.id

  console.info(`  RRT:     ${rrtId}`)
  console.info(`  Projeto: ${projetoId}`)

  const actor = migrationActor('fix-backrooms-billing')

  await withAuditServer(
    db,
    actor,
    {
      action: 'update',
      resource: { type: 'projeto', id: projetoId, label: 'Backrooms — consolidação' },
      metadata: { notes: 'NF de R$ 824,60 cobre Projeto + RRT' },
    },
    async () => {
      await db.collection('projetos').doc(projetoId).update({
        valor: 82460, // R$ 824,60
        status: 'PAGO' === projDoc.data().status ? 'PAGO' : 'ENTREGUE', // mantém se já estava pago
        billingConsolidates: [`rrt:${rrtId}`],
        updatedAt: FieldValue.serverTimestamp(),
      })
    },
  )

  await withAuditServer(
    db,
    actor,
    {
      action: 'update',
      resource: { type: 'rrt', id: rrtId, label: 'Backrooms — RRT consolidada' },
      metadata: { notes: `Faturada via projeto:${projetoId}` },
    },
    async () => {
      await db.collection('rrts').doc(rrtId).update({
        billingPrincipalId: `projeto:${projetoId}`,
        updatedAt: FieldValue.serverTimestamp(),
      })
    },
  )

  console.info('\n✅ Backrooms consolidado.')
  console.info(`   Projeto agora vale R$ 824,60 (NF total)`)
  console.info(`   RRT marcada como consolidada — não soma no financeiro`)
  console.info(`   Painel: https://vf-projetos.vercel.app/admin/projetos/${projetoId}`)
}

main().catch(e => {
  console.error('[fix] FALHA:', e)
  process.exit(1)
})
