import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { withAudit } from '../audit'
import { normalizeCnpj } from '../format'
import { useAuthStore } from '@/stores/auth.store'
import { getCompany } from './companies'
import type { Projeto, ProjetoStatus } from '@/types'
import type { ProjetoInput } from '../validations'

const COL = 'projetos'

export async function listProjetos(filters?: {
  companyId?: string
  status?: ProjetoStatus
}): Promise<Projeto[]> {
  let q
  if (filters?.companyId) {
    q = query(collection(db, COL), where('companyId', '==', filters.companyId))
  } else if (filters?.status) {
    q = query(collection(db, COL), where('status', '==', filters.status))
  } else {
    q = query(collection(db, COL), orderBy('dataCriacao', 'desc'))
  }
  const snap = await getDocs(q)
  let list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Projeto)
  if (filters?.status && filters.companyId) {
    list = list.filter(p => p.status === filters.status)
  }
  return list.sort((a, b) => {
    const at = a.dataCriacao?.toMillis?.() ?? 0
    const bt = b.dataCriacao?.toMillis?.() ?? 0
    return bt - at
  })
}

export async function getProjeto(id: string): Promise<Projeto | null> {
  const snap = await getDoc(doc(db, COL, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Projeto
}

export async function createProjeto(input: ProjetoInput): Promise<string> {
  const company = await getCompany(input.companyId)
  if (!company) throw new Error('Empresa não encontrada')
  const user = useAuthStore.getState().user
  if (!user) throw new Error('Não autenticado')

  const ref = await withAudit(
    {
      action: 'create',
      resource: { type: 'projeto', id: 'pending', label: input.nome },
    },
    () =>
      addDoc(collection(db, COL), {
        ...input,
        companyName: company.name,
        cnpjFaturamento: normalizeCnpj(input.cnpjFaturamento),
        status: 'BRIEFING' as ProjetoStatus,
        rrtIds: [],
        dataCriacao: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.uid,
      }),
  )
  return ref.id
}

export async function updateProjeto(id: string, patch: Partial<Projeto>): Promise<void> {
  const before = await getProjeto(id)
  if (!before) throw new Error('Projeto não encontrado')

  await withAudit(
    {
      action: 'update',
      resource: { type: 'projeto', id, label: before.nome },
      diff: { before, after: { ...before, ...patch }, fields: Object.keys(patch) },
    },
    () => updateDoc(doc(db, COL, id), { ...patch, updatedAt: serverTimestamp() }),
  )
}

const STATUS_FLOW: Record<ProjetoStatus, ProjetoStatus[]> = {
  BRIEFING: ['EM_DESENVOLVIMENTO', 'CANCELADO'],
  EM_DESENVOLVIMENTO: ['ENTREGUE', 'CANCELADO'],
  ENTREGUE: ['PAGO', 'CANCELADO'],
  PAGO: [],
  CANCELADO: [],
}

export function nextValidStatuses(current: ProjetoStatus): ProjetoStatus[] {
  return STATUS_FLOW[current]
}

export async function advanceProjetoStatus(id: string, to: ProjetoStatus): Promise<void> {
  const before = await getProjeto(id)
  if (!before) throw new Error('Projeto não encontrado')
  if (!nextValidStatuses(before.status).includes(to)) {
    throw new Error(`Transição inválida: ${before.status} → ${to}`)
  }

  const patch: Partial<Projeto> = { status: to }
  if (to === 'ENTREGUE') patch.dataEntrega = serverTimestamp() as never
  if (to === 'PAGO') patch.dataPagamento = serverTimestamp() as never

  await withAudit(
    {
      action: 'status_advance',
      resource: { type: 'projeto', id, label: before.nome },
      diff: { before: { status: before.status }, after: { status: to }, fields: ['status'] },
    },
    () => updateDoc(doc(db, COL, id), { ...patch, updatedAt: serverTimestamp() }),
  )
}

export async function revertProjetoStatus(
  id: string,
  to: ProjetoStatus,
  reason: string,
): Promise<void> {
  if (reason.length < 20) throw new Error('Razão da reversão precisa ter ao menos 20 caracteres.')
  const before = await getProjeto(id)
  if (!before) throw new Error('Projeto não encontrado')

  await withAudit(
    {
      action: 'status_revert',
      resource: { type: 'projeto', id, label: before.nome },
      diff: { before: { status: before.status }, after: { status: to }, fields: ['status'] },
      metadata: { notes: reason },
    },
    () => updateDoc(doc(db, COL, id), { status: to, updatedAt: serverTimestamp() }),
  )
}

export async function deleteProjeto(id: string): Promise<void> {
  const before = await getProjeto(id)
  if (!before) return
  await withAudit(
    { action: 'delete', resource: { type: 'projeto', id, label: before.nome } },
    () => deleteDoc(doc(db, COL, id)),
  )
}

/** Cliente alerta pagamento. */
export async function alertProjetoPayment(id: string): Promise<void> {
  const before = await getProjeto(id)
  if (!before) throw new Error('Projeto não encontrado')
  const user = useAuthStore.getState().user
  if (!user) throw new Error('Não autenticado')

  await withAudit(
    {
      action: 'alert_payment',
      resource: { type: 'projeto', id, label: before.nome },
    },
    () =>
      updateDoc(doc(db, COL, id), {
        paymentAlertedAt: serverTimestamp(),
        paymentAlertedBy: user.uid,
        updatedAt: serverTimestamp(),
      }),
  )
}
