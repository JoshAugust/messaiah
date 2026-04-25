/**
 * ddgSearch.ts — DuckDuckGo search enrichment (FREE, no API key)
 *
 * Uses html.duckduckgo.com to search for profile data, digital footprint,
 * and recent activity. Parses HTML snippets for structured data.
 *
 * Rate limiting: 2s delay between requests (enforced by caller via pipeline.ts)
 */

import type { DDGSearchResult } from '../../types/enrichment'

const DDG_URL = 'https://html.duckduckgo.com/html/'
const DEFAULT_DELAY_MS = 2000

// Bare-minimum HTML snippet parser — no DOM in Node/Edge environments
function extractSnippets(html: string): Array<{ title: string; url: string; snippet: string }> {
  const results: Array<{ title: string; url: string; snippet: string }> = []

  // DDG HTML results have class="result__snippet", "result__title", "result__url"
  // We use simple regex since DOMParser may not be available in all runtimes
  const resultBlocks = html.split(/class="result__body"/i)
  
  for (let i = 1; i < resultBlocks.length && results.length < 10; i++) {
    const block = resultBlocks[i]

    const titleMatch = block.match(/class="result__a"[^>]*>([^<]+)<\/a>/i)
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i)
    const urlMatch = block.match(/class="result__url"[^>]*>([\s\S]*?)<\/span>/i)

    const title = titleMatch ? titleMatch[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : ''
    const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim().replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"') : ''
    const url = urlMatch ? urlMatch[1].replace(/<[^>]+>/g, '').trim() : ''

    if (title || snippet) {
      results.push({ title, url, snippet })
    }
  }

  return results
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function ddgSearch(query: string, delayMs = DEFAULT_DELAY_MS): Promise<DDGSearchResult> {
  await sleep(delayMs)

  const params = new URLSearchParams({ q: query, kl: 'us-en' })
  const url = `${DDG_URL}?${params.toString()}`

  let html = ''
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MESSAIAH-enrichment/1.0)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(15_000),
    })

    if (!response.ok) {
      throw new Error(`DDG returned ${response.status}`)
    }
    html = await response.text()
  } catch (err) {
    console.warn(`[ddgSearch] Failed query "${query}":`, err)
  }

  const results = html ? extractSnippets(html) : []

  return {
    query,
    results,
    parsedAt: new Date().toISOString(),
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

export interface ProfileSearchData {
  headline: string | null
  bio: string | null
  skills: string[]
  location: string | null
  linkedinUrl: string | null
  sourceUrls: string[]
}

export interface FootprintData {
  socialProfiles: Record<string, string>
  sourceUrls: string[]
}

export interface ActivityData {
  recentActivity: Array<{
    type: 'news' | 'post' | 'event' | 'other'
    title: string
    url?: string
    source: string
  }>
}

/**
 * Search DDG for a person's LinkedIn profile and extract headline/bio/skills.
 */
export async function searchLinkedInProfile(
  name: string,
  company: string,
  delayMs?: number
): Promise<ProfileSearchData> {
  const query = `"${name}" "${company}" LinkedIn`
  const { results } = await ddgSearch(query, delayMs)

  let headline: string | null = null
  let bio: string | null = null
  const skills: string[] = []
  let location: string | null = null
  let linkedinUrl: string | null = null
  const sourceUrls: string[] = []

  for (const r of results) {
    // Pick first LinkedIn result
    if (r.url.includes('linkedin.com/in/') && !linkedinUrl) {
      linkedinUrl = r.url.startsWith('http') ? r.url : `https://${r.url}`
    }

    if (r.snippet) {
      // Headline is often the first sentence before " | " or " - "
      if (!headline) {
        const headlineMatch = r.snippet.match(/^([^|•\-–]{10,80})[\s]*[|•\-–]/)
        if (headlineMatch) headline = headlineMatch[1].trim()
      }

      // Bio: grab the full snippet if it contains the name
      if (!bio && r.snippet.toLowerCase().includes(name.toLowerCase().split(' ')[0].toLowerCase())) {
        bio = r.snippet.slice(0, 500)
      }

      // Skills: look for keywords like "skills", "experience in", "expert in"
      const skillsMatch = r.snippet.match(/(?:skills?|experience in|expert in|specializ[ei]ng in)[:\s]+([^.]{5,100})/i)
      if (skillsMatch) {
        skills.push(...skillsMatch[1].split(/[,·]/g).map(s => s.trim()).filter(s => s.length > 2 && s.length < 40))
      }

      // Location: look for City, Country patterns
      if (!location) {
        const locMatch = r.snippet.match(/(?:based in|located in|from)\s+([A-Z][a-zA-Z\s,]{3,40})/i)
        if (locMatch) location = locMatch[1].trim()
      }
    }

    if (r.url) sourceUrls.push(r.url)
  }

  return { headline, bio, skills: [...new Set(skills)], location, linkedinUrl, sourceUrls }
}

/**
 * Search DDG for a person's digital footprint (Twitter, GitHub, Medium, etc.)
 */
export async function searchDigitalFootprint(
  name: string,
  delayMs?: number
): Promise<FootprintData> {
  const query = `"${name}" site:twitter.com OR site:github.com OR site:medium.com OR site:substack.com`
  const { results } = await ddgSearch(query, delayMs)

  const socialProfiles: Record<string, string> = {}
  const sourceUrls: string[] = []

  for (const r of results) {
    const url = r.url.startsWith('http') ? r.url : `https://${r.url}`
    
    if (r.url.includes('twitter.com') && !socialProfiles.twitter) {
      socialProfiles.twitter = url
    } else if (r.url.includes('github.com') && !socialProfiles.github) {
      socialProfiles.github = url
    } else if (r.url.includes('medium.com') && !socialProfiles.medium) {
      socialProfiles.medium = url
    } else if (r.url.includes('substack.com') && !socialProfiles.substack) {
      socialProfiles.substack = url
    }

    sourceUrls.push(r.url)
  }

  return { socialProfiles, sourceUrls }
}

/**
 * Search DDG for recent activity: news, posts, events.
 */
export async function searchRecentActivity(
  name: string,
  company: string,
  delayMs?: number
): Promise<ActivityData> {
  const query = `"${name}" "${company}" 2024 OR 2025`
  const { results } = await ddgSearch(query, delayMs)

  const recentActivity: ActivityData['recentActivity'] = []

  for (const r of results.slice(0, 6)) {
    let type: 'news' | 'post' | 'event' | 'other' = 'other'
    
    if (r.url.includes('medium.com') || r.url.includes('substack.com') || r.url.includes('blog')) {
      type = 'post'
    } else if (r.snippet.toLowerCase().includes('conference') || r.snippet.toLowerCase().includes('event') || r.snippet.toLowerCase().includes('webinar')) {
      type = 'event'
    } else if (r.url.includes('techcrunch') || r.url.includes('forbes') || r.url.includes('bloomberg') || r.snippet.toLowerCase().includes('announced')) {
      type = 'news'
    }

    recentActivity.push({
      type,
      title: r.title || r.snippet.slice(0, 80),
      url: r.url.startsWith('http') ? r.url : `https://${r.url}`,
      source: new URL(r.url.startsWith('http') ? r.url : `https://${r.url}`).hostname.replace('www.', ''),
    })
  }

  return { recentActivity }
}

// Export the raw search function for custom queries
export { ddgSearch }
