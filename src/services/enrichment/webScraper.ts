/**
 * webScraper.ts — Public web scraper for LinkedIn and social profiles
 *
 * LinkedIn public pages are heavily restricted — we do best-effort extraction.
 * Graceful degradation: if blocked (302, 999, etc.), return partial data.
 *
 * Note: This only reads publicly visible data, same as any browser would see
 * without being logged in.
 */

const SCRAPE_TIMEOUT_MS = 15_000

export interface ScrapedProfileData {
  headline: string | null
  location: string | null
  bio: string | null
  avatarUrl: string | null
  socialLinks: Record<string, string>
  recentPosts: Array<{
    text: string
    date?: string
    url?: string
  }>
  blocked: boolean
  error: string | null
}

const EMPTY_RESULT: ScrapedProfileData = {
  headline: null,
  location: null,
  bio: null,
  avatarUrl: null,
  socialLinks: {},
  recentPosts: [],
  blocked: false,
  error: null,
}

function parseLinkedInPublic(html: string): Partial<ScrapedProfileData> {
  const data: Partial<ScrapedProfileData> = {
    socialLinks: {},
    recentPosts: [],
  }

  // LinkedIn public profile HTML varies but has some stable patterns:

  // Headline is often in <h2> or a meta tag
  const headlineMeta = html.match(/<meta[^>]+name="description"[^>]+content="([^"]{10,300})"/i)
  if (headlineMeta) {
    data.headline = headlineMeta[1].trim()
  }

  // og:description often has a clean bio
  const ogDesc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]{10,500})"/i)
  if (ogDesc) {
    data.bio = ogDesc[1].replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim()
  }

  // og:title sometimes has "Name | LinkedIn" or "Name - Title at Company"
  const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]{5,200})"/i)
  if (ogTitle) {
    const title = ogTitle[1].replace(/\s*\|\s*LinkedIn\s*$/, '').trim()
    if (!data.headline && title.includes(' - ')) {
      data.headline = title.split(' - ').slice(1).join(' - ')
    }
  }

  // Avatar from og:image
  const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
  if (ogImage) {
    data.avatarUrl = ogImage[1]
  }

  // Location: look for city/country in structured data or visible text
  const locationMatch = html.match(/location["\s:]+([A-Z][a-zA-Z\s,]+(?:Area|Region|[A-Z]{2})?)/i)
  if (locationMatch) {
    data.location = locationMatch[1].trim().slice(0, 60)
  }

  return data
}

function parseGenericSocialPage(html: string, platform: string): Partial<ScrapedProfileData> {
  const data: Partial<ScrapedProfileData> = { socialLinks: {}, recentPosts: [] }

  const description = html.match(/<meta[^>]+name="description"[^>]+content="([^"]{5,300})"/i)
  if (description) {
    data.bio = description[1].trim()
  }

  if (platform === 'github') {
    // GitHub public bio
    const bioMatch = html.match(/class="p-note[^"]*"[^>]*>([\s\S]{5,200}?)<\/div>/i)
    if (bioMatch) data.bio = bioMatch[1].replace(/<[^>]+>/g, '').trim()
  }

  return data
}

async function fetchPage(url: string): Promise<{ html: string; status: number; blocked: boolean }> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
    })

    const status = response.status
    // LinkedIn returns 999 for bots, or redirects to login
    const blocked = status === 999 || status === 403 || (status === 302 && response.url.includes('login'))

    if (blocked || status >= 400) {
      return { html: '', status, blocked: true }
    }

    const html = await response.text()
    return { html, status, blocked: false }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { html: '', status: 0, blocked: message.includes('timeout') }
  }
}

/**
 * Scrape a LinkedIn public profile URL.
 * Gracefully degrades if blocked — returns whatever was extractable.
 */
export async function scrapeLinkedInProfile(linkedinUrl: string): Promise<ScrapedProfileData> {
  if (!linkedinUrl) {
    return { ...EMPTY_RESULT, error: 'No URL provided' }
  }

  // Normalise URL
  const url = linkedinUrl.startsWith('http') ? linkedinUrl : `https://www.linkedin.com/in/${linkedinUrl}`
  
  const { html, blocked } = await fetchPage(url)

  if (blocked || !html) {
    return {
      ...EMPTY_RESULT,
      blocked: true,
      error: 'LinkedIn blocked scraping — public profile unavailable without auth',
    }
  }

  const parsed = parseLinkedInPublic(html)

  return {
    ...EMPTY_RESULT,
    ...parsed,
    blocked: false,
    error: null,
  }
}

/**
 * Scrape a GitHub, Medium, or other social profile.
 */
export async function scrapeSocialProfile(
  url: string
): Promise<ScrapedProfileData> {
  if (!url) return { ...EMPTY_RESULT, error: 'No URL provided' }

  let platform = 'generic'
  if (url.includes('github.com')) platform = 'github'
  else if (url.includes('medium.com')) platform = 'medium'
  else if (url.includes('twitter.com') || url.includes('x.com')) platform = 'twitter'

  const { html, blocked } = await fetchPage(url)

  if (blocked || !html) {
    return {
      ...EMPTY_RESULT,
      blocked: true,
      error: `Blocked or unreachable: ${url}`,
    }
  }

  const parsed = parseGenericSocialPage(html, platform)

  return {
    ...EMPTY_RESULT,
    ...parsed,
    blocked: false,
    error: null,
  }
}

/**
 * Enrich social data from a map of platform -> url.
 * Returns merged partial profile data from all sources.
 */
export async function enrichFromSocialProfiles(
  socialProfiles: Record<string, string>
): Promise<Partial<ScrapedProfileData>> {
  const merged: Partial<ScrapedProfileData> = { socialLinks: {}, recentPosts: [] }

  for (const [_platform, url] of Object.entries(socialProfiles)) {
    try {
      const result = await scrapeSocialProfile(url)
      if (!result.blocked) {
        if (!merged.bio && result.bio) merged.bio = result.bio
        if (!merged.headline && result.headline) merged.headline = result.headline
        if (!merged.location && result.location) merged.location = result.location
        if (!merged.avatarUrl && result.avatarUrl) merged.avatarUrl = result.avatarUrl
        if (result.recentPosts?.length) {
          merged.recentPosts = [...(merged.recentPosts ?? []), ...result.recentPosts]
        }
      }
    } catch {
      // Continue with next profile
    }
  }

  return merged
}
