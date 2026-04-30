import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { withAudit } from '../audit'
import type { User } from '@/types'

const COL = 'users'

export async function getUser(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, COL, uid))
  if (!snap.exists()) return null
  return { uid: snap.id, ...snap.data() } as User
}

export async function listUsers(filters?: { companyId?: string }): Promise<User[]> {
  let q = query(collection(db, COL), orderBy('displayName'))
  if (filters?.companyId) {
    q = query(collection(db, COL), where('companyId', '==', filters.companyId), orderBy('displayName'))
  }
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }) as User)
}

/**
 * Cria doc users/{uid} (NÃO cria auth user — isso é responsabilidade da Cloud Function).
 * Use apenas após criação de Auth user via Admin SDK ou seed.
 */
export async function upsertUserDoc(uid: string, data: Partial<User>): Promise<void> {
  const existing = await getUser(uid)
  await withAudit(
    {
      action: existing ? 'update' : 'create',
      resource: { type: 'user', id: uid, label: data.displayName ?? data.email ?? uid },
    },
    () =>
      setDoc(
        doc(db, COL, uid),
        {
          ...data,
          uid,
          ...(existing ? {} : { createdAt: serverTimestamp(), roleVersion: 1 }),
        },
        { merge: true },
      ),
  )
}

export async function updateUserSelf(
  uid: string,
  patch: Pick<User, 'displayName' | 'avatarUrl' | 'emailNotifications'>,
): Promise<void> {
  await withAudit(
    { action: 'update', resource: { type: 'user', id: uid, label: patch.displayName ?? uid } },
    () => updateDoc(doc(db, COL, uid), patch),
  )
}
