/**
 * Simula leitura cliente-side: usa client SDK do Firebase com login do owner DVI
 * pra testar se rules deixam ler anexos + gerar download URL.
 *
 * Uso: npx dotenv -e .env.local -- npx tsx scripts/test-cliente-read.ts
 */
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { getFirestore, collection, getDocs, query, orderBy } from 'firebase/firestore'
import { getStorage, ref, getDownloadURL } from 'firebase/storage'

const config = {
  apiKey: process.env.VITE_FIREBASE_API_KEY!,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.VITE_FIREBASE_APP_ID!,
}

async function main() {
  const app = initializeApp(config)
  const auth = getAuth(app)
  const db = getFirestore(app)
  const storage = getStorage(app)

  console.log('Logando como dvi-producoes...')
  await signInWithEmailAndPassword(auth, 'dvi-producoes@vfprojetos.local', 'DVI@2026')
  const tokenResult = await auth.currentUser!.getIdTokenResult()
  console.log('Claims:', JSON.stringify(tokenResult.claims, null, 2))

  // Tenta ler anexos do RRT Backrooms
  const RRT_ID = 'u0yfO5I3FbHdGuzOWTOh'
  console.log(`\nLendo rrts/${RRT_ID}/anexos ...`)
  try {
    const snap = await getDocs(query(collection(db, 'rrts', RRT_ID, 'anexos'), orderBy('uploadedAt', 'desc')))
    console.log(`  OK: ${snap.size} anexos`)
    for (const d of snap.docs) {
      const data = d.data()
      console.log(`    ${data.filename}  visibleToClient=${data.visibleToClient}`)
      try {
        const url = await getDownloadURL(ref(storage, data.storagePath))
        console.log(`    download URL: ${url.slice(0, 80)}...`)
      } catch (e) {
        console.log(`    DOWNLOAD FAIL: ${(e as Error).message}`)
      }
    }
  } catch (e) {
    console.log(`  FAIL: ${(e as Error).message}`)
  }

  // Tenta ler anexos do Projeto Backrooms
  const PROJ_ID = 'sBnSoUjan2DnivGSrNBQ'
  console.log(`\nLendo projetos/${PROJ_ID}/anexos ...`)
  try {
    const snap = await getDocs(query(collection(db, 'projetos', PROJ_ID, 'anexos'), orderBy('uploadedAt', 'desc')))
    console.log(`  OK: ${snap.size} anexos`)
    for (const d of snap.docs) {
      const data = d.data()
      console.log(`    ${data.filename}  visibleToClient=${data.visibleToClient}`)
    }
  } catch (e) {
    console.log(`  FAIL: ${(e as Error).message}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
