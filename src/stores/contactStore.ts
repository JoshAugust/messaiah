import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Contact, DiscoveredPerson } from '../types/database'

export type ContactFilter = {
  search: string
  enrichmentStatus: string | null
  relationshipType: string | null
  minScore: number | null
  tags: string[]
  sortBy: 'name' | 'score' | 'connected_on' | 'last_interaction'
  sortDir: 'asc' | 'desc'
}

interface ContactState {
  contacts: Contact[]
  discoveredPeople: DiscoveredPerson[]
  selectedContact: Contact | null
  filters: ContactFilter
  loading: boolean
  error: string | null
  totalCount: number

  // Actions
  fetchContacts: () => Promise<void>
  fetchDiscoveredPeople: () => Promise<void>
  selectContact: (contact: Contact | null) => void
  updateContact: (id: string, updates: Partial<Contact>) => Promise<void>
  deleteContact: (id: string) => Promise<void>
  setFilter: (filter: Partial<ContactFilter>) => void
  resetFilters: () => void
}

const defaultFilters: ContactFilter = {
  search: '',
  enrichmentStatus: null,
  relationshipType: null,
  minScore: null,
  tags: [],
  sortBy: 'name',
  sortDir: 'asc',
}

export const useContactStore = create<ContactState>((set, get) => ({
  contacts: [],
  discoveredPeople: [],
  selectedContact: null,
  filters: defaultFilters,
  loading: false,
  error: null,
  totalCount: 0,

  fetchContacts: async () => {
    set({ loading: true, error: null })
    try {
      const { filters } = get()
      let query = supabase.from('contacts').select('*', { count: 'exact' })

      if (filters.search) {
        query = query.or(
          `full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,company.ilike.%${filters.search}%`
        )
      }
      if (filters.enrichmentStatus) {
        query = query.eq('enrichment_status', filters.enrichmentStatus)
      }
      if (filters.relationshipType) {
        query = query.eq('relationship_type', filters.relationshipType)
      }
      if (filters.minScore !== null) {
        query = query.gte('discovery_score', filters.minScore)
      }

      const ascending = filters.sortDir === 'asc'
      query = query.order(filters.sortBy === 'name' ? 'full_name' : filters.sortBy, { ascending })

      const { data, error, count } = await query

      if (error) throw error
      set({ contacts: (data as Contact[]) ?? [], totalCount: count ?? 0 })
    } catch (err) {
      set({ error: (err as Error).message })
    } finally {
      set({ loading: false })
    }
  },

  fetchDiscoveredPeople: async () => {
    const { data, error } = await supabase
      .from('discovered_people')
      .select('*')
      .order('discovery_score', { ascending: false })

    if (!error && data) {
      set({ discoveredPeople: data as DiscoveredPerson[] })
    }
  },

  selectContact: (contact) => set({ selectedContact: contact }),

  updateContact: async (id, updates) => {
    const { error } = await supabase
      .from('contacts')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(updates as any)
      .eq('id', id)

    if (!error) {
      set((state) => ({
        contacts: state.contacts.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
      }))
    }
  },

  deleteContact: async (id) => {
    const { error } = await supabase.from('contacts').delete().eq('id', id)
    if (!error) {
      set((state) => ({
        contacts: state.contacts.filter((c) => c.id !== id),
        selectedContact: state.selectedContact?.id === id ? null : state.selectedContact,
      }))
    }
  },

  setFilter: (filter) =>
    set((state) => ({ filters: { ...state.filters, ...filter } })),

  resetFilters: () => set({ filters: defaultFilters }),
}))
