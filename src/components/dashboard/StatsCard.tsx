import { type ElementType } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { Link } from 'react-router-dom'

export interface StatsCardProps {
  icon: ElementType
  value: string | number
  label: string
  color?: string
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
  to?: string
  delay?: number
}

export function StatsCard({
  icon: Icon,
  value,
  label,
  color = 'var(--accent)',
  trend,
  trendLabel,
  to,
  delay = 0,
}: StatsCardProps) {
  const TrendIcon =
    trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus
  const trendColor =
    trend === 'up'
      ? 'var(--success)'
      : trend === 'down'
      ? 'var(--danger)'
      : 'var(--text-muted)'

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
      className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--accent)] transition-colors group cursor-pointer h-full"
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {trend && trendLabel && (
          <div className="flex items-center gap-0.5" style={{ color: trendColor }}>
            <TrendIcon className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{trendLabel}</span>
          </div>
        )}
      </div>

      <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums leading-none mb-1">
        {value}
      </p>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
    </motion.div>
  )

  if (to) {
    return <Link to={to} className="block h-full">{content}</Link>
  }
  return content
}
