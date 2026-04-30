import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Send } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { Modal } from '@/components/ui/Modal'
import { ChamadoStatusPill } from '@/components/ui/StatusPill'
import { Avatar } from '@/components/ui/Avatar'
import { FileUploader } from '@/components/domain/FileUploader'
import { AnexosList } from '@/components/domain/AnexosList'
import {
  getChamado,
  subscribeMensagens,
  postMensagem,
  advanceChamadoStatus,
  convertChamado,
} from '@/lib/api/chamados'
import { formatDateTime } from '@/lib/format'
import { toast } from '@/components/ui/Toast'
import type { Chamado, ChamadoStatus, Mensagem } from '@/types'
import { cn } from '@/lib/cn'

interface Props {
  isAdminView: boolean
}

export default function ChamadoDetail({ isAdminView }: Props) {
  const { id } = useParams<{ id: string }>()
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const [chamado, setChamado] = useState<Chamado | null | undefined>(undefined)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [convertOpen, setConvertOpen] = useState(false)
  const [criarRRT, setCriarRRT] = useState(true)
  const [converting, setConverting] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  async function reload() {
    if (!id) return
    setChamado(await getChamado(id))
  }

  useEffect(() => {
    if (!id) return
    void getChamado(id).then(setChamado)
    const unsub = subscribeMensagens(id, setMensagens)
    return unsub
  }, [id])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [mensagens.length])

  async function handleSend() {
    if (!id || !text.trim() || sending) return
    setSending(true)
    try {
      await postMensagem(id, text.trim())
      setText('')
      void reload()
    } catch (e) {
      toast.error('Falha', e instanceof Error ? e.message : 'Erro')
    } finally {
      setSending(false)
    }
  }

  async function handleAdvance(to: ChamadoStatus) {
    if (!id) return
    try {
      await advanceChamadoStatus(id, to)
      toast.success(`Status: ${to}`)
      void reload()
    } catch (e) {
      toast.error('Falha', e instanceof Error ? e.message : 'Erro')
    }
  }

  async function handleConvert() {
    if (!id) return
    setConverting(true)
    try {
      const { projetoId, rrtId } = await convertChamado(id, { criarRRT })
      toast.success('Convertido', rrtId ? 'Projeto + RRT criados.' : 'Projeto criado.')
      setConvertOpen(false)
      navigate(`/admin/projetos/${projetoId}`)
    } catch (e) {
      toast.error('Falha', e instanceof Error ? e.message : 'Erro')
    } finally {
      setConverting(false)
    }
  }

  if (chamado === undefined) return <Skeleton className="h-64" />
  if (chamado === null) return <p className="text-sm text-muted">Chamado não encontrado.</p>

  const backTo = isAdminView ? '/admin/chamados' : '/c/chamados'
  const NEXT_FOR_ADMIN: Record<ChamadoStatus, ChamadoStatus[]> = {
    ABERTO: ['EM_ANALISE', 'AGUARDANDO_CLIENTE'],
    EM_ANALISE: ['EM_ANDAMENTO', 'AGUARDANDO_CLIENTE'],
    EM_ANDAMENTO: ['AGUARDANDO_CLIENTE', 'FECHADO'],
    AGUARDANDO_CLIENTE: ['EM_ANDAMENTO', 'FECHADO'],
    FECHADO: [],
    CONVERTIDO: [],
  }
  const validNext = isAdminView ? NEXT_FOR_ADMIN[chamado.status] : []

  return (
    <div className="flex flex-col gap-6">
      <Link to={backTo} className="inline-flex items-center gap-1 text-sm text-muted hover:text-onyx">
        <ArrowLeft size={14} /> Chamados
      </Link>

      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-4xl text-onyx">{chamado.titulo}</h1>
            <ChamadoStatusPill status={chamado.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {chamado.openedByName} · {chamado.companyName} · {formatDateTime(chamado.dataAbertura)}
          </p>
        </div>
        {isAdminView && (
          <div className="flex gap-2">
            {validNext.map(s => (
              <Button key={s} variant="secondary" onClick={() => handleAdvance(s)}>
                {s.replace('_', ' ')}
              </Button>
            ))}
            {chamado.status !== 'FECHADO' && chamado.status !== 'CONVERTIDO' && (
              <Button onClick={() => setConvertOpen(true)}>Converter em projeto</Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Tipo" value={chamado.tipo} />
        <Field label="Prioridade" value={chamado.prioridade} />
        <Field label="Mensagens" value={String(chamado.qtdMensagens)} />
      </div>

      <Card>
        <CardHeader title="Briefing original" />
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">{chamado.descricao}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Anexos"
          action={
            <FileUploader
              parent="chamados"
              parentId={chamado.id}
              parentLabel={chamado.titulo}
              categoria="BRIEFING"
              onUploaded={() => setRefreshKey(k => k + 1)}
            />
          }
        />
        <CardContent>
          <AnexosList
            parent="chamados"
            parentId={chamado.id}
            parentLabel={chamado.titulo}
            refreshKey={refreshKey}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Conversa" />
        <CardContent className="p-0">
          <div ref={scrollRef} className="max-h-[480px] overflow-y-auto px-6 py-4">
            {mensagens.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">Nenhuma mensagem ainda.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {mensagens.map(m => {
                  const isMe = m.authorId === user?.uid
                  return (
                    <li key={m.id} className={cn('flex gap-2', isMe && 'flex-row-reverse')}>
                      <Avatar name={m.authorName} size="sm" />
                      <div
                        className={cn(
                          'max-w-[70%] rounded-2xl px-4 py-2',
                          isMe ? 'bg-onyx text-linen' : 'bg-sunken text-onyx',
                        )}
                      >
                        <div className="text-[10px] uppercase tracking-wider opacity-60">
                          {m.authorName} · {formatDateTime(m.timestamp)}
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm">{m.text}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSend()
                  }
                }}
                rows={2}
                placeholder="Digite sua mensagem… (Enter envia, Shift+Enter quebra linha)"
                className="flex-1 resize-none rounded-xl border border-transparent bg-sunken px-4 py-3 text-sm focus:border-onyx focus:bg-elevated"
              />
              <Button onClick={handleSend} loading={sending} disabled={!text.trim()}>
                <Send size={14} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Modal
        open={convertOpen}
        onOpenChange={setConvertOpen}
        title="Converter chamado em projeto"
        description="Cria um Projeto pré-preenchido com os dados do chamado."
      >
        <div className="flex flex-col gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={criarRRT}
              onChange={e => setCriarRRT(e.target.checked)}
            />
            <span>Criar RRT vinculada também</span>
          </label>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setConvertOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConvert} loading={converting}>
              Converter
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
      <span className="mt-1 text-sm text-onyx">{value}</span>
    </div>
  )
}
