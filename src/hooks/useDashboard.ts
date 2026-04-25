import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Contact, FeedItem } from '../types/database'

export interface DashboardStats {
  totalContacts: number
  enrichedCount: number
  discoveredCount: number
  pendingActions: number
  networkHealthScore: number
  enrichmentCoverage: number
  avgStrategicValue: number | null
  industryBreakdown: Array<{ industry: string; count: number; pct: number }>
  relationshipBreakdown: Array<{ type: string; count: number; pct: number }>
}

export interface DashboardData {
  stats: DashboardStats
  recentFeedItems: FeedItem[]
  topOpportunities: Contact[]
  loading: boolean
  error: string | null
  refresh: () => void
}

const EMPTY_STATS: DashboardStats = {
  totalContacts: 0,
  enrichedCount: 0,
  discoveredCount: 0,
  pendingActions: 0,
  networkHealthScore: 0,
  enrichmentCoverage: 0,
  avgStrategicValue: null,
  industryBreakdown: [],
  relationshipBreakdown: [],
}

function calcNetworkHealth(
  enrichmentCoverage: number,
  avgStrategicValue: number | null
): number {
  const coverageScore = enrichmentCoverage * 60 // up to 60 pts
  const valueScore = avgStrategicValue != null ? (avgStrategicValue / 10) * 40 : 0 // up to 40 pts
  return Math.min(100, Math.round(coverageScore + valueScore))
}

export function useDashboard(userId: string | null): DashboardData {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS)
  const [recentFeedItems, setRecentFeedItems] = useState<FeedItem[]>([])
  const [topOpportunities, setTopOpportunities] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)

    try {
      // Parallel fetch everything
      const [contactsRes, discoveredRes, feedRes, topOppsRes, pendingRes] = await Promise.all([
        supabase
          .from('contacts')
          .select(
            'id, company, enrichment_status, relationship_type, strategic_value, career_fit_score, discovery_score, connection_strength, next_action'
          )
          .eq('user_id', userId),

        supabase
          .from('discovered_people')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),

        supabase
          .from('feed_items')
          .select('*')
          .eq('user_id', userId)
          .eq('is_dismissed', false)
          .eq('is_completed', false)
          .order('created_at', { ascending: false })
          .limit(10),

        supabase
          .from('contacts')
          .select('*')
          .eq('user_id', userId)
          .is('next_action', null)
          .order('strategic_value', { ascending: false, nullsFirst: false })
          .limit(5),

        supabase
          .from('feed_items')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_dismissed', false)
          .eq('is_completed', false),
      ])

      if (contactsRes.error) throw contactsRes.error

      const contacts = contactsRes.data ?? []
      const total = contacts.length

      // Enrichment coverage
      const enriched = contacts.filter((c) => c.enrichment_status === 'completed').length
      const enrichmentCoverage = total > 0 ? enriched / total : 0

      // Avg strategic value
      const valids = contacts
        .map((c) => c.strategic_value as number | null)
        .filter((v): v is number => v !== null)
      const avgStrategicValue =
        valids.length > 0
          ? Math.round((valids.reduce((a, b) => a + b, 0) / valids.length) * 10) / 10
          : null

      // Network health
      const networkHealthScore = calcNetworkHealth(enrichmentCoverage, avgStrategicValue)

      // Industry breakdown (using company as proxy — contacts don't have industry field directly)
      // Use relationship_type field instead since there's no industry on contacts
      const relCounts: Record<string, number> = {}
      for (const c of contacts) {
        const rel = (c.relationship_type as string | null) ?? 'unset'
        relCounts[rel] = (relCounts[rel] ?? 0) + 1
      }
      const relationshipBreakdown = Object.entries(relCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({
          type,
          count,
          pct: total > 0 ? Math.round((count / total) * 100) : 0,
        }))

      // Industry from company grouping (top companies)
      const companyCounts: Record<string, number> = {}
      for (const c of contacts) {
        const co = (c.company as string | null) ?? 'Unknown'
        companyCounts[co] = (companyCounts[co] ?? 0) + 1
      }
      const industryBreakdown = Object.entries(companyCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([industry, count]) => ({
          industry,
          count,
          pct: total > 0 ? Math.round((count / total) * 100) : 0,
        }))

      setStats({
        totalContacts: total,
        enrichedCount: enriched,
        discoveredCount: discoveredRes.count ?? 0,
        pendingActions: pendingRes.count ?? 0,
        networkHealthScore,
        enrichmentCoverage: Math.round(enrichmentCoverage * 100),
        avgStrategicValue,
        industryBreakdown,
        relationshipBreakdown,
      })

      setRecentFeedItems((feedRes.data as FeedItem[]) ?? [])
      setTopOpportunities((topOppsRes.data as Contact[]) ?? [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Real-time subscription to feed_items
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`dashboard_feed_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feed_items', filter: `user_id=eq.${userId}` },
        () => { fetchAll() }
      )
      .subscribe()
    return () => { channel.unsubscribe() }
  }, [userId, fetchAll])

  return { stats, recentFeedItems, topOpportunities, loading, error, refresh: fetchAll }
}
