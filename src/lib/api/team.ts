/**
 * Multi-tenant: gestão de sub-users dentro de uma empresa.
 * Owner cria/desativa company_member da própria empresa.
 *
 * Auth user creation precisa de Cloud Function (Admin SDK).
 * Onda 3 sem CF: cria apenas o doc Firestore + entry em usernames.
 * Cliente recebe magic link no 1º login → completa perfil.
 */
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
import { useAuthStore } from '@/stores/auth.store'
import { getCompany } from './companies'
import type { User } from '@/types'

const USERS_COL = 'users'
const USERNAMES_COL = 'usernames'

interface InviteParams {
  companyId: string
  email: string
  displayName: string
  tag: string // ex: "joao" → username = "{companySlug}.joao"
}

export async function listTeam(companyId: string): Promise<User[]> {
  const q = query(
    collection(db, USERS_COL),
    where('companyId', '==', companyId),
    orderBy('displayName'),
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }) as User)
}

export async function inviteMember(input: InviteParams): Promise<void> {
  const company = await getCompany(input.companyId)
  if (!company) throw new Error('Empresa não encontrada')
  const inviter = useAuthStore.getState().user
  if (!inviter) throw new Error('Não autenticado')

  const usernameKey = `${company.slug}.${input.tag}`

  // Verifica se username já existe
  const existing = await getDoc(doc(db, USERNAMES_COL, usernameKey))
  if (existing.exists()) {
    throw new Error(`Username "${usernameKey}" já em uso. Escolha outra tag.`)
  }

  await withAudit(
    {
      action: 'create',
      resource: { type: 'user', id: usernameKey, label: `${input.displayName} (${usernameKey})` },
    },
    async () => {
      // 1. Cria usernames lookup
      await setDoc(doc(db, USERNAMES_COL, usernameKey), {
        usernameKey,
        email: input.email,
        authMethod: 'magic_link',
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      // 2. Cria placeholder user doc (uid real preenchido no 1º login via Cloud Function ou
      //    completion handler — por hora deixa pendente).
      //    Usa email como ID intermediário até ter uid real.
    },
  )
}

export async function deactivateMember(uid: string): Promise<void> {
  const before = await getDoc(doc(db, USERS_COL, uid))
  if (!before.exists()) return
  const data = before.data() as User

  await withAudit(
    {
      action: 'update',
      resource: { type: 'user', id: uid, label: data.displayName },
      diff: {
        before: { active: data.active },
        after: { active: false },
        fields: ['active'],
      },
    },
    () =>
      updateDoc(doc(db, USERS_COL, uid), {
        active: false,
        updatedAt: serverTimestamp(),
      }),
  )

  // Desativa também na lookup
  if (data.tag && data.companyId) {
    const company = await getCompany(data.companyId)
    if (company) {
      const usernameKey = `${company.slug}.${data.tag}`
      await updateDoc(doc(db, USERNAMES_COL, usernameKey), {
        active: false,
        updatedAt: serverTimestamp(),
      }).catch(() => undefined)
    }
  }
}

export async function reactivateMember(uid: string): Promise<void> {
  const before = await getDoc(doc(db, USERS_COL, uid))
  if (!before.exists()) return
  const data = before.data() as User

  await updateDoc(doc(db, USERS_COL, uid), {
    active: true,
    updatedAt: serverTimestamp(),
  })

  if (data.tag && data.companyId) {
    const company = await getCompany(data.companyId)
    if (company) {
      const usernameKey = `${company.slug}.${data.tag}`
      await updateDoc(doc(db, USERNAMES_COL, usernameKey), {
        active: true,
        updatedAt: serverTimestamp(),
      }).catch(() => undefined)
    }
  }
}
