import { describe, beforeAll, afterAll, beforeEach, it } from 'vitest'
import { assertSucceeds, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import {
  setupTestEnv,
  adminCtx,
  ownerCtx,
  memberCtx,
  outsiderCtx,
  COMPANY_A,
  COMPANY_B,
  OWNER_UID,
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
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', OWNER_UID), {
      email: 'owner@x',
      displayName: 'Owner',
      role: 'company_owner',
      companyId: COMPANY_A,
      active: true,
      roleVersion: 1,
    })
    await setDoc(doc(db, 'users', MEMBER_UID), {
      email: 'member@x',
      displayName: 'Member',
      role: 'company_member',
      companyId: COMPANY_A,
      active: true,
      roleVersion: 1,
    })
    await setDoc(doc(db, 'users', 'outsider-uid'), {
      email: 'outsider@x',
      displayName: 'Outsider',
      role: 'company_member',
      companyId: COMPANY_B,
      active: true,
      roleVersion: 1,
    })
  })
})

describe('rules: users (multi-tenant team)', () => {
  it('member lê outro membro da MESMA empresa', async () => {
    await assertSucceeds(getDoc(doc(memberCtx(env).firestore(), 'users', OWNER_UID)))
  })

  it('member NÃO lê membro de OUTRA empresa', async () => {
    await assertFails(getDoc(doc(memberCtx(env).firestore(), 'users', 'outsider-uid')))
  })

  it('owner lê membro da empresa dele', async () => {
    await assertSucceeds(getDoc(doc(ownerCtx(env).firestore(), 'users', MEMBER_UID)))
  })

  it('admin lê qualquer um', async () => {
    await assertSucceeds(getDoc(doc(adminCtx(env).firestore(), 'users', 'outsider-uid')))
  })

  it('outsider NÃO lê membro de outra empresa', async () => {
    await assertFails(getDoc(doc(outsiderCtx(env).firestore(), 'users', MEMBER_UID)))
  })

  it('member NÃO cria user', async () => {
    await assertFails(
      setDoc(doc(memberCtx(env).firestore(), 'users', 'novo'), {
        email: 'novo@x',
        displayName: 'Novo',
        role: 'company_member',
        companyId: COMPANY_A,
        active: true,
        roleVersion: 1,
      }),
    )
  })
})
