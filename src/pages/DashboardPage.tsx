import { motion } from 'framer-motion'
import {
  Users,
  Sparkles,
  Network,
  Zap,
  Target,
  Upload,
  Search,
  Activity,
  TrendingUp,
  BarChart2,
  Heart,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useDashboard } from '../hooks/useDashboard'
import { StatsCard } from '../components/dashboard/StatsCard'
import { ActionFeed } from '../components/dashboard/ActionFeed'
import { OpportunityList } from '../components/dashboard/OpportunityList'

// ─── Health Ring ─────────────────────────────────────────────────────────────

function HealthRing({ score }: { score: number }) {
  const r = 42
  const circ = 2 * Math.PI * r
  const fill = (score / 100) * circ
  const color =
    score >= 70 ? 'var(--success)' : score >= 40 ? 'var(--warning)' : 'var(--danger)'

  return (
    <div className="relative flex items-center justify-center w-28 h-28">
      <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
        <circle cx="56" cy="56" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
        <motion.circle
          cx="56"
          cy="56"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - fill }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.4 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-2xl font-bold tabular-nums"
          style={{ color }}
        >
          {score}
        </motion.span>
        <span className="text-[10px] text-[var(--text-muted)]">/ 100</span>
      </div>
    </div>
  )
}

// ─── CSS Bar Chart ────────────────────────────────────────────────────────────

function BarChart({
  data,
  maxValue,
  color = 'var(--accent)',
}: {
  data: Array<{ label: string; count: number; pct: number }>
  maxValue: number
  color?: string
}) {
  if (data.length === 0) {
    return (
      <p className="text-xs text-[var(--text-muted)] text-center py-4">No data yet</p>
    )
  }

  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 + i * 0.05 }}
          className="flex items-center gap-2"
        >
          <span
            className="text-xs text-[var(--text-muted)] truncate flex-shrink-0"
            style={{ width: '100px' }}
            title={item.label}
          >
            {item.label === 'null' || item.label === 'unset' ? '—' : item.label}
          </span>
          <div className="flex-1 h-4 bg-[var(--bg-hover)] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: color }}
              initial={{ width: 0 }}
              animate={{
                width: `${maxValue > 0 ? Math.round((item.count / maxValue) * 100) : 0}%`,
              }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.35 + i * 0.05 }}
            />
          </div>
          <span className="text-xs tabular-nums text-[var(--text-muted)] w-8 text-right flex-shrink-0">
            {item.count}
          </span>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Quick Action Button ──────────────────────────────────────────────────────

function QuickAction({
  icon: Icon,
  label,
  desc,
  to,
  color,
  delay,
}: {
  icon: typeof Activity
  label: string
  desc: string
  to: string
  color: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <Link
        to={to}
        className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] hover:border-[var(--accent)] bg-[var(--bg-card)] transition-all group"
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
            {label}
          </p>
          <p className="text-xs text-[var(--text-muted)]">{desc}</p>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function DashboardPage() {
  const { profile, user } = useAuthStore()
  const navigate = useNavigate()
  const { stats, recentFeedItems, topOpportunities, loading, refresh } = useDashboard(
    user?.id ?? null
  )

  const firstName = profile?.name?.split(' ')[0] ?? 'there'
  const enrichmentPct = stats.enrichmentCoverage

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-start justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            {loading ? 'Dashboard' : `Welcome back, ${firstName}`}
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">
            Network intelligence command center
          </p>
        </div>
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          onClick={refresh}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors flex items-center gap-1 mt-1"
        >
          <Activity className="w-3.5 h-3.5" />
          Refresh
        </motion.button>
      </motion.div>

      {/* ── Goal Banner ── */}
      {profile?.goal && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          className="relative overflow-hidden rounded-xl border border-[var(--accent)] border-opacity-30 bg-[var(--accent)] bg-opacity-[0.06] p-4"
        >
          <div
            className="absolute inset-0 opacity-5 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse at 80% 50%, var(--accent) 0%, transparent 70%)',
            }}
          />
          <div className="relative flex items-start gap-3">
            <Target className="w-4 h-4 text-[var(--accent)] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-[var(--accent)] mb-0.5 uppercase tracking-wide">
                Your Goal
              </p>
              <p className="text-sm text-[var(--text-primary)] leading-snug">{profile.goal}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Network Health + Stats ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Health Score */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="lg:col-span-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 flex flex-col items-center justify-center gap-2"
        >
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
            Network Health
          </p>
          <HealthRing score={stats.networkHealthScore} />
          <div className="w-full space-y-1 mt-1">
            <div className="flex justify-between text-xs text-[var(--text-muted)]">
              <span>Enrichment</span>
              <span className="tabular-nums">{enrichmentPct}%</span>
            </div>
            <div className="h-1.5 bg-[var(--bg-hover)] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-[var(--accent)]"
                initial={{ width: 0 }}
                animate={{ width: `${enrichmentPct}%` }}
                transition={{ duration: 0.8, delay: 0.5 }}
              />
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="lg:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatsCard
            icon={Users}
            value={loading ? '—' : stats.totalContacts}
            label="Total Contacts"
            color="var(--accent)"
            to="/contacts"
            delay={0.15}
          />
          <StatsCard
            icon={Sparkles}
            value={loading ? '—' : stats.enrichedCount}
            label="Enriched"
            color="var(--success)"
            trend={stats.enrichedCount > 0 ? 'up' : 'neutral'}
            trendLabel={stats.enrichedCount > 0 ? `${enrichmentPct}%` : undefined}
            to="/contacts"
            delay={0.2}
          />
          <StatsCard
            icon={Network}
            value={loading ? '—' : stats.discoveredCount}
            label="2nd Degree Found"
            color="#a78bfa"
            to="/graph"
            delay={0.25}
          />
          <StatsCard
            icon={Zap}
            value={loading ? '—' : stats.pendingActions}
            label="Pending Actions"
            color="var(--warning)"
            trend={stats.pendingActions > 0 ? 'up' : 'neutral'}
            delay={0.3}
          />
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div>
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3"
        >
          Quick Actions
        </motion.h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickAction
            icon={Upload}
            label="Import Contacts"
            desc="Upload your LinkedIn CSV export"
            to="/contacts"
            color="var(--accent)"
            delay={0.2}
          />
          <QuickAction
            icon={Sparkles}
            label="Start Enrichment"
            desc="Enrich pending contacts automatically"
            to="/command"
            color="var(--success)"
            delay={0.25}
          />
          <QuickAction
            icon={Search}
            label="Find a Path"
            desc="Discover warm introduction routes"
            to="/pathfinder"
            color="#a78bfa"
            delay={0.3}
          />
        </div>
      </div>

      {/* ── Mid row: Activity Feed + Top Opportunities ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activity / Action Feed */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--accent)]" />
              Recent Actions
            </h2>
            {recentFeedItems.length > 0 && (
              <span className="text-xs text-[var(--text-muted)]">
                {recentFeedItems.length} item{recentFeedItems.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <ActionFeed items={recentFeedItems} onRefresh={refresh} />
        </motion.div>

        {/* Top Opportunities */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--warning)]" />
              Top Opportunities
            </h2>
            <span className="text-xs text-[var(--text-muted)]">by strategic value</span>
          </div>
          <OpportunityList contacts={topOpportunities} />
        </motion.div>
      </div>

      {/* ── Bottom row: Industry + Relationship breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Company/Industry Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5"
        >
          <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-[var(--success)]" />
            Top Companies
          </h2>
          <BarChart
            data={stats.industryBreakdown.map((d) => ({ label: d.industry, count: d.count, pct: d.pct }))}
            maxValue={stats.industryBreakdown[0]?.count ?? 1}
            color="var(--success)"
          />
          {stats.totalContacts === 0 && (
            <p className="text-xs text-[var(--text-muted)] text-center mt-2">
              Import contacts to see company distribution
            </p>
          )}
        </motion.div>

        {/* Relationship Type Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5"
        >
          <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4">
            <Heart className="w-4 h-4 text-[var(--danger)]" />
            Relationship Types
          </h2>
          <BarChart
            data={stats.relationshipBreakdown.map((r) => ({
              label: r.type,
              count: r.count,
              pct: r.pct,
            }))}
            maxValue={stats.relationshipBreakdown[0]?.count ?? 1}
            color="var(--danger)"
          />
          {stats.totalContacts === 0 && (
            <p className="text-xs text-[var(--text-muted)] text-center mt-2">
              Tag your contacts to see distribution
            </p>
          )}
        </motion.div>
      </div>

      {/* ── Explore CTA (empty state) ── */}
      {stats.totalContacts === 0 && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center py-8"
        >
          <p className="text-sm text-[var(--text-muted)] mb-3">
            Your network is waiting. Import your LinkedIn connections to get started.
          </p>
          <button
            onClick={() => navigate('/contacts')}
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Import Contacts
          </button>
        </motion.div>
      )}
    </div>
  )
}
