import { motion } from 'framer-motion'
import type { EnrichmentStatus } from '../types/database'

interface EnrichmentBadgeProps {
  status: EnrichmentStatus | null
  className?: string
  showLabel?: boolean
}

const STATUS_CONFIG: Record<
  NonNullable<EnrichmentStatus>,
  { label: string; color: string; dot: string; pulse: boolean }
> = {
  pending: {
    label: 'Pending',
    color: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
    dot: 'bg-gray-400',
    pulse: false,
  },
  in_progress: {
    label: 'Enriching',
    color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    dot: 'bg-blue-400',
    pulse: true,
  },
  completed: {
    label: 'Enriched',
    color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    dot: 'bg-emerald-400',
    pulse: false,
  },
  failed: {
    label: 'Failed',
    color: 'text-red-400 bg-red-400/10 border-red-400/20',
    dot: 'bg-red-400',
    pulse: false,
  },
  skipped: {
    label: 'Stale',
    color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    dot: 'bg-yellow-400',
    pulse: false,
  },
}

export function EnrichmentBadge({ status, className = '', showLabel = true }: EnrichmentBadgeProps) {
  const cfg = status ? STATUS_CONFIG[status] : STATUS_CONFIG.pending

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full
        border text-xs font-medium
        ${cfg.color} ${className}
      `}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className={`rounded-full ${cfg.dot} h-full w-full`} />
        {cfg.pulse && (
          <motion.span
            className={`absolute inset-0 rounded-full ${cfg.dot}`}
            animate={{ scale: [1, 2, 1], opacity: [0.8, 0, 0.8] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </span>
      {showLabel && cfg.label}
    </span>
  )
}
