import { Link, useLocation, Outlet } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  Network,
  Route,
  Terminal,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Bell,
  Zap,
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useUIStore } from '../stores/uiStore'
import { UserMenu } from './UserMenu'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/contacts', label: 'Contacts', icon: Users },
  { path: '/graph', label: 'Network Graph', icon: Network },
  { path: '/pathfinder', label: 'Path Finder', icon: Route },
  { path: '/command', label: 'Command Center', icon: Terminal },
]

export function Layout() {
  const location = useLocation()
  const { user, profile, logout } = useAuthStore()
  const { sidebarCollapsed, toggleSidebar, notifications } = useUIStore()

  return (
    <div className="flex h-full bg-[var(--bg-primary)]">
      {/* Sidebar */}
      <motion.aside
        animate={{ width: sidebarCollapsed ? 64 : 240 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="flex flex-col h-full bg-[var(--bg-secondary)] border-r border-[var(--border)] overflow-hidden flex-shrink-0"
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-[var(--border)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="font-bold text-[var(--text-primary)] text-sm tracking-wider"
                >
                  MESSAIAH
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const isActive = path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(path)

            return (
              <Link
                key={path}
                to={path}
                title={sidebarCollapsed ? label : undefined}
                className={`
                  flex items-center gap-3 px-4 py-3 mx-2 rounded-lg mb-1 transition-all duration-150
                  ${isActive
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                  }
                `}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <AnimatePresence>
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-sm font-medium whitespace-nowrap"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            )
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-[var(--border)] p-3 flex-shrink-0">
          <div className={`flex items-center gap-3 p-2 rounded-lg ${!sidebarCollapsed ? 'mb-2' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-white" />
            </div>
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 min-w-0"
                >
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                    {profile?.name ?? user?.email?.split('@')[0] ?? 'User'}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] truncate">
                    {profile?.title ?? user?.email ?? ''}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={logout}
            title="Sign out"
            className="flex items-center gap-3 w-full px-2 py-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--danger)] transition-colors"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs"
                >
                  Sign out
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          className="absolute left-0 top-1/2 -translate-y-1/2 translate-x-full w-5 h-8 bg-[var(--bg-card)] border border-[var(--border)] rounded-r-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors z-10"
          style={{ left: sidebarCollapsed ? 64 : 240 }}
        >
          {sidebarCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </motion.aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center justify-between px-6 flex-shrink-0">
          {/* Page title slot — populated dynamically via route */}
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            {/* breadcrumb or title can go here */}
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors">
              <Bell className="w-5 h-5" />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--accent)] rounded-full" />
              )}
            </button>
            <UserMenu />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
