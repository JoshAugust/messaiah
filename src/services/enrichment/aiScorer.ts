/**
 * aiScorer.ts — AI-powered contact scoring and summary generation
 *
 * Works with Gemini API (user has a key) or falls back to rule-based scoring.
 * Pass supabase client as parameter — do not import directly.
 */

import type { EnrichmentResult, ScoringResult } from '../../types/enrichment'
import type { Contact, Profile } from '../../types/database'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_MODEL = 'gemini-2.0-flash'

function getGeminiKey(): string | null {
  if (typeof process !== 'undefined' && process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY
  }
  // Browser: can be injected via window or env
  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).GEMINI_API_KEY) {
    return (window as unknown as Record<string, unknown>).GEMINI_API_KEY as string
  }
  return null
}

// ─── Rule-based fallback scorer ───────────────────────────────────────────────

function scoreWithRules(
  contact: Contact,
  enrichment: Partial<EnrichmentResult>,
  userProfile: Profile | null
): ScoringResult {
  let discoveryScore = 30  // base
  let careerFitScore = 30
  let connectionStrength = 20
  let strategicValue = 30

  // discovery_score: uniqueness signals
  if (enrichment.recentActivity?.length) discoveryScore += Math.min(30, enrichment.recentActivity.length * 5)
  if (enrichment.socialProfiles && Object.keys(enrichment.socialProfiles).length > 1) discoveryScore += 15
  if (enrichment.bio && enrichment.bio.length > 100) discoveryScore += 10
  discoveryScore = Math.min(100, discoveryScore)

  // career_fit_score: alignment with user goals
  if (userProfile?.goal && contact.bio) {
    const goalWords = (userProfile.goal ?? '').toLowerCase().split(/\s+/)
    const bioLower = contact.bio.toLowerCase()
    const matches = goalWords.filter(w => w.length > 3 && bioLower.includes(w))
    careerFitScore += Math.min(40, matches.length * 10)
  }
  if (userProfile?.target_roles && Array.isArray(userProfile.target_roles)) {
    const roles = userProfile.target_roles as string[]
    const positionLower = (contact.position ?? '').toLowerCase()
    if (roles.some(r => positionLower.includes(r.toLowerCase()))) careerFitScore += 20
  }
  careerFitScore = Math.min(100, careerFitScore)

  // connection_strength: based on relationship type and recency
  const relStrength: Record<string, number> = {
    mentor: 80, mentee: 70, friend: 75, colleague: 50,
    hiring_manager: 60, recruiter: 55, peer: 45, acquaintance: 25, other: 20,
  }
  connectionStrength = relStrength[contact.relationship_type ?? 'other'] ?? 20
  if (contact.connected_on) {
    const ageMonths = (Date.now() - new Date(contact.connected_on).getTime()) / (1000 * 60 * 60 * 24 * 30)
    if (ageMonths < 6) connectionStrength = Math.min(100, connectionStrength + 15)
    else if (ageMonths > 24) connectionStrength = Math.max(5, connectionStrength - 10)
  }

  // strategic_value: based on their position and company
  const seniorTitles = ['ceo', 'cto', 'cpo', 'founder', 'vp', 'director', 'head of', 'partner', 'principal']
  const posLower = (contact.position ?? '').toLowerCase()
  if (seniorTitles.some(t => posLower.includes(t))) strategicValue += 30
  if (enrichment.colleagues && enrichment.colleagues.length > 0) strategicValue += 15  // has 2nd degree value
  if (contact.company) strategicValue += 10
  strategicValue = Math.min(100, strategicValue)

  // Talking points from available data
  const talkingPoints: string[] = []
  if (contact.company) talkingPoints.push(`Ask about their work at ${contact.company}`)
  if (contact.position) talkingPoints.push(`Discuss their role as ${contact.position}`)
  if (enrichment.recentActivity?.length) {
    talkingPoints.push(`Mention their recent activity: "${enrichment.recentActivity[0].title}"`)
  }
  if (enrichment.socialProfiles?.github) talkingPoints.push(`Reference their open source work on GitHub`)
  if (enrichment.skills?.length) talkingPoints.push(`Explore their expertise in ${enrichment.skills.slice(0, 2).join(' and ')}`)

  const outreachSuggestions: string[] = [
    `Reconnect via LinkedIn with a note about ${contact.company}`,
    `Ask for a 15-minute call to explore shared interests`,
  ]
  if (enrichment.socialProfiles?.twitter) {
    outreachSuggestions.push('Engage with their Twitter/X posts before reaching out')
  }

  const summary = [
    contact.full_name ?? `${contact.first_name} ${contact.last_name}`,
    contact.position ? `works as ${contact.position}` : null,
    contact.company ? `at ${contact.company}` : null,
    enrichment.bio ? `. ${enrichment.bio.slice(0, 200)}` : null,
  ].filter(Boolean).join(' ')

  return {
    discovery_score: discoveryScore,
    career_fit_score: careerFitScore,
    connection_strength: connectionStrength,
    strategic_value: strategicValue,
    ai_summary: summary,
    talking_points: talkingPoints.slice(0, 5),
    outreach_suggestions: outreachSuggestions,
    confidence: 0.4,  // rule-based is lower confidence
  }
}

// ─── Gemini-powered scorer ─────────────────────────────────────────────────────

async function scoreWithGemini(
  contact: Contact,
  enrichment: Partial<EnrichmentResult>,
  userProfile: Profile | null,
  apiKey: string
): Promise<ScoringResult> {
  const userContext = userProfile
    ? `User profile: ${userProfile.name}, ${userProfile.title} at ${userProfile.company}. Goal: ${userProfile.goal ?? 'career networking'}.`
    : 'User is a professional networking to advance their career.'

  const contactContext = `
Contact: ${contact.full_name ?? `${contact.first_name} ${contact.last_name}`}
Position: ${contact.position ?? 'unknown'}
Company: ${contact.company ?? 'unknown'}
Relationship: ${contact.relationship_type ?? 'acquaintance'}
Bio: ${enrichment.bio ?? contact.bio ?? 'none'}
Headline: ${enrichment.headline ?? contact.headline ?? 'none'}
Skills: ${(enrichment.skills ?? []).join(', ') || 'none'}
Social: ${Object.keys(enrichment.socialProfiles ?? {}).join(', ') || 'none'}
Recent activity: ${(enrichment.recentActivity ?? []).slice(0, 3).map(a => a.title).join('; ') || 'none'}
Connected: ${contact.connected_on ?? 'unknown date'}
`

  const prompt = `
You are a networking intelligence AI. Score this contact for the user's networking goals.

${userContext}

${contactContext}

Return a JSON object with these exact keys:
{
  "discovery_score": <0-100, how interesting/unexpected is this person?>,
  "career_fit_score": <0-100, how relevant to user's goals?>,
  "connection_strength": <0-100, how strong is the existing relationship?>,
  "strategic_value": <0-100, how useful for networking paths?>,
  "ai_summary": "<one paragraph about this contact and why they matter>",
  "talking_points": ["<3-5 specific conversation starters>"],
  "outreach_suggestions": ["<2-3 specific outreach tactics>"],
  "confidence": <0-1, how confident you are in these scores>
}

Return ONLY the JSON, no markdown fences.
`

  try {
    const response = await fetch(
      `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
        }),
        signal: AbortSignal.timeout(30_000),
      }
    )

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned) as ScoringResult

    return {
      ...parsed,
      confidence: parsed.confidence ?? 0.8,
    }
  } catch (err) {
    console.warn('[aiScorer] Gemini failed, falling back to rules:', err)
    return scoreWithRules(contact, enrichment, userProfile)
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

export interface ScoringOptions {
  /** Gemini API key. If not provided, falls back to rule-based scoring. */
  geminiApiKey?: string
  /** User profile for contextualised scoring */
  userProfile?: Profile | null
}

/**
 * Score a contact and generate AI insights.
 * Uses Gemini if API key is available, otherwise falls back to rule-based scoring.
 */
export async function scoreContact(
  contact: Contact,
  enrichment: Partial<EnrichmentResult>,
  options: ScoringOptions = {}
): Promise<ScoringResult> {
  const { geminiApiKey, userProfile = null } = options
  
  const apiKey = geminiApiKey ?? getGeminiKey()

  if (apiKey) {
    return scoreWithGemini(contact, enrichment, userProfile, apiKey)
  }

  console.log('[aiScorer] No Gemini key, using rule-based scoring')
  return scoreWithRules(contact, enrichment, userProfile)
}

/**
 * Generate talking points only (lighter call).
 */
export async function generateTalkingPoints(
  contact: Contact,
  enrichment: Partial<EnrichmentResult>,
  geminiApiKey?: string
): Promise<string[]> {
  const scoring = await scoreContact(contact, enrichment, { geminiApiKey })
  return scoring.talking_points
}
