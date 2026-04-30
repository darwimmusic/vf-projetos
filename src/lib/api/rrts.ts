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
import type { RRT, RRTStatus } from '@/types'
import type { RRTInput } from '../validations'

const COL = 'rrts'

function calcCobrado(valorBruto: number, taxaCAU: number, boletoPorMim: boolean): number {
  return boletoPorMim ? valorBruto : valorBruto - taxaCAU
}

export async function listRRTs(filters?: {
  companyId?: string
  status?: RRTStatus
}): Promise<RRT[]> {
  // Estratégia: where simples (1 campo) + sort client-side.
  // Volume baixo (<500/ano), não justifica índices compostos pra todas combinações.
  let q
  if (filters?.companyId) {
    q = query(collection(db, COL), where('companyId', '==', filters.companyId))
  } else if (filters?.status) {
    q = query(collection(db, COL), where('status', '==', filters.status))
  } else {
    q = query(collection(db, COL), orderBy('dataCriacao', 'desc'))
  }
  const snap = await getDocs(q)
  let list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as RRT)
  if (filters?.status && filters.companyId) {
    list = list.filter(r => r.status === filters.status)
  }
  // sort client-side por dataCriacao desc
  return list.sort((a, b) => {
    const at = a.dataCriacao?.toMillis?.() ?? 0
    const bt = b.dataCriacao?.toMillis?.() ?? 0
    return bt - at
  })
}

export async function getRRT(id: string): Promise<RRT | null> {
  const snap = await getDoc(doc(db, COL, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as RRT
}

export async function createRRT(input: RRTInput): Promise<string> {
  const company = await getCompany(input.companyId)
  if (!company) throw new Error('Empresa não encontrada')
  const user = useAuthStore.getState().user
  if (!user) throw new Error('Não autenticado')

  const valorLiquido = input.valorBruto - input.taxaCAU
  const valorCobradoCliente = calcCobrado(input.valorBruto, input.taxaCAU, input.boletoPorMim)

  const ref = await withAudit(
    {
      action: 'create',
      resource: { type: 'rrt', id: 'pending', label: input.numeroRRT ?? input.descricao.slice(0, 40) },
    },
    () =>
      addDoc(collection(db, COL), {
        ...input,
        companyName: company.name,
        cnpjFaturamento: normalizeCnpj(input.cnpjFaturamento),
        ...(input.cnpjContratante && { cnpjContratante: normalizeCnpj(input.cnpjContratante) }),
        valorLiquido,
        valorCobradoCliente,
        status: 'PROVISORIA' as RRTStatus,
        dataCriacao: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.uid,
      }),
  )
  return ref.id
}

export async function updateRRT(id: string, patch: Partial<RRT>): Promise<void> {
  const before = await getRRT(id)
  if (!before) throw new Error('RRT não encontrada')

  // Se mexeu em valor/taxa/boleto, recalcular derivados
  const fields: Partial<RRT> = { ...patch }
  if (
    patch.valorBruto !== undefined ||
    patch.taxaCAU !== undefined ||
    patch.boletoPorMim !== undefined
  ) {
    const vb = patch.valorBruto ?? before.valorBruto
    const tx = patch.taxaCAU ?? before.taxaCAU
    const bp = patch.boletoPorMim ?? before.boletoPorMim
    fields.valorLiquido = vb - tx
    fields.valorCobradoCliente = calcCobrado(vb, tx, bp)
  }

  await withAudit(
    {
      action: 'update',
      resource: { type: 'rrt', id, label: before.numeroRRT ?? before.descricao.slice(0, 40) },
      diff: { before, after: { ...before, ...fields }, fields: Object.keys(patch) },
    },
    () => updateDoc(doc(db, COL, id), { ...fields, updatedAt: serverTimestamp() }),
  )
}

const STATUS_FLOW: Record<RRTStatus, RRTStatus[]> = {
  PROVISORIA: ['BOLETO_PAGO', 'CANCELADA'],
  BOLETO_PAGO: ['DEFINITIVA', 'CANCELADA'],
  DEFINITIVA: ['NF_EMITIDA', 'CANCELADA'],
  NF_EMITIDA: ['PAGO', 'CANCELADA'],
  PAGO: [],
  CANCELADA: [],
}

export function nextValidRRTStatuses(current: RRTStatus): RRTStatus[] {
  return STATUS_FLOW[current]
}

export async function advanceRRTStatus(id: string, to: RRTStatus): Promise<void> {
  const before = await getRRT(id)
  if (!before) throw new Error('RRT não encontrada')
  if (!nextValidRRTStatuses(before.status).includes(to)) {
    throw new Error(`Transição inválida: ${before.status} → ${to}`)
  }

  // numeroRRT é obrigatório a partir de DEFINITIVA
  if (to === 'DEFINITIVA' && !before.numeroRRT) {
    throw new Error('Preencha o número da RRT antes de marcar como Definitiva.')
  }

  const patch: Partial<RRT> = { status: to }
  if (to === 'BOLETO_PAGO') patch.dataBoleto = serverTimestamp() as never
  if (to === 'DEFINITIVA') patch.dataDefinitiva = serverTimestamp() as never
  if (to === 'NF_EMITIDA') patch.dataNF = serverTimestamp() as never
  if (to === 'PAGO') patch.dataPagamento = serverTimestamp() as never

  await withAudit(
    {
      action: 'status_advance',
      resource: { type: 'rrt', id, label: before.numeroRRT ?? before.descricao.slice(0, 40) },
      diff: { before: { status: before.status }, after: { status: to }, fields: ['status'] },
    },
    () => updateDoc(doc(db, COL, id), { ...patch, updatedAt: serverTimestamp() }),
  )
}

export async function revertRRTStatus(id: string, to: RRTStatus, reason: string): Promise<void> {
  if (reason.length < 20) throw new Error('Razão da reversão precisa ter ao menos 20 caracteres.')
  const before = await getRRT(id)
  if (!before) throw new Error('RRT não encontrada')

  await withAudit(
    {
      action: 'status_revert',
      resource: { type: 'rrt', id, label: before.numeroRRT ?? before.descricao.slice(0, 40) },
      diff: { before: { status: before.status }, after: { status: to }, fields: ['status'] },
      metadata: { notes: reason },
    },
    () => updateDoc(doc(db, COL, id), { status: to, updatedAt: serverTimestamp() }),
  )
}

export async function deleteRRT(id: string): Promise<void> {
  const before = await getRRT(id)
  if (!before) return
  await withAudit(
    {
      action: 'delete',
      resource: { type: 'rrt', id, label: before.numeroRRT ?? before.descricao.slice(0, 40) },
    },
    () => deleteDoc(doc(db, COL, id)),
  )
}

export async function alertBoletoPaid(id: string): Promise<void> {
  const before = await getRRT(id)
  if (!before) throw new Error('RRT não encontrada')
  const user = useAuthStore.getState().user
  if (!user) throw new Error('Não autenticado')

  await withAudit(
    {
      action: 'alert_payment',
      resource: { type: 'rrt', id, label: before.numeroRRT ?? before.descricao.slice(0, 40) },
    },
    () =>
      updateDoc(doc(db, COL, id), {
        boletoAlertedAt: serverTimestamp(),
        boletoAlertedBy: user.uid,
        updatedAt: serverTimestamp(),
      }),
  )
}

export async function alertRRTPayment(id: string): Promise<void> {
  const before = await getRRT(id)
  if (!before) throw new Error('RRT não encontrada')
  const user = useAuthStore.getState().user
  if (!user) throw new Error('Não autenticado')

  await withAudit(
    {
      action: 'alert_payment',
      resource: { type: 'rrt', id, label: before.numeroRRT ?? before.descricao.slice(0, 40) },
    },
    () =>
      updateDoc(doc(db, COL, id), {
        paymentAlertedAt: serverTimestamp(),
        paymentAlertedBy: user.uid,
        updatedAt: serverTimestamp(),
      }),
  )
}
