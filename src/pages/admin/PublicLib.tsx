import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import {
  listPublicLib,
  uploadPublicLibItem,
  togglePublicLibActive,
  deletePublicLibItem,
} from '@/lib/api/public-lib'
import { formatDate } from '@/lib/format'
import { toast } from '@/components/ui/Toast'
import type { PublicLibItem, PublicLibCategory } from '@/types'

export default function AdminPublicLib() {
  const [items, setItems] = useState<PublicLibItem[] | null>(null)
  const [open, setOpen] = useState(false)

  async function reload() {
    setItems(null)
    setItems(await listPublicLib(false))
  }

  useEffect(() => {
    void reload()
  }, [])

  async function toggleActive(id: string, current: boolean) {
    try {
      await togglePublicLibActive(id, !current)
      void reload()
    } catch (e) {
      toast.error('Falha', e instanceof Error ? e.message : 'Erro')
    }
  }

  async function deleteItem(id: string) {
    if (!confirm('Deletar este item permanentemente?')) return
    try {
      await deletePublicLibItem(id)
      toast.success('Item deletado')
      void reload()
    } catch (e) {
      toast.error('Falha', e instanceof Error ? e.message : 'Erro')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-4xl text-onyx">Biblioteca Pública</h1>
          <p className="mt-1 text-sm text-muted">
            Carteira CAU, identidade e contratos visíveis em <code>/public-lib</code>.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} /> Novo item
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {items === null ? (
            <div className="p-6">
              <Skeleton className="h-32" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState title="Sem itens" description="Adicione carteira CAU, RG, etc." />
          ) : (
            <ul className="divide-y divide-border">
              {items.map(item => (
                <li
                  key={item.id}
                  className="flex items-center gap-4 px-6 py-4"
                >
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-onyx">{item.title}</span>
                      <Badge variant="info">{item.category}</Badge>
                      {!item.active && <Badge variant="neutral">Inativo</Badge>}
                    </div>
                    <span className="text-xs text-muted">
                      {item.filename} · {formatDate(item.uploadedAt)} ·{' '}
                      {(item.size / 1024).toFixed(0)}KB
                    </span>
                  </div>
                  <button
                    onClick={() => toggleActive(item.id, item.active)}
                    className="rounded-md p-1.5 text-muted hover:bg-sunken hover:text-onyx"
                    aria-label={item.active ? 'Desativar' : 'Ativar'}
                  >
                    {item.active ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="rounded-md p-1.5 text-muted hover:bg-sunken hover:text-danger"
                    aria-label="Deletar"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <UploadModal open={open} onOpenChange={setOpen} onCreated={reload} />
    </div>
  )
}

function UploadModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  onCreated(): void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<PublicLibCategory>('CAU')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit() {
    if (!file || !title) {
      toast.error('Preencha título e arquivo')
      return
    }
    setSubmitting(true)
    try {
      await uploadPublicLibItem({ file, title, description, category })
      toast.success('Item publicado')
      setTitle('')
      setDescription('')
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
      onOpenChange(false)
      onCreated()
    } catch (e) {
      toast.error('Falha', e instanceof Error ? e.message : 'Erro')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Novo item">
      <div className="flex flex-col gap-4">
        <Input
          label="Título"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Carteira CAU 2026"
        />
        <Input
          label="Descrição (opcional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            Categoria
          </span>
          <select
            value={category}
            onChange={e => setCategory(e.target.value as PublicLibCategory)}
            className="h-12 rounded-xl border border-transparent bg-sunken px-4 focus:border-onyx focus:bg-elevated"
          >
            <option value="CAU">CAU</option>
            <option value="IDENTIDADE">Identidade</option>
            <option value="COMPROVANTE">Comprovante</option>
            <option value="CONTRATO">Contrato</option>
            <option value="OUTRO">Outro</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            Arquivo
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </label>
        <div className="mt-2 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={!file || !title}>
            Publicar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
