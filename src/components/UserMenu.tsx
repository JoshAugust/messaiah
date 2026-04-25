import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, LogOut, User, ChevronDown } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/)
    return parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : parts[0].slice(0, 2).toUpperCase()
  }
  if (email) {
    return email.slice(0, 2).toUpperCase()
  }
  return 'U'
}

function stringToHue(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % 360
}

export function UserMenu() {
  const { user, profile, logout } = useAuthStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const displayName = profile?.name ?? user?.user_metadata?.full_name ?? null
  const email = user?.email ?? null
  const initials = getInitials(displayName, email)
  const hue = stringToHue(email ?? initials)
  const avatarStyle = {
    background: `linear-gradient(135deg, hsl(${hue}, 65%, 45%), hsl(${(hue + 40) % 360}, 65%, 35%))`,
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    setOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-[var(--bg-hover)] transition-colors group"
        aria-label="User menu"
      >
        {/* Avatar */}
        <div
          style={avatarStyle}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
        >
          {initials}
        </div>

        <div className="hidden sm:block text-left max-w-[120px]">
          <p className="text-xs font-medium text-[var(--text-primary)] truncate leading-tight">
            {displayName ?? email ?? 'User'}
          </p>
          {displayName && email && (
            <p className="text-[10px] text-[var(--text-muted)] truncate leading-tight">{email}</p>
          )}
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-200 hidden sm:block ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 w-56 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Profile header */}
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <div
                  style={avatarStyle}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm"
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {displayName ?? 'User'}
                  </p>
                  {email && (
                    <p className="text-xs text-[var(--text-muted)] truncate">{email}</p>
                  )}
                  {profile?.title && (
                    <p className="text-xs text-[var(--text-muted)] truncate mt-0.5 italic">
                      {profile.title}{profile.company ? ` · ${profile.company}` : ''}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Menu items */}
            <div className="p-1.5">
              <button
                onClick={() => { setOpen(false); navigate('/profile') }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
              >
                <User className="w-4 h-4 shrink-0" />
                My Profile
              </button>

              <button
                onClick={() => { setOpen(false); navigate('/settings') }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Settings className="w-4 h-4 shrink-0" />
                Settings
              </button>

              <div className="my-1 h-px bg-[var(--border)]" />

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
