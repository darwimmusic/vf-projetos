/**
 * Wrapper server-side de audit (FW-AUDIT-LOG §3.1.B v1.1).
 * Usado em scripts e Cloud Functions onde Zustand não existe.
 */
import { FieldValue, type Firestore } from 'firebase-admin/firestore'

export interface ServerActor {
  uid: string
  email: string
  role: 'admin' | 'company_owner' | 'company_member' | 'system'
  displayName: string
  companyId: string | null
  companyName: string | null
}

interface AuditParams {
  action: string
  resource: { type: string; id: string; label: string }
  diff?: { before: object; after: object; fields: string[] }
  metadata?: { ip?: string; userAgent?: string; notes?: string }
}

export async function withAuditServer<T>(
  db: Firestore,
  actor: ServerActor,
  params: AuditParams,
  operation: () => Promise<T>,
): Promise<T> {
  const result = await operation()
  try {
    await db.collection('audit_logs').add({
      timestamp: FieldValue.serverTimestamp(),
      actor: { ...actor },
      ...params,
    })
  } catch (e) {
    console.error('[AUDIT_FAIL_SERVER]', { actor, params, error: e })
  }
  return result
}

export const SYSTEM_ACTOR: ServerActor = {
  uid: 'system',
  email: 'system@vf-projetos',
  role: 'system',
  displayName: 'Sistema VF·PROJETOS',
  companyId: null,
  companyName: null,
}

export function migrationActor(scriptVersion: string): ServerActor {
  return {
    uid: 'migration',
    email: 'migration@vf-projetos',
    role: 'system',
    displayName: `Migration Script ${scriptVersion}`,
    companyId: null,
    companyName: null,
  }
}
