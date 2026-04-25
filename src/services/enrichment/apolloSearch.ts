/**
 * apolloSearch.ts — Apollo People Search (FREE, zero credits)
 *
 * Uses Apollo's /people/search endpoint which is FREE — it discovers people
 * by company domain. This powers 2nd-degree connection discovery.
 *
 * NOT Apollo enrichment (which costs credits). This is purely People Search.
 * Docs: https://apolloio.github.io/apollo-api-docs/#people-api
 */

import type { ApolloSearchResult } from '../../types/enrichment'

const APOLLO_BASE = 'https://api.apollo.io/v1'
const APOLLO_CONFIG_PATH = '.config/apollo/config.json'

// Load API key: env var > config file
function getApiKey(): string {
  // Browser / Edge Function: use env var only
  if (typeof process !== 'undefined' && process.env.APOLLO_API_KEY) {
    return process.env.APOLLO_API_KEY
  }

  // Node runtime: try reading config file
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      // Dynamic require only in Node
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require('fs') as typeof import('fs')
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const path = require('path') as typeof import('path')
      const configPath = path.resolve(process.cwd(), APOLLO_CONFIG_PATH)
      const raw = fs.readFileSync(configPath, 'utf-8')
      const config = JSON.parse(raw) as { api_key: string }
      return config.api_key
    } catch {
      // Fall through
    }
  }

  throw new Error('Apollo API key not found. Set APOLLO_API_KEY env var or create .config/apollo/config.json')
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Exponential backoff on 429 responses.
 */
async function fetchWithBackoff(
  url: string,
  options: RequestInit,
  attempt = 0
): Promise<Response> {
  const response = await fetch(url, options)

  if (response.status === 429 && attempt < 4) {
    const retryAfter = response.headers.get('Retry-After')
    const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, attempt + 1) * 1000
    console.log(`[apolloSearch] Rate limited, waiting ${delayMs}ms (attempt ${attempt + 1})`)
    await sleep(delayMs)
    return fetchWithBackoff(url, options, attempt + 1)
  }

  return response
}

export interface ApolloSearchOptions {
  /** Company domain, e.g. "stripe.com" */
  companyDomain: string
  /** Max results to fetch (default 25, max 100) */
  perPage?: number
  /** Filter by title keywords */
  titleKeywords?: string[]
}

/**
 * Search Apollo for people at a given company domain.
 * This is FREE — uses People Search, not enrichment credits.
 * 
 * Returns colleagues who can become 2nd-degree connections.
 */
export async function searchColleagues(options: ApolloSearchOptions): Promise<ApolloSearchResult> {
  const { companyDomain, perPage = 25, titleKeywords = [] } = options

  let apiKey: string
  try {
    apiKey = getApiKey()
  } catch (err) {
    console.warn('[apolloSearch] No API key available, skipping:', err)
    return { people: [], totalFound: 0, source: 'apollo' }
  }

  const body: Record<string, unknown> = {
    api_key: apiKey,
    q_organization_domains: companyDomain,
    per_page: Math.min(perPage, 100),
    page: 1,
  }

  if (titleKeywords.length > 0) {
    body.person_titles = titleKeywords
  }

  try {
    const response = await fetchWithBackoff(`${APOLLO_BASE}/mixed_people/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    })

    if (!response.ok) {
      const text = await response.text()
      console.warn(`[apolloSearch] API error ${response.status}:`, text.slice(0, 200))
      return { people: [], totalFound: 0, source: 'apollo' }
    }

    const data = await response.json() as {
      people?: Array<{
        name?: string
        title?: string
        linkedin_url?: string
        email?: string
        organization?: { name?: string; primary_domain?: string }
      }>
      pagination?: { total_entries?: number }
    }

    const people: ApolloSearchResult['people'] = (data.people ?? []).map(p => ({
      name: p.name ?? null,
      title: p.title ?? null,
      linkedin_url: p.linkedin_url ?? null,
      email: p.email ?? null,
      company: p.organization?.name ?? null,
      company_domain: p.organization?.primary_domain ?? companyDomain,
    }))

    return {
      people,
      totalFound: data.pagination?.total_entries ?? people.length,
      source: 'apollo',
    }
  } catch (err) {
    console.warn('[apolloSearch] Request failed:', err)
    return { people: [], totalFound: 0, source: 'apollo' }
  }
}

/**
 * Resolve a company domain from a company name via Apollo org search.
 * Falls back to naive domain guessing if Apollo fails.
 */
export async function resolveCompanyDomain(companyName: string): Promise<string | null> {
  let apiKey: string
  try {
    apiKey = getApiKey()
  } catch {
    return null
  }

  // Naive domain guess first (works for most well-known companies)
  const naive = companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '')
  
  const candidates = [`${naive}.com`, `${naive}.io`, `${naive}.co`]

  try {
    const response = await fetchWithBackoff(`${APOLLO_BASE}/mixed_companies/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        q_organization_name: companyName,
        per_page: 1,
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (response.ok) {
      const data = await response.json() as {
        organizations?: Array<{ primary_domain?: string }>
      }
      const domain = data.organizations?.[0]?.primary_domain
      if (domain) return domain
    }
  } catch {
    // Fall through to naive guess
  }

  return candidates[0] // Return naive guess as fallback
}
