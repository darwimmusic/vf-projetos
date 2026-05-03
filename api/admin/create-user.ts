/**
 * Endpoint Vercel — cria Auth user + users/{uid} + usernames/{key} + custom claims.
 *
 * Modos:
 *  - mode=owner   → cria company_owner. Apenas role=admin pode chamar.
 *  - mode=member  → cria company_member. Admin ou company_owner da mesma company.
 *
 * Auth: header `Authorization: Bearer <idToken>` do chamador (Firebase ID token).
 *
 * Env vars necessárias na Vercel:
 *  - FIREBASE_SERVICE_ACCOUNT_JSON  → JSON da service account (string completa)
 *  - FIREBASE_PROJECT_ID            → "rrt-vault" (opcional, fallback do JSON)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initializeApp, cert, getApps, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const SYNTHETIC_DOMAIN = 'vfprojetos.local'

function getApp(): App {
  const existing = getApps().find(a => a.name === 'admin-api')
  if (existing) return existing
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!json) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON ausente')
  const sa = JSON.parse(json)
  return initializeApp(
    {
      credential: cert(sa),
      projectId: process.env.FIREBASE_PROJECT_ID ?? sa.project_id,
    },
    'admin-api',
  )
}

interface Body {
  mode: 'owner' | 'member'
  username: string // dvi-producoes  ou  dvi-producoes.joao
  password: string
  displayName: string
  companyId: string
}

function badRequest(res: VercelResponse, msg: string) {
  return res.status(400).json({ error: msg })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const app = getApp()
  const auth = getAuth(app)
  const db = getFirestore(app)

  // 1. Auth do chamador
  const authHeader = req.headers.authorization ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return res.status(401).json({ error: 'Missing bearer token' })

  let caller
  try {
    caller = await auth.verifyIdToken(token)
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }

  // 2. Body
  const body = req.body as Body
  if (!body || typeof body !== 'object') return badRequest(res, 'Body inválido')
  const { mode, username, password, displayName, companyId } = body
  if (!mode || !username || !password || !displayName || !companyId) {
    return badRequest(res, 'Campos obrigatórios: mode, username, password, displayName, companyId')
  }
  if (!/^[a-z0-9.-]+$/.test(username)) return badRequest(res, 'username inválido')
  if (password.length < 6) return badRequest(res, 'senha precisa ter ao menos 6 caracteres')
  if (mode !== 'owner' && mode !== 'member') return badRequest(res, 'mode inválido')

  // 3. Autorização
  const callerRole = caller.role as string | undefined
  const callerCompanyId = caller.companyId as string | undefined
  if (mode === 'owner' && callerRole !== 'admin') {
    return res.status(403).json({ error: 'Apenas admin cria owner' })
  }
  if (mode === 'member') {
    const isAdmin = callerRole === 'admin'
    const isOwnerOfTarget = callerRole === 'company_owner' && callerCompanyId === companyId
    if (!isAdmin && !isOwnerOfTarget) {
      return res.status(403).json({ error: 'Sem permissão para esta empresa' })
    }
  }

  // 4. Carrega company
  const companyRef = db.collection('companies').doc(companyId)
  const companySnap = await companyRef.get()
  if (!companySnap.exists) return res.status(404).json({ error: 'Empresa não encontrada' })
  const company = companySnap.data() ?? {}
  const slug = String(company.slug ?? '')

  // 5. Validação de namespace do username
  if (mode === 'owner') {
    if (username !== slug) {
      return badRequest(res, `username de owner deve ser igual ao slug da empresa ("${slug}")`)
    }
  } else {
    if (!username.startsWith(`${slug}.`)) {
      return badRequest(res, `username de member deve começar com "${slug}." (ex: ${slug}.joao)`)
    }
  }

  // 6. Username já em uso?
  const usernameRef = db.collection('usernames').doc(username)
  const usernameSnap = await usernameRef.get()
  if (usernameSnap.exists) {
    const data = usernameSnap.data() ?? {}
    if (data.active) {
      return res.status(409).json({ error: `Username "${username}" já está em uso` })
    }
  }

  // 7. Auth user (idempotente por email sintético)
  const syntheticEmail = `${username}@${SYNTHETIC_DOMAIN}`
  let uid: string
  try {
    const existing = await auth.getUserByEmail(syntheticEmail)
    uid = existing.uid
    await auth.updateUser(uid, { password, displayName, disabled: false })
  } catch (e: unknown) {
    const code = (e as { code?: string }).code
    if (code === 'auth/user-not-found') {
      const created = await auth.createUser({
        email: syntheticEmail,
        password,
        displayName,
        emailVerified: true,
      })
      uid = created.uid
    } else {
      console.error('[create-user] auth error', e)
      return res.status(500).json({ error: 'Falha ao criar usuário no Auth' })
    }
  }

  // 8. Custom claims
  const role = mode === 'owner' ? 'company_owner' : 'company_member'
  await auth.setCustomUserClaims(uid, {
    role,
    companyId,
    roleVersion: 1,
  })

  // 9. Firestore batch (users + usernames + ownerId se for owner)
  const tag = mode === 'member' ? username.slice(slug.length + 1) : ''
  const batch = db.batch()
  batch.set(
    db.collection('users').doc(uid),
    {
      email: syntheticEmail,
      displayName,
      role,
      companyId,
      companyName: company.name ?? slug,
      tag,
      active: true,
      roleVersion: 1,
      createdAt: FieldValue.serverTimestamp(),
      emailNotifications: true,
      invitedBy: caller.uid,
      acceptedInviteAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  batch.set(
    usernameRef,
    {
      usernameKey: username,
      email: syntheticEmail,
      authMethod: 'password',
      active: true,
      uid,
      companyId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  if (mode === 'owner') {
    batch.set(companyRef, { ownerId: uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  }
  await batch.commit()

  // 10. Audit (best-effort)
  try {
    await db.collection('audit_logs').add({
      timestamp: FieldValue.serverTimestamp(),
      actor: {
        uid: caller.uid,
        email: caller.email ?? '',
        role: callerRole ?? 'admin',
        displayName: caller.name ?? '',
        companyId: callerCompanyId ?? null,
        companyName: null,
      },
      action: 'create',
      resource: { type: 'user', id: uid, label: `${username} (${role})` },
      metadata: { notes: `api/admin/create-user mode=${mode}` },
    })
  } catch (e) {
    console.error('[create-user] audit fail', e)
  }

  return res.status(200).json({
    uid,
    username,
    email: syntheticEmail,
    role,
    companyId,
  })
}
