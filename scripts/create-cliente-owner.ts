/**
 * Cria cliente owner para uma company existente.
 * Idempotente: se Auth user já existe, reusa; se username já existe, atualiza.
 *
 * Uso: npx tsx scripts/create-cliente-owner.ts <companyId> <username> <password>
 * Ex:  npx tsx scripts/create-cliente-owner.ts z8zlaYKeoBUVo8O2t2YG dvi-producoes DVI@2026
 */
import { getAdminApp, adminDb, adminAuth } from './lib/admin'
import { withAuditServer, migrationActor } from './lib/audit-server'
import { FieldValue } from 'firebase-admin/firestore'

const SYNTHETIC_DOMAIN = 'vfprojetos.local'

interface Args {
  companyId: string
  username: string
  password: string
  displayName?: string
  companyNameOverride?: string
  cnpjOverride?: string
  contactEmailOverride?: string
}

function parseArgs(): Args {
  const [companyId, username, password] = process.argv.slice(2)
  if (!companyId || !username || !password) {
    console.error('Uso: npx tsx scripts/create-cliente-owner.ts <companyId> <username> <password>')
    process.exit(1)
  }
  return {
    companyId,
    username: username.toLowerCase(),
    password,
    displayName: process.env.DISPLAY_NAME,
    companyNameOverride: process.env.COMPANY_NAME,
    cnpjOverride: process.env.CNPJ,
    contactEmailOverride: process.env.CONTACT_EMAIL,
  }
}

async function main() {
  const args = parseArgs()
  getAdminApp()
  const db = adminDb()
  const auth = adminAuth()

  // 1. Carrega company
  const companyRef = db.collection('companies').doc(args.companyId)
  const companySnap = await companyRef.get()
  if (!companySnap.exists) {
    throw new Error(`Company ${args.companyId} não existe`)
  }
  const company = companySnap.data() as Record<string, unknown>
  const slug = String(company.slug ?? args.username)

  console.log(`\n[1/4] Company encontrada: id=${args.companyId} slug=${slug}`)

  // 2. Corrige company se necessário
  const companyPatch: Record<string, unknown> = {}
  if (args.companyNameOverride && company.name !== args.companyNameOverride) {
    companyPatch.name = args.companyNameOverride
  }
  if (args.cnpjOverride && company.cnpj !== args.cnpjOverride) {
    companyPatch.cnpj = args.cnpjOverride
  }
  if (args.contactEmailOverride && company.contactEmail !== args.contactEmailOverride) {
    companyPatch.contactEmail = args.contactEmailOverride
  }
  if (typeof company.active !== 'boolean') companyPatch.active = true
  if (typeof company.prazoNF !== 'number') companyPatch.prazoNF = 30
  if (!company.createdAt) companyPatch.createdAt = FieldValue.serverTimestamp()

  // 3. Auth user (idempotente)
  const syntheticEmail = `${slug}@${SYNTHETIC_DOMAIN}`
  let uid: string
  try {
    const existing = await auth.getUserByEmail(syntheticEmail)
    uid = existing.uid
    await auth.updateUser(uid, {
      password: args.password,
      displayName: args.displayName ?? slug,
      disabled: false,
    })
    console.log(`[2/4] Auth user existente atualizado: uid=${uid} email=${syntheticEmail}`)
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'auth/user-not-found') {
      const created = await auth.createUser({
        email: syntheticEmail,
        password: args.password,
        displayName: args.displayName ?? slug,
        emailVerified: true,
      })
      uid = created.uid
      console.log(`[2/4] Auth user criado: uid=${uid} email=${syntheticEmail}`)
    } else {
      throw e
    }
  }

  // 4. Custom claims (RBAC)
  await auth.setCustomUserClaims(uid, {
    role: 'company_owner',
    companyId: args.companyId,
    roleVersion: 1,
  })
  console.log(`[3/4] Custom claims setadas: role=company_owner companyId=${args.companyId}`)

  // 5. Firestore docs (atomic batch)
  const userRef = db.collection('users').doc(uid)
  const usernameRef = db.collection('usernames').doc(args.username)

  await withAuditServer(
    db,
    migrationActor('create-cliente-owner@1'),
    {
      action: 'create',
      resource: {
        type: 'user',
        id: uid,
        label: `${args.username} (owner ${slug})`,
      },
      metadata: {
        notes: 'create-cliente-owner script',
      },
    },
    async () => {
      const batch = db.batch()

      // companyPatch + ownerId
      const finalCompanyPatch = {
        ...companyPatch,
        ownerId: uid,
        updatedAt: FieldValue.serverTimestamp(),
      }
      batch.set(companyRef, finalCompanyPatch, { merge: true })

      // user doc
      batch.set(
        userRef,
        {
          email: syntheticEmail,
          displayName: args.displayName ?? slug,
          role: 'company_owner',
          companyId: args.companyId,
          companyName: args.companyNameOverride ?? company.name ?? slug,
          tag: '',
          active: true,
          roleVersion: 1,
          createdAt: FieldValue.serverTimestamp(),
          emailNotifications: true,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )

      // usernames lookup
      batch.set(
        usernameRef,
        {
          usernameKey: args.username,
          email: syntheticEmail,
          authMethod: 'password',
          active: true,
          uid,
          companyId: args.companyId,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )

      await batch.commit()
    },
  )

  console.log(`[4/4] Firestore: company atualizada, users/${uid} e usernames/${args.username} criados`)

  console.log('\n=== PRONTO ===')
  console.log(`  Username: ${args.username}`)
  console.log(`  Senha:    ${args.password}`)
  console.log(`  Email:    ${syntheticEmail}`)
  console.log(`  UID:      ${uid}`)
  console.log(`  Company:  ${args.companyId} (${slug})`)
}

main().catch(e => {
  console.error('\n[ERRO]', e)
  process.exit(1)
})
