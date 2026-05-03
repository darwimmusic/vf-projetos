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
  // Force refresh: garante que o token traz custom claims atualizadas
  // (role, companyId) — sem isso, owner recém-criado pode ter token cacheado
  // de antes de receber claims, e endpoint nega autorização.
  const token = await fbUser.getIdToken(true)

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
