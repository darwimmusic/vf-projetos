import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../firebase'
import { withAudit } from '../audit'
import { useAuthStore } from '@/stores/auth.store'
import { getCompany } from './companies'
import { createNotification } from './notificacoes'
import type { Chamado, ChamadoStatus, Mensagem } from '@/types'

const COL = 'chamados'

interface CreateChamadoInput {
  companyId: string
  titulo: string
  descricao: string
  tipo: Chamado['tipo']
  prioridade: Chamado['prioridade']
}

export async function listChamados(filters?: {
  companyId?: string
  status?: ChamadoStatus
}): Promise<Chamado[]> {
  let q
  if (filters?.companyId) {
    q = query(collection(db, COL), where('companyId', '==', filters.companyId))
  } else if (filters?.status) {
    q = query(collection(db, COL), where('status', '==', filters.status))
  } else {
    q = query(collection(db, COL), orderBy('ultimaInteracao', 'desc'))
  }
  const snap = await getDocs(q)
  let list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Chamado)
  if (filters?.status && filters.companyId) {
    list = list.filter(c => c.status === filters.status)
  }
  return list.sort((a, b) => {
    const at = a.ultimaInteracao?.toMillis?.() ?? 0
    const bt = b.ultimaInteracao?.toMillis?.() ?? 0
    return bt - at
  })
}

export async function getChamado(id: string): Promise<Chamado | null> {
  const snap = await getDoc(doc(db, COL, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Chamado
}

export async function createChamado(input: CreateChamadoInput): Promise<string> {
  const user = useAuthStore.getState().user
  if (!user) throw new Error('Não autenticado')
  const company = await getCompany(input.companyId)
  if (!company) throw new Error('Empresa não encontrada')

  const ref = await withAudit(
    {
      action: 'open_ticket',
      resource: { type: 'chamado', id: 'pending', label: input.titulo },
    },
    () =>
      addDoc(collection(db, COL), {
        ...input,
        companyName: company.name,
        openedBy: user.uid,
        openedByName: user.displayName,
        status: 'ABERTO' as ChamadoStatus,
        dataAbertura: serverTimestamp(),
        ultimaInteracao: serverTimestamp(),
        qtdMensagens: 0,
        qtdAnexos: 0,
      }),
  )

  // Notifica admin
  await createNotification({
    recipientUid: 'admin', // será resolvido no W3 — por hora envia genérico
    recipientRole: 'admin',
    type: 'ticket_opened',
    title: `Novo chamado: ${input.titulo}`,
    body: `${user.displayName} (${company.name}) abriu um chamado.`,
    link: `/admin/chamados/${ref.id}`,
    resource: { type: 'chamado', id: ref.id },
    actorName: user.displayName,
  }).catch(e => console.warn('[notif] falha ao notificar admin:', e))

  return ref.id
}

export async function advanceChamadoStatus(id: string, to: ChamadoStatus): Promise<void> {
  const before = await getChamado(id)
  if (!before) throw new Error('Chamado não encontrado')

  await withAudit(
    {
      action: 'status_advance',
      resource: { type: 'chamado', id, label: before.titulo },
      diff: { before: { status: before.status }, after: { status: to }, fields: ['status'] },
    },
    () =>
      updateDoc(doc(db, COL, id), {
        status: to,
        ultimaInteracao: serverTimestamp(),
        ...(to === 'FECHADO' && { dataFechamento: serverTimestamp() }),
      }),
  )
}

export async function deleteChamado(id: string): Promise<void> {
  const before = await getChamado(id)
  if (!before) return
  await withAudit(
    { action: 'delete', resource: { type: 'chamado', id, label: before.titulo } },
    () => deleteDoc(doc(db, COL, id)),
  )
}

// ─── MENSAGENS ────────────────────────────────────────────────

export function subscribeMensagens(
  chamadoId: string,
  onChange: (msgs: Mensagem[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, COL, chamadoId, 'mensagens'),
    orderBy('timestamp', 'asc'),
  )
  return onSnapshot(q, snap => {
    onChange(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Mensagem))
  })
}

/** Atomicamente: cria msg + incrementa contador e ultimaInteracao no chamado pai. */
export async function postMensagem(
  chamadoId: string,
  text: string,
  anexoIds?: string[],
): Promise<void> {
  const user = useAuthStore.getState().user
  if (!user) throw new Error('Não autenticado')

  await runTransaction(db, async tx => {
    const chamadoRef = doc(db, COL, chamadoId)
    const chamadoSnap = await tx.get(chamadoRef)
    if (!chamadoSnap.exists()) throw new Error('Chamado não encontrado')
    const data = chamadoSnap.data() as Chamado

    const msgRef = doc(collection(db, COL, chamadoId, 'mensagens'))
    tx.set(msgRef, {
      authorId: user.uid,
      authorName: user.displayName,
      authorRole: user.role,
      text,
      timestamp: serverTimestamp(),
      ...(anexoIds && anexoIds.length > 0 && { anexoIds }),
    })

    tx.update(chamadoRef, {
      qtdMensagens: (data.qtdMensagens ?? 0) + 1,
      ultimaInteracao: serverTimestamp(),
      ...(anexoIds && anexoIds.length > 0 && { qtdAnexos: (data.qtdAnexos ?? 0) + anexoIds.length }),
    })

    // Notifica o "outro lado"
    const isAdminAuthor = user.role === 'admin'
    if (isAdminAuthor) {
      // notifica o cliente (openedBy)
      const notifRef = doc(collection(db, 'notificacoes'))
      tx.set(notifRef, {
        recipientUid: data.openedBy,
        recipientRole: 'company_member',
        type: 'ticket_replied',
        title: `Nova resposta no chamado: ${data.titulo}`,
        body: text.slice(0, 100),
        link: `/c/chamados/${chamadoId}`,
        read: false,
        createdAt: serverTimestamp(),
        resource: { type: 'chamado', id: chamadoId },
        actorName: user.displayName,
      })
    } else {
      // notifica admin
      const notifRef = doc(collection(db, 'notificacoes'))
      tx.set(notifRef, {
        recipientUid: 'admin', // simplified — Onda 3 resolve via lookup
        recipientRole: 'admin',
        type: 'ticket_replied',
        title: `Cliente respondeu: ${data.titulo}`,
        body: text.slice(0, 100),
        link: `/admin/chamados/${chamadoId}`,
        read: false,
        createdAt: serverTimestamp(),
        resource: { type: 'chamado', id: chamadoId },
        actorName: user.displayName,
      })
    }
  })
}

/** Convert chamado em projeto + opcionalmente RRT. */
export async function convertChamado(
  chamadoId: string,
  options: { criarRRT: boolean },
): Promise<{ projetoId: string; rrtId?: string }> {
  const chamado = await getChamado(chamadoId)
  if (!chamado) throw new Error('Chamado não encontrado')
  const user = useAuthStore.getState().user
  if (!user) throw new Error('Não autenticado')

  // Cria projeto via API
  const { createProjeto } = await import('./projetos')
  const projetoId = await createProjeto({
    companyId: chamado.companyId,
    nome: chamado.titulo,
    descricao: chamado.descricao,
    empresaFaturamento: chamado.companyName,
    cnpjFaturamento: '',
    valor: 0,
    tags: ['origem-chamado'],
  })

  let rrtId: string | undefined
  if (options.criarRRT) {
    const { createRRT } = await import('./rrts')
    rrtId = await createRRT({
      companyId: chamado.companyId,
      projetoId,
      empresaFaturamento: chamado.companyName,
      cnpjFaturamento: '',
      contratante: chamado.companyName,
      descricao: chamado.descricao,
      valorBruto: 0,
      taxaCAU: 13064,
      boletoPorMim: false,
    })
  }

  await withAudit(
    {
      action: 'status_advance',
      resource: { type: 'chamado', id: chamadoId, label: chamado.titulo },
      diff: {
        before: { status: chamado.status },
        after: { status: 'CONVERTIDO' },
        fields: ['status'],
      },
      metadata: { notes: `→ projeto/${projetoId}${rrtId ? `, rrt/${rrtId}` : ''}` },
    },
    () =>
      updateDoc(doc(db, COL, chamadoId), {
        status: 'CONVERTIDO' as ChamadoStatus,
        projetoIdGerado: projetoId,
        ...(rrtId && { rrtIdGerado: rrtId }),
        ultimaInteracao: serverTimestamp(),
      }),
  )

  return { projetoId, ...(rrtId && { rrtId }) }
}

// ─── helpers ──────────────────────────────────────────────────

export function formatChamadoAge(dataAbertura: Timestamp | undefined): string {
  if (!dataAbertura) return '—'
  const ms = Date.now() - dataAbertura.toDate().getTime()
  const days = Math.floor(ms / 86400000)
  if (days === 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 7) return `${days}d atrás`
  if (days < 30) return `${Math.floor(days / 7)}sem atrás`
  return `${Math.floor(days / 30)}m atrás`
}
