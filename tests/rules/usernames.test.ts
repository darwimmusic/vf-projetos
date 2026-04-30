import { describe, beforeAll, afterAll, beforeEach, it } from 'vitest'
import { assertSucceeds, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { setupTestEnv, adminCtx, memberCtx } from './_helpers'

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
    await setDoc(doc(ctx.firestore(), 'usernames', 'dvi.joao'), {
      usernameKey: 'dvi.joao',
      email: 'joao@dvi.com',
      authMethod: 'magic_link',
      active: true,
    })
  })
})

describe('rules: usernames (lookup público — B2)', () => {
  it('UNAUTHENTICATED lê usernames (chicken-and-egg fix)', async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'usernames', 'dvi.joao')))
  })

  it('apenas admin escreve', async () => {
    await assertFails(
      setDoc(doc(memberCtx(env).firestore(), 'usernames', 'novo'), {
        usernameKey: 'novo',
        email: 'a@b.c',
        authMethod: 'magic_link',
        active: true,
      }),
    )
    await assertSucceeds(
      setDoc(doc(adminCtx(env).firestore(), 'usernames', 'novo'), {
        usernameKey: 'novo',
        email: 'a@b.c',
        authMethod: 'magic_link',
        active: true,
      }),
    )
  })

  it('admin atualiza apenas campos permitidos', async () => {
    await assertSucceeds(
      updateDoc(doc(adminCtx(env).firestore(), 'usernames', 'dvi.joao'), {
        active: false,
        updatedAt: new Date(),
      }),
    )
    await assertFails(
      updateDoc(doc(adminCtx(env).firestore(), 'usernames', 'dvi.joao'), {
        usernameKey: 'hack',
      }),
    )
  })
})
