import * as ToastPrimitive from '@radix-ui/react-toast'
import { create } from 'zustand'
import { X } from 'lucide-react'

type ToastVariant = 'success' | 'error' | 'info'

interface ToastEntry {
  id: string
  title: string
  description?: string
  variant: ToastVariant
}

interface ToastState {
  toasts: ToastEntry[]
  show(t: Omit<ToastEntry, 'id'>): void
  dismiss(id: string): void
}

export const useToastStore = create<ToastState>(set => ({
  toasts: [],
  show(t) {
    const id = Math.random().toString(36).slice(2)
    set(state => ({ toasts: [...state.toasts, { ...t, id }] }))
    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(x => x.id !== id) }))
    }, 4500)
  },
  dismiss(id) {
    set(state => ({ toasts: state.toasts.filter(x => x.id !== id) }))
  },
}))

export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().show({ title, description, variant: 'success' }),
  error: (title: string, description?: string) =>
    useToastStore.getState().show({ title, description, variant: 'error' }),
  info: (title: string, description?: string) =>
    useToastStore.getState().show({ title, description, variant: 'info' }),
}

const VARIANT_STYLE: Record<ToastVariant, { bar: string }> = {
  success: { bar: 'bg-success' },
  error: { bar: 'bg-danger' },
  info: { bar: 'bg-info' },
}

export function ToastContainer() {
  const toasts = useToastStore(s => s.toasts)
  const dismiss = useToastStore(s => s.dismiss)

  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={4500}>
      {toasts.map(t => (
        <ToastPrimitive.Root
          key={t.id}
          onOpenChange={open => !open && dismiss(t.id)}
          className="relative flex items-start gap-3 overflow-hidden rounded-xl border border-border bg-elevated px-4 py-3 shadow-lg"
        >
          <span className={`absolute left-0 top-0 h-full w-1 ${VARIANT_STYLE[t.variant].bar}`} />
          <div className="flex flex-1 flex-col gap-0.5 pl-2">
            <ToastPrimitive.Title className="text-sm font-semibold text-onyx">
              {t.title}
            </ToastPrimitive.Title>
            {t.description && (
              <ToastPrimitive.Description className="text-xs text-muted">
                {t.description}
              </ToastPrimitive.Description>
            )}
          </div>
          <ToastPrimitive.Close
            aria-label="Fechar"
            className="rounded-md p-1 text-muted hover:bg-sunken"
          >
            <X size={14} />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed bottom-6 right-6 z-50 flex w-[380px] max-w-[calc(100vw-32px)] flex-col gap-2 outline-none" />
    </ToastPrimitive.Provider>
  )
}
