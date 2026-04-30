import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, type CalendarEvent } from '@/components/domain/Calendar'
import { Skeleton } from '@/components/ui/Skeleton'
import { listRRTs } from '@/lib/api/rrts'
import { listProjetos } from '@/lib/api/projetos'
import type { Projeto, RRT } from '@/types'

export default function AdminCalendario() {
  const navigate = useNavigate()
  const [rrts, setRRTs] = useState<RRT[] | null>(null)
  const [projetos, setProjetos] = useState<Projeto[] | null>(null)

  useEffect(() => {
    void Promise.all([listRRTs(), listProjetos()]).then(([r, p]) => {
      setRRTs(r)
      setProjetos(p)
    })
  }, [])

  const events: CalendarEvent[] = useMemo(() => {
    const list: CalendarEvent[] = []
    rrts?.forEach(r => {
      if (r.vencimentoBoleto) {
        list.push({
          id: `${r.id}-vencimento`,
          date: r.vencimentoBoleto.toDate(),
          label: `Boleto CAU: ${r.numeroRRT ?? r.descricao.slice(0, 20)}`,
          color: 'warning',
          link: `/admin/rrts/${r.id}`,
        })
      }
      if (r.dataNF) {
        list.push({
          id: `${r.id}-nf`,
          date: r.dataNF.toDate(),
          label: `NF: ${r.numeroNF ?? r.numeroRRT ?? r.id.slice(0, 6)}`,
          color: 'info',
          link: `/admin/rrts/${r.id}`,
        })
      }
      if (r.previsaoPagamento) {
        list.push({
          id: `${r.id}-pag`,
          date: r.previsaoPagamento.toDate(),
          label: `Previsão pagamento: ${r.numeroRRT ?? '—'}`,
          color: 'success',
          link: `/admin/rrts/${r.id}`,
        })
      }
    })
    projetos?.forEach(p => {
      if (p.dataEvento) {
        list.push({
          id: `${p.id}-evento`,
          date: p.dataEvento.toDate(),
          label: `Evento: ${p.nome}`,
          color: 'info',
          link: `/admin/projetos/${p.id}`,
        })
      }
      if (p.dataEntregaPrevista) {
        list.push({
          id: `${p.id}-entrega`,
          date: p.dataEntregaPrevista.toDate(),
          label: `Entrega: ${p.nome}`,
          color: 'warning',
          link: `/admin/projetos/${p.id}`,
        })
      }
    })
    return list
  }, [rrts, projetos])

  if (rrts === null || projetos === null) return <Skeleton className="h-96" />

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-4xl text-onyx">Calendário</h1>
        <p className="mt-1 text-sm text-muted">Vencimentos, eventos e prazos.</p>
      </div>
      <Calendar
        events={events}
        onEventClick={ev => ev.link && navigate(ev.link)}
      />
    </div>
  )
}
