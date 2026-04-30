/**
 * Inicializador único de Admin SDK para scripts.
 *
 * 2 caminhos de credenciais (auto-detect):
 *   1. Service account JSON via env FIREBASE_SERVICE_ACCOUNT_NEW/OLD (preferido em CI/prod)
 *   2. Application Default Credentials via gcloud auth (dev local — sem download de JSON)
 *
 * Para usar ADC localmente:
 *   gcloud auth application-default login
 *   gcloud config set project rrt-vault
 */
import { initializeApp, cert, applicationDefault, type App, getApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

interface ProjectMap {
  default: string
  legacy?: string
}

const PROJECT_IDS: ProjectMap = {
  default: 'rrt-vault',
  legacy: 'projeto-01-dc739',
}

export function loadServiceAccount(envKey: string): object | null {
  const path = process.env[envKey]
  if (!path) return null
  const fullPath = resolve(process.cwd(), path)
  if (!existsSync(fullPath)) return null
  return JSON.parse(readFileSync(fullPath, 'utf-8'))
}

export function getAdminApp(name = 'default', envKey = 'FIREBASE_SERVICE_ACCOUNT_NEW'): App {
  const existing = getApps().find(a => a.name === name)
  if (existing) return existing

  const sa = loadServiceAccount(envKey)
  const projectId = name === 'legacy' ? PROJECT_IDS.legacy : PROJECT_IDS.default

  if (sa) {
    console.info(`[admin] usando service account de ${envKey}`)
    return initializeApp(
      { credential: cert(sa as Parameters<typeof cert>[0]) },
      name,
    )
  }

  // Fallback: Application Default Credentials (firebase/gcloud auth)
  console.info(`[admin] usando Application Default Credentials para projeto ${projectId}`)
  return initializeApp(
    {
      credential: applicationDefault(),
      projectId,
    },
    name,
  )
}

export function adminAuth(name = 'default') {
  return getAuth(getApp(name))
}

export function adminDb(name = 'default') {
  return getFirestore(getApp(name))
}
