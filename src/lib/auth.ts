import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signOut as fbSignOut,
  type User as FbUser,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import type { AppUser, AuthMethod, UsernameEntry } from '@/types'

const MAGIC_LINK_KEY = 'vf-projetos:pending-email'

/**
 * Resolve username → { email, authMethod, active } via collection pública `usernames`.
 * Falha (null) se usuário não existe ou está inativo.
 */
export async function resolveUsername(
  usernameKey: string,
): Promise<UsernameEntry | null> {
  const snap = await getDoc(doc(db, 'usernames', usernameKey))
  if (!snap.exists()) return null
  const data = snap.data() as UsernameEntry
  if (!data.active) return null
  return data
}

/**
 * Login admin (password). Espera email completo já resolvido via `usernames` lookup
 * — não constrói email manualmente (fix B3).
 */
export async function signInWithPassword(email: string, password: string): Promise<FbUser> {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  return cred.user
}

/**
 * Envia magic link e armazena email pendente em localStorage para `completeMagicLink`.
 */
export async function sendMagicLink(email: string): Promise<void> {
  const url = `${window.location.origin}/auth/accept-invite`
  await sendSignInLinkToEmail(auth, email, {
    url,
    handleCodeInApp: true,
  })
  window.localStorage.setItem(MAGIC_LINK_KEY, email)
}

/**
 * Detecta link de email no URL e completa autenticação.
 * Retorna user OU null se URL atual não é magic link.
 */
export async function completeMagicLink(): Promise<FbUser | null> {
  if (!isSignInWithEmailLink(auth, window.location.href)) return null

  let email = window.localStorage.getItem(MAGIC_LINK_KEY)
  if (!email) {
    email = window.prompt('Confirme o email para completar o login') ?? ''
    if (!email) throw new Error('Email não informado')
  }

  const cred = await signInWithEmailLink(auth, email, window.location.href)
  window.localStorage.removeItem(MAGIC_LINK_KEY)
  return cred.user
}

export async function signOut(): Promise<void> {
  await fbSignOut(auth)
}

/** Hidrata Firestore user doc + custom claims em paralelo. */
export async function hydrateAppUser(fbUser: FbUser): Promise<AppUser | null> {
  const [snap, tokenResult] = await Promise.all([
    getDoc(doc(db, 'users', fbUser.uid)),
    fbUser.getIdTokenResult(),
  ])

  if (!snap.exists()) return null

  const userData = snap.data()
  const claims = tokenResult.claims

  return {
    uid: fbUser.uid,
    email: fbUser.email ?? '',
    displayName: userData.displayName ?? fbUser.displayName ?? '',
    avatarUrl: userData.avatarUrl,
    role: userData.role ?? 'guest',
    companyId: userData.companyId ?? null,
    companyName: userData.companyName,
    tag: userData.tag,
    active: userData.active ?? true,
    roleVersion: userData.roleVersion ?? 1,
    createdAt: userData.createdAt,
    lastLogin: userData.lastLogin,
    emailNotifications: userData.emailNotifications ?? true,
    invitedBy: userData.invitedBy,
    acceptedInviteAt: userData.acceptedInviteAt,
    claims: {
      role: (claims.role as AppUser['role']) ?? 'guest',
      companyId: (claims.companyId as string | null) ?? null,
      roleVersion: (claims.roleVersion as number) ?? 0,
    },
  }
}

/**
 * Watchdog v1.1 — compara claims.roleVersion com Firestore. Se Firestore > token,
 * força refresh do ID token para puxar novas claims. Resolve H3.
 */
export async function refreshClaimsIfStale(fbUser: FbUser): Promise<boolean> {
  const [snap, tokenResult] = await Promise.all([
    getDoc(doc(db, 'users', fbUser.uid)),
    fbUser.getIdTokenResult(),
  ])
  if (!snap.exists()) return false

  const firestoreVersion = (snap.data().roleVersion ?? 1) as number
  const claimVersion = (tokenResult.claims.roleVersion as number) ?? 0

  if (firestoreVersion > claimVersion) {
    await fbUser.getIdToken(true)
    return true
  }
  return false
}

export { type AuthMethod }
