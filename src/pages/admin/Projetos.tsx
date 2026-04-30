import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProjetoStatusPill } from '@/components/ui/StatusPill'
import { listProjetos, createProjeto } from '@/lib/api/projetos'
import { listCompanies } from '@/lib/api/companies'
import { projetoSchema, type ProjetoInput } from '@/lib/validations'
import { brl, formatDate } from '@/lib/format'
import { toast } from '@/components/ui/Toast'
import type { Projeto, Company } from '@/types'

export default function AdminProjetos() {
  const [projetos, setProjetos] = useState<Projeto[] | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  async function reload() {
    setProjetos(null)
    const [p, c] = await Promise.all([listProjetos(), listCompanies()])
    setProjetos(p)
    setCompanies(c)
  }

  useEffect(() => {
    void reload()
  }, [])

  const filtered =
    projetos?.filter(p => {
      if (!search) return true
      const s = search.toLowerCase()
      return (
        p.nome.toLowerCase().includes(s) ||
        p.companyName.toLowerCase().includes(s) ||
        (p.oc ?? '').toLowerCase().includes(s)
      )
    }) ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-4xl text-onyx">Projetos</h1>
          <p className="mt-1 text-sm text-muted">Cenografia, ativações, projetos técnicos.</p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={companies.length === 0}>
          <Plus size={16} /> Novo projeto
        </Button>
      </div>

      <div className="relative w-80">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input
          placeholder="Buscar…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {projetos === null ? (
            <div className="p-6">
              <Skeleton className="h-32" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title={search ? 'Nada encontrado' : 'Sem projetos'}
              description={
                search
                  ? 'Tente outro termo.'
                  : companies.length === 0
                    ? 'Cadastre uma empresa primeiro em /admin/clientes.'
                    : 'Crie o primeiro projeto.'
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map(p => (
                <li key={p.id}>
                  <Link
                    to={`/admin/projetos/${p.id}`}
                    className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-sunken"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-onyx">{p.nome}</span>
                      <span className="text-xs text-muted">
                        {p.companyName} · {formatDate(p.dataCriacao)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted">{brl(p.valor)}</span>
                      <ProjetoStatusPill status={p.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <NewProjetoModal
        open={open}
        onOpenChange={setOpen}
        companies={companies}
        onCreated={reload}
      />
    </div>
  )
}

function NewProjetoModal({
  open,
  onOpenChange,
  companies,
  onCreated,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  companies: Company[]
  onCreated(): void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ProjetoInput>({
    resolver: zodResolver(projetoSchema),
    defaultValues: { descricao: '', tags: [], valor: 0 },
  })

  async function onSubmit(data: ProjetoInput) {
    try {
      await createProjeto({ ...data, valor: Math.round(Number(data.valor) * 100) })
      toast.success('Projeto criado')
      reset()
      onOpenChange(false)
      onCreated()
    } catch (e) {
      toast.error('Falha', e instanceof Error ? e.message : 'Erro')
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Novo projeto">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            Empresa cliente
          </span>
          <select
            {...register('companyId')}
            className="h-12 rounded-xl border border-transparent bg-sunken px-4 text-base text-onyx outline-none focus:border-onyx focus:bg-elevated"
          >
            <option value="">Selecione…</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.companyId && (
            <span className="text-xs text-danger">{errors.companyId.message}</span>
          )}
        </label>

        <Input label="Nome" {...register('nome')} error={errors.nome?.message} />
        <Input label="OC (opcional)" {...register('oc')} error={errors.oc?.message} />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Empresa faturamento"
            {...register('empresaFaturamento')}
            error={errors.empresaFaturamento?.message}
          />
          <Input
            label="CNPJ faturamento"
            {...register('cnpjFaturamento')}
            error={errors.cnpjFaturamento?.message}
          />
        </div>
        <Input
          label="Valor (R$)"
          type="number"
          step="0.01"
          {...register('valor', { valueAsNumber: true })}
          error={errors.valor?.message}
          helperText="Será convertido em centavos automaticamente."
        />
        <Input label="Local" {...register('local')} error={errors.local?.message} />
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            Descrição
          </span>
          <textarea
            {...register('descricao')}
            rows={3}
            className="rounded-xl border border-transparent bg-sunken px-4 py-3 text-sm text-onyx outline-none focus:border-onyx focus:bg-elevated"
          />
        </label>

        <div className="mt-2 flex justify-end gap-3">
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Criar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
