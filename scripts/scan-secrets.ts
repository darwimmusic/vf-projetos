/**
 * Pre-commit secret scanner — fail fast se algo sensível vazar pro stage.
 * Uso: tsx scripts/scan-secrets.ts (rodar manualmente ou via husky)
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const PATTERNS: Array<{ name: string; rx: RegExp }> = [
  { name: 'Firebase Admin private key', rx: /-----BEGIN PRIVATE KEY-----/ },
  { name: 'Firebase service account JSON', rx: /"type"\s*:\s*"service_account"/ },
  { name: 'Generic AWS access key', rx: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Hardcoded "Farofa" outside docs/', rx: /\bFarofa\b/ },
  { name: 'Bearer/JWT-like long token', rx: /\b[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/ },
  { name: 'Generic API key var hardcoded', rx: /(?:apiKey|api_key|API_KEY)\s*[:=]\s*['"][A-Za-z0-9-_]{20,}['"]/ },
]

const ALLOWED_PATHS = [
  /^docs\//,
  /^\.env\.example$/,
  /^scripts\/scan-secrets\.ts$/,
  /^scripts\/seed-admin\.ts$/, // contém DEFAULT_PASSWORD documentado, override via SEED_ADMIN_PASSWORD
]

function getStagedFiles(): string[] {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf-8' })
    return out.split(/\r?\n/).filter(Boolean)
  } catch {
    // Fallback: all tracked files
    const out = execSync('git ls-files', { encoding: 'utf-8' })
    return out.split(/\r?\n/).filter(Boolean)
  }
}

function isAllowed(path: string): boolean {
  return ALLOWED_PATHS.some(rx => rx.test(path))
}

const files = getStagedFiles()
const violations: Array<{ file: string; pattern: string; line: number }> = []

for (const file of files) {
  if (isAllowed(file)) continue
  let content: string
  try {
    content = readFileSync(file, 'utf-8')
  } catch {
    continue
  }
  const lines = content.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    for (const { name, rx } of PATTERNS) {
      if (rx.test(lines[i])) {
        violations.push({ file, pattern: name, line: i + 1 })
      }
    }
  }
}

if (violations.length > 0) {
  console.error('\n[secrets:scan] BLOQUEIO — possível segredo no commit:')
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  →  ${v.pattern}`)
  }
  console.error('\nSe é falso positivo, ajuste ALLOWED_PATHS em scripts/scan-secrets.ts.\n')
  process.exit(1)
}

console.log(`[secrets:scan] OK — ${files.length} arquivos varridos.`)
