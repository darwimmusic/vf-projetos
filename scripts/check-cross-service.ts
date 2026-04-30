/**
 * Pré-flight B0.2 — verifica se Storage rules cross-service estão habilitadas.
 *
 * Faz dry-run de deploy das rules atuais e checa stderr por:
 *   "function firestore.get not available"
 *
 * Output: console + atualiza docs/decisions/D-001-storage-cross-service.md
 *
 * Uso: npm run check:cross-service
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

async function main() {
  console.info('[check-cross-service] dry-run deploy de storage.rules…')

  let result: 'supported' | 'unsupported' = 'supported'
  let detail = ''

  try {
    const out = execSync('npx firebase deploy --only storage --dry-run --non-interactive', {
      stdio: 'pipe',
      encoding: 'utf-8',
    })
    detail = out.slice(-500)
    if (/firestore\.(get|exists).*not available|cross.service.*disabled/i.test(out)) {
      result = 'unsupported'
    }
  } catch (e) {
    const err = e as { stderr?: Buffer; message?: string }
    detail = err.stderr?.toString() ?? err.message ?? 'unknown error'
    if (/firestore\.(get|exists).*not available|cross.service.*disabled/i.test(detail)) {
      result = 'unsupported'
    } else if (/auth|permission|login/i.test(detail)) {
      console.error('[check-cross-service] erro de auth — rode `firebase login` antes.')
      console.error(detail)
      process.exit(2)
    } else {
      console.warn('[check-cross-service] erro desconhecido. Detail:')
      console.warn(detail.slice(0, 1000))
    }
  }

  console.info(`\n→ Cross-service Storage rules: ${result.toUpperCase()}\n`)

  // Atualiza ADR
  const adrPath = 'docs/decisions/D-001-storage-cross-service.md'
  const current = readFileSync(adrPath, 'utf-8')
  const updated = current.replace(
    /status: pending-verification/,
    `status: ${result === 'supported' ? 'accepted-cross-service' : 'accepted-fallback-path-based'}`,
  )
  writeFileSync(adrPath, updated, 'utf-8')

  if (result === 'unsupported') {
    console.warn('⚠️  Adotar fallback path-based:')
    console.warn('    1. Reescrever lib/storage.ts pra usar paths "{companyId}__{entityId}/..."')
    console.warn('    2. Atualizar storage.rules removendo firestore.exists/get')
    console.warn('    3. Ver D-001 para detalhes')
  } else {
    console.info('✅ Cross-service rules disponíveis. Manter implementação atual.')
  }
}

main().catch(e => {
  console.error('[check-cross-service] FALHA:', e)
  process.exit(1)
})
