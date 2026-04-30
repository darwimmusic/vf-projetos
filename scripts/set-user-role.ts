/**
 * Atualiza role + companyId + incrementa roleVersion (força refresh de claims).
 *
 * Uso:
 *   tsx scripts/set-user-role.ts <uid> <role> [companyId]
 *
 * Ex:
 *   tsx scripts/set-user-role.ts abc123 company_owner companyXYZ
 */
import { getAdminApp, adminAuth, adminDb } from './lib/admin'
import { withAuditServer, migrationActor } from './lib/audit-server'
import { FieldValue } from 'firebase-admin/firestore'

async function main() {
  const [uid, role, companyId] = process.argv.slice(2)
  if (!uid || !role) {
    console.error('Uso: tsx scripts/set-user-role.ts <uid> <role> [companyId]')
    process.exit(1)
  }
  if (!['admin', 'company_owner', 'company_member'].includes(role)) {
    console.error(`Role inválido: ${role}`)
    process.exit(1)
  }

  getAdminApp()
  const auth = adminAuth()
  const db = adminDb()

  const userDoc = await db.collection('users').doc(uid).get()
  if (!userDoc.exists) {
    console.error(`User ${uid} não encontrado.`)
    process.exit(1)
  }
  const before = userDoc.data()!
  const newVersion = (before.roleVersion ?? 0) + 1

  await auth.setCustomUserClaims(uid, {
    role,
    companyId: companyId ?? null,
    roleVersion: newVersion,
  })

  await withAuditServer(
    db,
    migrationActor('set-user-role'),
    {
      action: 'update',
      resource: { type: 'user', id: uid, label: before.displayName ?? uid },
      diff: {
        before: { role: before.role, companyId: before.companyId, roleVersion: before.roleVersion },
        after: { role, companyId: companyId ?? null, roleVersion: newVersion },
        fields: ['role', 'companyId', 'roleVersion'],
      },
    },
    async () => {
      await db.collection('users').doc(uid).update({
        role,
        companyId: companyId ?? null,
        roleVersion: newVersion,
        updatedAt: FieldValue.serverTimestamp(),
      })
    },
  )

  console.info(`✅ ${uid} → role=${role} companyId=${companyId ?? 'null'} roleVersion=${newVersion}`)
}

main().catch(e => {
  console.error('[set-user-role] FALHA:', e)
  process.exit(1)
})
