// Enrichment pipeline types for MESSAIAH

export type EnrichmentPhase = 
  | 'ddg_profile'
  | 'ddg_footprint'
  | 'ddg_activity'
  | 'apollo_colleagues'
  | 'ai_scoring'
  | 'complete'
  | 'failed'

export interface DDGSearchResult {
  query: string
  results: Array<{
    title: string
    url: string
    snippet: string
  }>
  parsedAt: string
}

export interface ApolloSearchResult {
  people: Array<{
    name: string | null
    title: string | null
    linkedin_url: string | null
    email: string | null
    company: string | null
    company_domain: string | null
  }>
  totalFound: number
  source: 'apollo'
}

export interface ScoringResult {
  discovery_score: number       // 0-100: How interesting/unexpected is this person?
  career_fit_score: number      // 0-100: How relevant to user's goals?
  connection_strength: number   // 0-100: How strong is the existing relationship?
  strategic_value: number       // 0-100: How useful for networking paths?
  ai_summary: string            // One paragraph about the contact
  talking_points: string[]      // 3-5 conversation starters
  outreach_suggestions: string[]
  confidence: number            // 0-1: how confident is the scoring
}

export interface EnrichmentResult {
  contactId: string
  phases: Partial<Record<EnrichmentPhase, 'pending' | 'running' | 'done' | 'failed' | 'skipped'>>
  
  // Extracted profile data
  headline: string | null
  bio: string | null
  location: string | null
  skills: string[]
  
  // Social/digital footprint
  socialProfiles: {
    twitter?: string
    github?: string
    medium?: string
    website?: string
    [key: string]: string | undefined
  }
  
  // Recent activity
  recentActivity: Array<{
    type: 'news' | 'post' | 'event' | 'other'
    title: string
    url?: string
    date?: string
    source: string
  }>

  // 2nd degree connections via Apollo
  colleagues: ApolloSearchResult['people']
  
  // AI scoring
  scoring: ScoringResult | null

  // Metadata
  enrichedAt: string
  sourceUrls: string[]
  errors: string[]
}

export interface BatchRunnerOptions {
  concurrency?: number   // default 1, max 3
  delayMs?: number       // delay between contacts (default 2000)
  skipCompleted?: boolean // skip contacts already enriched
  maxContacts?: number   // limit for this run
}

export interface BatchRunnerProgress {
  total: number
  completed: number
  failed: number
  skipped: number
  currentContactId: string | null
  currentPhase: EnrichmentPhase | null
  startedAt: string
  estimatedCompletionAt: string | null
}
