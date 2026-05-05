import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { uploadFile, deleteFile } from '../storage'
import { useAuthStore } from '@/stores/auth.store'
import type { Anexo, AnexoCategoria } from '@/types'

interface CreateAnexoParams {
  parent: 'projetos' | 'rrts' | 'chamados'
  parentId: string
  parentLabel: string
  file: File
  categoria?: AnexoCategoria
  descricao?: string
  visibleToClient?: boolean
  onProgress?: (percent: number) => void
}

export async function listAnexos(parent: CreateAnexoParams['parent'], parentId: string): Promise<Anexo[]> {
  // Rules de não-admin exigem `resource.data.visibleToClient == true`.
  // Firestore só autoriza a query se o client filtrar pelo MESMO predicado;
  // sem isso, a query inteira é rejeitada com "Missing or insufficient permissions".
  const role = useAuthStore.getState().user?.role
  const ref = collection(db, parent, parentId, 'anexos')
  const q =
    role === 'admin'
      ? query(ref, orderBy('uploadedAt', 'desc'))
      : query(ref, where('visibleToClient', '==', true), orderBy('uploadedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Anexo)
}

export async function createAnexo(params: CreateAnexoParams): Promise<string> {
  const user = useAuthStore.getState().user
  if (!user) throw new Error('Não autenticado')

  const isPrivate = params.visibleToClient === false
  // Anexos privados moram em path 'INTERNO' — Storage rules usam isso pra
  // bloquear download por member/owner sem precisar ler doc do anexo.
  const folder = isPrivate ? 'INTERNO' : (params.categoria ?? 'OUTRO')
  const path = `${params.parent}/${params.parentId}/${folder}`
  const upload = await uploadFile({
    path,
    file: params.file,
    entityType: params.parent === 'projetos' ? 'projeto' : params.parent === 'rrts' ? 'rrt' : 'chamado',
    entityId: params.parentId,
    entityLabel: params.parentLabel,
    categoria: params.categoria,
    onProgress: params.onProgress,
  })

  const ref = await addDoc(collection(db, params.parent, params.parentId, 'anexos'), {
    storagePath: upload.storagePath,
    filename: upload.filename,
    mimeType: upload.mimeType,
    size: upload.size,
    uploadedBy: user.uid,
    uploadedByName: user.displayName,
    uploadedAt: serverTimestamp(),
    categoria: params.categoria,
    descricao: params.descricao ?? '',
    visibleToClient: params.visibleToClient ?? true,
  })

  return ref.id
}

export async function deleteAnexo(
  parent: CreateAnexoParams['parent'],
  parentId: string,
  anexoId: string,
  storagePath: string,
  parentLabel: string,
): Promise<void> {
  await deleteFile(storagePath, parentLabel)
  await deleteDoc(doc(db, parent, parentId, 'anexos', anexoId))
}
