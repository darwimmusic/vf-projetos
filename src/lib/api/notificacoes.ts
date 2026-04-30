import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Notificacao, NotificacaoType, Role } from '@/types'

const COL = 'notificacoes'

export async function listMyNotifications(uid: string, unreadOnly = false): Promise<Notificacao[]> {
  let q = query(
    collection(db, COL),
    where('recipientUid', '==', uid),
    orderBy('createdAt', 'desc'),
  )
  if (unreadOnly) {
    q = query(
      collection(db, COL),
      where('recipientUid', '==', uid),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
    )
  }
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Notificacao)
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
