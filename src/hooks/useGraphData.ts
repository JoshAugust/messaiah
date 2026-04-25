import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import type { Contact, DiscoveredPerson, Connection } from '../types/database'

export interface GraphNode {
  id: string
  name: string
  val: number
  type: 'self' | 'contact' | 'discovered'
  color?: string
  // Data
  contact?: Contact
  person?: DiscoveredPerson
  // Search state
  highlighted?: boolean
  // Position hints for force graph
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

export interface GraphLink {
  source: string
  target: string
  strength?: number
  relationship?: string | null
}

export interface GraphFilters {
  company: string
  relationshipType: string
  minScore: number
  searchQuery: string
  viewMode: 'organic' | 'cluster'
}

const DEFAULT_FILTERS: GraphFilters = {
  company: '',
  relationshipType: '',
  minScore: 0,
  searchQuery: '',
  viewMode: 'organic',
}

function nodeColor(node: GraphNode): string {
  if (node.type === 'self') return '#f59e0b' // gold
  if (node.type === 'discovered') return '#22c55e' // green
  // Contacts: blue shades based on relationship type
  const contact = node.contact
  if (!contact) return '#3b82f6'
  switch (contact.relationship_type) {
    case 'mentor': return '#a78bfa'
    case 'mentee': return '#34d399'
    case 'recruiter': return '#f472b6'
    case 'hiring_manager': return '#fb923c'
    case 'colleague': return '#60a5fa'
    case 'peer': return '#38bdf8'
    case 'friend': return '#4ade80'
    default: return '#3b82f6'
  }
}

function nodeSize(node: GraphNode): number {
  if (node.type === 'self') return 20
  const score = node.contact?.strategic_value ?? node.person?.strategic_value ?? 0
  return Math.max(3, Math.min(16, 3 + score / 8))
}

export function useGraphData() {
  const { user } = useAuthStore()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [discoveredPeople, setDiscoveredPeople] = useState<DiscoveredPerson[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<GraphFilters>(DEFAULT_FILTERS)

  // Fetch all data
  useEffect(() => {
    if (!user) return

    const fetchAll = async () => {
      setLoading(true)
      setError(null)
      try {
        const [contactsRes, discoveredRes, connectionsRes] = await Promise.all([
          supabase
            .from('contacts')
            .select('*')
            .eq('user_id', user.id)
            .limit(300),
          supabase
            .from('discovered_people')
            .select('*')
            .eq('user_id', user.id)
            .limit(200),
          supabase
            .from('connections')
            .select('*')
            .eq('user_id', user.id)
            .limit(500),
        ])

        if (contactsRes.error) throw contactsRes.error
        if (discoveredRes.error) throw discoveredRes.error
        if (connectionsRes.error) throw connectionsRes.error

        setContacts(contactsRes.data ?? [])
        setDiscoveredPeople(discoveredRes.data ?? [])
        setConnections(connectionsRes.data ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load graph data')
      } finally {
        setLoading(false)
      }
    }

    fetchAll()
  }, [user])

  // Unique companies and relationship types for filter dropdowns
  const companies = useMemo(() => {
    const set = new Set<string>()
    contacts.forEach(c => { if (c.company) set.add(c.company) })
    discoveredPeople.forEach(p => { if (p.company) set.add(p.company) })
    return Array.from(set).sort()
  }, [contacts, discoveredPeople])

  const relationshipTypes = useMemo(() => {
    const set = new Set<string>()
    contacts.forEach(c => { if (c.relationship_type) set.add(c.relationship_type) })
    return Array.from(set).sort()
  }, [contacts])

  // Build raw graph data (before filters)
  const { filteredContacts, filteredDiscovered } = useMemo(() => {
    const score = filters.minScore
    const company = filters.company.toLowerCase()
    const relType = filters.relationshipType

    const fc = contacts.filter(c => {
      if (score > 0 && (c.strategic_value ?? 0) < score) return false
      if (company && (c.company ?? '').toLowerCase() !== company) return false
      if (relType && c.relationship_type !== relType) return false
      return true
    })

    const fd = discoveredPeople.filter(p => {
      if (score > 0 && (p.strategic_value ?? 0) < score) return false
      if (company && (p.company ?? '').toLowerCase() !== company) return false
      return true
    })

    return { filteredContacts: fc, filteredDiscovered: fd }
  }, [contacts, discoveredPeople, filters])

  // Build graph data
  const graphData = useMemo(() => {
    const searchQ = filters.searchQuery.toLowerCase().trim()
    const filteredContactIds = new Set(filteredContacts.map(c => c.id))
    const filteredDiscoveredIds = new Set(filteredDiscovered.map(p => p.id))

    const selfNode: GraphNode = {
      id: 'self',
      name: 'You',
      val: 20,
      type: 'self',
      color: '#f59e0b',
    }

    const contactNodes: GraphNode[] = filteredContacts.map(c => {
      const name = c.full_name ?? [c.first_name, c.last_name].filter(Boolean).join(' ') ?? 'Unknown'
      const isHighlighted = searchQ
        ? name.toLowerCase().includes(searchQ) ||
          (c.company ?? '').toLowerCase().includes(searchQ) ||
          (c.position ?? '').toLowerCase().includes(searchQ)
        : false
      const node: GraphNode = {
        id: c.id,
        name,
        val: nodeSize({ id: c.id, name, val: 0, type: 'contact', contact: c }),
        type: 'contact',
        contact: c,
        highlighted: isHighlighted,
      }
      node.color = nodeColor(node)
      return node
    })

    const discoveredNodes: GraphNode[] = filteredDiscovered.map(p => {
      const name = p.name ?? 'Unknown'
      const isHighlighted = searchQ
        ? name.toLowerCase().includes(searchQ) ||
          (p.company ?? '').toLowerCase().includes(searchQ) ||
          (p.title ?? '').toLowerCase().includes(searchQ)
        : false
      const node: GraphNode = {
        id: p.id,
        name,
        val: nodeSize({ id: p.id, name, val: 0, type: 'discovered', person: p }),
        type: 'discovered',
        person: p,
        highlighted: isHighlighted,
      }
      node.color = nodeColor(node)
      return node
    })

    // Links: self→contact for all contacts, then connection table edges
    const links: GraphLink[] = []

    // Self to contacts
    filteredContacts.forEach(c => {
      links.push({ source: 'self', target: c.id, strength: 0.5 })
    })

    // Connection table edges (between contacts or discovered)
    connections.forEach(conn => {
      const srcInGraph =
        conn.source_id === 'self' ||
        filteredContactIds.has(conn.source_id) ||
        filteredDiscoveredIds.has(conn.source_id)
      const tgtInGraph =
        conn.target_id === 'self' ||
        filteredContactIds.has(conn.target_id) ||
        filteredDiscoveredIds.has(conn.target_id)

      if (srcInGraph && tgtInGraph) {
        // Avoid duplicate self links
        const isDuplicate = conn.source_id === 'self' &&
          filteredContactIds.has(conn.target_id)
        if (!isDuplicate) {
          links.push({
            source: conn.source_id,
            target: conn.target_id,
            strength: conn.strength ?? 0.3,
            relationship: conn.relationship,
          })
        }
      }
    })

    // Discovered people linked back to the contact that discovered them
    filteredDiscovered.forEach(p => {
      if (p.discovered_from_contact_id && filteredContactIds.has(p.discovered_from_contact_id)) {
        links.push({
          source: p.discovered_from_contact_id,
          target: p.id,
          strength: 0.4,
          relationship: 'discovered via',
        })
      }
    })

    const nodes = [selfNode, ...contactNodes, ...discoveredNodes]
    return { nodes, links }
  }, [filteredContacts, filteredDiscovered, connections, filters.searchQuery])

  const updateFilter = useCallback(<K extends keyof GraphFilters>(key: K, value: GraphFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), [])

  return {
    graphData,
    loading,
    error,
    filters,
    updateFilter,
    resetFilters,
    companies,
    relationshipTypes,
    contactCount: contacts.length,
    discoveredCount: discoveredPeople.length,
  }
}
