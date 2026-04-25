import { Navigate, Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'

export function ProtectedRoute() {
  const { user, loading, initialized, profile, isProfileComplete } = useAuthStore()

  if (!initialized || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg-primary)]">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-[var(--accent)] flex items-center justify-center shadow-lg shadow-[var(--accent-glow)]">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <div className="absolute -inset-1 rounded-2xl border-2 border-[var(--accent)] opacity-30 animate-ping" />
          </div>
          <p className="text-[var(--text-muted)] text-sm font-medium tracking-wide">Loading…</p>
        </motion.div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // If profile loaded and incomplete → onboarding
  // Use `profile !== null` to confirm profile has been fetched before checking completeness
  if (profile !== null && !isProfileComplete) {
    // Don't redirect if already on /onboarding
    const isOnboarding = window.location.pathname === '/onboarding'
    if (!isOnboarding) {
      return <Navigate to="/onboarding" replace />
    }
  }

  return <Outlet />
}
