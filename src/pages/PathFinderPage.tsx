import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Route,
  Search,
  ArrowRight,
  User,
  Loader2,
  Bookmark,
  Sparkles,
  ChevronRight,
  AlertCircle,
  Target,
  Building2,
  Briefcase,
  RotateCcw,
} from 'lucide-react'
import { usePathFinder } from '../hooks/usePathFinder'
import type { PathResult, PathNode } from '../services/pathFinder'

const SUGGESTIONS = [
  'How do I get to VP of Product at Stripe?',
  'Find path to a Partner at a VC fund',
  'How do I reach a Hiring Manager at Google?',
  'Get intro to someone in climate tech',
  'Find path to a CTO at a Series B startup',
]

function WarmthDot({ warmth }: { warmth: number }) {
  const color =
    warmth >= 70
      ? 'bg-emerald-500'
      : warmth >= 40
      ? 'bg-amber-500'
      : 'bg-slate-500'
  return <span className={`inline-block w-2 h-2 rounded-full ${color} flex-shrink-0`} />
}

function NodeCard({ node, isTarget }: { node: PathNode; isTarget?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
        node.type === 'user'
          ? 'border-[var(--accent)] bg-[var(--accent)] bg-opacity-10'
          : isTarget || node.type === 'target'
          ? 'border-emerald-500 bg-emerald-500 bg-opacity-10'
          : 'border-[var(--border)] bg-[var(--bg-hover)]'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <WarmthDot warmth={node.warmth} />
        {node.type === 'user' ? (
          <User className="w-3.5 h-3.5 text-[var(--accent)]" />
        ) : isTarget || node.type === 'target' ? (
          <Target className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <User className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{node.name}</p>
        {(node.title || node.company) && (
          <p className="text-[10px] text-[var(--text-muted)] truncate">
            {node.title ?? ''}{node.title && node.company ? ' · ' : ''}{node.company ?? ''}
          </p>
        )}
      </div>
    </div>
  )
}

function PathCard({
  result,
  index,
  onBookmark,
}: {
  result: PathResult
  index: number
  onBookmark: () => void
}) {
  const scoreColor =
    result.score >= 70
      ? 'text-emerald-400'
      : result.score >= 45
      ? 'text-amber-400'
      : 'text-slate-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden hover:border-[var(--accent)] transition-colors"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-[var(--text-muted)]">
            #{index + 1}
          </span>
          <span className={`text-sm font-bold ${scoreColor}`}>
            Score {result.score}
          </span>
          <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-hover)] px-2 py-0.5 rounded-full">
            {result.hopCount} hop{result.hopCount !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={onBookmark}
          className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
          title="Save path"
        >
          <Bookmark className="w-3.5 h-3.5" />
          Save
        </button>
      </div>

      {/* Path visualization */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-2 flex-wrap">
          {result.nodes.map((node, i) => (
            <div key={i} className="flex items-center gap-2">
              <NodeCard
                node={node}
                isTarget={i === result.nodes.length - 1}
              />
              {i < result.nodes.length - 1 && (
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-[var(--text-muted)] mt-2">{result.summary}</p>
      </div>

      {/* Approach scripts */}
      {result.hops.length > 0 && (
        <div className="border-t border-[var(--border)] divide-y divide-[var(--border)]">
          {result.hops.map((hop, i) => (
            <div key={i} className="px-4 py-3">
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-[var(--accent)] bg-opacity-15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-[var(--accent)]">{i + 1}</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--text-secondary)] mb-0.5">
                    {hop.from.name} → {hop.to.name}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    {hop.approachScript}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

export function PathFinderPage() {
  const { query, results, loading, error, setQuery, search, bookmarkPath, reset } = usePathFinder()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) search(query)
  }

  const handleSuggestion = (s: string) => {
    setQuery(s)
    search(s)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Route className="w-5 h-5 text-[var(--accent)]" />
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Path Finder</h1>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Map warm introduction chains to any role, company, or person
        </p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Search */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="How do I get to VP of Product at Stripe?"
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl pl-10 pr-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
            </div>

            {/* Quick hints */}
            <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
              <Briefcase className="w-3 h-3 flex-shrink-0" />
              <span>Try: role + company, or a person's name</span>
              <Building2 className="w-3 h-3 ml-2 flex-shrink-0" />
              <span>"at [Company]"</span>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Find Paths
                  </>
                )}
              </button>
              {results.length > 0 && (
                <button
                  type="button"
                  onClick={reset}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-xl transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30 rounded-xl px-4 py-3"
          >
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </motion.div>
        )}

        {/* Results */}
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16 gap-4"
            >
              <div className="relative">
                <div className="w-14 h-14 rounded-full border-2 border-[var(--accent)] border-opacity-20 animate-ping absolute inset-0" />
                <div className="w-14 h-14 rounded-full border-2 border-[var(--accent)] flex items-center justify-center">
                  <Route className="w-6 h-6 text-[var(--accent)]" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-[var(--text-secondary)]">Mapping your network…</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Scanning contacts and 2nd-degree connections</p>
              </div>
            </motion.div>
          )}

          {!loading && results.length > 0 && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  {results.length} path{results.length !== 1 ? 's' : ''} found
                </h2>
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <WarmthDot warmth={75} /> warm
                  <WarmthDot warmth={45} /> medium
                  <WarmthDot warmth={15} /> cold
                </div>
              </div>

              {results.map((result, i) => (
                <PathCard
                  key={result.id}
                  result={result}
                  index={i}
                  onBookmark={() => bookmarkPath(result)}
                />
              ))}
            </motion.div>
          )}

          {!loading && results.length === 0 && !error && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-5"
            >
              {/* Empty state */}
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center mb-4">
                  <Route className="w-7 h-7 text-[var(--text-muted)] opacity-40" />
                </div>
                <p className="text-sm font-medium text-[var(--text-secondary)]">Start with a target</p>
                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs">
                  Type any role, company, or person's name to find warm introduction paths
                </p>
              </div>

              {/* Suggestions */}
              <div>
                <p className="text-xs font-medium text-[var(--text-muted)] mb-3">Try searching for…</p>
                <div className="space-y-2">
                  {SUGGESTIONS.map((s) => (
                    <motion.button
                      key={s}
                      whileHover={{ x: 4 }}
                      onClick={() => handleSuggestion(s)}
                      className="w-full text-left flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)] rounded-xl px-4 py-3 transition-colors group"
                    >
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--accent)] flex-shrink-0 transition-colors" />
                      <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                        {s}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
