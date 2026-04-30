# VF · PROJETOS

Sistema de gestão: empresas clientes, projetos técnicos, RRTs, chamados, faturamento, auditoria.

## Stack

Vite 5 · React 19 · TypeScript 5 (strict) · Tailwind v4 (inline-only) · Firebase 12 · Vercel.

## Setup

```bash
git clone https://github.com/darwimmusic/vf-projetos
cd vf-projetos
npm install

# Env vars (config Firebase é pública)
vercel link --project vf-projetos
vercel env pull .env.local --yes

# Para scripts admin (seed, migration)
gcloud auth application-default login
gcloud auth application-default set-quota-project rrt-vault

npm run dev
```

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Build de produção |
| `npm run typecheck` | TS check sem emitir |
| `npm run lint` | ESLint zero-warnings |
| `npm run test` | Vitest unit |
| `npm run test:rules` | Rules tests (emulator) |
| `npm run emulators` | Firebase emulator suite |
| `npm run seed` | Seed admin (1x) |
| `npm run deploy:rules` | Deploy Firestore + Storage rules |
| `npm run secrets:scan` | Anti-leak scan |

## Deploy

```bash
npm run build
vercel --prod
```

## Arquitetura

- **Auth**: Firebase Auth (Email/Password admin + Magic Link cliente)
- **DB**: Firestore com rules versionadas em `firestore.rules`
- **Storage**: Firebase Storage com cross-service Firestore reads
- **RBAC**: 4 roles (admin, company_owner, company_member, guest) declarado em `src/lib/rbac.matrix.ts`
- **Audit**: toda mutation passa por `withAudit()` (cliente) ou `withAuditServer()` (scripts/CFs)

## Segurança

- `.env*` e `service-account*.json` gitignored
- Pre-commit `npm run secrets:scan` valida antes do commit
- Custom claims em ID token + watchdog `roleVersion` força refresh em mudança de role
- Audit logs append-only com anti-forgery (rules validam `actor.role` vs `request.auth.token.role`)
