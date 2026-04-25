import type { Contact, DiscoveredPerson, Connection } from '../types/database'

export interface PathNode {
  id: string
  name: string
  title: string | null
  company: string | null
  type: 'user' | 'contact' | 'discovered' | 'target'
  warmth: number // 0-100
  linkedinUrl?: string | null
}

export interface PathHop {
  from: PathNode
  to: PathNode
  relationshipStrength: number
  approachScript: string
}

export interface PathResult {
  id: string
  nodes: PathNode[]
  hops: PathHop[]
  score: number
  hopCount: number
  totalWarmth: number
  summary: string
}

export interface ParsedQuery {
  targetRole: string | null
  targetCompany: string | null
  targetPerson: string | null
  rawQuery: string
}

// Parse natural language query into structured components
export function parseQuery(query: string): ParsedQuery {
  const lower = query.toLowerCase()
  let targetRole: string | null = null
  let targetCompany: string | null = null
  let targetPerson: string | null = null

  // "Find path to [Person Name]" or "How do I reach [Person Name]"
  const personPatterns = [
    /find (?:path to |intro to |introduction to )?([A-Z][a-z]+ [A-Z][a-z]+)/i,
    /reach (?:out to |)?([A-Z][a-z]+ [A-Z][a-z]+)/i,
    /connect with ([A-Z][a-z]+ [A-Z][a-z]+)/i,
    /get to ([A-Z][a-z]+ [A-Z][a-z]+)/i,
    /intro to ([A-Z][a-z]+ [A-Z][a-z]+)/i,
  ]

  for (const pattern of personPatterns) {
    const match = query.match(pattern)
    if (match) {
      targetPerson = match[1]
      break
    }
  }

  // "How do I get to [role] at [company]?"
  const roleAtCompanyPattern = /(?:get to|reach|find|become|land|apply for|work at)\s+([^@]+?)\s+at\s+([^?]+)/i
  const roleAtMatch = query.match(roleAtCompanyPattern)
  if (roleAtMatch) {
    targetRole = roleAtMatch[1].trim()
    targetCompany = roleAtMatch[2].replace(/[?!.]/g, '').trim()
  }

  // "at [Company]" pattern
  if (!targetCompany) {
    const atCompanyPattern = /\bat\s+([\w\s]+?)(?:\s*[?,!]|$)/i
    const atMatch = query.match(atCompanyPattern)
    if (atMatch) {
      targetCompany = atMatch[1].trim()
    }
  }

  // Extract role keywords if not found yet
  if (!targetRole && !targetPerson) {
    const roleKeywords = ['cto', 'ceo', 'coo', 'vp', 'director', 'manager', 'engineer', 'designer', 'founder', 'partner', 'analyst', 'associate', 'head of']
    for (const kw of roleKeywords) {
      if (lower.includes(kw)) {
        const rolePattern = new RegExp(`(${kw}[\\w\\s]*)`, 'i')
        const match = query.match(rolePattern)
        if (match) {
          targetRole = match[1].trim()
          break
        }
      }
    }
  }

  return {
    targetRole,
    targetCompany,
    targetPerson,
    rawQuery: query,
  }
}

// Generate a human-readable approach script for a hop
function generateApproachScript(from: PathNode, to: PathNode, isFirstHop: boolean): string {
  if (isFirstHop) {
    const warmthLabel = from.warmth > 70 ? 'close contact' : from.warmth > 40 ? 'solid connection' : 'connection'
    return `Reach out to ${to.name} — your ${warmthLabel}${to.company ? ` at ${to.company}` : ''}. Mention your shared background and ask if they know anyone in your target space. Keep it brief and specific.`
  }

  return `Ask ${from.name} to introduce you to ${to.name}${to.title ? ` (${to.title})` : ''}. A warm email intro with a clear one-liner about what you're looking for works best.`
}

// Score a path: higher warmth × fewer hops = better score
function scorePath(hops: PathHop[]): number {
  if (hops.length === 0) return 0
  const totalStrength = hops.reduce((sum, h) => sum + h.relationshipStrength, 0)
  const avgStrength = totalStrength / hops.length
  // Penalize extra hops, reward warmth
  const hopPenalty = Math.pow(0.85, hops.length - 1)
  return Math.round(avgStrength * hopPenalty)
}

// Main path finding function using BFS
export function findPaths(
  parsed: ParsedQuery,
  contacts: Contact[],
  discoveredPeople: DiscoveredPerson[],
  connections: Connection[]
): PathResult[] {
  const { targetRole, targetCompany, targetPerson } = parsed
  const results: PathResult[] = []

  if (!targetRole && !targetCompany && !targetPerson) return []

  // Build user node
  const userNode: PathNode = {
    id: 'user',
    name: 'You',
    title: null,
    company: null,
    type: 'user',
    warmth: 100,
  }

  // Normalize for matching
  const normalize = (s: string | null | undefined) => (s ?? '').toLowerCase().trim()

  const matchesTarget = (name: string | null, title: string | null, company: string | null): boolean => {
    const n = normalize(name)
    const t = normalize(title)
    const c = normalize(company)

    if (targetPerson && n.includes(normalize(targetPerson))) return true
    if (targetRole && t.includes(normalize(targetRole))) return true
    if (targetCompany && c.includes(normalize(targetCompany))) return true
    return false
  }

  // Build contact nodes
  const contactNodes: PathNode[] = contacts.map((c) => ({
    id: `contact:${c.id}`,
    name: (c.full_name ?? (`${c.first_name ?? ''} ${c.last_name ?? ''}`.trim())) || 'Unknown',
    title: c.position ?? null,
    company: c.company ?? null,
    type: 'contact' as const,
    warmth: c.connection_strength ?? Math.min(50 + Math.random() * 30, 80),
    linkedinUrl: c.linkedin_url,
  }))

  // Build discovered person nodes
  const discoveredNodes: PathNode[] = discoveredPeople.map((d) => ({
    id: `discovered:${d.id}`,
    name: d.name ?? 'Unknown',
    title: d.title ?? null,
    company: d.company ?? null,
    type: 'discovered' as const,
    warmth: d.discovery_score ?? 30,
    linkedinUrl: d.linkedin_url,
  }))

  // Build adjacency: contact → discovered via connections table
  const contactToDiscovered = new Map<string, string[]>()
  for (const conn of connections) {
    if (conn.source_type === 'contact' && conn.target_type === 'discovered_person') {
      const key = `contact:${conn.source_id}`
      if (!contactToDiscovered.has(key)) contactToDiscovered.set(key, [])
      contactToDiscovered.get(key)!.push(`discovered:${conn.target_id}`)
    }
  }

  // For discovered people, also use discovered_from_contact_id
  for (const d of discoveredPeople) {
    if (d.discovered_from_contact_id) {
      const key = `contact:${d.discovered_from_contact_id}`
      if (!contactToDiscovered.has(key)) contactToDiscovered.set(key, [])
      const dKey = `discovered:${d.id}`
      if (!contactToDiscovered.get(key)!.includes(dKey)) {
        contactToDiscovered.get(key)!.push(dKey)
      }
    }
  }

  // 1st degree: direct contact matches
  const directMatches = contactNodes.filter((cn) =>
    matchesTarget(cn.name, cn.title, cn.company)
  )
  for (const match of directMatches.slice(0, 2)) {
    const hop: PathHop = {
      from: userNode,
      to: { ...match, type: 'target' },
      relationshipStrength: match.warmth,
      approachScript: generateApproachScript(userNode, match, true),
    }
    results.push({
      id: crypto.randomUUID(),
      nodes: [userNode, { ...match, type: 'target' }],
      hops: [hop],
      score: scorePath([hop]),
      hopCount: 1,
      totalWarmth: match.warmth,
      summary: `Direct connection — ${match.name} is already in your network`,
    })
  }

  // 1st degree lateral: contact at same company, then target
  if (targetCompany) {
    const lateralContacts = contactNodes.filter(
      (cn) => normalize(cn.company).includes(normalize(targetCompany)) && !matchesTarget(cn.name, cn.title, cn.company)
    )
    for (const lateral of lateralContacts.slice(0, 2)) {
      const targetNode: PathNode = {
        id: 'target-lateral',
        name: targetPerson ?? `${targetRole ?? 'Target'} at ${targetCompany}`,
        title: targetRole ?? null,
        company: targetCompany,
        type: 'target',
        warmth: 50,
      }
      const hop1: PathHop = {
        from: userNode,
        to: lateral,
        relationshipStrength: lateral.warmth,
        approachScript: generateApproachScript(userNode, lateral, true),
      }
      const hop2: PathHop = {
        from: lateral,
        to: targetNode,
        relationshipStrength: 50,
        approachScript: generateApproachScript(lateral, targetNode, false),
      }
      results.push({
        id: crypto.randomUUID(),
        nodes: [userNode, lateral, targetNode],
        hops: [hop1, hop2],
        score: scorePath([hop1, hop2]),
        hopCount: 2,
        totalWarmth: (lateral.warmth + 50) / 2,
        summary: `Via ${lateral.name} — your contact at ${targetCompany}`,
      })
    }
  }

  // 2nd degree: contact → discovered match
  const discoveredMatches = discoveredNodes.filter((dn) =>
    matchesTarget(dn.name, dn.title, dn.company)
  )

  for (const dMatch of discoveredMatches.slice(0, 3)) {
    // Find which contact introduced them
    let bridgeContact: PathNode | null = null
    for (const [contactKey, dKeys] of contactToDiscovered.entries()) {
      if (dKeys.includes(dMatch.id)) {
        bridgeContact = contactNodes.find((cn) => cn.id === contactKey) ?? null
        break
      }
    }

    if (!bridgeContact) {
      // Pick the strongest contact as a bridge
      const sorted = [...contactNodes].sort((a, b) => b.warmth - a.warmth)
      bridgeContact = sorted[0] ?? null
    }

    if (!bridgeContact) continue

    const hop1: PathHop = {
      from: userNode,
      to: bridgeContact,
      relationshipStrength: bridgeContact.warmth,
      approachScript: generateApproachScript(userNode, bridgeContact, true),
    }
    const hop2: PathHop = {
      from: bridgeContact,
      to: { ...dMatch, type: 'target' },
      relationshipStrength: dMatch.warmth,
      approachScript: generateApproachScript(bridgeContact, dMatch, false),
    }
    results.push({
      id: crypto.randomUUID(),
      nodes: [userNode, bridgeContact, { ...dMatch, type: 'target' }],
      hops: [hop1, hop2],
      score: scorePath([hop1, hop2]),
      hopCount: 2,
      totalWarmth: (bridgeContact.warmth + dMatch.warmth) / 2,
      summary: `Via ${bridgeContact.name} → ${dMatch.name}`,
    })
  }

  // 2nd degree lateral: contact → discovered at same company
  if (targetCompany && discoveredMatches.length === 0) {
    const discoveredAtCompany = discoveredNodes.filter(
      (dn) => normalize(dn.company).includes(normalize(targetCompany))
    )
    for (const dPerson of discoveredAtCompany.slice(0, 2)) {
      const sorted = [...contactNodes].sort((a, b) => b.warmth - a.warmth)
      const bridgeContact = sorted[0]
      if (!bridgeContact) continue

      const targetNode: PathNode = {
        id: 'target-2nd-lateral',
        name: targetPerson ?? `${targetRole ?? 'Target'} at ${targetCompany}`,
        title: targetRole ?? null,
        company: targetCompany,
        type: 'target',
        warmth: 40,
      }
      const hop1: PathHop = {
        from: userNode,
        to: bridgeContact,
        relationshipStrength: bridgeContact.warmth,
        approachScript: generateApproachScript(userNode, bridgeContact, true),
      }
      const hop2: PathHop = {
        from: bridgeContact,
        to: dPerson,
        relationshipStrength: dPerson.warmth,
        approachScript: generateApproachScript(bridgeContact, dPerson, false),
      }
      const hop3: PathHop = {
        from: dPerson,
        to: targetNode,
        relationshipStrength: 40,
        approachScript: generateApproachScript(dPerson, targetNode, false),
      }
      results.push({
        id: crypto.randomUUID(),
        nodes: [userNode, bridgeContact, dPerson, targetNode],
        hops: [hop1, hop2, hop3],
        score: scorePath([hop1, hop2, hop3]),
        hopCount: 3,
        totalWarmth: (bridgeContact.warmth + dPerson.warmth + 40) / 3,
        summary: `3-hop path via ${bridgeContact.name} and ${dPerson.name}`,
      })
    }
  }

  // If no real data matched, generate illustrative paths using top contacts
  if (results.length === 0 && contactNodes.length > 0) {
    const top = [...contactNodes].sort((a, b) => b.warmth - a.warmth).slice(0, 3)
    const targetNode: PathNode = {
      id: 'target-illustrative',
      name: targetPerson ?? `${targetRole ?? 'Your Target'}${targetCompany ? ` at ${targetCompany}` : ''}`,
      title: targetRole ?? null,
      company: targetCompany ?? null,
      type: 'target',
      warmth: 50,
    }

    // Direct path via top contact
    if (top[0]) {
      const hop: PathHop = {
        from: userNode,
        to: targetNode,
        relationshipStrength: top[0].warmth,
        approachScript: `Start by reaching out to ${top[0].name}, your strongest connection. Ask who they know in this space and request a warm introduction.`,
      }
      results.push({
        id: crypto.randomUUID(),
        nodes: [userNode, targetNode],
        hops: [hop],
        score: scorePath([hop]),
        hopCount: 1,
        totalWarmth: top[0].warmth,
        summary: `Best estimated path based on your network`,
      })
    }

    // 2-hop path via second contact
    if (top[1]) {
      const hop1: PathHop = {
        from: userNode,
        to: top[1],
        relationshipStrength: top[1].warmth,
        approachScript: generateApproachScript(userNode, top[1], true),
      }
      const hop2: PathHop = {
        from: top[1],
        to: targetNode,
        relationshipStrength: 50,
        approachScript: generateApproachScript(top[1], targetNode, false),
      }
      results.push({
        id: crypto.randomUUID(),
        nodes: [userNode, top[1], targetNode],
        hops: [hop1, hop2],
        score: scorePath([hop1, hop2]),
        hopCount: 2,
        totalWarmth: (top[1].warmth + 50) / 2,
        summary: `Via ${top[1].name}${top[1].company ? ` (${top[1].company})` : ''}`,
      })
    }
  }

  // Sort by score descending, return top 5
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}
