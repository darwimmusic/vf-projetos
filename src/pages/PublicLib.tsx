import { useEffect, useState } from 'react'
import { Download, FileText, IdCard, Receipt, FileSignature } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Logo } from '@/components/Logo'
import { listPublicLib, getSignedUrl } from '@/lib/api/public-lib'
import type { PublicLibItem, PublicLibCategory } from '@/types'
import { formatDate } from '@/lib/format'

const CATEGORY_ICON: Record<PublicLibCategory, React.ComponentType<{ size?: number }>> = {
  CAU: IdCard,
  IDENTIDADE: IdCard,
  COMPROVANTE: Receipt,
  CONTRATO: FileSignature,
  OUTRO: FileText,
}

const CATEGORY_LABEL: Record<PublicLibCategory, string> = {
  CAU: 'CAU',
  IDENTIDADE: 'Identidade',
  COMPROVANTE: 'Comprovantes',
  CONTRATO: 'Contratos',
  OUTRO: 'Outros',
}

export default function PublicLib() {
  const [items, setItems] = useState<PublicLibItem[] | null>(null)

  useEffect(() => {
    void listPublicLib(true).then(setItems)
  }, [])

  async function handleDownload(item: PublicLibItem) {
    const url = await getSignedUrl(item.storagePath)
    window.open(url, '_blank', 'noopener')
  }

  return (
    <main className="min-h-screen bg-linen px-6 py-12">
      <div className="mx-auto flex max-w-[1080px] flex-col gap-10">
        <header className="flex flex-col items-center gap-4 text-center">
          <Logo size="lg" />
          <p className="max-w-md text-sm text-muted">
            Documentos públicos do arquiteto Victor Lima Ferreira (CAU 00A2723948).
          </p>
        </header>

        {items === null ? (
          <Skeleton className="h-64" />
        ) : items.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState title="Sem documentos publicados ainda" />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map(item => {
              const Icon = CATEGORY_ICON[item.category]
              return (
                <Card key={item.id}>
                  <CardContent className="flex flex-col gap-3 p-5">
                    <div className="flex items-center gap-2 text-muted">
                      <Icon size={18} />
                      <span className="text-[10px] font-semibold uppercase tracking-wider">
                        {CATEGORY_LABEL[item.category]}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-serif text-xl text-onyx">{item.title}</h3>
                      {item.description && (
                        <p className="mt-1 text-sm text-muted">{item.description}</p>
                      )}
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <span className="text-[10px] uppercase tracking-wider text-muted">
                        {formatDate(item.uploadedAt)} · {(item.size / 1024).toFixed(0)}KB
                      </span>
                      <Button size="sm" onClick={() => handleDownload(item)}>
                        <Download size={14} /> Baixar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
