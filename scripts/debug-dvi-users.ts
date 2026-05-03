/**
 * Diagnóstico: lista companies "dvi*", usernames e users vinculados.
 * Uso: npx tsx scripts/debug-dvi-users.ts
 */
import { getAdminApp, adminDb, adminAuth } from './lib/admin'

async function main() {
  getAdminApp()
  const db = adminDb()
  const auth = adminAuth()

  console.log('\n=== COMPANIES (slug contendo dvi) ===')
  const companiesSnap = await db.collection('companies').get()
  const dviCompanies = companiesSnap.docs.filter(d => {
    const data = d.data()
    return (
      String(data.slug ?? '').toLowerCase().includes('dvi') ||
      String(data.nome ?? '').toLowerCase().includes('dvi')
    )
  })
  for (const d of dviCompanies) {
    const data = d.data()
    console.log(`  id=${d.id}  slug=${data.slug}  nome=${data.nome}  ownerId=${data.ownerId ?? '-'}`)
  }

  console.log('\n=== USERNAMES (todas, marcando dvi*) ===')
  const usernamesSnap = await db.collection('usernames').get()
  for (const d of usernamesSnap.docs) {
    const data = d.data()
    const isDvi = d.id.toLowerCase().includes('dvi')
    if (isDvi) {
      console.log(
        `  >> ${d.id}  email=${data.email}  authMethod=${data.authMethod}  active=${data.active}`,
      )
    }
  }
  console.log(`  total usernames docs: ${usernamesSnap.size}`)

  console.log('\n=== USERS (companyId match) ===')
  for (const c of dviCompanies) {
    const usersSnap = await db.collection('users').where('companyId', '==', c.id).get()
    console.log(`  companyId=${c.id} (${c.data().slug}): ${usersSnap.size} users`)
    for (const u of usersSnap.docs) {
      const data = u.data()
      console.log(
        `    uid=${u.id}  email=${data.email}  role=${data.role}  tag=${data.tag}  active=${data.active}`,
      )
    }
  }

  console.log('\n=== AUTH USERS (procurando emails dvi/rgproducoes) ===')
  let nextPageToken: string | undefined
  const matches: { uid: string; email?: string; providers: string[] }[] = []
  do {
    const result = await auth.listUsers(1000, nextPageToken)
    for (const u of result.users) {
      const e = (u.email ?? '').toLowerCase()
      if (e.includes('dvi') || e.includes('rgproducoes')) {
        matches.push({
          uid: u.uid,
          email: u.email,
          providers: u.providerData.map(p => p.providerId),
        })
      }
    }
    nextPageToken = result.pageToken
  } while (nextPageToken)
  for (const m of matches) {
    console.log(`  uid=${m.uid}  email=${m.email}  providers=${m.providers.join(',')}`)
  }
  if (matches.length === 0) console.log('  (nenhum)')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
