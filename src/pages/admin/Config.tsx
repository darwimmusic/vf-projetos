import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { useAuthStore } from '@/stores/auth.store'

export default function AdminConfig() {
  const user = useAuthStore(s => s.user)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-4xl text-onyx">Configurações</h1>
        <p className="mt-1 text-sm text-muted">Conta e parâmetros do sistema.</p>
      </div>

      <Card>
        <CardHeader title="Conta" />
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Nome" value={user?.displayName ?? '—'} />
            <Field label="Email" value={user?.email ?? '—'} />
            <Field label="Papel" value={user?.role ?? '—'} />
            <Field label="Versão de claims" value={String(user?.roleVersion ?? '—')} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Trocar senha"
          subtitle="Disponível em W3 — por enquanto via Firebase Console"
        />
      </Card>

      <Card>
        <CardHeader title="Configurações do sistema" subtitle="W3 — taxa CAU, prazos NF padrão, etc." />
      </Card>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-onyx">{value}</dd>
    </div>
  )
}
