/**
 * Cliente do endpoint serverless `/api/admin/*`.
 * Pega ID token do usuário corrente e envia no header.
 */
import { auth } from '../firebase'

export interface CreateUserPayload {
  mode: 'owner' | 'member'
  username: string
  password: string
  displayName: string
  companyId: string
}

export interface CreateUserResult {
  uid: string
  username: string
  email: string
  role: 'company_owner' | 'company_member'
  companyId: string
}

export async function apiCreateUser(payload: CreateUserPayload): Promise<CreateUserResult> {
  const fbUser = auth.currentUser
  if (!fbUser) throw new Error('Não autenticado')
  const token = await fbUser.getIdToken()

  const res = await fetch('/api/admin/create-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? `Falha ${res.status}`)
  }

  return (await res.json()) as CreateUserResult
}
