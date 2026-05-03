import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, UserX, UserCheck } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useCan } from '@/lib/rbac'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { listTeam, inviteMember, deactivateMember, reactivateMember } from '@/lib/api/team'
import { toast } from '@/components/ui/Toast'
import type { User } from '@/types'

const inviteSchema = z.object({
  displayName: z.string().min(2).max(120),
  tag: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'apenas minúsculas, números e hífen'),
  password: z.string().min(6, 'mínimo 6 caracteres'),
})
type InviteForm = z.infer<typeof inviteSchema>

export default function ClienteTime() {
  const user = useAuthStore(s => s.user)
  const canManage = useCan('create', 'user', { companyId: user?.companyId ?? undefined })
  const [members, setMembers] = useState<User[] | null>(null)
  const [open, setOpen] = useState(false)

  async function reload() {
    if (!user?.companyId) return
    setMembers(null)
    setMembers(await listTeam(user.companyId))
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.companyId])

  if (!user?.companyId) {
    return <p className="text-sm text-muted">Sem empresa associada.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-4xl text-onyx">Time</h1>
          <p className="mt-1 text-sm text-muted">
            Membros da {user.companyName}. Cada um tem acesso individual.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} /> Adicionar membro
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {members === null ? (
            <div className="p-6">
              <Skeleton className="h-32" />
            </div>
          ) : members.length === 0 ? (
            <EmptyState
              title="Apenas você"
              description={canManage ? 'Convide colaboradores para colaborar.' : 'Peça pro owner adicionar membros.'}
              action={
                canManage && (
                  <Button onClick={() => setOpen(true)}>
                    <Plus size={16} /> Adicionar
                  </Button>
                )
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {members.map(m => (
                <li key={m.uid} className="flex items-center gap-4 px-6 py-4">
                  <Avatar name={m.displayName} src={m.avatarUrl} size="md" />
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-onyx">{m.displayName}</span>
                      <Badge variant={m.role === 'company_owner' ? 'premium' : 'neutral'}>
                        {m.role === 'company_owner' ? 'owner' : 'member'}
                      </Badge>
                      {!m.active && <Badge variant="neutral">Inativo</Badge>}
                    </div>
                    <span className="text-xs text-muted">
                      {m.email} {m.tag && `· @${m.tag}`}
                    </span>
                  </div>
                  {canManage && m.role !== 'company_owner' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          if (m.active) {
                            await deactivateMember(m.uid)
                          } else {
                            await reactivateMember(m.uid)
                          }
                          await reload()
                        } catch (e) {
                          toast.error('Falha', e instanceof Error ? e.message : 'Erro')
                        }
                      }}
                    >
                      {m.active ? <UserX size={14} /> : <UserCheck size={14} />}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <InviteModal
        open={open}
        onOpenChange={setOpen}
        companyId={user.companyId}
        onInvited={reload}
      />
    </div>
  )
}

function InviteModal({
  open,
  onOpenChange,
  companyId,
  onInvited,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  companyId: string
  onInvited(): void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<InviteForm>({ resolver: zodResolver(inviteSchema) })

  async function onSubmit(data: InviteForm) {
    try {
      await inviteMember({ ...data, companyId })
      toast.success('Membro criado', `${data.displayName} já pode logar com username + senha.`)
      reset()
      onOpenChange(false)
      onInvited()
    } catch (e) {
      toast.error('Falha', e instanceof Error ? e.message : 'Erro')
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Adicionar membro"
      description="Cria um sub-usuário com username e senha. Você repassa pra pessoa."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label="Nome"
          placeholder="João Silva"
          {...register('displayName')}
          error={errors.displayName?.message}
        />
        <Input
          label="Tag (parte do username)"
          placeholder="joao"
          {...register('tag')}
          error={errors.tag?.message}
          helperText="Login será {slug-da-empresa}.{tag}"
        />
        <Input
          label="Senha"
          type="password"
          autoComplete="new-password"
          placeholder="mínimo 6 caracteres"
          {...register('password')}
          error={errors.password?.message}
          helperText="Anota — você é quem repassa pra pessoa"
        />
        <div className="mt-2 flex justify-end gap-3">
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Adicionar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
