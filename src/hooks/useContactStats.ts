import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { EnrichmentStatus, RelationshipType } from '../types/database'

export interface ContactStats {
  totalContacts: number
  enrichmentBreakdown: Record<EnrichmentStatus, number>
  relationshipBreakdown: Record<string, number>
  topCompanies: Array<{ company: string; count: number }>
  averageScores: {
    careerFit: number | null
    strategicValue: number | null
    discoveryScore: number | null
    connectionStrength: number | null
  }
}

const EMPTY_STATS: ContactStats = {
  totalContacts: 0,
  enrichmentBreakdown: {
    pending: 0,
    in_progress: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
  },
  relationshipBreakdown: {},
  topCompanies: [],
  averageScores: {
    careerFit: null,
    strategicValue: null,
    discoveryScore: null,
    connectionStrength: null,
  },
}

export function useContactStats(userId: string | null) {
  const [stats, setStats] = useState<ContactStats>(EMPTY_STATS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)

    try {
      // Fetch all contacts for this user (just the columns we need for stats)
      const { data, error: fetchError } = await supabase
        .from('contacts')
        .select(
          'enrichment_status, relationship_type, company, career_fit_score, strategic_value, discovery_score, connection_strength'
        )
        .eq('user_id', userId)

      if (fetchError) throw fetchError

      const rows = data ?? []
      const total = rows.length

      // Enrichment breakdown
      const enrichmentBreakdown: Record<string, number> = {
        pending: 0,
        in_progress: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
      }
      for (const row of rows) {
        const status = row.enrichment_status as EnrichmentStatus | null
        if (status && status in enrichmentBreakdown) {
          enrichmentBreakdown[status]++
        }
      }

      // Relationship type breakdown
      const relationshipBreakdown: Record<string, number> = {}
      for (const row of rows) {
        const rel = row.relationship_type as RelationshipType | null
        if (rel) {
          relationshipBreakdown[rel] = (relationshipBreakdown[rel] ?? 0) + 1
        }
      }

      // Top companies
      const companyCounts: Record<string, number> = {}
      for (const row of rows) {
        const co = row.company as string | null
        if (co) {
          companyCounts[co] = (companyCounts[co] ?? 0) + 1
        }
      }
      const topCompanies = Object.entries(companyCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([company, count]) => ({ company, count }))

      // Average scores (only non-null values)
      const avg = (vals: (number | null)[]) => {
        const valid = vals.filter((v): v is number => v !== null)
        return valid.length > 0
          ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10
          : null
      }

      const averageScores = {
        careerFit: avg(rows.map((r) => r.career_fit_score)),
        strategicValue: avg(rows.map((r) => r.strategic_value)),
        discoveryScore: avg(rows.map((r) => r.discovery_score)),
        connectionStrength: avg(rows.map((r) => r.connection_strength)),
      }

      setStats({
        totalContacts: total,
        enrichmentBreakdown: enrichmentBreakdown as Record<EnrichmentStatus, number>,
        relationshipBreakdown,
        topCompanies,
        averageScores,
      })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return { stats, loading, error, refresh: fetchStats }
}
