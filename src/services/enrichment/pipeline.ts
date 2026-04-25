/**
 * pipeline.ts — Single-contact enrichment pipeline orchestrator
 *
 * Phases:
 *   1. ddg_profile    — DDG search for LinkedIn profile data
 *   2. ddg_footprint  — DDG search for social/digital footprint
 *   3. ddg_activity   — DDG search for recent activity
 *   4. apollo_colleagues — Apollo People Search for 2nd degree connections
 *   5. ai_scoring     — AI summary and scoring
 *
 * Supabase client is passed as parameter — not imported globally.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { EnrichmentResult, EnrichmentPhase } from '../../types/enrichment'
import type { Contact } from '../../types/database'

import { searchLinkedInProfile, searchDigitalFootprint, searchRecentActivity } from './ddgSearch'
import { searchColleagues, resolveCompanyDomain } from './apolloSearch'
import { scrapeLinkedInProfile } from './webScraper'
import { scoreContact } from './aiScorer'

export interface PipelineOptions {
  supabase: SupabaseClient
  userId: string
  geminiApiKey?: string
  /** ms between DDG requests (default 2000) */
  ddgDelayMs?: number
  /** Skip Apollo lookup (faster) */
  skipApollo?: boolean
}

export interface PipelineResult {
  success: boolean
  enrichment: EnrichmentResult | null
  error: string | null
}

function makeEmptyResult(contactId: string): EnrichmentResult {
  return {
    contactId,
    phases: {},
    headline: null,
    bio: null,
    location: null,
    skills: [],
    socialProfiles: {},
    recentActivity: [],
    colleagues: [],
    scoring: null,
    enrichedAt: new Date().toISOString(),
    sourceUrls: [],
    errors: [],
  }
}

async function updateJobPhase(
  supabase: SupabaseClient,
  jobId: string,
  phase: EnrichmentPhase,
  status: 'running' | 'done' | 'failed'
): Promise<void> {
  try {
    // Fetch current phases
    const { data: job } = await supabase
      .from('enrichment_jobs')
      .select('phases')
      .eq('id', jobId)
      .single()

    const phases = (job?.phases as Record<string, string> | null) ?? {}
    phases[phase] = status

    await supabase
      .from('enrichment_jobs')
      .update({ phases, updated_at: new Date().toISOString() })
      .eq('id', jobId)
  } catch {
    // Non-fatal — continue pipeline
  }
}

async function getOrCreateJob(
  supabase: SupabaseClient,
  userId: string,
  contactId: string
): Promise<string> {
  // Check for existing running job
  const { data: existing } = await supabase
    .from('enrichment_jobs')
    .select('id')
    .eq('user_id', userId)
    .eq('target_id', contactId)
    .eq('target_type', 'contact')
    .in('status', ['pending', 'running', 'retrying'])
    .maybeSingle()

  if (existing?.id) return existing.id

  // Create new job
  const { data: newJob, error } = await supabase
    .from('enrichment_jobs')
    .insert({
      user_id: userId,
      target_type: 'contact',
      target_id: contactId,
      status: 'running' as const,
      started_at: new Date().toISOString(),
      attempt_count: 1,
      max_attempts: 3,
      phases: {},
      sources_tried: [],
      sources_succeeded: [],
      error_log: [],
      priority: 5,
    })
    .select('id')
    .single()

  if (error || !newJob) {
    throw new Error(`Failed to create enrichment job: ${error?.message}`)
  }

  return newJob.id
}

/**
 * Run the full enrichment pipeline for a single contact.
 */
export async function enrichContact(
  contact: Contact,
  options: PipelineOptions
): Promise<PipelineResult> {
  const { supabase, userId, geminiApiKey, ddgDelayMs = 2000, skipApollo = false } = options

  const result = makeEmptyResult(contact.id)

  let jobId: string
  try {
    jobId = await getOrCreateJob(supabase, userId, contact.id)
  } catch (err) {
    return { success: false, enrichment: null, error: String(err) }
  }

  const name = contact.full_name ?? `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim()
  const company = contact.company ?? ''

  // ── Phase 1: DDG LinkedIn Profile Search ─────────────────────────────────────
  result.phases['ddg_profile'] = 'running'
  await updateJobPhase(supabase, jobId, 'ddg_profile', 'running')

  try {
    const profileData = await searchLinkedInProfile(name, company, ddgDelayMs)
    result.headline = profileData.headline
    result.bio = profileData.bio
    result.location = profileData.location
    result.skills = [...new Set([...result.skills, ...profileData.skills])]
    result.sourceUrls.push(...profileData.sourceUrls)

    // If we found a LinkedIn URL from DDG and contact doesn't have one, note it
    if (profileData.linkedinUrl && !contact.linkedin_url) {
      result.sourceUrls.unshift(profileData.linkedinUrl)
    }

    result.phases['ddg_profile'] = 'done'
    await updateJobPhase(supabase, jobId, 'ddg_profile', 'done')
  } catch (err) {
    const msg = String(err)
    result.phases['ddg_profile'] = 'failed'
    result.errors.push(`ddg_profile: ${msg}`)
    await updateJobPhase(supabase, jobId, 'ddg_profile', 'failed')
  }

  // ── Phase 1b: Scrape LinkedIn profile if URL available ────────────────────────
  const linkedinUrl = contact.linkedin_url ?? result.sourceUrls.find(u => u.includes('linkedin.com'))
  if (linkedinUrl) {
    try {
      const scraped = await scrapeLinkedInProfile(linkedinUrl)
      if (!scraped.blocked) {
        if (!result.headline && scraped.headline) result.headline = scraped.headline
        if (!result.bio && scraped.bio) result.bio = scraped.bio
        if (!result.location && scraped.location) result.location = scraped.location
      }
    } catch {
      // Non-fatal
    }
  }

  // ── Phase 2: DDG Digital Footprint ───────────────────────────────────────────
  result.phases['ddg_footprint'] = 'running'
  await updateJobPhase(supabase, jobId, 'ddg_footprint', 'running')

  try {
    const footprint = await searchDigitalFootprint(name, ddgDelayMs)
    result.socialProfiles = { ...result.socialProfiles, ...footprint.socialProfiles }
    result.sourceUrls.push(...footprint.sourceUrls)
    result.phases['ddg_footprint'] = 'done'
    await updateJobPhase(supabase, jobId, 'ddg_footprint', 'done')
  } catch (err) {
    result.phases['ddg_footprint'] = 'failed'
    result.errors.push(`ddg_footprint: ${String(err)}`)
    await updateJobPhase(supabase, jobId, 'ddg_footprint', 'failed')
  }

  // ── Phase 3: DDG Recent Activity ─────────────────────────────────────────────
  result.phases['ddg_activity'] = 'running'
  await updateJobPhase(supabase, jobId, 'ddg_activity', 'running')

  try {
    const activity = await searchRecentActivity(name, company, ddgDelayMs)
    result.recentActivity = activity.recentActivity
    result.phases['ddg_activity'] = 'done'
    await updateJobPhase(supabase, jobId, 'ddg_activity', 'done')
  } catch (err) {
    result.phases['ddg_activity'] = 'failed'
    result.errors.push(`ddg_activity: ${String(err)}`)
    await updateJobPhase(supabase, jobId, 'ddg_activity', 'failed')
  }

  // ── Phase 4: Apollo Colleagues (2nd degree discovery) ────────────────────────
  if (!skipApollo && company) {
    result.phases['apollo_colleagues'] = 'running'
    await updateJobPhase(supabase, jobId, 'apollo_colleagues', 'running')

    try {
      const domain = await resolveCompanyDomain(company)
      if (domain) {
        const apolloResult = await searchColleagues({ companyDomain: domain, perPage: 20 })
        result.colleagues = apolloResult.people

        // Upsert discovered people
        if (apolloResult.people.length > 0) {
          const discoveredInserts = apolloResult.people
            .filter(p => p.name)
            .map(p => ({
              user_id: userId,
              name: p.name,
              title: p.title,
              company: p.company ?? company,
              linkedin_url: p.linkedin_url,
              email: p.email,
              discovered_via: 'apollo_search',
              discovered_from_contact_id: contact.id,
              connection_degree: 2 as const,
              enrichment_status: 'pending' as const,
            }))

          if (discoveredInserts.length > 0) {
            await supabase
              .from('discovered_people')
              .upsert(discoveredInserts, { onConflict: 'user_id,linkedin_url', ignoreDuplicates: true })
          }

          // Create connection edges: user -> contact -> each colleague
          const connectionInserts = apolloResult.people
            .filter(p => p.linkedin_url)
            .map(p => ({
              user_id: userId,
              source_type: 'contact',
              source_id: contact.id,
              target_type: 'discovered_person',
              target_id: p.linkedin_url!, // Use linkedin_url as reference until we have the DB id
              relationship: 'colleague',
              strength: 40,
              evidence: { source: 'apollo_search', company },
            }))

          if (connectionInserts.length > 0) {
            await supabase
              .from('connections')
              .upsert(connectionInserts, { onConflict: 'user_id,source_id,target_id', ignoreDuplicates: true })
          }
        }

        result.phases['apollo_colleagues'] = 'done'
        await updateJobPhase(supabase, jobId, 'apollo_colleagues', 'done')
      } else {
        result.phases['apollo_colleagues'] = 'skipped'
      }
    } catch (err) {
      result.phases['apollo_colleagues'] = 'failed'
      result.errors.push(`apollo_colleagues: ${String(err)}`)
      await updateJobPhase(supabase, jobId, 'apollo_colleagues', 'failed')
    }
  } else {
    result.phases['apollo_colleagues'] = 'skipped'
  }

  // ── Phase 5: AI Scoring ───────────────────────────────────────────────────────
  result.phases['ai_scoring'] = 'running'
  await updateJobPhase(supabase, jobId, 'ai_scoring', 'running')

  try {
    // Fetch user profile for contextualised scoring
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    result.scoring = await scoreContact(contact, result, {
      geminiApiKey,
      userProfile,
    })

    result.phases['ai_scoring'] = 'done'
    await updateJobPhase(supabase, jobId, 'ai_scoring', 'done')
  } catch (err) {
    result.phases['ai_scoring'] = 'failed'
    result.errors.push(`ai_scoring: ${String(err)}`)
    await updateJobPhase(supabase, jobId, 'ai_scoring', 'failed')
  }

  // ── Persist enrichment to contact record ─────────────────────────────────────
  result.enrichedAt = new Date().toISOString()

  const contactUpdate: Partial<Contact> = {
    enrichment_status: 'completed',
    enriched_at: result.enrichedAt,
    headline: result.headline ?? contact.headline,
    bio: result.bio ?? contact.bio,
    location: result.location ?? contact.location,
    skills: result.skills.length > 0 ? result.skills : contact.skills,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    social_profiles: Object.keys(result.socialProfiles).length > 0 ? result.socialProfiles as any : contact.social_profiles,
    recent_activity: result.recentActivity.length > 0 ? result.recentActivity : contact.recent_activity,
  }

  if (result.scoring) {
    contactUpdate.discovery_score = result.scoring.discovery_score
    contactUpdate.career_fit_score = result.scoring.career_fit_score
    contactUpdate.connection_strength = result.scoring.connection_strength
    contactUpdate.strategic_value = result.scoring.strategic_value
    contactUpdate.ai_summary = result.scoring.ai_summary
    contactUpdate.talking_points = result.scoring.talking_points
    contactUpdate.outreach_suggestions = result.scoring.outreach_suggestions
  }

  const { error: updateError } = await supabase
    .from('contacts')
    .update(contactUpdate)
    .eq('id', contact.id)

  if (updateError) {
    result.errors.push(`contact_update: ${updateError.message}`)
  }

  // ── Mark job complete ─────────────────────────────────────────────────────────
  const hasAnyError = result.errors.length > 0
  const hasCriticalError = result.phases['ddg_profile'] === 'failed' && result.phases['ai_scoring'] === 'failed'

  await supabase
    .from('enrichment_jobs')
    .update({
      status: hasCriticalError ? 'failed' : 'completed',
      completed_at: new Date().toISOString(),
      phases: result.phases,
      sources_tried: ['ddg', 'apollo', 'web_scraper', 'gemini'],
      sources_succeeded: [
        result.phases['ddg_profile'] === 'done' ? 'ddg' : null,
        result.phases['apollo_colleagues'] === 'done' ? 'apollo' : null,
        result.phases['ai_scoring'] === 'done' ? 'gemini' : null,
      ].filter(Boolean) as string[],
      error_log: result.errors,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)

  result.phases['complete'] = 'done'

  return {
    success: !hasCriticalError,
    enrichment: result,
    error: hasAnyError ? result.errors.join('; ') : null,
  }
}
