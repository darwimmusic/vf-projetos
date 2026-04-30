import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { createAnexo } from '@/lib/api/anexos'
import type { AnexoCategoria } from '@/types'
import { toast } from '@/components/ui/Toast'

interface Props {
  parent: 'projetos' | 'rrts' | 'chamados'
  parentId: string
  parentLabel: string
  categoria?: AnexoCategoria
  onUploaded(): void
}

export function FileUploader({ parent, parentId, parentLabel, categoria, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setProgress(0)
    try {
      await createAnexo({
        parent,
        parentId,
        parentLabel,
        file,
        categoria,
        onProgress: setProgress,
      })
      toast.success('Upload concluído', file.name)
      onUploaded()
    } catch (err) {
      toast.error('Falha no upload', err instanceof Error ? err.message : 'Erro')
    } finally {
      setBusy(false)
      setProgress(0)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        onChange={handleChange}
        className="hidden"
      />
      <Button
        variant="secondary"
        size="sm"
        onClick={() => inputRef.current?.click()}
        loading={busy}
      >
        <Upload size={14} /> {busy ? `${progress.toFixed(0)}%` : 'Anexar'}
      </Button>
    </>
  )
}
