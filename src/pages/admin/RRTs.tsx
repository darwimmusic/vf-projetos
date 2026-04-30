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
import { RRTStatusPill } from '@/components/ui/StatusPill'
import { listRRTs, createRRT } from '@/lib/api/rrts'
import { listCompanies } from '@/lib/api/companies'
import { rrtSchema, type RRTInput } from '@/lib/validations'
import { brl, formatDate } from '@/lib/format'
import { toast } from '@/components/ui/Toast'
import type { RRT, Company } from '@/types'

export default function AdminRRTs() {
  const [rrts, setRRTs] = useState<RRT[] | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  async function reload() {
    setRRTs(null)
    const [r, c] = await Promise.all([listRRTs(), listCompanies()])
    setRRTs(r)
    setCompanies(c)
  }

  useEffect(() => {
    void reload()
  }, [])

  const filtered =
    rrts?.filter(r => {
      if (!search) return true
      const s = search.toLowerCase()
      return (
        (r.numeroRRT ?? '').toLowerCase().includes(s) ||
        r.companyName.toLowerCase().includes(s) ||
        r.descricao.toLowerCase().includes(s) ||
        (r.oc ?? '').toLowerCase().includes(s)
      )
    }) ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-4xl text-onyx">RRTs</h1>
          <p className="mt-1 text-sm text-muted">Registros de Responsabilidade Técnica.</p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={companies.length === 0}>
          <Plus size={16} /> Nova RRT
        </Button>
      </div>

      <div className="relative w-80">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input
          placeholder="Buscar por número, OC, descrição…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {rrts === null ? (
            <div className="p-6">
              <Skeleton className="h-32" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title={search ? 'Nada encontrado' : 'Sem RRTs'}
              description={
                companies.length === 0
                  ? 'Cadastre uma empresa primeiro em /admin/clientes.'
                  : 'Crie a primeira RRT.'
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map(r => (
                <li key={r.id}>
                  <Link
                    to={`/admin/rrts/${r.id}`}
                    className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-sunken"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-onyx">
                        {r.numeroRRT ?? r.descricao.slice(0, 60)}
                      </span>
                      <span className="text-xs text-muted">
                        {r.companyName} · {formatDate(r.dataCriacao)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted">{brl(r.valorCobradoCliente)}</span>
                      <RRTStatusPill status={r.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <NewRRTModal open={open} onOpenChange={setOpen} companies={companies} onCreated={reload} />
    </div>
  )
}

function NewRRTModal({
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
  } = useForm<RRTInput>({
    resolver: zodResolver(rrtSchema),
    defaultValues: {
      boletoPorMim: false,
      valorBruto: 0,
      taxaCAU: 13064, // R$ 130,64 default em centavos
    },
  })

  async function onSubmit(data: RRTInput) {
    try {
      // form recebe valores em reais → converter pra centavos
      const payload: RRTInput = {
        ...data,
        valorBruto: Math.round(Number(data.valorBruto) * 100),
        taxaCAU: Math.round(Number(data.taxaCAU) * 100),
      }
      await createRRT(payload)
      toast.success('RRT criada')
      reset()
      onOpenChange(false)
      onCreated()
    } catch (e) {
      toast.error('Falha', e instanceof Error ? e.message : 'Erro')
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Nova RRT">
      <form onSubmit={handleSubmit(onSubmit)} className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            Empresa cliente
          </span>
          <select
            {...register('companyId')}
            className="h-12 rounded-xl border border-transparent bg-sunken px-4 text-base text-onyx focus:border-onyx focus:bg-elevated"
          >
            <option value="">Selecione…</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.companyId && <span className="text-xs text-danger">{errors.companyId.message}</span>}
        </label>

        <Input label="Número RRT (opcional)" {...register('numeroRRT')} />
        <Input label="OC (opcional)" {...register('oc')} />

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
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Contratante"
            {...register('contratante')}
            error={errors.contratante?.message}
          />
          <Input label="CNPJ contratante" {...register('cnpjContratante')} />
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Descrição</span>
          <textarea
            {...register('descricao')}
            rows={2}
            className="rounded-xl border border-transparent bg-sunken px-4 py-3 text-sm focus:border-onyx focus:bg-elevated"
          />
          {errors.descricao && <span className="text-xs text-danger">{errors.descricao.message}</span>}
        </label>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Evento" {...register('evento')} />
          <Input label="Local" {...register('local')} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Valor bruto (R$)"
            type="number"
            step="0.01"
            {...register('valorBruto', { valueAsNumber: true })}
          />
          <Input
            label="Taxa CAU (R$)"
            type="number"
            step="0.01"
            {...register('taxaCAU', { valueAsNumber: true })}
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('boletoPorMim')} />
          <span>Boleto pago por mim (cobra valor bruto integral)</span>
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
