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
} from './_helpers'

let env: RulesTestEnvironment
const RRT_ID = 'rrt-1'
const PROJ_ID = 'proj-1'

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
    await setDoc(doc(db, 'rrts', RRT_ID), {
      companyId: COMPANY_A,
      descricao: 'X',
      status: 'PROVISORIA',
    })
    await setDoc(doc(db, 'projetos', PROJ_ID), {
      companyId: COMPANY_A,
      nome: 'P',
      status: 'BRIEFING',
    })
    await setDoc(doc(db, 'rrts', RRT_ID, 'anexos', 'pub'), {
      filename: 'public.pdf',
      visibleToClient: true,
      uploadedBy: 'admin-uid',
    })
    await setDoc(doc(db, 'rrts', RRT_ID, 'anexos', 'priv'), {
      filename: 'internal.pdf',
      visibleToClient: false,
      uploadedBy: 'admin-uid',
    })
    await setDoc(doc(db, 'projetos', PROJ_ID, 'anexos', 'pub'), {
      filename: 'public.pdf',
      visibleToClient: true,
    })
    await setDoc(doc(db, 'projetos', PROJ_ID, 'anexos', 'priv'), {
      filename: 'internal.pdf',
      visibleToClient: false,
    })
  })
})

describe('rules: anexos visibleToClient', () => {
  it('member lê anexo público de RRT da própria empresa', async () => {
    await assertSucceeds(
      getDoc(doc(memberCtx(env).firestore(), 'rrts', RRT_ID, 'anexos', 'pub')),
    )
  })

  it('member NÃO lê anexo INTERNO de RRT (visibleToClient=false)', async () => {
    await assertFails(
      getDoc(doc(memberCtx(env).firestore(), 'rrts', RRT_ID, 'anexos', 'priv')),
    )
  })

  it('owner também NÃO lê anexo INTERNO', async () => {
    await assertFails(
      getDoc(doc(ownerCtx(env).firestore(), 'rrts', RRT_ID, 'anexos', 'priv')),
    )
  })

  it('admin lê anexo INTERNO', async () => {
    await assertSucceeds(
      getDoc(doc(adminCtx(env).firestore(), 'rrts', RRT_ID, 'anexos', 'priv')),
    )
  })

  it('outsider NÃO lê anexo público', async () => {
    await assertFails(
      getDoc(doc(outsiderCtx(env).firestore(), 'rrts', RRT_ID, 'anexos', 'pub')),
    )
  })

  it('member lê anexo público de Projeto da própria empresa', async () => {
    await assertSucceeds(
      getDoc(doc(memberCtx(env).firestore(), 'projetos', PROJ_ID, 'anexos', 'pub')),
    )
  })

  it('member NÃO lê anexo interno de Projeto', async () => {
    await assertFails(
      getDoc(doc(memberCtx(env).firestore(), 'projetos', PROJ_ID, 'anexos', 'priv')),
    )
  })
})
