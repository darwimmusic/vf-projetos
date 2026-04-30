import { useMemo, useState } from 'react'
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

export interface CalendarEvent {
  id: string
  date: Date
  label: string
  color: 'warning' | 'info' | 'success' | 'danger'
  link?: string
}

interface Props {
  events: CalendarEvent[]
  onEventClick?(event: CalendarEvent): void
}

const COLOR: Record<CalendarEvent['color'], string> = {
  warning: 'bg-warning text-linen',
  info: 'bg-info text-linen',
  success: 'bg-success text-linen',
  danger: 'bg-danger text-linen',
}

export function Calendar({ events, onEventClick }: Props) {
  const [cursor, setCursor] = useState(new Date())

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { locale: ptBR })
    const end = endOfWeek(endOfMonth(cursor), { locale: ptBR })
    const arr: Date[] = []
    let d = start
    while (d <= end) {
      arr.push(d)
      d = new Date(d.getTime() + 86400000)
    }
    return arr
  }, [cursor])

  const eventsByDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>()
    for (const ev of events) {
      const key = format(ev.date, 'yyyy-MM-dd')
      const list = m.get(key) ?? []
      list.push(ev)
      m.set(key, list)
    }
    return m
  }, [events])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl text-onyx">
          {format(cursor, "MMMM 'de' yyyy", { locale: ptBR })}
        </h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setCursor(subMonths(cursor, 1))}>
            <ChevronLeft size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>
            Hoje
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(addMonths(cursor, 1))}>
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
          <div key={d} className="bg-sunken px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted">
            {d}
          </div>
        ))}
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd')
          const dayEvents = eventsByDay.get(key) ?? []
          const inMonth = isSameMonth(day, cursor)
          const today = isSameDay(day, new Date())
          return (
            <div
              key={key}
              className={cn(
                'min-h-[88px] bg-elevated p-1.5 text-xs',
                !inMonth && 'bg-sunken/50 text-muted',
              )}
            >
              <div
                className={cn(
                  'mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold',
                  today && 'bg-onyx text-linen',
                )}
              >
                {format(day, 'd')}
              </div>
              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, 3).map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick?.(ev)}
                    className={cn(
                      'truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium transition-opacity hover:opacity-80',
                      COLOR[ev.color],
                    )}
                  >
                    {ev.label}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[10px] text-muted">+{dayEvents.length - 3}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
