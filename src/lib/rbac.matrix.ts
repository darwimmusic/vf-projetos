/**
 * Matriz declarativa de permissões — gerada de FW-RBAC-MATRIX.md v1.1 §3.
 * SEMPRE batida com firestore.rules. Drift = bug crítico.
 *
 * Notação:
 *   true  = sempre permitido pra esse role
 *   false = sempre negado
 *   'own' = apenas se resourceCompanyId === userCompanyId
 *   'self'= apenas se resourceOwnerId === userUid
 */
import type { RBACAction, RBACResource, Role } from '@/types'

type Permission = true | false | 'own' | 'self'

type ResourceMatrix = Record<RBACAction, Record<Role, Permission>>

export const RBAC_MATRIX: Record<RBACResource, ResourceMatrix> = {
  company: {
    create: { admin: true, company_owner: false, company_member: false, guest: false },
    read: { admin: true, company_owner: 'own', company_member: 'own', guest: false },
    update: { admin: true, company_owner: 'own', company_member: false, guest: false },
    delete: { admin: true, company_owner: false, company_member: false, guest: false },
    list: { admin: true, company_owner: 'own', company_member: 'own', guest: false },
  },
  user: {
    create: { admin: true, company_owner: 'own', company_member: false, guest: false },
    // Member pode listar/ler outros membros da MESMA empresa.
    read: { admin: true, company_owner: 'own', company_member: 'own', guest: false },
    update: { admin: true, company_owner: 'own', company_member: 'self', guest: false },
    delete: { admin: true, company_owner: 'own', company_member: false, guest: false },
    list: { admin: true, company_owner: 'own', company_member: 'own', guest: false },
  },
  projeto: {
    create: { admin: true, company_owner: false, company_member: false, guest: false },
    read: { admin: true, company_owner: 'own', company_member: 'own', guest: false },
    // "Alertar pagamento": owner sim, member não.
    update: { admin: true, company_owner: 'own', company_member: false, guest: false },
    delete: { admin: true, company_owner: false, company_member: false, guest: false },
    list: { admin: true, company_owner: 'own', company_member: 'own', guest: false },
  },
  rrt: {
    create: { admin: true, company_owner: false, company_member: false, guest: false },
    read: { admin: true, company_owner: 'own', company_member: 'own', guest: false },
    update: { admin: true, company_owner: 'own', company_member: false, guest: false },
    delete: { admin: true, company_owner: false, company_member: false, guest: false },
    list: { admin: true, company_owner: 'own', company_member: 'own', guest: false },
  },
  chamado: {
    create: { admin: true, company_owner: 'own', company_member: 'own', guest: false },
    read: { admin: true, company_owner: 'own', company_member: 'own', guest: false },
    update: { admin: true, company_owner: 'own', company_member: 'own', guest: false },
    delete: { admin: true, company_owner: false, company_member: false, guest: false },
    list: { admin: true, company_owner: 'own', company_member: 'own', guest: false },
  },
  anexo: {
    // Upload em chamado: own. Em projeto/RRT: só admin (rule a nível de path).
    create: { admin: true, company_owner: 'own', company_member: 'own', guest: false },
    read: { admin: true, company_owner: 'own', company_member: 'own', guest: false },
    update: { admin: true, company_owner: false, company_member: false, guest: false },
    delete: { admin: true, company_owner: false, company_member: false, guest: false },
    list: { admin: true, company_owner: 'own', company_member: 'own', guest: false },
  },
  public_lib: {
    create: { admin: true, company_owner: false, company_member: false, guest: false },
    read: { admin: true, company_owner: true, company_member: true, guest: true },
    update: { admin: true, company_owner: false, company_member: false, guest: false },
    delete: { admin: true, company_owner: false, company_member: false, guest: false },
    list: { admin: true, company_owner: true, company_member: true, guest: true },
  },
  audit_log: {
    create: { admin: true, company_owner: true, company_member: true, guest: false }, // via wrapper
    read: { admin: true, company_owner: false, company_member: false, guest: false }, // owner read em W3
    update: { admin: false, company_owner: false, company_member: false, guest: false },
    delete: { admin: false, company_owner: false, company_member: false, guest: false },
    list: { admin: true, company_owner: false, company_member: false, guest: false },
  },
  dashboard: {
    create: { admin: false, company_owner: false, company_member: false, guest: false },
    read: { admin: true, company_owner: 'own', company_member: 'own', guest: false },
    update: { admin: false, company_owner: false, company_member: false, guest: false },
    delete: { admin: false, company_owner: false, company_member: false, guest: false },
    list: { admin: true, company_owner: 'own', company_member: 'own', guest: false },
  },
}
