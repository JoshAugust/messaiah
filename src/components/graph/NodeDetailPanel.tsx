import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Briefcase,
  MapPin,
  Mail,
  Linkedin,
  Star,
  TrendingUp,
  Users,
  MessageSquare,
  ExternalLink,
  ChevronRight,
} from 'lucide-react'
import type { GraphNode } from '../../hooks/useGraphData'

interface Props {
  node: GraphNode | null
  onClose: () => void
  onFindSimilar?: (node: GraphNode) => void
}

function ScoreBar({ label, value }: { label: string; value: number | null | undefined }) {
  const pct = Math.min(100, Math.max(0, value ?? 0))
  const color =
    pct >= 75 ? '#22c55e' :
    pct >= 50 ? '#f59e0b' :
    pct >= 25 ? '#60a5fa' : '#6b7280'

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className="font-mono text-[var(--text-primary)]">{pct.toFixed(0)}</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function Badge({ text }: { text: string }) {
  return (
    <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs text-[var(--text-secondary)] capitalize">
      {text.replace(/_/g, ' ')}
    </span>
  )
}

export function NodeDetailPanel({ node, onClose, onFindSimilar }: Props) {
  if (!node) return null

  const contact = node.contact
  const person = node.person
  const data = contact ?? person

  const name = node.name
  const company = data?.company ?? null
  const title = contact?.position ?? person?.title ?? null
  const location = contact?.location ?? null
  const email = contact?.email ?? person?.email ?? null
  const linkedinUrl = contact?.linkedin_url ?? person?.linkedin_url ?? null
  const aiSummary = data?.ai_summary ?? null
  const talkingPoints = (data?.talking_points as string[] | null) ?? []
  const relationshipType = contact?.relationship_type ?? null
  const tags = (contact?.tags as string[] | null) ?? []
  const notes = contact?.notes ?? null
  const nextAction = contact?.next_action ?? null

  const scores = contact
    ? [
        { label: 'Strategic Value', value: contact.strategic_value },
        { label: 'Discovery Score', value: contact.discovery_score },
        { label: 'Career Fit', value: contact.career_fit_score },
        { label: 'Connection Strength', value: contact.connection_strength },
      ]
    : [
        { label: 'Strategic Value', value: person?.strategic_value },
        { label: 'Discovery Score', value: person?.discovery_score },
        { label: 'Career Fit', value: person?.career_fit_score },
      ]

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          key="panel"
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="absolute top-0 right-0 h-full w-80 bg-[#0e0e18] border-l border-white/10 shadow-2xl flex flex-col z-20 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between p-4 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {/* Avatar circle */}
              <div
                className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold text-white"
                style={{
                  backgroundColor: node.color ?? (node.type === 'contact' ? '#3b82f6' : '#22c55e'),
                }}
              >
                {name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-[var(--text-primary)] text-sm truncate">{name}</p>
                {title && (
                  <p className="text-xs text-[var(--text-muted)] truncate">{title}</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Meta info */}
            <div className="space-y-2">
              {company && (
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <Briefcase className="w-3.5 h-3.5 flex-shrink-0 text-[var(--text-muted)]" />
                  <span className="truncate">{company}</span>
                </div>
              )}
              {location && (
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-[var(--text-muted)]" />
                  <span className="truncate">{location}</span>
                </div>
              )}
              {email && (
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0 text-[var(--text-muted)]" />
                  <a href={`mailto:${email}`} className="truncate hover:text-[var(--accent)] transition-colors">
                    {email}
                  </a>
                </div>
              )}
              {linkedinUrl && (
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <Linkedin className="w-3.5 h-3.5 flex-shrink-0 text-[var(--text-muted)]" />
                  <a
                    href={linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate hover:text-[var(--accent)] transition-colors flex items-center gap-1"
                  >
                    LinkedIn <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Badges */}
            {(relationshipType || tags.length > 0 || node.type === 'discovered') && (
              <div className="flex flex-wrap gap-1.5">
                {node.type === 'discovered' && <Badge text="2nd degree" />}
                {node.type === 'contact' && <Badge text="1st degree" />}
                {relationshipType && <Badge text={relationshipType} />}
                {tags.slice(0, 4).map(tag => <Badge key={tag} text={tag} />)}
              </div>
            )}

            {/* Scores */}
            <div className="space-y-2.5 bg-white/5 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                <Star className="w-3 h-3" /> Scores
              </div>
              {scores.map(s => (
                <ScoreBar key={s.label} label={s.label} value={s.value} />
              ))}
            </div>

            {/* AI Summary */}
            {aiSummary && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                  <TrendingUp className="w-3 h-3" /> AI Summary
                </div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {aiSummary}
                </p>
              </div>
            )}

            {/* Talking points */}
            {talkingPoints.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                  <MessageSquare className="w-3 h-3" /> Talking Points
                </div>
                <ul className="space-y-1.5">
                  {talkingPoints.slice(0, 5).map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                      <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-[var(--accent)]" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Notes */}
            {notes && (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Notes</div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed bg-white/5 rounded-lg p-2.5">
                  {notes}
                </p>
              </div>
            )}

            {/* Next action */}
            {nextAction && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 text-sm text-amber-300">
                <span className="font-medium">Next: </span>{nextAction}
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="p-4 border-t border-white/10 flex-shrink-0 space-y-2">
            {onFindSimilar && node.type !== 'self' && (
              <button
                onClick={() => onFindSimilar(node)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-white text-sm font-medium transition-colors"
              >
                <Users className="w-4 h-4" />
                Find Similar People
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full px-3 py-2 rounded-lg border border-white/15 text-[var(--text-secondary)] text-sm hover:bg-white/5 transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
