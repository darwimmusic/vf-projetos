import { describe, beforeAll, afterAll, beforeEach, it } from 'vitest'
import { assertSucceeds, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, updateDoc } from 'firebase/firestore'
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

beforeAll(async () => {
  env = await setupTestEnv()
})

afterAll(async () => {
  await env?.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), 'rrts', RRT_ID), {
      companyId: COMPANY_A,
      companyName: 'DVI',
      empresaFaturamento: 'DVI',
      cnpjFaturamento: '00',
      contratante: 'DVI',
      descricao: 'X',
      valorBruto: 45000,
      taxaCAU: 13064,
      valorLiquido: 31936,
      valorCobradoCliente: 31936,
      boletoPorMim: false,
      status: 'PROVISORIA',
      createdBy: 'admin-uid',
    })
  })
})

describe('rules: rrts', () => {
  it('admin lê e cria', async () => {
    await assertSucceeds(
      setDoc(doc(adminCtx(env).firestore(), 'rrts', 'novo'), {
        companyId: COMPANY_A,
        descricao: 'X',
        status: 'PROVISORIA',
      }),
    )
  })

  it('member da empresa lê', async () => {
    await assertSucceeds(
      (async () => {
        const d = doc(memberCtx(env).firestore(), 'rrts', RRT_ID)
        await import('firebase/firestore').then(({ getDoc }) => getDoc(d))
      })(),
    )
  })

  it('outsider NÃO lê', async () => {
    await assertFails(
      (async () => {
        const d = doc(outsiderCtx(env).firestore(), 'rrts', RRT_ID)
        await import('firebase/firestore').then(({ getDoc }) => getDoc(d))
      })(),
    )
  })

  it('member NÃO cria RRT (só admin)', async () => {
    await assertFails(
      setDoc(doc(memberCtx(env).firestore(), 'rrts', 'forbidden'), {
        companyId: COMPANY_A,
        descricao: 'X',
        status: 'PROVISORIA',
      }),
    )
  })

  it('owner alerta pagamento (apenas campos permitidos)', async () => {
    await assertSucceeds(
      updateDoc(doc(ownerCtx(env).firestore(), 'rrts', RRT_ID), {
        paymentAlertedAt: new Date(),
        paymentAlertedBy: 'owner-uid',
        updatedAt: new Date(),
      }),
    )
  })

  it('member NÃO alerta pagamento (só owner)', async () => {
    await assertFails(
      updateDoc(doc(memberCtx(env).firestore(), 'rrts', RRT_ID), {
        paymentAlertedAt: new Date(),
        paymentAlertedBy: 'member-uid',
        updatedAt: new Date(),
      }),
    )
  })

  it('member NÃO altera valor', async () => {
    await assertFails(
      updateDoc(doc(memberCtx(env).firestore(), 'rrts', RRT_ID), {
        valorBruto: 99999,
      }),
    )
  })

  it('member NÃO muda status', async () => {
    await assertFails(
      updateDoc(doc(memberCtx(env).firestore(), 'rrts', RRT_ID), {
        status: 'PAGO',
      }),
    )
  })
})
