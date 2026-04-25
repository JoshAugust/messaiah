import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { ChatMessage } from '../types/database'

interface UseChatReturn {
  messages: ChatMessage[]
  input: string
  sending: boolean
  error: string | null
  setInput: (v: string) => void
  sendMessage: (text?: string) => Promise<void>
  clearHistory: () => void
  bottomRef: React.RefObject<HTMLDivElement | null>
}

// Normalize string for matching
const lower = (s: string | null | undefined) => (s ?? '').toLowerCase()

// Smart query engine: parse intent and query Supabase
async function generateResponse(userId: string, question: string): Promise<string> {
  const q = question.toLowerCase()

  // --- Intent: contacts at a specific company ---
  const atCompanyMatch = q.match(/(?:connections?|contacts?|people|who).{0,30}(?:at|in|from)\s+([\w\s]+?)(?:\?|$|,)/i)
    ?? q.match(/(?:at|in|from)\s+([\w\s]+?)(?:\?|$|,)/i)

  if (atCompanyMatch && (q.includes('at') || q.includes('who') || q.includes('connect'))) {
    const company = atCompanyMatch[1].trim()
    const { data } = await supabase
      .from('contacts')
      .select('full_name, position, company, connection_strength')
      .eq('user_id', userId)
      .ilike('company', `%${company}%`)
      .order('connection_strength', { ascending: false })
      .limit(10)

    if (data && data.length > 0) {
      const names = data.map((c: { full_name: string | null; position: string | null }) =>
        `• **${c.full_name ?? 'Unknown'}**${c.position ? ` (${c.position})` : ''}`
      ).join('\n')
      return `You have ${data.length} connection${data.length > 1 ? 's' : ''} at **${company}**:\n\n${names}\n\nYour strongest contact there is ${data[0].full_name ?? 'Unknown'}. Want me to draft an outreach message?`
    }
    return `I don't see any direct connections at **${company}** in your network. You may have 2nd-degree contacts there — try the Path Finder to map a route.`
  }

  // --- Intent: strongest connections ---
  if (q.includes('strongest') || q.includes('best connection') || q.includes('closest')) {
    const { data } = await supabase
      .from('contacts')
      .select('full_name, position, company, connection_strength')
      .eq('user_id', userId)
      .not('connection_strength', 'is', null)
      .order('connection_strength', { ascending: false })
      .limit(5)

    if (data && data.length > 0) {
      const list = data.map((c: { full_name: string | null; position: string | null; company: string | null; connection_strength: number | null }, i: number) =>
        `${i + 1}. **${c.full_name ?? 'Unknown'}** — ${c.position ?? 'Unknown role'} at ${c.company ?? 'Unknown company'} (strength: ${c.connection_strength ?? 'N/A'})`
      ).join('\n')
      return `Your top 5 strongest connections are:\n\n${list}\n\nThese are your best starting points for warm introductions.`
    }
    return `I need more data to rank your connections. Try uploading your LinkedIn CSV or running enrichment first.`
  }

  // --- Intent: strategic value / most valuable ---
  if (q.includes('strategic') || q.includes('most valuable') || q.includes('high value') || q.includes('strategic value')) {
    const { data } = await supabase
      .from('contacts')
      .select('full_name, position, company, strategic_value, career_fit_score')
      .eq('user_id', userId)
      .not('strategic_value', 'is', null)
      .order('strategic_value', { ascending: false })
      .limit(5)

    if (data && data.length > 0) {
      const list = data.map((c: { full_name: string | null; position: string | null; company: string | null; strategic_value: number | null; career_fit_score: number | null }, i: number) =>
        `${i + 1}. **${c.full_name ?? 'Unknown'}** — ${c.position ?? 'Unknown role'} at ${c.company ?? 'Unknown company'} (strategic score: ${c.strategic_value ?? 'N/A'})`
      ).join('\n')
      return `Your most strategically valuable contacts:\n\n${list}\n\nI'd prioritize staying warm with these people.`
    }
    return `Strategic value scores haven't been computed yet. Run enrichment to unlock this.`
  }

  // --- Intent: network health summary ---
  if (q.includes('network health') || q.includes('summarize') || q.includes('overview') || q.includes('how is my network')) {
    const [contactsRes, discoveredRes, jobsRes] = await Promise.all([
      supabase.from('contacts').select('id, enrichment_status, connection_strength', { count: 'exact' }).eq('user_id', userId),
      supabase.from('discovered_people').select('id', { count: 'exact' }).eq('user_id', userId),
      supabase.from('enrichment_jobs').select('status').eq('user_id', userId).in('status', ['running', 'pending']),
    ])

    const totalContacts = contactsRes.count ?? contactsRes.data?.length ?? 0
    const totalDiscovered = discoveredRes.count ?? discoveredRes.data?.length ?? 0
    const enrichedCount = contactsRes.data?.filter((c: { enrichment_status: string | null }) => c.enrichment_status === 'completed').length ?? 0
    const avgStrength = contactsRes.data
      ? contactsRes.data.filter((c: { connection_strength: number | null }) => c.connection_strength != null).reduce((sum: number, c: { connection_strength: number | null }) => sum + (c.connection_strength ?? 0), 0) / Math.max(1, enrichedCount)
      : 0
    const activeJobs = jobsRes.data?.length ?? 0

    return `**Network Health Summary**\n\n` +
      `📇 **${totalContacts}** total contacts | **${totalDiscovered}** discovered people\n` +
      `✅ **${enrichedCount}** contacts enriched (${totalContacts > 0 ? Math.round(enrichedCount / totalContacts * 100) : 0}%)\n` +
      `💪 Avg connection strength: **${avgStrength.toFixed(1)}**\n` +
      `⚡ Active enrichment jobs: **${activeJobs}**\n\n` +
      (totalContacts < 50
        ? `Your network is small but targeted. Focus on quality outreach.`
        : totalContacts < 200
        ? `Solid network. Prioritize enriching your top contacts.`
        : `Large network! Use Path Finder to activate the most strategic paths.`)
  }

  // --- Intent: breaking into an industry ---
  const industryMatch = q.match(/break(?:ing)? into\s+([\w\s]+?)(?:\?|$|,)/i)
    ?? q.match(/(?:work(?:ing)? in|get into|enter)\s+([\w\s]+?)(?:\?|$|,)/i)
  if (industryMatch) {
    const industry = industryMatch[1].trim()
    const { data } = await supabase
      .from('contacts')
      .select('full_name, position, company, connection_strength, career_fit_score')
      .eq('user_id', userId)
      .ilike('company', `%${industry}%`)
      .order('career_fit_score', { ascending: false })
      .limit(5)

    if (data && data.length > 0) {
      const list = data.map((c: { full_name: string | null; position: string | null; company: string | null }) =>
        `• **${c.full_name ?? 'Unknown'}** — ${c.position ?? 'Unknown role'} at ${c.company ?? 'Unknown'}`
      ).join('\n')
      return `To break into **${industry}**, start with these contacts:\n\n${list}\n\nI recommend reaching out with a curiosity-first message — ask for a 20-min coffee chat, not a job.`
    }
    return `I don't see direct connections in **${industry}** yet. Use Path Finder to map 2nd-degree routes, or try enriching your discovered contacts.`
  }

  // --- Intent: how many contacts ---
  if (q.includes('how many') && (q.includes('contact') || q.includes('connection') || q.includes('people'))) {
    const { count } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    return `You have **${count ?? 0}** contacts in MESSAIAH. ${(count ?? 0) > 100 ? "That's a solid network to work with." : "Keep building — quality over quantity."}`
  }

  // --- Intent: recent connections ---
  if (q.includes('recent') || q.includes('newest') || q.includes('latest connection')) {
    const { data } = await supabase
      .from('contacts')
      .select('full_name, position, company, connected_on')
      .eq('user_id', userId)
      .not('connected_on', 'is', null)
      .order('connected_on', { ascending: false })
      .limit(5)

    if (data && data.length > 0) {
      const list = data.map((c: { full_name: string | null; position: string | null; company: string | null; connected_on: string | null }) =>
        `• **${c.full_name ?? 'Unknown'}** — ${c.company ?? 'Unknown'}${c.connected_on ? ` (connected ${new Date(c.connected_on).toLocaleDateString()})` : ''}`
      ).join('\n')
      return `Your most recent connections:\n\n${list}`
    }
  }

  // --- Fallback: general help ---
  return `I can help you navigate your network. Try asking:\n\n` +
    `• "Who do I know at Google?"\n` +
    `• "Show me my strongest connections"\n` +
    `• "Who has the most strategic value?"\n` +
    `• "Summarize my network health"\n` +
    `• "How do I break into fintech?"\n\n` +
    `Or use the **Path Finder** tab to map warm intro routes to specific roles or companies.`
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  // Load chat history on mount
  useEffect(() => {
    const loadHistory = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(100)

      if (data) setMessages(data as ChatMessage[])
    }
    loadHistory()
  }, [])

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || sending) return

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setSending(true)
    setInput('')
    setError(null)

    // Optimistically add user message
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      user_id: user.id,
      role: 'user',
      content: text,
      active_context: null,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])

    try {
      // Persist user message
      await supabase.from('chat_messages').insert({
        user_id: user.id,
        role: 'user',
        content: text,
        active_context: null,
      })

      // Generate smart response
      const responseText = await generateResponse(user.id, text)

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        user_id: user.id,
        role: 'assistant',
        content: responseText,
        active_context: null,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMsg])

      // Persist assistant message
      await supabase.from('chat_messages').insert({
        user_id: user.id,
        role: 'assistant',
        content: responseText,
        active_context: null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }, [input, sending])

  const clearHistory = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('chat_messages').delete().eq('user_id', user.id)
    setMessages([])
  }, [])

  return {
    messages,
    input,
    sending,
    error,
    setInput,
    sendMessage,
    clearHistory,
    bottomRef,
  }
}

// Suppress unused import warning
void lower
