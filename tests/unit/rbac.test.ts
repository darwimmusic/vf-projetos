import { describe, it, expect } from 'vitest'
import { can } from '../../src/lib/rbac'

const adminCtx = { role: 'admin' as const, uid: 'admin-uid', companyId: null }
const ownerCtx = { role: 'company_owner' as const, uid: 'owner-uid', companyId: 'co-A' }
const memberCtx = { role: 'company_member' as const, uid: 'member-uid', companyId: 'co-A' }
const guestCtx = { role: 'guest' as const, uid: '', companyId: null }

describe('rbac.can', () => {
  it('admin tudo', () => {
    expect(can('create', 'company', adminCtx)).toBe(true)
    expect(can('delete', 'rrt', adminCtx)).toBe(true)
    expect(can('read', 'audit_log', adminCtx)).toBe(true)
  })

  it('guest nada', () => {
    expect(can('read', 'company', guestCtx)).toBe(false)
    expect(can('list', 'projeto', guestCtx)).toBe(false)
  })

  it('owner: lê própria empresa', () => {
    expect(can('read', 'company', { ...ownerCtx, resourceCompanyId: 'co-A' })).toBe(true)
    expect(can('read', 'company', { ...ownerCtx, resourceCompanyId: 'co-B' })).toBe(false)
  })

  it('owner NÃO cria projetos/RRTs', () => {
    expect(can('create', 'projeto', ownerCtx)).toBe(false)
    expect(can('create', 'rrt', ownerCtx)).toBe(false)
  })

  it('owner cria sub-user', () => {
    expect(can('create', 'user', ownerCtx)).toBe(true)
  })

  it('member lê próprio user, não outro', () => {
    expect(can('read', 'user', { ...memberCtx, resourceOwnerId: 'member-uid' })).toBe(true)
    expect(can('read', 'user', { ...memberCtx, resourceOwnerId: 'other-uid' })).toBe(false)
  })

  it('public_lib leitura é universal', () => {
    expect(can('read', 'public_lib', guestCtx)).toBe(true)
    expect(can('read', 'public_lib', memberCtx)).toBe(true)
  })

  it('chamado: member abre na própria empresa', () => {
    expect(can('create', 'chamado', { ...memberCtx, resourceCompanyId: 'co-A' })).toBe(true)
    expect(can('create', 'chamado', { ...memberCtx, resourceCompanyId: 'co-B' })).toBe(false)
  })
})
