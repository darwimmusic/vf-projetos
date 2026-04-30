/**
 * Helpers para testes de rules contra Firestore Emulator.
 */
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'

const PROJECT_ID = 'rrt-vault-rules-test'

export async function setupTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf-8'),
      host: 'localhost',
      port: 8080,
    },
  })
}

export const ADMIN_UID = 'admin-uid'
export const OWNER_UID = 'owner-uid'
export const MEMBER_UID = 'member-uid'
export const OUTSIDER_UID = 'outsider-uid'

export const COMPANY_A = 'company-a'
export const COMPANY_B = 'company-b'

export function adminCtx(env: RulesTestEnvironment) {
  return env.authenticatedContext(ADMIN_UID, {
    role: 'admin',
    companyId: null,
    roleVersion: 1,
  })
}

export function ownerCtx(env: RulesTestEnvironment, companyId = COMPANY_A) {
  return env.authenticatedContext(OWNER_UID, {
    role: 'company_owner',
    companyId,
    roleVersion: 1,
  })
}

export function memberCtx(env: RulesTestEnvironment, companyId = COMPANY_A) {
  return env.authenticatedContext(MEMBER_UID, {
    role: 'company_member',
    companyId,
    roleVersion: 1,
  })
}

export function outsiderCtx(env: RulesTestEnvironment) {
  return env.authenticatedContext(OUTSIDER_UID, {
    role: 'company_member',
    companyId: COMPANY_B,
    roleVersion: 1,
  })
}
