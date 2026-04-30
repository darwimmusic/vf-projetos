import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createChamado } from '@/lib/api/chamados'
import { createAnexo } from '@/lib/api/anexos'
import { toast } from '@/components/ui/Toast'

const schema = z.object({
  titulo: z.string().min(4).max(120),
  descricao: z.string().min(10).max(2000),
  tipo: z.enum(['novo_projeto', 'duvida', 'alteracao', 'urgente', 'outro']),
  prioridade: z.enum(['baixa', 'media', 'alta', 'critica']),
})
type FormData = z.infer<typeof schema>

export default function NovoChamado() {
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: 'novo_projeto', prioridade: 'media' },
  })

  async function onSubmit(data: FormData) {
    if (!user?.companyId) {
      toast.error('Sem empresa associada')
      return
    }
    setSubmitting(true)
    try {
      const id = await createChamado({ ...data, companyId: user.companyId })
      // Upload de anexos sequencial
      for (const file of files) {
        await createAnexo({
          parent: 'chamados',
          parentId: id,
          parentLabel: data.titulo,
          file,
          categoria: 'BRIEFING',
        })
      }
      toast.success('Chamado aberto', 'Victor foi notificado.')
      navigate(`/c/chamados/${id}`)
    } catch (e) {
      toast.error('Falha', e instanceof Error ? e.message : 'Erro')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/c/chamados"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-onyx"
      >
        <ArrowLeft size={14} /> Chamados
      </Link>

      <div>
        <h1 className="font-serif text-4xl text-onyx">Novo chamado</h1>
        <p className="mt-1 text-sm text-muted">
          Briefing, dúvida ou pedido de alteração — tudo em um só lugar.
        </p>
      </div>

      <Card>
        <CardContent className="px-8 py-8">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <Input
              label="Título"
              placeholder="Ex: Sessão Especial Diabo Veste Prada 2"
              {...register('titulo')}
              error={errors.titulo?.message}
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                Descrição / briefing
              </span>
              <textarea
                {...register('descricao')}
                rows={6}
                placeholder="Conte o que você precisa, datas, escopo, referências…"
                className="rounded-xl border border-transparent bg-sunken px-4 py-3 text-sm focus:border-onyx focus:bg-elevated"
              />
              {errors.descricao && (
                <span className="text-xs text-danger">{errors.descricao.message}</span>
              )}
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Tipo
                </span>
                <select
                  {...register('tipo')}
                  className="h-12 rounded-xl border border-transparent bg-sunken px-4 focus:border-onyx focus:bg-elevated"
                >
                  <option value="novo_projeto">Novo projeto</option>
                  <option value="duvida">Dúvida</option>
                  <option value="alteracao">Alteração</option>
                  <option value="urgente">Urgente</option>
                  <option value="outro">Outro</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Prioridade
                </span>
                <select
                  {...register('prioridade')}
                  className="h-12 rounded-xl border border-transparent bg-sunken px-4 focus:border-onyx focus:bg-elevated"
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="critica">Crítica</option>
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                Anexos (opcional)
              </span>
              <input
                type="file"
                multiple
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={e => setFiles(Array.from(e.target.files ?? []))}
                className="text-sm"
              />
              {files.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
                  {files.map((f, i) => (
                    <li key={i}>
                      {f.name} ({(f.size / 1024).toFixed(0)} KB)
                    </li>
                  ))}
                </ul>
              )}
            </label>

            <div className="mt-2 flex justify-end gap-3">
              <Link to="/c/chamados">
                <Button type="button" variant="ghost">
                  Cancelar
                </Button>
              </Link>
              <Button type="submit" loading={submitting}>
                Abrir chamado
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
