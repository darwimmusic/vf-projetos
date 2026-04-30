import { useEffect, useState } from 'react'
import { FileText, Download, Trash2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { listAnexos, deleteAnexo } from '@/lib/api/anexos'
import { getSignedUrl } from '@/lib/storage'
import { formatDate } from '@/lib/format'
import { useCan } from '@/lib/rbac'
import { toast } from '@/components/ui/Toast'
import type { Anexo } from '@/types'

interface Props {
  parent: 'projetos' | 'rrts' | 'chamados'
  parentId: string
  parentLabel: string
  refreshKey?: number
}

export function AnexosList({ parent, parentId, parentLabel, refreshKey }: Props) {
  const [anexos, setAnexos] = useState<Anexo[] | null>(null)
  const canDelete = useCan('delete', 'anexo')

  useEffect(() => {
    setAnexos(null)
    void listAnexos(parent, parentId).then(setAnexos)
  }, [parent, parentId, refreshKey])

  if (anexos === null) return <Skeleton className="h-20" />
  if (anexos.length === 0)
    return <p className="text-sm text-muted">Nenhum arquivo anexado.</p>

  async function handleDownload(a: Anexo) {
    const url = await getSignedUrl(a.storagePath)
    window.open(url, '_blank', 'noopener')
  }

  async function handleDelete(a: Anexo) {
    if (!confirm(`Deletar ${a.filename}?`)) return
    try {
      await deleteAnexo(parent, parentId, a.id, a.storagePath, parentLabel)
      setAnexos(prev => prev?.filter(x => x.id !== a.id) ?? null)
      toast.success('Anexo deletado')
    } catch (e) {
      toast.error('Falha', e instanceof Error ? e.message : 'Erro')
    }
  }

  return (
    <ul className="flex flex-col gap-2">
      {anexos.map(a => (
        <li
          key={a.id}
          className="flex items-center gap-3 rounded-lg border border-border bg-sunken px-3 py-2"
        >
          <FileText size={16} className="text-muted" />
          <div className="flex flex-1 flex-col">
            <span className="text-sm text-onyx">{a.filename}</span>
            <span className="text-xs text-muted">
              {formatDate(a.uploadedAt)} · {a.uploadedByName} · {(a.size / 1024).toFixed(1)} KB
            </span>
          </div>
          {a.categoria && <Badge variant="info">{a.categoria}</Badge>}
          <button
            onClick={() => handleDownload(a)}
            aria-label="Download"
            className="rounded-md p-1.5 text-muted hover:bg-elevated hover:text-onyx"
          >
            <Download size={14} />
          </button>
          {canDelete && (
            <button
              onClick={() => handleDelete(a)}
              aria-label="Deletar"
              className="rounded-md p-1.5 text-muted hover:bg-elevated hover:text-danger"
            >
              <Trash2 size={14} />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
