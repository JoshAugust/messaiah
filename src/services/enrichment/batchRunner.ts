/**
 * batchRunner.ts — Batch enrichment runner
 *
 * Processes multiple contacts in sequence (or limited concurrency).
 * Resumable: checks enrichment_status before processing.
 * Can be triggered from the UI or run as a standalone Node script.
 *
 * Concurrency: default 1, max 3 (stay polite to DDG).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Contact } from '../../types/database'
import type { BatchRunnerOptions, BatchRunnerProgress, EnrichmentPhase } from '../../types/enrichment'

import { enrichContact, type PipelineOptions } from './pipeline'

export interface BatchRunnerConfig {
  supabase: SupabaseClient
  userId: string
  geminiApiKey?: string
  options?: BatchRunnerOptions
  /** Called after each contact is processed */
  onProgress?: (progress: BatchRunnerProgress) => void
  /** Called when a contact is enriched */
  onContactDone?: (contactId: string, success: boolean) => void
  /** Signal to stop processing */
  signal?: AbortSignal
}

const MAX_CONCURRENCY = 3
const DEFAULT_DELAY_MS = 2500  // slightly over DDG minimum

function estimateCompletion(
  startedAt: string,
  completed: number,
  total: number,
  _delayMs: number
): string | null {
  if (completed === 0 || total === 0) return null
  const elapsed = Date.now() - new Date(startedAt).getTime()
  const perItem = elapsed / completed
  const remaining = (total - completed) * perItem
  return new Date(Date.now() + remaining).toISOString()
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Fetch contacts that need enrichment for this user.
 */
async function fetchPendingContacts(
  supabase: SupabaseClient,
  userId: string,
  options: BatchRunnerOptions
): Promise<Contact[]> {
  let query = supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (options.skipCompleted !== false) {
    // By default, skip already-completed contacts
    query = query.not('enrichment_status', 'eq', 'completed')
  }

  if (options.maxContacts) {
    query = query.limit(options.maxContacts)
  }

  const { data, error } = await query

  if (error) throw new Error(`Failed to fetch contacts: ${error.message}`)
  return (data as Contact[]) ?? []
}

/**
 * Process a single contact with retry logic.
 */
async function processOne(
  contact: Contact,
  pipelineOptions: PipelineOptions,
  retries = 1
): Promise<boolean> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await enrichContact(contact, pipelineOptions)
      return result.success
    } catch (err) {
      console.error(`[batchRunner] Error enriching ${contact.id} (attempt ${attempt + 1}):`, err)
      if (attempt < retries) {
        await sleep(5000) // wait before retry
      }
    }
  }
  return false
}

/**
 * Run batch enrichment for a user's contacts.
 *
 * @example
 * // From Node script:
 * const { createClient } = require('@supabase/supabase-js')
 * const supabase = createClient(url, serviceKey)
 * await runBatchEnrichment({ supabase, userId: '...', options: { maxContacts: 50 } })
 *
 * @example
 * // From React (via hook):
 * await runBatchEnrichment({ supabase, userId, onProgress: setProgress, signal: controller.signal })
 */
export async function runBatchEnrichment(config: BatchRunnerConfig): Promise<BatchRunnerProgress> {
  const {
    supabase,
    userId,
    geminiApiKey,
    options = {},
    onProgress,
    onContactDone,
    signal,
  } = config

  const concurrency = Math.min(options.concurrency ?? 1, MAX_CONCURRENCY)
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS

  let contacts: Contact[]
  try {
    contacts = await fetchPendingContacts(supabase, userId, options)
  } catch (err) {
    console.error('[batchRunner] Failed to fetch contacts:', err)
    throw err
  }

  const progress: BatchRunnerProgress = {
    total: contacts.length,
    completed: 0,
    failed: 0,
    skipped: 0,
    currentContactId: null,
    currentPhase: null,
    startedAt: new Date().toISOString(),
    estimatedCompletionAt: null,
  }

  console.log(`[batchRunner] Starting enrichment of ${contacts.length} contacts (concurrency: ${concurrency})`)

  const pipelineOptions: PipelineOptions = {
    supabase,
    userId,
    geminiApiKey,
    ddgDelayMs: delayMs,
  }

  // Process with concurrency limit using sliding window
  const queue = [...contacts]
  const inFlight = new Set<Promise<void>>()

  while (queue.length > 0 || inFlight.size > 0) {
    // Check for cancellation
    if (signal?.aborted) {
      console.log('[batchRunner] Cancelled by signal')
      break
    }

    // Fill up to concurrency limit
    while (queue.length > 0 && inFlight.size < concurrency) {
      if (signal?.aborted) break

      const contact = queue.shift()!
      progress.currentContactId = contact.id
      progress.currentPhase = 'ddg_profile' as EnrichmentPhase

      // Skip contacts that should be skipped
      if (contact.enrichment_status === 'completed' && options.skipCompleted !== false) {
        progress.skipped++
        onProgress?.(progress)
        continue
      }

      const task = processOne(contact, pipelineOptions)
        .then(success => {
          if (success) {
            progress.completed++
          } else {
            progress.failed++
          }
          progress.estimatedCompletionAt = estimateCompletion(
            progress.startedAt,
            progress.completed + progress.failed,
            progress.total,
            delayMs
          )
          onContactDone?.(contact.id, success)
          onProgress?.({ ...progress })
        })
        .catch(() => {
          progress.failed++
          onContactDone?.(contact.id, false)
          onProgress?.({ ...progress })
        })
        .finally(() => {
          inFlight.delete(task)
        })

      inFlight.add(task)

      // Add delay between starts to respect rate limits
      if (queue.length > 0) {
        await sleep(delayMs)
      }
    }

    // Wait for at least one to finish before looping
    if (inFlight.size >= concurrency && queue.length > 0) {
      await Promise.race(inFlight)
    } else if (inFlight.size > 0 && queue.length === 0) {
      await Promise.all(inFlight)
    }
  }

  progress.currentContactId = null
  progress.currentPhase = null
  onProgress?.({ ...progress })

  console.log(`[batchRunner] Done. Completed: ${progress.completed}, Failed: ${progress.failed}, Skipped: ${progress.skipped}`)

  return progress
}

/**
 * Enrich a single contact by ID (convenience wrapper).
 */
export async function enrichSingleContact(
  contactId: string,
  config: Omit<BatchRunnerConfig, 'options'>
): Promise<boolean> {
  const { supabase, userId } = config

  const { data: contact, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .eq('user_id', userId)
    .single()

  if (error || !contact) {
    console.error('[batchRunner] Contact not found:', contactId, error?.message)
    return false
  }

  const result = await enrichContact(contact as Contact, {
    supabase,
    userId,
    geminiApiKey: config.geminiApiKey,
  })

  config.onContactDone?.(contactId, result.success)
  return result.success
}
