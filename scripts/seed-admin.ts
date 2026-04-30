/**
 * Seed admin user — rodar 1x.
 * Cria:
 *   - Auth user `viihferreira@admin.local`
 *   - Custom claims: { role: 'admin', companyId: null, roleVersion: 1 }
 *   - Firestore: users/{uid} + usernames/viihferreira
 *
 * Uso:
 *   npm run seed
 *   SEED_ADMIN_PASSWORD=xxx npm run seed   # override senha default
 *
 * Idempotente: detecta se já existe e atualiza claims sem recriar.
 */
import { getAdminApp, adminAuth, adminDb } from './lib/admin'
import { withAuditServer, migrationActor } from './lib/audit-server'
import { FieldValue } from 'firebase-admin/firestore'

const ADMIN_USERNAME = 'viihferreira'
const ADMIN_EMAIL = 'viihferreira@admin.local'
const ADMIN_DISPLAY = 'Victor Lima Ferreira'
const DEFAULT_PASSWORD = 'Farofa'

async function main() {
  console.info('[seed-admin] iniciando…')
  getAdminApp()
  const auth = adminAuth()
  const db = adminDb()

  const password = process.env.SEED_ADMIN_PASSWORD ?? DEFAULT_PASSWORD

  // 1. Auth user
  let uid: string
  try {
    const existing = await auth.getUserByEmail(ADMIN_EMAIL)
    uid = existing.uid
    console.info(`[seed-admin] auth user existe: ${uid}`)
    await auth.updateUser(uid, { password, displayName: ADMIN_DISPLAY })
  } catch (e: unknown) {
    const code = (e as { code?: string }).code
    if (code === 'auth/user-not-found') {
      const created = await auth.createUser({
        email: ADMIN_EMAIL,
        password,
        displayName: ADMIN_DISPLAY,
        emailVerified: true,
      })
      uid = created.uid
      console.info(`[seed-admin] auth user criado: ${uid}`)
    } else {
      throw e
    }
  }

  // 2. Claims
  await auth.setCustomUserClaims(uid, {
    role: 'admin',
    companyId: null,
    roleVersion: 1,
  })
  console.info('[seed-admin] custom claims set')

  // 3. Firestore docs
  const actor = migrationActor('seed-admin-v1')

  await withAuditServer(
    db,
    actor,
    {
      action: 'create',
      resource: { type: 'user', id: uid, label: ADMIN_DISPLAY },
    },
    async () => {
      await db
        .collection('users')
        .doc(uid)
        .set(
          {
            uid,
            email: ADMIN_EMAIL,
            displayName: ADMIN_DISPLAY,
            role: 'admin',
            companyId: null,
            companyName: null,
            active: true,
            roleVersion: 1,
            emailNotifications: true,
            createdAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        )
    },
  )

  await withAuditServer(
    db,
    actor,
    {
      action: 'create',
      resource: { type: 'user', id: ADMIN_USERNAME, label: `usernames/${ADMIN_USERNAME}` },
    },
    async () => {
      await db
        .collection('usernames')
        .doc(ADMIN_USERNAME)
        .set(
          {
            usernameKey: ADMIN_USERNAME,
            email: ADMIN_EMAIL,
            authMethod: 'password',
            active: true,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        )
    },
  )

  console.info('\n✅ Seed completo.')
  console.info(`   Login:    username "${ADMIN_USERNAME}" + senha "${password}"`)
  console.info(`   Próximo:  TROCAR a senha em /admin/config (ou Firebase Console)\n`)
}

main().catch(e => {
  console.error('[seed-admin] FALHA:', e)
  process.exit(1)
})
