import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { findPaths, parseQuery } from '../services/pathFinder'
import type { PathResult, ParsedQuery } from '../services/pathFinder'
import type { Contact, DiscoveredPerson, Connection } from '../types/database'

interface UsePathFinderState {
  query: string
  parsed: ParsedQuery | null
  results: PathResult[]
  loading: boolean
  error: string | null
  savedQueryId: string | null
}

export function usePathFinder() {
  const [state, setState] = useState<UsePathFinderState>({
    query: '',
    parsed: null,
    results: [],
    loading: false,
    error: null,
    savedQueryId: null,
  })

  const setQuery = useCallback((q: string) => {
    setState((prev) => ({ ...prev, query: q }))
  }, [])

  const search = useCallback(async (queryText: string) => {
    if (!queryText.trim()) return

    setState((prev) => ({ ...prev, loading: true, error: null, results: [], savedQueryId: null }))

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const parsed = parseQuery(queryText)
      setState((prev) => ({ ...prev, parsed }))

      // Fetch graph data in parallel
      const [contactsRes, discoveredRes, connectionsRes] = await Promise.all([
        supabase
          .from('contacts')
          .select('*')
          .eq('user_id', user.id)
          .limit(500),
        supabase
          .from('discovered_people')
          .select('*')
          .eq('user_id', user.id)
          .limit(500),
        supabase
          .from('connections')
          .select('*')
          .eq('user_id', user.id)
          .limit(1000),
      ])

      const contacts: Contact[] = contactsRes.data ?? []
      const discoveredPeople: DiscoveredPerson[] = discoveredRes.data ?? []
      const connections: Connection[] = connectionsRes.data ?? []

      // Run path finding
      const pathResults = findPaths(parsed, contacts, discoveredPeople, connections)

      // Save query + results to Supabase
      const bestScore = pathResults[0]?.score ?? null
      const { data: savedQuery, error: saveError } = await supabase
        .from('path_queries')
        .insert({
          user_id: user.id,
          query_text: queryText,
          target_role: parsed.targetRole,
          target_company: parsed.targetCompany,
          target_person: parsed.targetPerson,
          paths: pathResults as unknown as import('../types/database').Json,
          best_path_score: bestScore,
          status: 'completed',
        })
        .select('id')
        .single()

      if (saveError) {
        console.warn('Failed to save path query:', saveError.message)
      }

      setState((prev) => ({
        ...prev,
        results: pathResults,
        savedQueryId: savedQuery?.id ?? null,
        loading: false,
      }))
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'An error occurred',
        loading: false,
      }))
    }
  }, [])

  const bookmarkPath = useCallback(
    async (pathResult: PathResult) => {
      if (!state.savedQueryId) return
      // Upsert the bookmark as a feed item for future action
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      await supabase.from('feed_items').insert({
        user_id: user.id,
        type: 'introduction',
        title: `Path saved: ${pathResult.summary}`,
        description: `${pathResult.hopCount} hop path with score ${pathResult.score}`,
        rationale: `Bookmarked from Path Finder`,
        related_path_query: state.savedQueryId,
        is_completed: false,
        is_dismissed: false,
        priority: Math.round(pathResult.score / 10),
      })
    },
    [state.savedQueryId]
  )

  const reset = useCallback(() => {
    setState({
      query: '',
      parsed: null,
      results: [],
      loading: false,
      error: null,
      savedQueryId: null,
    })
  }, [])

  return {
    ...state,
    setQuery,
    search,
    bookmarkPath,
    reset,
  }
}
