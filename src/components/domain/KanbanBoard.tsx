import { useState, type ReactNode } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/cn'

export interface KanbanCard<S extends string> {
  id: string
  status: S
  render: ReactNode
}

interface Props<S extends string> {
  columns: { value: S; label: string }[]
  cards: KanbanCard<S>[]
  canMove(from: S, to: S): boolean
  onMove(cardId: string, from: S, to: S): Promise<void>
}

export function KanbanBoard<S extends string>({ columns, cards, canMove, onMove }: Props<S>) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [draggingId, setDraggingId] = useState<string | null>(null)

  function handleDragStart(e: DragStartEvent) {
    setDraggingId(String(e.active.id))
  }

  async function handleDragEnd(e: DragEndEvent) {
    setDraggingId(null)
    const cardId = String(e.active.id)
    const targetStatus = e.over?.id ? (String(e.over.id) as S) : null
    if (!targetStatus) return

    const card = cards.find(c => c.id === cardId)
    if (!card || card.status === targetStatus) return

    if (!canMove(card.status, targetStatus)) {
      console.warn(`[kanban] transição inválida ${card.status} → ${targetStatus}`)
      return
    }

    try {
      await onMove(cardId, card.status, targetStatus)
    } catch (err) {
      console.error('[kanban] falha:', err)
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map(col => (
          <Column<S>
            key={col.value}
            status={col.value}
            label={col.label}
            cards={cards.filter(c => c.status === col.value)}
            draggingId={draggingId}
          />
        ))}
      </div>
    </DndContext>
  )
}

function Column<S extends string>({
  status,
  label,
  cards,
  draggingId,
}: {
  status: S
  label: string
  cards: KanbanCard<S>[]
  draggingId: string | null
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
        <span className="text-xs text-muted">{cards.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'min-h-[400px] flex-1 rounded-xl bg-sunken/60 p-2 transition-colors',
          isOver && 'bg-onyx/5 ring-2 ring-onyx',
        )}
      >
        <ul className="flex flex-col gap-2">
          {cards.map(c => (
            <Card key={c.id} id={c.id} dragging={draggingId === c.id}>
              {c.render}
            </Card>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Card({ id, dragging, children }: { id: string; dragging: boolean; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'cursor-grab rounded-lg border border-border bg-elevated p-3 shadow-sm active:cursor-grabbing',
        dragging && 'opacity-40',
      )}
    >
      {children}
    </li>
  )
}
