// Auto-generated types matching the Supabase schema

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type EnrichmentStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
export type RelationshipType = 'colleague' | 'mentor' | 'mentee' | 'recruiter' | 'hiring_manager' | 'peer' | 'friend' | 'acquaintance' | 'other'
export type ConnectionDegree = 1 | 2 | 3
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'retrying'
export type FeedItemType = 'outreach' | 'follow_up' | 'introduction' | 'reconnect' | 'opportunity' | 'alert'
export type PathQueryStatus = 'pending' | 'running' | 'completed' | 'failed'
export type ChatRole = 'user' | 'assistant' | 'system'

export interface Profile {
  id: string // uuid
  name: string | null
  title: string | null
  company: string | null
  industry: string | null
  linkedin_url: string | null
  goal: string | null
  interests: Json | null
  target_roles: Json | null
  settings: Json | null
  created_at?: string
  updated_at?: string
}

export interface Contact {
  id: string // uuid
  user_id: string
  first_name: string | null
  last_name: string | null
  full_name: string | null // generated column
  email: string | null
  company: string | null
  position: string | null
  linkedin_url: string | null
  connected_on: string | null // date
  enrichment_status: EnrichmentStatus | null
  enriched_at: string | null
  discovery_score: number | null
  career_fit_score: number | null
  connection_strength: number | null
  strategic_value: number | null
  relationship_type: RelationshipType | null
  bio: string | null
  headline: string | null
  location: string | null
  avatar_url: string | null
  work_history: Json | null
  education: Json | null
  skills: Json | null
  social_profiles: Json | null
  recent_activity: Json | null
  ai_summary: string | null
  talking_points: Json | null
  outreach_suggestions: Json | null
  tags: Json | null
  notes: string | null
  last_interaction: string | null
  next_action: string | null
  created_at?: string
  updated_at?: string
}

export interface DiscoveredPerson {
  id: string
  user_id: string
  name: string | null
  title: string | null
  company: string | null
  linkedin_url: string | null
  email: string | null
  discovered_via: string | null
  discovered_from_contact_id: string | null
  connection_degree: ConnectionDegree | null
  enrichment_status: EnrichmentStatus | null
  discovery_score: number | null
  career_fit_score: number | null
  strategic_value: number | null
  bio: string | null
  work_history: Json | null
  social_profiles: Json | null
  recent_activity: Json | null
  ai_summary: string | null
  talking_points: Json | null
  created_at?: string
  updated_at?: string
}

export interface Connection {
  id: string
  user_id: string
  source_type: string
  source_id: string
  target_type: string
  target_id: string
  relationship: string | null
  strength: number | null
  evidence: Json | null
  created_at?: string
}

export interface EnrichmentJob {
  id: string
  user_id: string
  target_type: string
  target_id: string
  status: JobStatus
  priority: number | null
  phases: Json | null
  sources_tried: string[] | null
  sources_succeeded: string[] | null
  error_log: Json | null
  started_at: string | null
  completed_at: string | null
  attempt_count: number
  max_attempts: number
  next_retry_at: string | null
  created_at?: string
  updated_at?: string
}

export interface FeedItem {
  id: string
  user_id: string
  type: FeedItemType
  title: string
  description: string | null
  rationale: string | null
  tactics: Json | null
  related_contact_id: string | null
  related_discovered_id: string | null
  related_path_query: string | null
  is_completed: boolean
  is_dismissed: boolean
  priority: number | null
  due_date: string | null
  completed_at: string | null
  created_at?: string
  updated_at?: string
}

export interface PathQuery {
  id: string
  user_id: string
  query_text: string | null
  target_role: string | null
  target_company: string | null
  target_industry: string | null
  target_person: string | null
  paths: Json | null
  best_path_score: number | null
  status: PathQueryStatus
  created_at?: string
  updated_at?: string
}

export interface ChatMessage {
  id: string
  user_id: string
  role: ChatRole
  content: string
  active_context: Json | null
  created_at?: string
}

// Database type for Supabase client
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'full_name'>
        Update: Partial<Omit<Profile, 'id'>>
      }
      contacts: {
        Row: Contact
        Insert: Omit<Contact, 'id' | 'full_name' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Contact, 'id' | 'full_name'>>
      }
      discovered_people: {
        Row: DiscoveredPerson
        Insert: Omit<DiscoveredPerson, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<DiscoveredPerson, 'id'>>
      }
      connections: {
        Row: Connection
        Insert: Omit<Connection, 'id' | 'created_at'>
        Update: Partial<Omit<Connection, 'id'>>
      }
      enrichment_jobs: {
        Row: EnrichmentJob
        Insert: Omit<EnrichmentJob, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<EnrichmentJob, 'id'>>
      }
      feed_items: {
        Row: FeedItem
        Insert: Omit<FeedItem, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<FeedItem, 'id'>>
      }
      path_queries: {
        Row: PathQuery
        Insert: Omit<PathQuery, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<PathQuery, 'id'>>
      }
      chat_messages: {
        Row: ChatMessage
        Insert: Omit<ChatMessage, 'id' | 'created_at'>
        Update: Partial<Omit<ChatMessage, 'id'>>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      enrichment_status: EnrichmentStatus
      relationship_type: RelationshipType
      job_status: JobStatus
      feed_item_type: FeedItemType
      path_query_status: PathQueryStatus
      chat_role: ChatRole
    }
  }
}
