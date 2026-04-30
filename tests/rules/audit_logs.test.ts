import { describe, beforeAll, afterAll, beforeEach, it } from 'vitest'
import { assertSucceeds, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import {
  setupTestEnv,
  adminCtx,
  memberCtx,
  COMPANY_A,
  ADMIN_UID,
  MEMBER_UID,
} from './_helpers'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await setupTestEnv()
})

afterAll(async () => {
  await env?.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
})

describe('rules: audit_logs (append-only + anti-forgery)', () => {
  it('member cria log com SEU uid + role + companyId', async () => {
    await assertSucceeds(
      addDoc(collection(memberCtx(env).firestore(), 'audit_logs'), {
        timestamp: new Date(),
        actor: {
          uid: MEMBER_UID,
          role: 'company_member',
          companyId: COMPANY_A,
          email: 'a@b.c',
          displayName: 'X',
          companyName: 'DVI',
        },
        action: 'create',
        resource: { type: 'rrt', id: 'x', label: 'X' },
      }),
    )
  })

  it('member NÃO forja role admin', async () => {
    await assertFails(
      addDoc(collection(memberCtx(env).firestore(), 'audit_logs'), {
        timestamp: new Date(),
        actor: {
          uid: MEMBER_UID,
          role: 'admin', // forgery!
          companyId: COMPANY_A,
          email: 'x',
          displayName: 'x',
          companyName: 'x',
        },
        action: 'create',
        resource: { type: 'rrt', id: 'x', label: 'x' },
      }),
    )
  })

  it('member NÃO forja outro uid', async () => {
    await assertFails(
      addDoc(collection(memberCtx(env).firestore(), 'audit_logs'), {
        timestamp: new Date(),
        actor: {
          uid: 'someone-else',
          role: 'company_member',
          companyId: COMPANY_A,
          email: 'x',
          displayName: 'x',
          companyName: 'x',
        },
        action: 'create',
        resource: { type: 'rrt', id: 'x', label: 'x' },
      }),
    )
  })

  it('member NÃO forja outra companyId', async () => {
    await assertFails(
      addDoc(collection(memberCtx(env).firestore(), 'audit_logs'), {
        timestamp: new Date(),
        actor: {
          uid: MEMBER_UID,
          role: 'company_member',
          companyId: 'company-x', // forgery!
          email: 'x',
          displayName: 'x',
          companyName: 'x',
        },
        action: 'create',
        resource: { type: 'rrt', id: 'x', label: 'x' },
      }),
    )
  })

  it('append-only — update e delete bloqueados', async () => {
    let logId = ''
    await env.withSecurityRulesDisabled(async ctx => {
      const ref = await addDoc(collection(ctx.firestore(), 'audit_logs'), {
        actor: { uid: ADMIN_UID, role: 'admin', companyId: null, displayName: 'a', email: 'a', companyName: null },
        action: 'create',
        resource: { type: 'rrt', id: 'x', label: 'x' },
        timestamp: new Date(),
      })
      logId = ref.id
    })

    await assertFails(
      updateDoc(doc(adminCtx(env).firestore(), 'audit_logs', logId), { action: 'update' }),
    )
    await assertFails(deleteDoc(doc(adminCtx(env).firestore(), 'audit_logs', logId)))
  })

  it('apenas admin lê', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await addDoc(collection(ctx.firestore(), 'audit_logs'), {
        actor: { uid: ADMIN_UID, role: 'admin', companyId: null, displayName: 'a', email: 'a', companyName: null },
        action: 'create',
        resource: { type: 'rrt', id: 'x', label: 'x' },
        timestamp: new Date(),
      })
    })

    const { getDocs, query, limit } = await import('firebase/firestore')
    await assertSucceeds(getDocs(query(collection(adminCtx(env).firestore(), 'audit_logs'), limit(1))))
    await assertFails(getDocs(query(collection(memberCtx(env).firestore(), 'audit_logs'), limit(1))))
  })
})
