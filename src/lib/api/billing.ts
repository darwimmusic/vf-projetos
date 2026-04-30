import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { withAudit } from '../audit'
import type { BillingRef } from '@/types'

export type EntityType = 'rrt' | 'projeto'

function refToParts(ref: BillingRef): { type: EntityType; id: string } {
  const [type, id] = ref.split(':')
  return { type: type as EntityType, id }
}

const COL: Record<EntityType, string> = {
  rrt: 'rrts',
  projeto: 'projetos',
}

/**
 * Consolida faturamento: marca `principal` como detentor da NF,
 * e marca cada `child` como `billingPrincipalId = principal`.
 * Atômico — todos os updates numa transação.
 */
export async function consolidateBilling(
  principal: { type: EntityType; id: string; label: string },
  children: BillingRef[],
): Promise<void> {
  if (children.length === 0) throw new Error('Selecione ao menos 1 item para consolidar.')

  const principalRef: BillingRef = `${principal.type}:${principal.id}`

  await withAudit(
    {
      action: 'update',
      resource: { type: principal.type, id: principal.id, label: principal.label },
      metadata: { notes: `Consolidação de faturamento: ${children.join(', ')}` },
    },
    async () => {
      await runTransaction(db, async tx => {
        // Lê todos os children
        const childSnaps = await Promise.all(
          children.map(c => {
            const { type, id } = refToParts(c)
            return tx.get(doc(db, COL[type], id))
          }),
        )

        // Valida: nenhum child já consolidado em outro lugar
        for (let i = 0; i < childSnaps.length; i++) {
          const snap = childSnaps[i]
          if (!snap.exists()) throw new Error(`Item ${children[i]} não encontrado`)
          const existing = snap.data()?.billingPrincipalId
          if (existing && existing !== principalRef) {
            throw new Error(`Item ${children[i]} já consolidado em ${existing}`)
          }
        }

        // Atualiza principal
        const principalDocRef = doc(db, COL[principal.type], principal.id)
        const principalSnap = await tx.get(principalDocRef)
        if (!principalSnap.exists()) throw new Error('Item principal não encontrado')

        const existingConsolidates = (principalSnap.data()?.billingConsolidates ?? []) as BillingRef[]
        const merged = Array.from(new Set([...existingConsolidates, ...children]))

        tx.update(principalDocRef, {
          billingConsolidates: merged,
          updatedAt: serverTimestamp(),
        })

        // Atualiza children
        for (let i = 0; i < children.length; i++) {
          const { type, id } = refToParts(children[i])
          tx.update(doc(db, COL[type], id), {
            billingPrincipalId: principalRef,
            updatedAt: serverTimestamp(),
          })
        }
      })
    },
  )
}

/**
 * Remove um child da consolidação.
 */
export async function unconsolidate(
  principal: { type: EntityType; id: string; label: string },
  child: BillingRef,
): Promise<void> {
  const principalRef: BillingRef = `${principal.type}:${principal.id}`

  await withAudit(
    {
      action: 'update',
      resource: { type: principal.type, id: principal.id, label: principal.label },
      metadata: { notes: `Remoção de consolidação: ${child}` },
    },
    async () => {
      await runTransaction(db, async tx => {
        const principalDocRef = doc(db, COL[principal.type], principal.id)
        const principalSnap = await tx.get(principalDocRef)
        if (!principalSnap.exists()) throw new Error('Principal não encontrado')

        const existing = (principalSnap.data()?.billingConsolidates ?? []) as BillingRef[]
        const filtered = existing.filter(r => r !== child)

        tx.update(principalDocRef, {
          billingConsolidates: filtered,
          updatedAt: serverTimestamp(),
        })

        const { type, id } = refToParts(child)
        const childRef = doc(db, COL[type], id)
        const childSnap = await tx.get(childRef)
        if (childSnap.exists() && childSnap.data()?.billingPrincipalId === principalRef) {
          tx.update(childRef, {
            billingPrincipalId: null,
            updatedAt: serverTimestamp(),
          })
        }
      })
    },
  )
}

/** Resolve label de um BillingRef pra exibição. */
export async function resolveLabel(ref: BillingRef): Promise<string> {
  const { type, id } = refToParts(ref)
  const snap = await getDoc(doc(db, COL[type], id))
  if (!snap.exists()) return ref
  const data = snap.data()
  if (type === 'rrt') return `RRT ${data.numeroRRT ?? id.slice(0, 6)}`
  return `Projeto ${data.nome ?? id.slice(0, 6)}`
}
