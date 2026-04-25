import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Contact, EnrichmentStatus, RelationshipType } from '../types/database'

export type SortField = 'career_fit_score' | 'strategic_value' | 'connected_on' | 'full_name'
export type SortDir = 'asc' | 'desc'

export interface ContactFilters {
  search: string
  enrichmentStatus: EnrichmentStatus | null
  relationshipType: RelationshipType | null
  sortBy: SortField
  sortDir: SortDir
}

export interface UseContactsReturn {
  contacts: Contact[]
  loading: boolean
  error: string | null
  totalCount: number
  page: number
  pageCount: number
  filters: ContactFilters
  setFilters: (f: Partial<ContactFilters>) => void
  setPage: (p: number) => void
  refresh: () => void
  updateContact: (id: string, updates: Partial<Contact>) => Promise<void>
  deleteContact: (id: string) => Promise<void>
}

const PAGE_SIZE = 50

const DEFAULT_FILTERS: ContactFilters = {
  search: '',
  enrichmentStatus: null,
  relationshipType: null,
  sortBy: 'full_name',
  sortDir: 'asc',
}

export function useContacts(userId: string | null): UseContactsReturn {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFiltersState] = useState<ContactFilters>(DEFAULT_FILTERS)
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const setFilters = useCallback((f: Partial<ContactFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...f }))
    setPage(1) // reset to first page on filter change
  }, [])

  const fetchContacts = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)

    try {
      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .range(from, to)

      // Search across name, company, position
      if (filters.search.trim()) {
        const s = filters.search.trim()
        query = query.or(
          `full_name.ilike.%${s}%,company.ilike.%${s}%,position.ilike.%${s}%,email.ilike.%${s}%`
        )
      }

      if (filters.enrichmentStatus) {
        query = query.eq('enrichment_status', filters.enrichmentStatus)
      }

      if (filters.relationshipType) {
        query = query.eq('relationship_type', filters.relationshipType)
      }

      const ascending = filters.sortDir === 'asc'
      query = query.order(filters.sortBy, { ascending, nullsFirst: false })

      const { data, error: fetchError, count } = await query

      if (fetchError) throw fetchError

      setContacts((data as Contact[]) ?? [])
      setTotalCount(count ?? 0)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [userId, page, filters])

  // Subscribe to real-time contact changes
  useEffect(() => {
    if (!userId) return

    // Tear down previous subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe()
    }

    const channel = supabase
      .channel(`contacts:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Refetch on any change
          fetchContacts()
        }
      )
      .subscribe()

    subscriptionRef.current = channel

    return () => {
      channel.unsubscribe()
    }
  }, [userId, fetchContacts])

  // Fetch when deps change
  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  const updateContact = useCallback(async (id: string, updates: Partial<Contact>) => {
    const { error: updateError } = await supabase
      .from('contacts')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(updates as any)
      .eq('id', id)

    if (updateError) throw updateError

    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    )
  }, [])

  const deleteContact = useCallback(async (id: string) => {
    const { error: deleteError } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    setContacts((prev) => prev.filter((c) => c.id !== id))
    setTotalCount((prev) => prev - 1)
  }, [])

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return {
    contacts,
    loading,
    error,
    totalCount,
    page,
    pageCount,
    filters,
    setFilters,
    setPage,
    refresh: fetchContacts,
    updateContact,
    deleteContact,
  }
}

/**
 * Fetch a single contact by ID.
 */
export function useContact(contactId: string | null) {
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!contactId) {
      setContact(null)
      return
    }

    let cancelled = false
    setLoading(true)

    supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single()
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) {
          setError(err.message)
        } else {
          setContact(data as Contact)
        }
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [contactId])

  return { contact, loading, error }
}
