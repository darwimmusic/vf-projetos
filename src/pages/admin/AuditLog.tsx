import { useEffect, useState } from 'react'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { formatDateTime } from '@/lib/format'
import type { AuditLog } from '@/types'

const ACTION_VARIANT: Record<string, Parameters<typeof Badge>[0]['variant']> = {
  create: 'success',
  update: 'warning',
  delete: 'danger',
  status_advance: 'warning',
  status_revert: 'danger',
  upload: 'info',
  download: 'info',
  delete_file: 'danger',
  login: 'success',
  login_fail: 'danger',
  logout: 'neutral',
  alert_payment: 'premium',
}

export default function AdminAuditLog() {
  const [logs, setLogs] = useState<AuditLog[] | null>(null)

  useEffect(() => {
    void (async () => {
      const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100))
      const snap = await getDocs(q)
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }) as AuditLog))
    })()
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-4xl text-onyx">Auditoria</h1>
        <p className="mt-1 text-sm text-muted">Últimas 100 ações no sistema.</p>
      </div>

      <Card>
        <CardHeader title="Trilha de auditoria" />
        <CardContent className="p-0">
          {logs === null ? (
            <div className="p-6">
              <Skeleton className="h-32" />
            </div>
          ) : logs.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted">Sem registros.</p>
          ) : (
            <ul className="divide-y divide-border">
              {logs.map(log => (
                <li key={log.id} className="flex items-center gap-4 px-6 py-3">
                  <Badge variant={ACTION_VARIANT[log.action] ?? 'neutral'}>{log.action}</Badge>
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm text-onyx">
                      {log.actor.displayName}{' '}
                      <span className="text-muted">→</span> {log.resource.label}
                    </span>
                    <span className="text-xs text-muted">
                      {log.actor.role} · {log.actor.companyName ?? 'sistema'} ·{' '}
                      {log.metadata?.notes && `"${log.metadata.notes}" · `}
                      {formatDateTime(log.timestamp)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
