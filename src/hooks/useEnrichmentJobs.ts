import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { EnrichmentJob, JobStatus } from '../types/database'

interface UseEnrichmentJobsReturn {
  jobs: EnrichmentJob[]
  loading: boolean
  error: string | null
  statusFilter: JobStatus | 'all'
  setStatusFilter: (s: JobStatus | 'all') => void
  refresh: () => Promise<void>
  startBatchEnrichment: () => Promise<void>
  stats: {
    total: number
    pending: number
    running: number
    completed: number
    failed: number
    retrying: number
  }
}

export function useEnrichmentJobs(): UseEnrichmentJobsReturn {
  const [jobs, setJobs] = useState<EnrichmentJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all')

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      let query = supabase
        .from('enrichment_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error: fetchError } = await query
      if (fetchError) throw fetchError
      setJobs((data as EnrichmentJob[]) ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  // Initial fetch
  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  // Realtime subscription
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null

    const setupRealtime = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      channel = supabase
        .channel('enrichment-jobs-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'enrichment_jobs',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newJob = payload.new as EnrichmentJob
              setJobs((prev) => {
                if (statusFilter !== 'all' && newJob.status !== statusFilter) return prev
                return [newJob, ...prev.slice(0, 49)]
              })
            } else if (payload.eventType === 'UPDATE') {
              const updated = payload.new as EnrichmentJob
              setJobs((prev) =>
                prev.map((j) => (j.id === updated.id ? updated : j))
              )
            } else if (payload.eventType === 'DELETE') {
              setJobs((prev) => prev.filter((j) => j.id !== payload.old.id))
            }
          }
        )
        .subscribe()
    }

    setupRealtime()
    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [statusFilter])

  // Start batch enrichment for un-enriched contacts
  const startBatchEnrichment = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    // Find contacts that haven't been enriched yet
    const { data: unenriched } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', user.id)
      .in('enrichment_status', ['pending'])
      .limit(20)

    if (!unenriched || unenriched.length === 0) return

    // Insert enrichment jobs in batch
    const jobsToInsert = unenriched.map((c: { id: string }) => ({
      user_id: user.id,
      target_type: 'contact',
      target_id: c.id,
      status: 'pending' as const,
      priority: 5,
      attempt_count: 0,
      max_attempts: 3,
    }))

    await supabase.from('enrichment_jobs').insert(jobsToInsert)
    await fetchJobs()
  }, [fetchJobs])

  // Compute stats
  const stats = {
    total: jobs.length,
    pending: jobs.filter((j) => j.status === 'pending').length,
    running: jobs.filter((j) => j.status === 'running').length,
    completed: jobs.filter((j) => j.status === 'completed').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
    retrying: jobs.filter((j) => j.status === 'retrying').length,
  }

  return {
    jobs,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    refresh: fetchJobs,
    startBatchEnrichment,
    stats,
  }
}
