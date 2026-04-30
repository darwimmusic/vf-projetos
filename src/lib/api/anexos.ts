import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
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
  const q = query(
    collection(db, parent, parentId, 'anexos'),
    orderBy('uploadedAt', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Anexo)
}

export async function createAnexo(params: CreateAnexoParams): Promise<string> {
  const user = useAuthStore.getState().user
  if (!user) throw new Error('Não autenticado')

  const path = `${params.parent}/${params.parentId}/${params.categoria ?? 'OUTRO'}`
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
