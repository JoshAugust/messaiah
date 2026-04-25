import { motion } from 'framer-motion'
import { Star, ChevronRight, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Contact } from '../../types/database'

interface OpportunityListProps {
  contacts: Contact[]
}

function ScoreBadge({ score, color }: { score: number; color: string }) {
  return (
    <div
      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums"
      style={{ backgroundColor: `${color}18`, color }}
    >
      <Star className="w-2.5 h-2.5" />
      {score.toFixed(1)}
    </div>
  )
}

function getInitials(contact: Contact): string {
  const parts = [contact.first_name, contact.last_name].filter(Boolean)
  if (parts.length === 0) return '?'
  return parts.map((p) => p![0].toUpperCase()).join('')
}

function getScoreColor(score: number): string {
  if (score >= 8) return '#f59e0b'
  if (score >= 6) return 'var(--accent)'
  if (score >= 4) return 'var(--success)'
  return 'var(--text-muted)'
}

export function OpportunityList({ contacts }: OpportunityListProps) {
  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <TrendingUp className="w-8 h-8 text-[var(--text-muted)] mb-2 opacity-30" />
        <p className="text-sm text-[var(--text-muted)]">No opportunities yet</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Enrich your contacts to surface top opportunities
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {contacts.map((contact, i) => {
        const score = contact.strategic_value ?? 0
        const color = getScoreColor(score)
        const initials = getInitials(contact)

        return (
          <motion.div
            key={contact.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.06, duration: 0.3 }}
          >
            <Link
              to={`/contacts/${contact.id}`}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--bg-hover)] transition-colors group"
            >
              {/* Rank */}
              <span className="w-5 text-xs text-[var(--text-muted)] tabular-nums text-center flex-shrink-0">
                {i + 1}
              </span>

              {/* Avatar */}
              {contact.avatar_url ? (
                <img
                  src={contact.avatar_url}
                  alt={contact.full_name ?? ''}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: `${color}20`, color }}
                >
                  {initials}
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--text-primary)] font-medium truncate leading-tight">
                  {contact.full_name ?? contact.first_name ?? 'Unknown'}
                </p>
                <p className="text-xs text-[var(--text-muted)] truncate">
                  {[contact.position, contact.company].filter(Boolean).join(' @ ')}
                </p>
              </div>

              {/* Score */}
              {contact.strategic_value != null && (
                <ScoreBadge score={contact.strategic_value} color={color} />
              )}

              <ChevronRight className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </Link>
          </motion.div>
        )
      })}

      <div className="pt-2">
        <Link
          to="/contacts"
          className="text-xs text-[var(--accent)] hover:opacity-80 transition-opacity flex items-center gap-1"
        >
          View all contacts
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}
