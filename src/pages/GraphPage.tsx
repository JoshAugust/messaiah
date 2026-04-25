import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Network, Loader2, ZoomIn, ZoomOut, Maximize2, RefreshCw } from 'lucide-react'
import { useGraphData, type GraphNode } from '../hooks/useGraphData'
import { NodeDetailPanel } from '../components/graph/NodeDetailPanel'
import { GraphControls } from '../components/graph/GraphControls'

// ─── ForceGraph2D lazy import ─────────────────────────────────────────────────
// The library is heavy — we dynamically import it to avoid blocking the main bundle.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ForceGraph2D: any = null

// ─── Hover tooltip ─────────────────────────────────────────────────────────────
interface TooltipState {
  visible: boolean
  x: number
  y: number
  node: GraphNode | null
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function GraphPage() {
  const {
    graphData,
    loading,
    error,
    filters,
    updateFilter,
    resetFilters,
    companies,
    relationshipTypes,
    contactCount,
    discoveredCount,
  } = useGraphData()

  const [selected, setSelected] = useState<GraphNode | null>(null)
  const [graphReady, setGraphReady] = useState(false)
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, node: null })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _mousePos = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<{ zoom: (k: number, ms?: number) => void; zoomToFit: (ms?: number, padding?: number) => void } | null>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  // Track mouse position for tooltip
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      _mousePos.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  // Load ForceGraph2D dynamically
  useEffect(() => {
    import('react-force-graph-2d').then(mod => {
      ForceGraph2D = mod.default
      setGraphReady(true)
    })
  }, [])

  // Resize observer
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        })
      }
    }
    update()
    const ro = new ResizeObserver(update)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Node color with highlight ring effect
  const getNodeColor = useCallback((node: GraphNode) => {
    const searchQ = filters.searchQuery.toLowerCase().trim()
    if (searchQ && node.highlighted) return '#ffffff'
    return node.color ?? '#3b82f6'
  }, [filters.searchQuery])

  // Node canvas rendering — custom draw for richer nodes
  const paintNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const x = node.x ?? 0
    const y = node.y ?? 0
    const r = (node.val ?? 4) * 0.8
    const label = node.name
    const fontSize = Math.max(8, 12 / globalScale)

    // Highlight ring
    const searchQ = filters.searchQuery.toLowerCase().trim()
    if (searchQ && node.highlighted) {
      ctx.beginPath()
      ctx.arc(x, y, r + 4, 0, 2 * Math.PI)
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'
      ctx.lineWidth = 2 / globalScale
      ctx.stroke()
    }

    // Main circle
    ctx.beginPath()
    ctx.arc(x, y, r, 0, 2 * Math.PI)
    ctx.fillStyle = node.color ?? '#3b82f6'
    ctx.fill()

    // Gold pulse for self
    if (node.type === 'self') {
      ctx.beginPath()
      ctx.arc(x, y, r + 3, 0, 2 * Math.PI)
      ctx.strokeStyle = 'rgba(245,158,11,0.4)'
      ctx.lineWidth = 2 / globalScale
      ctx.stroke()
    }

    // Label (only when zoomed in enough)
    if (globalScale > 1.2 || node.type === 'self') {
      ctx.font = `${node.type === 'self' ? 'bold ' : ''}${fontSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.fillText(
        node.type === 'self' ? 'You' : label.split(' ')[0],
        x,
        y + r + fontSize * 0.7,
      )
    }
  }, [filters.searchQuery])

  // Node pointer area
  const nodePointerArea = useCallback((node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
    void color
    const x = node.x ?? 0
    const y = node.y ?? 0
    const r = (node.val ?? 4) * 0.8 + 4
    ctx.beginPath()
    ctx.arc(x, y, r, 0, 2 * Math.PI)
  }, [])

  // Link styling
  const getLinkColor = useCallback((link: { relationship?: string | null }) => {
    if (link.relationship === 'discovered via') return 'rgba(34,197,94,0.2)'
    return 'rgba(99,102,241,0.15)'
  }, [])

  const getLinkWidth = useCallback(() => 1, [])

  // Hover
  const handleNodeHover = useCallback((node: GraphNode | null) => {
    if (node) {
      setTooltip({ visible: true, x: _mousePos.current.x, y: _mousePos.current.y, node })
    } else {
      setTooltip(prev => ({ ...prev, visible: false }))
    }
  }, [])

  // Click
  const handleNodeClick = useCallback((node: GraphNode) => {
    if (node.type === 'self') return
    setSelected(prev => prev?.id === node.id ? null : node)
  }, [])

  // Zoom controls
  const handleZoomIn = () => graphRef.current?.zoom(1.5, 400)
  const handleZoomOut = () => graphRef.current?.zoom(0.67, 400)
  const handleZoomFit = () => graphRef.current?.zoomToFit(400, 40)

  // Find similar (filter by company)
  const handleFindSimilar = useCallback((node: GraphNode) => {
    const company = node.contact?.company ?? node.person?.company
    if (company) updateFilter('company', company)
  }, [updateFilter])

  const isEmpty = !loading && graphData.nodes.length <= 1

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="px-6 py-3.5 border-b border-[var(--border)] flex items-center gap-3 flex-shrink-0">
        <Network className="w-5 h-5 text-[var(--accent)]" />
        <h1 className="text-base font-bold text-[var(--text-primary)]">Network Graph</h1>
        <div className="ml-auto flex items-center gap-3 text-xs text-[var(--text-muted)]">
          {contactCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
              {contactCount} contacts
            </span>
          )}
          {discoveredCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              {discoveredCount} discovered
            </span>
          )}
          <span>{graphData.nodes.length} nodes · {graphData.links.length} edges</span>
        </div>
      </div>

      {/* Graph area */}
      <div className="flex-1 relative overflow-hidden bg-[#08080f]" ref={containerRef}>
        {/* Loading */}
        {(loading || !graphReady) && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
              <p className="text-sm text-[var(--text-muted)]">
                {!graphReady ? 'Loading graph engine…' : 'Fetching network data…'}
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center">
              <p className="text-red-400 font-medium">{error}</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">Check your connection and try again</p>
            </div>
          </div>
        )}

        {/* Empty */}
        {isEmpty && !loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center">
              <Network className="w-12 h-12 text-[var(--text-muted)] opacity-20 mx-auto mb-3" />
              <p className="text-[var(--text-secondary)] font-medium">No network data</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">Import contacts to visualize your network</p>
            </div>
          </div>
        )}

        {/* Graph */}
        {graphReady && ForceGraph2D && !isEmpty && (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            nodeLabel={(node: GraphNode) => `${node.name}${node.contact?.company ? ` · ${node.contact.company}` : node.person?.company ? ` · ${node.person.company}` : ''}`}
            nodeColor={getNodeColor}
            nodeCanvasObject={paintNode}
            nodeCanvasObjectMode={() => 'replace'}
            nodePointerAreaPaint={nodePointerArea}
            nodeRelSize={4}
            linkColor={getLinkColor}
            linkWidth={getLinkWidth}
            backgroundColor="#08080f"
            width={dimensions.width}
            height={dimensions.height}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            linkDirectionalParticles={0}
            d3VelocityDecay={0.3}
            cooldownTicks={100}
            onEngineStop={() => {
              // Zoom to fit after initial layout
              graphRef.current?.zoomToFit(600, 40)
            }}
          />
        )}

        {/* Controls overlay */}
        {graphReady && !isEmpty && (
          <GraphControls
            filters={filters}
            onFilterChange={updateFilter}
            onReset={resetFilters}
            companies={companies}
            relationshipTypes={relationshipTypes}
          />
        )}

        {/* Zoom buttons */}
        <div className="absolute top-4 right-4 flex flex-col gap-1.5 z-10">
          {[
            { icon: ZoomIn, fn: handleZoomIn, label: 'Zoom in' },
            { icon: ZoomOut, fn: handleZoomOut, label: 'Zoom out' },
            { icon: Maximize2, fn: handleZoomFit, label: 'Fit to screen' },
            { icon: RefreshCw, fn: () => graphRef.current?.zoomToFit(400, 40), label: 'Reset view' },
          ].map(({ icon: Icon, fn, label }) => (
            <button
              key={label}
              onClick={fn}
              title={label}
              className="w-8 h-8 bg-[#0e0e18]/90 border border-white/10 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-white/25 transition-colors backdrop-blur-sm"
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>

        {/* Hover tooltip */}
        {tooltip.visible && tooltip.node && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed pointer-events-none z-30 bg-[#0e0e18] border border-white/15 rounded-lg px-3 py-2 shadow-xl text-sm"
            style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
          >
            <p className="font-medium text-[var(--text-primary)]">{tooltip.node.name}</p>
            {(tooltip.node.contact?.company ?? tooltip.node.person?.company) && (
              <p className="text-xs text-[var(--text-muted)]">
                {tooltip.node.contact?.company ?? tooltip.node.person?.company}
              </p>
            )}
            {(tooltip.node.contact?.strategic_value ?? tooltip.node.person?.strategic_value) != null && (
              <p className="text-xs text-[var(--text-muted)]">
                Score: {(tooltip.node.contact?.strategic_value ?? tooltip.node.person?.strategic_value)?.toFixed(0)}
              </p>
            )}
          </motion.div>
        )}

        {/* Node detail panel */}
        <NodeDetailPanel
          node={selected}
          onClose={() => setSelected(null)}
          onFindSimilar={handleFindSimilar}
        />
      </div>
    </div>
  )
}
