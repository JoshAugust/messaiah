/**
 * useEnrichment.ts — React hook for the enrichment pipeline
 *
 * Features:
 * - Start enrichment for a single contact
 * - Start batch enrichment for all pending contacts
 * - Track progress via Supabase realtime (enrichment_jobs table)
 * - Cancel enrichment
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { BatchRunnerProgress, EnrichmentPhase } from '../types/enrichment'
import type { JobStatus } from '../types/database'

export interface EnrichmentState {
  isRunning: boolean
  isBatchRunning: boolean
  progress: BatchRunnerProgress | null
  currentJobId: string | null
  currentPhase: EnrichmentPhase | null
  error: string | null
}

export interface UseEnrichmentReturn {
  state: EnrichmentState
  /** Enrich a single contact */
  enrichContact: (contactId: string) => Promise<boolean>
  /** Enrich all pending contacts */
  startBatchEnrichment: (options?: { maxContacts?: number; concurrency?: number }) => Promise<void>
  /** Cancel any in-progress enrichment */
  cancel: () => void
  /** Reset state */
  reset: () => void
}

const INITIAL_STATE: EnrichmentState = {
  isRunning: false,
  isBatchRunning: false,
  progress: null,
  currentJobId: null,
  currentPhase: null,
  error: null,
}

// We call the enrichment via the API route (or directly in Node scripts)
// For the browser, we POST to a server endpoint that runs the pipeline
const API_BASE = '/api/enrichment'

async function callEnrichAPI(
  path: string,
  body: Record<string, unknown>
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function useEnrichment(userId: string): UseEnrichmentReturn {
  const [state, setState] = useState<EnrichmentState>(INITIAL_STATE)
  const abortRef = useRef<AbortController | null>(null)
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Subscribe to enrichment job updates via Supabase realtime
  const subscribeToJob = useCallback((jobId: string) => {
    // Cleanup existing subscription
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current)
    }

    const channel = supabase
      .channel(`enrichment_job_${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'enrichment_jobs',
          filter: `id=eq.${jobId}`,
        },
        payload => {
          const job = payload.new as {
            status: JobStatus
            phases: Record<string, string> | null
            completed_at: string | null
          }

          // Extract current phase
          const phases = job.phases ?? {}
          const runningPhase = Object.entries(phases).find(([, v]) => v === 'running')?.[0] as EnrichmentPhase | undefined

          setState(prev => ({
            ...prev,
            currentPhase: runningPhase ?? null,
            isRunning: job.status === 'running' || job.status === 'retrying',
          }))

          if (job.status === 'completed' || job.status === 'failed') {
            setState(prev => ({
              ...prev,
              isRunning: false,
              currentPhase: 'complete',
              error: job.status === 'failed' ? 'Enrichment failed' : null,
            }))
            supabase.removeChannel(channel)
          }
        }
      )
      .subscribe()

    realtimeChannelRef.current = channel
  }, [])

  // Subscribe to batch progress via contacts table changes
  const subscribeToBatch = useCallback(() => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current)
    }

    const channel = supabase
      .channel(`batch_enrichment_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'contacts',
          filter: `user_id=eq.${userId}`,
        },
        _payload => {
          // Update batch progress stats
          setState(prev => {
            if (!prev.progress) return prev
            return {
              ...prev,
              progress: {
                ...prev.progress,
                completed: prev.progress.completed + 1,
              },
            }
          })
        }
      )
      .subscribe()

    realtimeChannelRef.current = channel
  }, [userId])

  const enrichContact = useCallback(async (contactId: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isRunning: true, error: null, currentPhase: 'ddg_profile' }))

    try {
      // For browser use, call the API; for server-side use pipeline directly
      const response = await callEnrichAPI('/single', { contactId, userId })

      if (!response.ok) {
        const data = await response.json() as { error?: string; jobId?: string }
        throw new Error(data.error ?? `HTTP ${response.status}`)
      }

      const data = await response.json() as { jobId: string; success: boolean }

      if (data.jobId) {
        setState(prev => ({ ...prev, currentJobId: data.jobId }))
        subscribeToJob(data.jobId)
      }

      setState(prev => ({
        ...prev,
        isRunning: false,
        currentPhase: 'complete',
        error: data.success ? null : 'Enrichment completed with errors',
      }))

      return data.success
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      setState(prev => ({ ...prev, isRunning: false, error }))
      return false
    }
  }, [userId, subscribeToJob])

  const startBatchEnrichment = useCallback(async (
    options: { maxContacts?: number; concurrency?: number } = {}
  ): Promise<void> => {
    abortRef.current = new AbortController()

    // Get total count for progress tracking
    const { count } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .neq('enrichment_status', 'completed')

    const total = count ?? 0

    setState(prev => ({
      ...prev,
      isBatchRunning: true,
      error: null,
      progress: {
        total,
        completed: 0,
        failed: 0,
        skipped: 0,
        currentContactId: null,
        currentPhase: null,
        startedAt: new Date().toISOString(),
        estimatedCompletionAt: null,
      },
    }))

    subscribeToBatch()

    try {
      const response = await callEnrichAPI('/batch', {
        userId,
        maxContacts: options.maxContacts,
        concurrency: options.concurrency ?? 1,
      })

      if (!response.ok) {
        const data = await response.json() as { error?: string }
        throw new Error(data.error ?? `HTTP ${response.status}`)
      }

      const data = await response.json() as BatchRunnerProgress
      setState(prev => ({
        ...prev,
        isBatchRunning: false,
        progress: data,
      }))
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        setState(prev => ({ ...prev, isBatchRunning: false, error: 'Cancelled' }))
        return
      }
      const error = err instanceof Error ? err.message : String(err)
      setState(prev => ({ ...prev, isBatchRunning: false, error }))
    }
  }, [userId, subscribeToBatch])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setState(prev => ({
      ...prev,
      isRunning: false,
      isBatchRunning: false,
      currentPhase: null,
      error: 'Cancelled by user',
    }))
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current)
      realtimeChannelRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    cancel()
    setState(INITIAL_STATE)
  }, [cancel])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current)
      }
    }
  }, [])

  return { state, enrichContact, startBatchEnrichment, cancel, reset }
}

/**
 * Simpler hook for tracking a single contact's enrichment status reactively.
 */
export function useContactEnrichmentStatus(contactId: string): {
  status: string | null
  scores: {
    discovery: number | null
    careerFit: number | null
    connectionStrength: number | null
    strategicValue: number | null
  } | null
} {
  const [status, setStatus] = useState<string | null>(null)
  const [scores, setScores] = useState<{
    discovery: number | null
    careerFit: number | null
    connectionStrength: number | null
    strategicValue: number | null
  } | null>(null)

  useEffect(() => {
    if (!contactId) return

    const channel = supabase
      .channel(`contact_enrichment_${contactId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'contacts',
          filter: `id=eq.${contactId}`,
        },
        payload => {
          const contact = payload.new as {
            enrichment_status: string | null
            discovery_score: number | null
            career_fit_score: number | null
            connection_strength: number | null
            strategic_value: number | null
          }

          setStatus(contact.enrichment_status)
          setScores({
            discovery: contact.discovery_score,
            careerFit: contact.career_fit_score,
            connectionStrength: contact.connection_strength,
            strategicValue: contact.strategic_value,
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [contactId])

  return { status, scores }
}
