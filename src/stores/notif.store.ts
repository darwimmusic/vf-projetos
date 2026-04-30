import { create } from 'zustand'
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from './auth.store'
import { markRead } from '@/lib/api/notificacoes'
import type { Notificacao } from '@/types'

interface NotifState {
  list: Notificacao[]
  unreadCount: number
  unsubscribe: Unsubscribe | null
  start(uid: string): void
  stop(): void
  markRead(id: string): Promise<void>
}

export const useNotifStore = create<NotifState>((set, get) => ({
  list: [],
  unreadCount: 0,
  unsubscribe: null,

  start(uid) {
    get().stop()
    const q = query(
      collection(db, 'notificacoes'),
      where('recipientUid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(20),
    )
    const unsub = onSnapshot(
      q,
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Notificacao)
        set({ list, unreadCount: list.filter(n => !n.read).length })
      },
      err => {
        console.warn('[notif.store] subscription error:', err.message)
      },
    )
    set({ unsubscribe: unsub })
  },

  stop() {
    const u = get().unsubscribe
    if (u) {
      u()
      set({ unsubscribe: null, list: [], unreadCount: 0 })
    }
  },

  async markRead(id) {
    await markRead(id)
  },
}))

// Auto-start quando user loga
useAuthStore.subscribe(state => {
  const notifStore = useNotifStore.getState()
  if (state.user?.uid && state.user.role === 'admin') {
    notifStore.start('admin') // admin = inbox compartilhado por hora
  } else if (state.user?.uid) {
    notifStore.start(state.user.uid)
  } else {
    notifStore.stop()
  }
})
