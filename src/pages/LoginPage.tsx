import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Mail, ArrowRight, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'

// Google "G" SVG icon
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export function LoginPage() {
  const { user, login, loginWithGoogle, loading } = useAuthStore()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  if (user) {
    return <Navigate to="/" replace />
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setSending(true)
    setError(null)
    const { error } = await login(trimmed)
    setSending(false)
    if (error) {
      setError(error.message)
    } else {
      setSubmitted(true)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    setGoogleLoading(true)
    const { error } = await loginWithGoogle()
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
    // If no error, browser redirects — don't reset loading
  }

  const isDisabled = loading || sending || googleLoading

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
      {/* Background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[var(--accent)] opacity-[0.04] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-600 opacity-[0.03] rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="relative w-full max-w-sm"
      >
        {/* Logo + brand */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4, type: 'spring', stiffness: 200 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--accent)] mb-4 shadow-xl shadow-[var(--accent-glow)]"
          >
            <Zap className="w-8 h-8 text-white" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}
            className="text-3xl font-bold text-[var(--text-primary)] tracking-tight"
          >
            MESSAIAH
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.35 }}
            className="text-[var(--text-muted)] text-sm mt-1.5"
          >
            Network Intelligence Platform
          </motion.p>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 shadow-2xl"
        >
          <AnimatePresence mode="wait">
            {submitted ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="text-center py-6"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
                  className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4"
                >
                  <CheckCircle className="w-7 h-7 text-emerald-400" />
                </motion.div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                  Check your inbox
                </h2>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                  We sent a magic link to{' '}
                  <span className="font-medium text-[var(--text-primary)]">{email}</span>.
                  Click it to sign in.
                </p>
                <button
                  onClick={() => { setSubmitted(false); setEmail('') }}
                  className="mt-5 text-[var(--accent)] text-sm hover:underline underline-offset-2"
                >
                  Use a different email →
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.25 }}
              >
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-0.5">
                  Sign in
                </h2>
                <p className="text-[var(--text-muted)] text-sm mb-6">
                  Access your network intelligence
                </p>

                {/* Google */}
                <button
                  onClick={handleGoogle}
                  disabled={isDisabled}
                  className="w-full flex items-center justify-center gap-2.5 bg-[var(--bg-hover)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text-primary)] rounded-xl py-2.5 px-4 text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed hover:border-[var(--text-muted)]"
                >
                  {googleLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <GoogleIcon />
                  )}
                  Continue with Google
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-[var(--border)]" />
                  <span className="text-[var(--text-muted)] text-xs font-medium">or</span>
                  <div className="flex-1 h-px bg-[var(--border)]" />
                </div>

                {/* Magic link form */}
                <form onSubmit={handleMagicLink} noValidate>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(null) }}
                    placeholder="you@example.com"
                    required
                    disabled={isDisabled}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50"
                  />

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -4 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2 flex items-center gap-1.5 text-xs text-red-400"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button
                    type="submit"
                    disabled={isDisabled || !email.trim()}
                    whileTap={{ scale: 0.98 }}
                    className="w-full mt-3 flex items-center justify-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl py-2.5 px-4 text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[var(--accent-glow)]"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        Send magic link
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-[var(--text-muted)] text-xs mt-5"
        >
          By signing in you agree to our{' '}
          <a href="#" className="hover:text-[var(--text-secondary)] underline underline-offset-2 transition-colors">
            Terms of Service
          </a>
        </motion.p>
      </motion.div>
    </div>
  )
}
