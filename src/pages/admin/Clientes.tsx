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
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { listCompanies, createCompany } from '@/lib/api/companies'
import { companySchema, type CompanyInput } from '@/lib/validations'
import { formatCnpj } from '@/lib/format'
import { toast } from '@/components/ui/Toast'
import type { Company } from '@/types'

export default function AdminClientes() {
  const [companies, setCompanies] = useState<Company[] | null>(null)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  async function reload() {
    setCompanies(null)
    setCompanies(await listCompanies(false))
  }

  useEffect(() => {
    void reload()
  }, [])

  const filtered =
    companies?.filter(c => {
      if (!search) return true
      const s = search.toLowerCase()
      return c.name.toLowerCase().includes(s) || c.cnpj.includes(s) || c.slug.includes(s)
    }) ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-4xl text-onyx">Clientes</h1>
          <p className="mt-1 text-sm text-muted">Empresas atendidas.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} /> Nova empresa
        </Button>
      </div>

      <div className="relative w-80">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input
          placeholder="Buscar por nome, CNPJ ou slug…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {companies === null ? (
            <div className="p-6">
              <Skeleton className="h-32" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title={search ? 'Nada encontrado' : 'Nenhuma empresa cadastrada'}
              description={
                search ? 'Tente outro termo.' : 'Crie a primeira empresa para começar.'
              }
              action={
                !search && (
                  <Button onClick={() => setOpen(true)}>
                    <Plus size={16} /> Nova empresa
                  </Button>
                )
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map(c => (
                <li key={c.id}>
                  <Link
                    to={`/admin/clientes/${c.id}`}
                    className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-sunken"
                  >
                    <Avatar name={c.name} src={c.logoUrl} size="md" />
                    <div className="flex flex-1 flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-onyx">{c.name}</span>
                        {!c.active && <Badge variant="neutral">Inativa</Badge>}
                      </div>
                      <span className="text-xs text-muted">
                        {formatCnpj(c.cnpj)} · {c.slug}
                      </span>
                    </div>
                    <div className="flex flex-col items-end text-xs text-muted">
                      <span>{c.contactEmail}</span>
                      <span>Prazo NF: {c.prazoNF}d</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <NewCompanyModal open={open} onOpenChange={setOpen} onCreated={reload} />
    </div>
  )
}

function NewCompanyModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  onCreated(): void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CompanyInput>({
    resolver: zodResolver(companySchema),
    defaultValues: { prazoNF: 10 },
  })

  async function onSubmit(data: CompanyInput) {
    try {
      await createCompany(data)
      toast.success('Empresa criada', `${data.name} foi adicionada.`)
      reset()
      onOpenChange(false)
      onCreated()
    } catch (e) {
      toast.error('Falha ao criar', e instanceof Error ? e.message : 'Erro')
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Nova empresa"
      description="Cadastre um cliente. Você pode convidar usuários depois."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label="Nome"
          placeholder="DVI Produções"
          {...register('name')}
          error={errors.name?.message}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Slug"
            placeholder="dvi"
            {...register('slug')}
            error={errors.slug?.message}
            helperText="Usado em login (ex: dvi.joao)"
          />
          <Input
            label="CNPJ"
            placeholder="12.345.678/0001-90"
            {...register('cnpj')}
            error={errors.cnpj?.message}
          />
        </div>
        <Input
          label="Email de contato"
          type="email"
          placeholder="contato@dvi.com.br"
          {...register('contactEmail')}
          error={errors.contactEmail?.message}
        />
        <Input
          label="Prazo NF (dias)"
          type="number"
          {...register('prazoNF', { valueAsNumber: true })}
          error={errors.prazoNF?.message}
        />
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
