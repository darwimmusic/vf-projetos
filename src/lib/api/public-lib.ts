import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { uploadFile, getSignedUrl } from '../storage'
import { withAudit } from '../audit'
import { useAuthStore } from '@/stores/auth.store'
import type { PublicLibItem, PublicLibCategory } from '@/types'

const COL = 'public_lib'

export async function listPublicLib(activeOnly = true): Promise<PublicLibItem[]> {
  const q = activeOnly
    ? query(collection(db, COL), where('active', '==', true), orderBy('uploadedAt', 'desc'))
    : query(collection(db, COL), orderBy('uploadedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as PublicLibItem)
}

export async function uploadPublicLibItem(input: {
  file: File
  title: string
  description?: string
  category: PublicLibCategory
}): Promise<string> {
  const user = useAuthStore.getState().user
  if (!user) throw new Error('Não autenticado')

  const upload = await uploadFile({
    path: `public_lib/${input.category}`,
    file: input.file,
    entityType: 'public_lib',
    entityId: 'public',
    entityLabel: input.title,
  })

  const ref = await addDoc(collection(db, COL), {
    storagePath: upload.storagePath,
    filename: upload.filename,
    title: input.title,
    description: input.description ?? '',
    category: input.category,
    size: upload.size,
    mimeType: upload.mimeType,
    uploadedBy: user.uid,
    uploadedAt: serverTimestamp(),
    active: true,
  })

  return ref.id
}

export async function togglePublicLibActive(id: string, active: boolean): Promise<void> {
  await withAudit(
    {
      action: 'update',
      resource: { type: 'anexo', id, label: 'public_lib item' },
      diff: { before: { active: !active }, after: { active }, fields: ['active'] },
    },
    () => updateDoc(doc(db, COL, id), { active }),
  )
}

export async function deletePublicLibItem(id: string): Promise<void> {
  await withAudit(
    { action: 'delete', resource: { type: 'anexo', id, label: 'public_lib item' } },
    () => deleteDoc(doc(db, COL, id)),
  )
}

export { getSignedUrl }
