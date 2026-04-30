import {
  addDoc,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  type DocumentReference,
  type Transaction,
} from 'firebase/firestore'
import { db } from './firebase'
import { useAuthStore } from '@/stores/auth.store'
import type { AuditAction, AuditResourceType } from '@/types'

interface AuditParams {
  action: AuditAction
  resource: { type: AuditResourceType; id: string; label: string }
  diff?: { before: object; after: object; fields: string[] }
  metadata?: { ip?: string; userAgent?: string; notes?: string }
}

/**
 * Wrapper best-effort. Operação executa primeiro; log em try/catch isolado.
 * Falha de log gera console.error mas NÃO derruba operação.
 *
 * Use {@link withAuditTransaction} para mutations críticas (lista em FW-AUDIT-LOG §3.2).
 */
export async function withAudit<T>(params: AuditParams, operation: () => Promise<T>): Promise<T> {
  const user = useAuthStore.getState().user
  if (!user) throw new Error('Audit: usuário não autenticado')

  const result = await operation()

  try {
    await addDoc(collection(db, 'audit_logs'), {
      timestamp: serverTimestamp(),
      actor: {
        uid: user.uid,
        email: user.email,
        role: user.role,
        displayName: user.displayName,
        companyId: user.companyId ?? null,
        companyName: user.companyName ?? null,
      },
      ...params,
    })
  } catch (e) {
    console.error('[AUDIT_FAIL]', { params, error: e })
  }

  return result
}

/**
 * Versão transacional — usar em mutations onde audit-loss é juridicamente grave.
 * Lista canônica: delete de company/rrt/projeto, mudança de role, deactivation de user.
 *
 * @param params metadados do log
 * @param mutate callback que recebe a Transaction e o ref do log a criar
 */
export async function withAuditTransaction<T>(
  params: AuditParams,
  mutate: (tx: Transaction, auditRef: DocumentReference) => Promise<T>,
): Promise<T> {
  const user = useAuthStore.getState().user
  if (!user) throw new Error('Audit: usuário não autenticado')

  return runTransaction(db, async tx => {
    const auditRef = doc(collection(db, 'audit_logs'))
    const result = await mutate(tx, auditRef)

    tx.set(auditRef, {
      timestamp: serverTimestamp(),
      actor: {
        uid: user.uid,
        email: user.email,
        role: user.role,
        displayName: user.displayName,
        companyId: user.companyId ?? null,
        companyName: user.companyName ?? null,
      },
      ...params,
    })

    return result
  })
}
