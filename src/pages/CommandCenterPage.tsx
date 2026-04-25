import { useRef, type KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Terminal,
  Activity,
  MessageSquare,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Play,
  Zap,
  Trash2,
  Bot,
  User,
  AlertCircle,
} from 'lucide-react'
import { useChat } from '../hooks/useChat'
import { useEnrichmentJobs } from '../hooks/useEnrichmentJobs'
import { useState } from 'react'
import type { EnrichmentJob, JobStatus } from '../types/database'

// ─── Chat suggestions ──────────────────────────────────────────────────────────

const CHAT_SUGGESTIONS = [
  'Summarize my network health',
  'Who should I talk to about breaking into fintech?',
  'What are my strongest connections?',
  'Who in my network has the most strategic value?',
  'How many contacts do I have?',
  'Who are my most recent connections?',
]

// ─── Job status helpers ────────────────────────────────────────────────────────

function JobStatusBadge({ status }: { status: EnrichmentJob['status'] }) {
  const configs: Record<JobStatus, { icon: React.ReactNode; label: string; className: string }> = {
    completed: {
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      label: 'Completed',
      className: 'text-emerald-400 bg-emerald-400 bg-opacity-10',
    },
    failed: {
      icon: <XCircle className="w-3.5 h-3.5" />,
      label: 'Failed',
      className: 'text-red-400 bg-red-400 bg-opacity-10',
    },
    running: {
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
      label: 'Running',
      className: 'text-[var(--accent)] bg-[var(--accent)] bg-opacity-10',
    },
    retrying: {
      icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
      label: 'Retrying',
      className: 'text-amber-400 bg-amber-400 bg-opacity-10',
    },
    pending: {
      icon: <Clock className="w-3.5 h-3.5" />,
      label: 'Queued',
      className: 'text-[var(--text-muted)] bg-[var(--bg-hover)]',
    },
  }

  const cfg = configs[status]
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.className}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

// ─── Chat message component ────────────────────────────────────────────────────

function ChatBubble({ role, content }: { role: 'user' | 'assistant' | 'system'; content: string }) {
  const isUser = role === 'user'

  // Simple markdown-lite: bold **text**
  const formatContent = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>
      }
      // Preserve newlines
      return part.split('\n').map((line, j, arr) => (
        <span key={`${i}-${j}`}>
          {line}
          {j < arr.length - 1 && <br />}
        </span>
      ))
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-[var(--accent)]' : 'bg-[var(--bg-hover)] border border-[var(--border)]'
        }`}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5 text-white" />
        ) : (
          <Bot className="w-3.5 h-3.5 text-[var(--accent)]" />
        )}
      </div>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-[var(--accent)] text-white rounded-tr-sm'
            : 'bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-tl-sm'
        }`}
      >
        {formatContent(content)}
      </div>
    </motion.div>
  )
}

// ─── Enrichment Jobs tab ───────────────────────────────────────────────────────

function EnrichmentJobsTab() {
  const {
    jobs,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    refresh,
    startBatchEnrichment,
    stats,
  } = useEnrichmentJobs()

  const filterOptions: { value: JobStatus | 'all'; label: string }[] = [
    { value: 'all', label: `All (${stats.total})` },
    { value: 'running', label: `Running (${stats.running})` },
    { value: 'pending', label: `Queued (${stats.pending})` },
    { value: 'completed', label: `Done (${stats.completed})` },
    { value: 'failed', label: `Failed (${stats.failed})` },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 mb-4 flex-shrink-0">
        {[
          { label: 'Total', value: stats.total, color: 'text-[var(--text-primary)]' },
          { label: 'Running', value: stats.running, color: 'text-[var(--accent)]' },
          { label: 'Done', value: stats.completed, color: 'text-emerald-400' },
          { label: 'Failed', value: stats.failed, color: 'text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3 text-center">
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <div className="flex gap-1 flex-1 overflow-x-auto pb-1">
          {filterOptions.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                statusFilter === value
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors flex-shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
        <button
          onClick={startBatchEnrichment}
          className="flex items-center gap-1.5 text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
        >
          <Play className="w-3 h-3" />
          Batch Enrich
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30 rounded-xl px-4 py-3 mb-4 flex-shrink-0">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Job list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Activity className="w-10 h-10 text-[var(--text-muted)] opacity-20 mb-3" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">No enrichment jobs</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Click "Batch Enrich" to start enriching your contacts
            </p>
          </div>
        ) : (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
            <AnimatePresence>
              {jobs.map((job) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-4 px-4 py-3 border-b border-[var(--border)] last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                        {job.target_type === 'contact' ? '👤' : '🔍'} {job.target_id.slice(0, 12)}…
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
                      <span>Attempt {job.attempt_count}/{job.max_attempts}</span>
                      {job.started_at && (
                        <span>Started {new Date(job.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                      {job.completed_at && (
                        <span>Done {new Date(job.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>

                    {/* Progress bar for running jobs */}
                    {(job.status === 'running' || job.status === 'retrying') && (
                      <div className="mt-1.5 h-1 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-[var(--accent)] rounded-full"
                          initial={{ width: '10%' }}
                          animate={{ width: '80%' }}
                          transition={{ duration: 3, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }}
                        />
                      </div>
                    )}
                    {job.status === 'completed' && (
                      <div className="mt-1.5 h-1 bg-emerald-500 bg-opacity-20 rounded-full overflow-hidden">
                        <div className="h-full w-full bg-emerald-500 rounded-full" />
                      </div>
                    )}
                  </div>

                  <JobStatusBadge status={job.status} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CommandCenterPage() {
  const { messages, input, sending, error, setInput, sendMessage, clearHistory, bottomRef } = useChat()
  const [activeTab, setActiveTab] = useState<'chat' | 'jobs'>('chat')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleSuggestion = (s: string) => {
    sendMessage(s)
    inputRef.current?.focus()
  }

  const tabs = [
    { key: 'chat' as const, label: 'AI Chat', icon: MessageSquare },
    { key: 'jobs' as const, label: 'Enrichment Jobs', icon: Activity },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-[var(--accent)]" />
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Command Center</h1>
        </div>
        <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          Smart query engine active
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-3 pb-0 flex gap-2 flex-shrink-0">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden p-6 pt-4">
        {activeTab === 'chat' ? (
          <div className="flex flex-col h-full bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center h-full text-center py-8"
                >
                  <div className="w-14 h-14 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border)] flex items-center justify-center mb-4">
                    <Bot className="w-6 h-6 text-[var(--accent)]" />
                  </div>
                  <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                    Ask me about your network
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mb-6 max-w-xs">
                    I can query your contacts, find patterns, and help you plan your outreach strategy
                  </p>

                  {/* Suggestion chips */}
                  <div className="w-full max-w-md space-y-2">
                    {CHAT_SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSuggestion(s)}
                        className="w-full text-left text-xs bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border)] hover:border-[var(--accent)] rounded-xl px-4 py-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <ChatBubble key={msg.id} role={msg.role} content={msg.content} />
                  ))}
                  {sending && (
                    <div className="flex gap-2">
                      <div className="w-7 h-7 rounded-full bg-[var(--bg-hover)] border border-[var(--border)] flex items-center justify-center flex-shrink-0">
                        <Bot className="w-3.5 h-3.5 text-[var(--accent)]" />
                      </div>
                      <div className="bg-[var(--bg-hover)] rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]"
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </>
              )}
            </div>

            {/* Error bar */}
            {error && (
              <div className="px-4 py-2 bg-red-500 bg-opacity-10 border-t border-red-500 border-opacity-20 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            {/* Suggestions (when messages exist) */}
            {messages.length > 0 && (
              <div className="px-4 pt-2 pb-0 flex gap-2 overflow-x-auto">
                {CHAT_SUGGESTIONS.slice(0, 3).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSuggestion(s)}
                    className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] bg-[var(--bg-hover)] hover:bg-[var(--bg-secondary)] px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex-shrink-0"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input area */}
            <div className="border-t border-[var(--border)] p-4 flex-shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  sendMessage()
                }}
                className="flex gap-3"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your network…"
                  className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl px-4 py-2.5 transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={clearHistory}
                    title="Clear chat history"
                    className="text-[var(--text-muted)] hover:text-red-400 rounded-xl px-2 py-2.5 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </form>
            </div>
          </div>
        ) : (
          <EnrichmentJobsTab />
        )}
      </div>
    </div>
  )
}
