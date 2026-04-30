import { useAuthStore } from '@/stores/auth.store'
import type { RBACAction, RBACResource, Role } from '@/types'
import { RBAC_MATRIX } from './rbac.matrix'

interface CanContext {
  role: Role
  uid: string
  companyId: string | null
  resourceCompanyId?: string
  resourceOwnerId?: string
}

/**
 * Verificação síncrona de permissão. Espelhada em firestore.rules.
 * UI usa pra render condicional; rules garantem segurança real.
 */
export function can(action: RBACAction, resource: RBACResource, ctx: CanContext): boolean {
  if (ctx.role === 'admin') return true

  const matrix = RBAC_MATRIX[resource]
  if (!matrix) return false

  const permission = matrix[action][ctx.role]

  if (permission === true) return true
  if (permission === false) return false

  if (permission === 'own') {
    if (ctx.resourceCompanyId === undefined) return false
    return ctx.companyId === ctx.resourceCompanyId
  }

  if (permission === 'self') {
    if (ctx.resourceOwnerId === undefined) return false
    return ctx.uid === ctx.resourceOwnerId
  }

  return false
}

/**
 * Hook React — usa Auth Store para resolver contexto do usuário atual.
 * Retorna boolean síncrono.
 */
export function useCan(
  action: RBACAction,
  resource: RBACResource,
  target?: { companyId?: string; ownerId?: string },
): boolean {
  const user = useAuthStore(s => s.user)

  return can(action, resource, {
    role: user?.role ?? 'guest',
    uid: user?.uid ?? '',
    companyId: user?.companyId ?? null,
    resourceCompanyId: target?.companyId,
    resourceOwnerId: target?.ownerId,
  })
}
