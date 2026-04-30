import { describe, beforeAll, afterAll, beforeEach, it } from 'vitest'
import { assertSucceeds, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import {
  setupTestEnv,
  adminCtx,
  ownerCtx,
  memberCtx,
  outsiderCtx,
  COMPANY_A,
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
    await setDoc(doc(ctx.firestore(), 'companies', COMPANY_A), {
      name: 'DVI',
      slug: 'dvi',
      cnpj: '00000000000000',
      ownerId: 'owner-uid',
      contactEmail: 'a@b.c',
      prazoNF: 10,
      active: true,
    })
  })
})

describe('rules: companies', () => {
  it('admin lê qualquer empresa', async () => {
    await assertSucceeds(getDoc(doc(adminCtx(env).firestore(), 'companies', COMPANY_A)))
  })

  it('member da própria empresa lê', async () => {
    await assertSucceeds(getDoc(doc(memberCtx(env).firestore(), 'companies', COMPANY_A)))
  })

  it('outsider de outra empresa NÃO lê', async () => {
    await assertFails(getDoc(doc(outsiderCtx(env).firestore(), 'companies', COMPANY_A)))
  })

  it('admin cria empresa', async () => {
    await assertSucceeds(
      setDoc(doc(adminCtx(env).firestore(), 'companies', 'new-co'), {
        name: 'X',
        slug: 'x',
        cnpj: '00',
        ownerId: 'u',
        contactEmail: 'a@b.c',
        prazoNF: 10,
        active: true,
      }),
    )
  })

  it('owner NÃO cria empresa', async () => {
    await assertFails(
      setDoc(doc(ownerCtx(env).firestore(), 'companies', 'new-co'), {
        name: 'X',
        slug: 'x',
        cnpj: '00',
        ownerId: 'u',
        contactEmail: 'a@b.c',
        prazoNF: 10,
        active: true,
      }),
    )
  })

  it('owner atualiza apenas campos permitidos', async () => {
    await assertSucceeds(
      updateDoc(doc(ownerCtx(env).firestore(), 'companies', COMPANY_A), {
        name: 'DVI Atualizada',
        updatedAt: new Date(),
      }),
    )
  })

  it('owner NÃO atualiza CNPJ', async () => {
    await assertFails(
      updateDoc(doc(ownerCtx(env).firestore(), 'companies', COMPANY_A), {
        cnpj: '11111111111111',
      }),
    )
  })

  it('apenas admin deleta', async () => {
    await assertFails(deleteDoc(doc(ownerCtx(env).firestore(), 'companies', COMPANY_A)))
    await assertSucceeds(deleteDoc(doc(adminCtx(env).firestore(), 'companies', COMPANY_A)))
  })
})
