import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Notificacao, NotificacaoType, Role } from '@/types'

const COL = 'notificacoes'

export async function listMyNotifications(uid: string, unreadOnly = false): Promise<Notificacao[]> {
  const q = query(collection(db, COL), where('recipientUid', '==', uid))
  const snap = await getDocs(q)
  let list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Notificacao)
  if (unreadOnly) list = list.filter(n => !n.read)
  return list.sort((a, b) => {
    const at = a.createdAt?.toMillis?.() ?? 0
    const bt = b.createdAt?.toMillis?.() ?? 0
    return bt - at
  })
}

export async function createNotification(params: {
  recipientUid: string
  recipientRole: Role
  type: NotificacaoType
  title: string
  body: string
  link?: string
  resource?: { type: string; id: string }
  actorName?: string
}): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...params,
    read: false,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function markRead(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), { read: true, readAt: serverTimestamp() })
}
