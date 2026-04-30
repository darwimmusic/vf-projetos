import { create } from 'zustand'
import { onAuthStateChanged, type User as FbUser } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import {
  hydrateAppUser,
  refreshClaimsIfStale,
  resolveUsername,
  sendMagicLink,
  signInWithPassword,
  signOut,
} from '@/lib/auth'
import type { AppUser } from '@/types'

interface AuthState {
  user: AppUser | null
  fbUser: FbUser | null
  loading: boolean
  initialized: boolean
  error: string | null

  // Actions
  signInWithUsername(username: string, password?: string): Promise<{ requirePassword: boolean }>
  signOut(): Promise<void>
  refresh(): Promise<void>
  setError(error: string | null): void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  fbUser: null,
  loading: true,
  initialized: false,
  error: null,

  async signInWithUsername(username, password) {
    set({ loading: true, error: null })
    try {
      const lookup = await resolveUsername(username.trim().toLowerCase())
      if (!lookup) {
        set({ loading: false, error: 'Usuário não encontrado.' })
        throw new Error('Usuário não encontrado.')
      }

      if (lookup.authMethod === 'password') {
        if (!password) {
          set({ loading: false })
          return { requirePassword: true }
        }
        await signInWithPassword(lookup.email, password)
        // onAuthStateChanged hidrata o user
        return { requirePassword: false }
      } else {
        await sendMagicLink(lookup.email)
        set({ loading: false })
        return { requirePassword: false }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido'
      set({ loading: false, error: msg })
      throw e
    }
  },

  async signOut() {
    await signOut()
    set({ user: null, fbUser: null, error: null })
  },

  async refresh() {
    const fbUser = get().fbUser
    if (!fbUser) return
    const refreshed = await refreshClaimsIfStale(fbUser)
    if (refreshed) {
      const user = await hydrateAppUser(fbUser)
      set({ user })
    }
  },

  setError(error) {
    set({ error })
  },
}))

// Subscribe global — roda 1x no app load
onAuthStateChanged(auth, async fbUser => {
  if (!fbUser) {
    useAuthStore.setState({
      user: null,
      fbUser: null,
      loading: false,
      initialized: true,
    })
    return
  }

  try {
    const user = await hydrateAppUser(fbUser)
    useAuthStore.setState({
      user,
      fbUser,
      loading: false,
      initialized: true,
      error: null,
    })

    // Watchdog: força refresh se claims defasadas
    void refreshClaimsIfStale(fbUser).then(async refreshed => {
      if (refreshed) {
        const fresh = await hydrateAppUser(fbUser)
        useAuthStore.setState({ user: fresh })
      }
    })
  } catch (e) {
    console.error('[auth] hydrate failed', e)
    useAuthStore.setState({
      user: null,
      fbUser: null,
      loading: false,
      initialized: true,
      error: 'Falha ao carregar perfil',
    })
  }
})
