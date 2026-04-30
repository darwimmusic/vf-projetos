import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type UploadTask,
} from 'firebase/storage'
import { storage } from './firebase'
import { withAudit } from './audit'
import { slugify } from './format'
import type { AnexoCategoria } from '@/types'

const MAX_SIZE_MB = 50
const ALLOWED_MIMES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]

interface UploadParams {
  path: string // ex: "projetos/{projetoId}/{categoria}"
  file: File
  entityType: 'projeto' | 'rrt' | 'chamado' | 'public_lib' | 'company' | 'user'
  entityId: string
  entityLabel: string
  categoria?: AnexoCategoria
  onProgress?: (percent: number) => void
}

interface UploadResult {
  storagePath: string
  filename: string
  size: number
  mimeType: string
  downloadURL: string
}

/** Validação client-side antes de subir (rules são defesa real). */
function validate(file: File): void {
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`Arquivo muito grande. Máximo: ${MAX_SIZE_MB}MB.`)
  }
  if (!ALLOWED_MIMES.includes(file.type)) {
    throw new Error(`Tipo não suportado: ${file.type}. Aceitos: PDF, PNG, JPEG, WEBP, SVG.`)
  }
}

/** Filename normalizado: 2026-04-29_briefing_{entityId-prefix}.{ext} */
function buildFilename(file: File, entityId: string): string {
  const today = new Date().toISOString().slice(0, 10)
  const ext = file.name.split('.').pop() ?? 'bin'
  const baseSlug = slugify(file.name.replace(/\.[^.]+$/, ''))
  return `${today}_${baseSlug}_${entityId.slice(0, 6)}.${ext}`
}

export async function uploadFile(params: UploadParams): Promise<UploadResult> {
  validate(params.file)

  const filename = buildFilename(params.file, params.entityId)
  const fullPath = `${params.path}/${filename}`
  const storageRef = ref(storage, fullPath)

  const task: UploadTask = uploadBytesResumable(storageRef, params.file, {
    contentType: params.file.type,
    customMetadata: {
      entityType: params.entityType,
      entityId: params.entityId,
      ...(params.categoria && { categoria: params.categoria }),
    },
  })

  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      snapshot => {
        const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        params.onProgress?.(percent)
      },
      reject,
      () => resolve(),
    )
  })

  const downloadURL = await getDownloadURL(storageRef)

  return withAudit(
    {
      action: 'upload',
      resource: { type: 'anexo', id: filename, label: `${params.entityLabel} → ${filename}` },
      metadata: { notes: `${(params.file.size / 1024).toFixed(1)} KB · ${params.file.type}` },
    },
    async () => ({
      storagePath: fullPath,
      filename,
      size: params.file.size,
      mimeType: params.file.type,
      downloadURL,
    }),
  )
}

/** Gera URL temporária (default 1h) — Firebase Storage handles signing internamente. */
export async function getSignedUrl(storagePath: string): Promise<string> {
  const storageRef = ref(storage, storagePath)
  const url = await getDownloadURL(storageRef)

  // Audit não-bloqueante
  void withAudit(
    {
      action: 'download',
      resource: { type: 'anexo', id: storagePath, label: storagePath },
    },
    async () => undefined,
  ).catch(() => undefined)

  return url
}

export async function deleteFile(storagePath: string, entityLabel: string): Promise<void> {
  const storageRef = ref(storage, storagePath)
  await withAudit(
    {
      action: 'delete_file',
      resource: { type: 'anexo', id: storagePath, label: entityLabel },
    },
    () => deleteObject(storageRef),
  )
}
