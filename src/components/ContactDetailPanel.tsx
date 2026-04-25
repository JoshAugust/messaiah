import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Twitter,
  Github,
  Globe,
  Linkedin,
  BookOpen,
  Briefcase,
  GraduationCap,
  Zap,
  MessageSquare,
  Tag,
  Activity,
  Route,
  Save,
  ExternalLink,
  Star,
  Target,
  Link as LinkIcon,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useContactStore } from '../stores/contactStore'
import { EnrichmentBadge } from './EnrichmentBadge'
import type { Contact } from '../types/database'

interface ContactDetailPanelProps {
  contact: Contact
  onClose: () => void
}

interface ScoreBarProps {
  label: string
  value: number | null
  color: string
  icon: React.ReactNode
}

function ScoreBar({ label, value, color, icon }: ScoreBarProps) {
  const pct = value ?? 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
          {icon}
          {label}
        </span>
        <span className="font-semibold text-[var(--text-primary)]">{value ?? '—'}</span>
      </div>
      <div className="h-1.5 bg-[var(--bg-hover)] rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
        />
      </div>
    </div>
  )
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-[var(--border)] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] transition-colors text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {title}
        </span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function ContactDetailPanel({ contact, onClose }: ContactDetailPanelProps) {
  const navigate = useNavigate()
  const { updateContact } = useContactStore()

  const [notes, setNotes] = useState(contact.notes ?? '')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>(
    Array.isArray(contact.tags) ? (contact.tags as string[]) : []
  )
  const [saving, setSaving] = useState(false)
  const [enriching, setEnriching] = useState(false)

  const socialProfiles =
    contact.social_profiles && typeof contact.social_profiles === 'object'
      ? (contact.social_profiles as Record<string, string>)
      : {}

  const workHistory = Array.isArray(contact.work_history)
    ? (contact.work_history as Array<{ title?: string; company?: string; start?: string; end?: string }>)
    : []

  const education = Array.isArray(contact.education)
    ? (contact.education as Array<{ school?: string; degree?: string; field?: string; year?: string }>)
    : []

  const skills = Array.isArray(contact.skills) ? (contact.skills as string[]) : []

  const talkingPoints = Array.isArray(contact.talking_points)
    ? (contact.talking_points as string[])
    : []

  const outreachSuggestions = Array.isArray(contact.outreach_suggestions)
    ? (contact.outreach_suggestions as string[])
    : []

  const recentActivity = Array.isArray(contact.recent_activity)
    ? (contact.recent_activity as Array<{
        type: string
        title: string
        url?: string
        date?: string
        source: string
      }>)
    : []

  const isEnriched = contact.enrichment_status === 'completed'

  const handleSaveNotes = async () => {
    setSaving(true)
    await updateContact(contact.id, { notes, tags: tags as unknown as import('../types/database').Json })
    setSaving(false)
  }

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      const t = tagInput.trim().toLowerCase()
      if (!tags.includes(t)) setTags([...tags, t])
      setTagInput('')
    }
  }

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag))

  const handleStartEnrichment = async () => {
    setEnriching(true)
    await updateContact(contact.id, { enrichment_status: 'in_progress' })
    setEnriching(false)
  }

  const handleFindPath = () => {
    const name = contact.full_name ?? `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim()
    navigate(`/pathfinder?target=${encodeURIComponent(name)}`)
  }

  const SOCIAL_ICONS: Record<string, React.ReactNode> = {
    twitter: <Twitter className="w-4 h-4" />,
    github: <Github className="w-4 h-4" />,
    medium: <BookOpen className="w-4 h-4" />,
    website: <Globe className="w-4 h-4" />,
    linkedin: <Linkedin className="w-4 h-4" />,
  }

  return (
    <motion.div
      key={contact.id}
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="h-full flex flex-col bg-[var(--bg-secondary)] border-l border-[var(--border)] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-[var(--border)] flex-shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-purple-600 flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-lg">
            {(contact.first_name?.[0] ?? contact.full_name?.[0] ?? '?').toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[var(--text-primary)] truncate">
              {contact.full_name ?? (`${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() || 'Unknown')}
            </h2>
            {contact.headline && (
              <p className="text-sm text-[var(--text-secondary)] truncate">{contact.headline}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <EnrichmentBadge status={contact.enrichment_status} />
              {contact.location && (
                <span className="text-xs text-[var(--text-muted)]">📍 {contact.location}</span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors flex-shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 px-5 py-3 border-b border-[var(--border)] flex-shrink-0">
        {!isEnriched && (
          <button
            onClick={handleStartEnrichment}
            disabled={enriching || contact.enrichment_status === 'in_progress'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5" />
            {enriching ? 'Starting…' : 'Start Enrichment'}
          </button>
        )}
        <button
          onClick={handleFindPath}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] text-xs font-medium hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
        >
          <Route className="w-3.5 h-3.5" />
          Find Path
        </button>
        {contact.linkedin_url && (
          <a
            href={contact.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] text-xs font-medium hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Linkedin className="w-3.5 h-3.5" />
            LinkedIn
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Scores */}
        {isEnriched && (
          <Section title="Scores">
            <div className="space-y-3">
              <ScoreBar
                label="Discovery Score"
                value={contact.discovery_score}
                color="bg-purple-500"
                icon={<Star className="w-3.5 h-3.5" />}
              />
              <ScoreBar
                label="Career Fit"
                value={contact.career_fit_score}
                color="bg-blue-500"
                icon={<Target className="w-3.5 h-3.5" />}
              />
              <ScoreBar
                label="Connection Strength"
                value={contact.connection_strength}
                color="bg-emerald-500"
                icon={<LinkIcon className="w-3.5 h-3.5" />}
              />
              <ScoreBar
                label="Strategic Value"
                value={contact.strategic_value}
                color="bg-amber-500"
                icon={<TrendingUp className="w-3.5 h-3.5" />}
              />
            </div>
          </Section>
        )}

        {/* Bio / AI Summary */}
        {(contact.bio ?? contact.ai_summary) && (
          <Section title="About">
            {contact.bio && (
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{contact.bio}</p>
            )}
            {contact.ai_summary && (
              <div className="mt-3 p-3 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20">
                <p className="text-xs font-semibold text-[var(--accent)] mb-1.5 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> AI Summary
                </p>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {contact.ai_summary}
                </p>
              </div>
            )}
          </Section>
        )}

        {/* Talking points */}
        {talkingPoints.length > 0 && (
          <Section title="Talking Points">
            <ul className="space-y-2">
              {talkingPoints.map((pt, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <span className="w-5 h-5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-medium">
                    {i + 1}
                  </span>
                  {pt}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Outreach suggestions */}
        {outreachSuggestions.length > 0 && (
          <Section title="Outreach Suggestions" defaultOpen={false}>
            <ul className="space-y-2">
              {outreachSuggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <MessageSquare className="w-3.5 h-3.5 text-[var(--accent)] flex-shrink-0 mt-0.5" />
                  {s}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Work history */}
        {workHistory.length > 0 && (
          <Section title="Work History" defaultOpen={false}>
            <div className="space-y-3">
              {workHistory.map((job, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--bg-hover)] flex items-center justify-center flex-shrink-0">
                    <Briefcase className="w-4 h-4 text-[var(--text-muted)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{job.title ?? 'Role'}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{job.company ?? '—'}</p>
                    {(job.start ?? job.end) && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {job.start ?? ''} – {job.end ?? 'Present'}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Education */}
        {education.length > 0 && (
          <Section title="Education" defaultOpen={false}>
            <div className="space-y-3">
              {education.map((ed, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--bg-hover)] flex items-center justify-center flex-shrink-0">
                    <GraduationCap className="w-4 h-4 text-[var(--text-muted)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{ed.school ?? 'School'}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {[ed.degree, ed.field].filter(Boolean).join(', ') || '—'}
                    </p>
                    {ed.year && <p className="text-xs text-[var(--text-muted)] mt-0.5">{ed.year}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <Section title="Skills" defaultOpen={false}>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((skill, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-full text-xs bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-[var(--border)]"
                >
                  {skill}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Social links */}
        {Object.keys(socialProfiles).length > 0 && (
          <Section title="Social Profiles" defaultOpen={false}>
            <div className="space-y-2">
              {Object.entries(socialProfiles).map(([platform, url]) => {
                if (!url) return null
                return (
                  <a
                    key={platform}
                    href={url.startsWith('http') ? url : `https://${url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors group"
                  >
                    <span className="text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors">
                      {SOCIAL_ICONS[platform] ?? <Globe className="w-4 h-4" />}
                    </span>
                    <span className="capitalize">{platform}</span>
                    <ExternalLink className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                )
              })}
            </div>
          </Section>
        )}

        {/* Recent activity */}
        {recentActivity.length > 0 && (
          <Section title="Recent Activity" defaultOpen={false}>
            <div className="space-y-3">
              {recentActivity.slice(0, 5).map((item, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] flex-shrink-0 mt-1.5" />
                  <div className="min-w-0">
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors line-clamp-2"
                      >
                        {item.title}
                      </a>
                    ) : (
                      <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{item.title}</p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <Activity className="w-3 h-3 text-[var(--text-muted)]" />
                      <span className="text-xs text-[var(--text-muted)]">
                        {item.source}
                        {item.date ? ` · ${item.date}` : ''}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Notes */}
        <Section title="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this contact…"
            rows={4}
            className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
          <button
            onClick={handleSaveNotes}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : 'Save Notes'}
          </button>
        </Section>

        {/* Tags */}
        <Section title="Tags">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20"
              >
                <Tag className="w-3 h-3" />
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="ml-0.5 hover:text-red-400 transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            placeholder="Add tag (press Enter)…"
            className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
        </Section>
      </div>
    </motion.div>
  )
}
