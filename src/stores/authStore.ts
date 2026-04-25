import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'

interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  initialized: boolean

  // Derived
  isProfileComplete: boolean

  // Actions
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  setProfile: (profile: Profile | null) => void
  setLoading: (loading: boolean) => void
  login: (email: string) => Promise<{ error: Error | null }>
  loginWithGoogle: () => Promise<{ error: Error | null }>
  logout: () => Promise<void>
  fetchProfile: () => Promise<void>
  updateProfile: (updates: Partial<Omit<Profile, 'id'>>) => Promise<{ error: Error | null }>
  initialize: () => Promise<() => void>
}

function checkProfileComplete(profile: Profile | null): boolean {
  if (!profile) return false
  return !!(profile.goal && profile.goal.trim().length > 0)
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,
  initialized: false,
  isProfileComplete: false,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile, isProfileComplete: checkProfileComplete(profile) }),
  setLoading: (loading) => set({ loading }),

  login: async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    return { error: error as Error | null }
  },

  loginWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    return { error: error as Error | null }
  },

  logout: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, profile: null, isProfileComplete: false })
  },

  fetchProfile: async () => {
    const { user } = get()
    if (!user) return

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!error && data) {
      const profile = data as Profile
      set({ profile, isProfileComplete: checkProfileComplete(profile) })
    }
  },

  updateProfile: async (updates: Partial<Omit<Profile, 'id'>>) => {
    const { user } = get()
    if (!user) return { error: new Error('Not authenticated') }

    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, ...updates }, { onConflict: 'id' })
      .select('*')
      .single()

    if (!error && data) {
      const profile = data as Profile
      set({ profile, isProfileComplete: checkProfileComplete(profile) })
    }

    return { error: error as Error | null }
  },

  initialize: async () => {
    // Get initial session
    const { data: { session } } = await supabase.auth.getSession()
    set({
      session,
      user: session?.user ?? null,
      loading: false,
      initialized: true,
    })

    if (session?.user) {
      get().fetchProfile()
    }

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        set({
          session,
          user: session?.user ?? null,
          loading: false,
        })
        if (session?.user) {
          get().fetchProfile()
        } else {
          set({ profile: null, isProfileComplete: false })
        }
      }
    )

    // Return cleanup function
    return () => subscription.unsubscribe()
  },
}))
