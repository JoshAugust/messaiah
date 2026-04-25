import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare,
  RefreshCw,
  UserPlus,
  Bell,
  Zap,
  Star,
  CheckCircle,
  Activity,
} from 'lucide-react'
import type { FeedItem, FeedItemType } from '../../types/database'
import { supabase } from '../../lib/supabase'

const TYPE_CONFIG: Record<
  FeedItemType,
  { icon: typeof Activity; color: string; label: string }
> = {
  outreach: { icon: MessageSquare, color: 'var(--accent)', label: 'Outreach' },
  follow_up: { icon: RefreshCw, color: 'var(--warning)', label: 'Follow-up' },
  introduction: { icon: UserPlus, color: 'var(--success)', label: 'Introduction' },
  reconnect: { icon: RefreshCw, color: '#a78bfa', label: 'Reconnect' },
  opportunity: { icon: Star, color: 'var(--warning)', label: 'Opportunity' },
  alert: { icon: Bell, color: 'var(--danger)', label: 'Alert' },
}

function timeAgo(dateStr: string | undefined): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

async function markCompleted(itemId: string) {
  await supabase
    .from('feed_items')
    .update({ is_completed: true, completed_at: new Date().toISOString() })
    .eq('id', itemId)
}

async function dismiss(itemId: string) {
  await supabase.from('feed_items').update({ is_dismissed: true }).eq('id', itemId)
}

interface ActionFeedProps {
  items: FeedItem[]
  onRefresh?: () => void
}

export function ActionFeed({ items, onRefresh }: ActionFeedProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Activity className="w-8 h-8 text-[var(--text-muted)] mb-2 opacity-30" />
        <p className="text-sm text-[var(--text-muted)]">No pending actions</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Import contacts to generate recommendations
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {items.map((item, i) => {
          const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.alert
          const Icon = cfg.icon

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10, height: 0, marginBottom: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
              className="group flex items-start gap-3 p-3 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: `${cfg.color}20` }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-[var(--text-primary)] font-medium leading-snug truncate">
                    {item.title}
                  </p>
                  <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap flex-shrink-0 mt-0.5">
                    {timeAgo(item.created_at)}
                  </span>
                </div>
                {item.description && (
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">
                    {item.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={async () => {
                      await markCompleted(item.id)
                      onRefresh?.()
                    }}
                    className="flex items-center gap-1 text-[10px] text-[var(--success)] hover:opacity-80 transition-opacity"
                  >
                    <CheckCircle className="w-3 h-3" />
                    Done
                  </button>
                  <button
                    onClick={async () => {
                      await dismiss(item.id)
                      onRefresh?.()
                    }}
                    className="text-[10px] text-[var(--text-muted)] hover:opacity-80 transition-opacity"
                  >
                    Dismiss
                  </button>
                </div>
              </div>

              <div
                className="flex-shrink-0 self-start mt-1 px-1.5 py-0.5 rounded text-[9px] font-medium"
                style={{ backgroundColor: `${cfg.color}15`, color: cfg.color }}
              >
                {cfg.label}
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>

      {items.length > 0 && (
        <div className="pt-1 flex items-center justify-between">
          <span className="text-xs text-[var(--text-muted)]">
            {items.length} pending action{items.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={onRefresh}
            className="text-xs text-[var(--accent)] hover:opacity-80 transition-opacity flex items-center gap-1"
          >
            <Zap className="w-3 h-3" />
            Refresh
          </button>
        </div>
      )}
    </div>
  )
}
