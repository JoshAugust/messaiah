import { Search, RotateCcw, SlidersHorizontal } from 'lucide-react'
import type { GraphFilters } from '../../hooks/useGraphData'

interface Props {
  filters: GraphFilters
  onFilterChange: <K extends keyof GraphFilters>(key: K, value: GraphFilters[K]) => void
  onReset: () => void
  companies: string[]
  relationshipTypes: string[]
}

const LEGEND_ITEMS = [
  { color: '#f59e0b', label: 'You (center)' },
  { color: '#3b82f6', label: '1st degree (contact)' },
  { color: '#22c55e', label: '2nd degree (discovered)' },
  { color: '#a78bfa', label: 'Mentor' },
  { color: '#f472b6', label: 'Recruiter' },
  { color: '#fb923c', label: 'Hiring manager' },
]

export function GraphControls({ filters, onFilterChange, onReset, companies, relationshipTypes }: Props) {
  const hasActiveFilters =
    filters.company !== '' ||
    filters.relationshipType !== '' ||
    filters.minScore > 0 ||
    filters.searchQuery !== ''

  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-3 max-w-xs w-72">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
        <input
          type="text"
          placeholder="Search nodes..."
          value={filters.searchQuery}
          onChange={e => onFilterChange('searchQuery', e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#0e0e18]/90 border border-white/15 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/50 backdrop-blur-sm"
        />
      </div>

      {/* Filters panel */}
      <div className="bg-[#0e0e18]/90 border border-white/10 rounded-xl p-3 backdrop-blur-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
          </div>
          {hasActiveFilters && (
            <button
              onClick={onReset}
              className="flex items-center gap-1 text-xs text-[var(--accent)] hover:text-[var(--accent)]/70 transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
        </div>

        {/* Company filter */}
        <div className="space-y-1">
          <label className="text-xs text-[var(--text-muted)]">Company</label>
          <select
            value={filters.company}
            onChange={e => onFilterChange('company', e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/40"
          >
            <option value="">All companies</option>
            {companies.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Relationship type filter */}
        <div className="space-y-1">
          <label className="text-xs text-[var(--text-muted)]">Relationship type</label>
          <select
            value={filters.relationshipType}
            onChange={e => onFilterChange('relationshipType', e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/40"
          >
            <option value="">All types</option>
            {relationshipTypes.map(r => (
              <option key={r} value={r} className="capitalize">{r.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        {/* Score threshold slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <label className="text-[var(--text-muted)]">Min strategic value</label>
            <span className="font-mono text-[var(--text-primary)]">{filters.minScore}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={filters.minScore}
            onChange={e => onFilterChange('minScore', Number(e.target.value))}
            className="w-full h-1.5 accent-[var(--accent)] cursor-pointer"
          />
          <div className="flex justify-between text-xs text-[var(--text-muted)]">
            <span>0</span><span>100</span>
          </div>
        </div>

        {/* View mode toggle */}
        <div className="space-y-1">
          <label className="text-xs text-[var(--text-muted)]">Layout</label>
          <div className="grid grid-cols-2 gap-1">
            {(['organic', 'cluster'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => onFilterChange('viewMode', mode)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                  filters.viewMode === mode
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-white/5 text-[var(--text-secondary)] hover:bg-white/10'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-[#0e0e18]/90 border border-white/10 rounded-xl p-3 backdrop-blur-sm">
        <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">Legend</div>
        <div className="space-y-1.5">
          {LEGEND_ITEMS.map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-[var(--text-secondary)]">{item.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-2.5 pt-2 border-t border-white/10 text-xs text-[var(--text-muted)]">
          Node size = strategic value score
        </div>
      </div>
    </div>
  )
}
