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
import { apiCreateUser } from './admin-api'
import type { Company } from '@/types'
import type { CompanyInput } from '../validations'

const COL = 'companies'

export interface CreateCompanyWithOwnerInput extends CompanyInput {
  ownerPassword: string
  ownerDisplayName?: string
}

export async function listCompanies(activeOnly = true): Promise<Company[]> {
  // Sem composite index — busca tudo orderBy name, filtra client-side.
  // Volume baixo (<100 empresas) torna isso aceitável.
  const q = query(collection(db, COL), orderBy('name'))
  const snap = await getDocs(q)
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Company)
  return activeOnly ? all.filter(c => c.active !== false) : all
}

export async function getCompany(id: string): Promise<Company | null> {
  const snap = await getDoc(doc(db, COL, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Company
}

export async function createCompany(input: CompanyInput, ownerId = ''): Promise<string> {
  // Pré-validação: slug único
  const existing = await getDocs(query(collection(db, COL), where('slug', '==', input.slug)))
  if (!existing.empty) throw new Error(`Slug "${input.slug}" já em uso.`)

  const ref = await withAudit(
    {
      action: 'create',
      resource: { type: 'company', id: 'pending', label: input.name },
    },
    () =>
      addDoc(collection(db, COL), {
        ...input,
        cnpj: normalizeCnpj(input.cnpj),
        ownerId,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
  )
  return ref.id
}

/**
 * Cria empresa + owner em sequência. Username do owner = slug.
 * Se a criação do owner falhar, a empresa ainda existe — admin pode tentar de novo
 * pela tela de detalhes.
 */
export async function createCompanyWithOwner(
  input: CreateCompanyWithOwnerInput,
): Promise<{ companyId: string; ownerUid: string }> {
  const { ownerPassword, ownerDisplayName, ...companyInput } = input
  const companyId = await createCompany(companyInput)
  const result = await apiCreateUser({
    mode: 'owner',
    username: companyInput.slug,
    password: ownerPassword,
    displayName: ownerDisplayName ?? companyInput.name,
    companyId,
  })
  return { companyId, ownerUid: result.uid }
}

export async function updateCompany(id: string, patch: Partial<CompanyInput>): Promise<void> {
  const before = await getCompany(id)
  if (!before) throw new Error('Empresa não encontrada')

  await withAudit(
    {
      action: 'update',
      resource: { type: 'company', id, label: before.name },
      diff: { before, after: { ...before, ...patch }, fields: Object.keys(patch) },
    },
    () =>
      updateDoc(doc(db, COL, id), {
        ...patch,
        ...(patch.cnpj && { cnpj: normalizeCnpj(patch.cnpj) }),
        updatedAt: serverTimestamp(),
      }),
  )
}

export async function deactivateCompany(id: string): Promise<void> {
  const before = await getCompany(id)
  if (!before) return
  await withAudit(
    {
      action: 'delete',
      resource: { type: 'company', id, label: before.name },
    },
    () => updateDoc(doc(db, COL, id), { active: false, updatedAt: serverTimestamp() }),
  )
}

/** Hard delete — usar com cuidado, só admin via UI */
export async function deleteCompany(id: string): Promise<void> {
  const before = await getCompany(id)
  if (!before) return
  await withAudit(
    {
      action: 'delete',
      resource: { type: 'company', id, label: before.name },
    },
    () => deleteDoc(doc(db, COL, id)),
  )
}
