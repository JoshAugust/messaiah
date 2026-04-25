import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Filter, Upload, User, Mail, Building2,
  Star, ChevronRight, Loader2, X, ChevronLeft,
  ChevronDown, Briefcase, Calendar, AlertCircle,
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useContacts, type SortField } from '../hooks/useContacts'
import { CSVImportModal } from '../components/CSVImportModal'
import type { Contact, EnrichmentStatus, RelationshipType } from '../types/database'

// ────────── Sub-components ──────────

function ScoreBadge({ score, label }: { score: number | null; label?: string }) {
  if (score === null) return null
  const color =
    score >= 80 ? 'var(--success, #22c55e)'
    : score >= 50 ? 'var(--warning, #f59e0b)'
    : 'var(--text-muted)'
  return (
    <span className="flex items-center gap-1 text-xs font-medium" style={{ color }}>
      <Star className="w-3 h-3" />
      {score.toFixed(0)}
      {label && <span className="opacity-60">{label}</span>}
    </span>
  )
}

function EnrichmentBadge({ status }: { status: EnrichmentStatus | null }) {
  if (!status) return null
  const styles: Record<string, { bg: string; text: string }> = {
    completed: { bg: 'rgba(34,197,94,0.1)', text: 'var(--success, #22c55e)' },
    pending:   { bg: 'rgba(245,158,11,0.1)', text: 'var(--warning, #f59e0b)' },
    in_progress: { bg: 'rgba(99,102,241,0.1)', text: 'var(--accent)' },
    failed:    { bg: 'rgba(239,68,68,0.1)', text: 'var(--error, #ef4444)' },
    skipped:   { bg: 'rgba(148,163,184,0.1)', text: 'var(--text-muted)' },
  }
  const s = styles[status] ?? styles.skipped
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {status.replace('_', ' ')}
    </span>
  )
}

function ContactCard({
  contact,
  onSelect,
  isSelected,
}: {
  contact: Contact
  onSelect: (c: Contact) => void
  isSelected: boolean
}) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onSelect(contact)}
      className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors text-left border-b border-[var(--border)] last:border-0"
      style={{
        backgroundColor: isSelected ? 'var(--bg-hover)' : undefined,
      }}
    >
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: 'rgba(99,102,241,0.15)' }}
      >
        {contact.avatar_url ? (
          <img
            src={contact.avatar_url}
            alt={contact.full_name ?? ''}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <User className="w-4 h-4" style={{ color: 'var(--accent)' }} />
        )}
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {contact.full_name ?? ([contact.first_name, contact.last_name].filter(Boolean).join(' ') || '—')}
        </p>
        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
          {[contact.position, contact.company].filter(Boolean).join(' @ ') || 'No details'}
        </p>
      </div>

      {/* Scores + status */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <ScoreBadge score={contact.career_fit_score} />
        <EnrichmentBadge status={contact.enrichment_status} />
        <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
      </div>
    </motion.button>
  )
}

function ContactDetail({
  contact,
  onClose,
  onUpdate,
}: {
  contact: Contact
  onClose: () => void
  onUpdate?: (id: string, updates: Partial<Contact>) => void
}) {
  const [notes, setNotes] = useState(contact.notes ?? '')
  const [saving, setSaving] = useState(false)

  const saveNotes = async () => {
    if (!onUpdate) return
    setSaving(true)
    await onUpdate(contact.id, { notes })
    setSaving(false)
  }

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="w-80 flex-shrink-0 border-l overflow-y-auto flex flex-col"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Detail header */}
      <div
        className="p-4 border-b flex items-center justify-between sticky top-0 z-10"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-secondary)' }}
      >
        <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
          Contact Detail
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 flex-1 space-y-4">
        {/* Identity */}
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'rgba(99,102,241,0.15)' }}
          >
            {contact.avatar_url ? (
              <img
                src={contact.avatar_url}
                alt={contact.full_name ?? ''}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <User className="w-6 h-6" style={{ color: 'var(--accent)' }} />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {contact.full_name ?? [contact.first_name, contact.last_name].filter(Boolean).join(' ')}
            </p>
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              {contact.headline ?? contact.position ?? ''}
            </p>
          </div>
        </div>

        {/* Contact info */}
        <div className="space-y-2">
          {contact.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
              <span className="truncate" style={{ color: 'var(--text-secondary)' }}>
                {contact.email}
              </span>
            </div>
          )}
          {contact.company && (
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
              <span className="truncate" style={{ color: 'var(--text-secondary)' }}>
                {contact.company}
              </span>
            </div>
          )}
          {contact.position && (
            <div className="flex items-center gap-2 text-sm">
              <Briefcase className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
              <span className="truncate" style={{ color: 'var(--text-secondary)' }}>
                {contact.position}
              </span>
            </div>
          )}
          {contact.connected_on && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
              <span style={{ color: 'var(--text-muted)' }}>
                Connected {new Date(contact.connected_on).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          )}
        </div>

        {/* Scores grid */}
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
            Scores
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Discovery', value: contact.discovery_score },
              { label: 'Career Fit', value: contact.career_fit_score },
              { label: 'Strength', value: contact.connection_strength },
              { label: 'Strategic', value: contact.strategic_value },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-lg p-3 text-center"
                style={{ backgroundColor: 'var(--bg-card)' }}
              >
                <p
                  className="text-lg font-bold"
                  style={{
                    color: value !== null
                      ? value >= 80 ? 'var(--success, #22c55e)'
                        : value >= 50 ? 'var(--warning, #f59e0b)'
                        : 'var(--text-primary)'
                      : 'var(--text-muted)',
                  }}
                >
                  {value !== null ? value.toFixed(0) : '—'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* AI Summary */}
        {contact.ai_summary && (
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              AI Summary
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {contact.ai_summary}
            </p>
          </div>
        )}

        {/* Enrichment status */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Enrichment
          </p>
          <EnrichmentBadge status={contact.enrichment_status} />
        </div>

        {/* LinkedIn */}
        {contact.linkedin_url && (
          <a
            href={contact.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-center py-2 rounded-lg transition-colors hover:opacity-80"
            style={{ backgroundColor: 'rgba(10,102,194,0.15)', color: '#0a66c2' }}
          >
            View LinkedIn Profile →
          </a>
        )}

        {/* Notes */}
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
            Notes
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes..."
            rows={4}
            className="w-full rounded-lg p-2.5 text-sm resize-none focus:outline-none border transition-colors"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          {notes !== (contact.notes ?? '') && (
            <button
              onClick={saveNotes}
              disabled={saving}
              className="mt-2 w-full py-2 rounded-lg text-xs font-medium text-white transition-colors flex items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {saving ? 'Saving...' : 'Save notes'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ────────── Filter bar ──────────

const ENRICHMENT_OPTIONS: { label: string; value: EnrichmentStatus | '' }[] = [
  { label: 'All statuses', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
]

const RELATIONSHIP_OPTIONS: { label: string; value: RelationshipType | '' }[] = [
  { label: 'All types', value: '' },
  { label: 'Colleague', value: 'colleague' },
  { label: 'Mentor', value: 'mentor' },
  { label: 'Mentee', value: 'mentee' },
  { label: 'Recruiter', value: 'recruiter' },
  { label: 'Hiring Manager', value: 'hiring_manager' },
  { label: 'Peer', value: 'peer' },
  { label: 'Friend', value: 'friend' },
  { label: 'Acquaintance', value: 'acquaintance' },
  { label: 'Other', value: 'other' },
]

const SORT_OPTIONS: { label: string; value: SortField }[] = [
  { label: 'Name', value: 'full_name' },
  { label: 'Career Fit', value: 'career_fit_score' },
  { label: 'Strategic Value', value: 'strategic_value' },
  { label: 'Connected On', value: 'connected_on' },
]

// ────────── Main page ──────────

export function ContactsPage() {
  const { user } = useAuthStore()
  const userId = user?.id ?? null

  const {
    contacts,
    loading,
    error,
    totalCount,
    page,
    pageCount,
    filters,
    setFilters,
    setPage,
    refresh,
    updateContact,
    deleteContact,
  } = useContacts(userId)

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [searchInput, setSearchInput] = useState('')

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters({ search: searchInput })
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput, setFilters])

  const handleImportComplete = () => {
    setShowImportModal(false)
    refresh()
  }

  const handleDeleteContact = async (contact: Contact) => {
    if (!confirm(`Remove ${contact.full_name ?? 'this contact'}?`)) return
    await deleteContact(contact.id)
    if (selectedContact?.id === contact.id) setSelectedContact(null)
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Header ── */}
        <div
          className="px-6 py-4 border-b flex items-center gap-3 flex-wrap"
          style={{ borderColor: 'var(--border)' }}
        >
          <h1 className="text-lg font-bold mr-auto" style={{ color: 'var(--text-primary)' }}>
            Contacts
            {totalCount > 0 && (
              <span className="ml-2 text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
                ({totalCount.toLocaleString()})
              </span>
            )}
          </h1>

          {/* Search */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none w-56 transition-colors"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-2 rounded-lg border transition-colors"
            style={{
              backgroundColor: showFilters ? 'var(--accent)' : 'var(--bg-secondary)',
              borderColor: showFilters ? 'var(--accent)' : 'var(--border)',
              color: showFilters ? 'white' : 'var(--text-secondary)',
            }}
          >
            <Filter className="w-4 h-4" />
          </button>

          {/* Import button */}
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
        </div>

        {/* ── Filter bar ── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="px-6 py-3 flex items-center gap-3 flex-wrap">
                {/* Enrichment status */}
                <div className="relative">
                  <select
                    value={filters.enrichmentStatus ?? ''}
                    onChange={(e) =>
                      setFilters({
                        enrichmentStatus: (e.target.value as EnrichmentStatus) || null,
                      })
                    }
                    className="appearance-none border rounded-lg px-3 py-1.5 text-sm pr-8 focus:outline-none"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {ENRICHMENT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                    style={{ color: 'var(--text-muted)' }}
                  />
                </div>

                {/* Relationship type */}
                <div className="relative">
                  <select
                    value={filters.relationshipType ?? ''}
                    onChange={(e) =>
                      setFilters({
                        relationshipType: (e.target.value as RelationshipType) || null,
                      })
                    }
                    className="appearance-none border rounded-lg px-3 py-1.5 text-sm pr-8 focus:outline-none"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {RELATIONSHIP_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                    style={{ color: 'var(--text-muted)' }}
                  />
                </div>

                {/* Sort */}
                <div className="relative">
                  <select
                    value={filters.sortBy}
                    onChange={(e) => setFilters({ sortBy: e.target.value as SortField })}
                    className="appearance-none border rounded-lg px-3 py-1.5 text-sm pr-8 focus:outline-none"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        Sort: {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                    style={{ color: 'var(--text-muted)' }}
                  />
                </div>

                {/* Sort dir toggle */}
                <button
                  onClick={() =>
                    setFilters({ sortDir: filters.sortDir === 'asc' ? 'desc' : 'asc' })
                  }
                  className="border rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-[var(--bg-hover)]"
                  style={{
                    borderColor: 'var(--border)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {filters.sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Contact list ── */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div
              className="m-4 p-3 rounded-xl flex items-start gap-2"
              style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}
            >
              <AlertCircle className="w-4 h-4 mt-0.5" style={{ color: '#ef4444' }} />
              <p className="text-sm" style={{ color: '#ef4444' }}>
                {error}
              </p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} />
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-6">
              <User
                className="w-10 h-10 mb-3 opacity-20"
                style={{ color: 'var(--text-muted)' }}
              />
              <p className="font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                {filters.search || filters.enrichmentStatus || filters.relationshipType
                  ? 'No contacts match your filters'
                  : 'No contacts yet'}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {filters.search || filters.enrichmentStatus || filters.relationshipType
                  ? 'Try adjusting your search or filters'
                  : 'Import your LinkedIn CSV to get started'}
              </p>
              {!(filters.search || filters.enrichmentStatus || filters.relationshipType) && (
                <button
                  onClick={() => setShowImportModal(true)}
                  className="mt-4 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  <Upload className="w-4 h-4" />
                  Import CSV
                </button>
              )}
            </div>
          ) : (
            <div
              className="border m-4 rounded-xl overflow-hidden"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}
            >
              {contacts.map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  isSelected={selectedContact?.id === contact.id}
                  onSelect={(c) =>
                    setSelectedContact(selectedContact?.id === c.id ? null : c)
                  }
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-3 pb-4">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border transition-colors disabled:opacity-30 hover:bg-[var(--bg-hover)]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Page {page} of {pageCount}
              </span>
              <button
                onClick={() => setPage(Math.min(pageCount, page + 1))}
                disabled={page === pageCount}
                className="p-1.5 rounded-lg border transition-colors disabled:opacity-30 hover:bg-[var(--bg-hover)]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Detail panel ── */}
      <AnimatePresence>
        {selectedContact && (
          <ContactDetail
            key={selectedContact.id}
            contact={selectedContact}
            onClose={() => setSelectedContact(null)}
            onUpdate={async (id, updates) => {
              await updateContact(id, updates)
              setSelectedContact((prev) => (prev?.id === id ? { ...prev, ...updates } : prev))
            }}
          />
        )}
      </AnimatePresence>

      {/* ── CSV Import Modal ── */}
      <AnimatePresence>
        {showImportModal && userId && (
          <CSVImportModal
            userId={userId}
            onClose={() => setShowImportModal(false)}
            onComplete={handleImportComplete}
          />
        )}
      </AnimatePresence>

      {/* Suppress unused import of deleteContact warning */}
      {false && handleDeleteContact}
    </div>
  )
}
