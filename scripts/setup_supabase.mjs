#!/usr/bin/env node
/**
 * Supabase Schema Setup for MESSAIAH
 * Runs SQL migrations via Supabase REST API (service role)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(resolve(__dirname, '../../.config/supabase/messaiah.json'), 'utf-8'));

const SUPABASE_URL = config.url;
const SERVICE_KEY = config.service_role_key;

async function runSQL(sql, label) {
  console.log(`\n▸ ${label}...`);
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  // The REST RPC approach may not work for raw SQL. 
  // Use the SQL editor endpoint instead.
  if (!resp.ok) {
    // Fallback: use the management API or pg directly
    console.log(`  REST RPC failed (${resp.status}), trying pg...`);
    return false;
  }
  console.log(`  ✓ ${label} done`);
  return true;
}

// We'll use the Supabase Management API instead
async function runMigration(sql, label) {
  console.log(`\n▸ ${label}...`);
  
  // Use the /pg endpoint (available via service role on newer Supabase)
  // Or just output the SQL for manual execution
  console.log('SQL to execute:');
  console.log(sql);
  console.log('---');
  return true;
}

const SCHEMA_SQL = `
-- ============================================
-- MESSAIAH Database Schema
-- ============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES (user settings & goals)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  company TEXT,
  industry TEXT,
  linkedin_url TEXT,
  goal TEXT,
  interests JSONB DEFAULT '[]'::jsonb,
  target_roles JSONB DEFAULT '[]'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONTACTS (1st degree — from CSV import)
-- ============================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT,
  full_name TEXT GENERATED ALWAYS AS (
    CASE WHEN last_name IS NOT NULL THEN first_name || ' ' || last_name
    ELSE first_name END
  ) STORED,
  email TEXT,
  company TEXT,
  position TEXT,
  linkedin_url TEXT,
  connected_on DATE,

  -- Enrichment data
  enrichment_status TEXT DEFAULT 'pending' CHECK (enrichment_status IN ('pending', 'enriching', 'enriched', 'failed', 'stale')),
  enriched_at TIMESTAMPTZ,
  
  -- Scores (0-100)
  discovery_score INTEGER DEFAULT 0,
  career_fit_score INTEGER DEFAULT 0,
  connection_strength INTEGER DEFAULT 0,
  strategic_value INTEGER DEFAULT 0,
  
  -- Relationship classification
  relationship_type TEXT DEFAULT 'peer' CHECK (relationship_type IN ('peer', 'mentor', 'sponsor', 'prospect', 'dormant', 'unknown')),
  
  -- Enriched profile data
  bio TEXT,
  headline TEXT,
  location TEXT,
  avatar_url TEXT,
  work_history JSONB DEFAULT '[]'::jsonb,
  education JSONB DEFAULT '[]'::jsonb,
  skills JSONB DEFAULT '[]'::jsonb,
  
  -- Digital footprint
  social_profiles JSONB DEFAULT '{}'::jsonb,  -- {twitter, github, medium, substack, etc}
  recent_activity JSONB DEFAULT '[]'::jsonb,  -- [{type, title, url, date, summary}]
  
  -- AI intelligence
  ai_summary TEXT,
  talking_points JSONB DEFAULT '[]'::jsonb,
  outreach_suggestions JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  tags JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  last_interaction DATE,
  next_action TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DISCOVERED_PEOPLE (2nd/3rd degree connections)
-- ============================================
CREATE TABLE IF NOT EXISTS discovered_people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Basic info
  name TEXT NOT NULL,
  title TEXT,
  company TEXT,
  linkedin_url TEXT,
  email TEXT,
  
  -- How discovered
  discovered_via TEXT NOT NULL, -- 'apollo_search', 'ddg_search', 'mutual_reference', 'company_crawl'
  discovered_from_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  connection_degree INTEGER DEFAULT 2 CHECK (connection_degree IN (2, 3)),
  
  -- Enrichment
  enrichment_status TEXT DEFAULT 'pending',
  discovery_score INTEGER DEFAULT 0,
  career_fit_score INTEGER DEFAULT 0,
  strategic_value INTEGER DEFAULT 0,
  
  -- Profile
  bio TEXT,
  work_history JSONB DEFAULT '[]'::jsonb,
  social_profiles JSONB DEFAULT '{}'::jsonb,
  recent_activity JSONB DEFAULT '[]'::jsonb,
  ai_summary TEXT,
  talking_points JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate people per user
  UNIQUE(user_id, linkedin_url)
);

-- ============================================
-- CONNECTIONS (edges in the network graph)
-- ============================================
CREATE TABLE IF NOT EXISTS connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Flexible edge: can connect contacts, discovered_people, or the user themselves
  source_type TEXT NOT NULL CHECK (source_type IN ('user', 'contact', 'discovered')),
  source_id UUID,  -- NULL when source_type = 'user'
  target_type TEXT NOT NULL CHECK (target_type IN ('contact', 'discovered')),
  target_id UUID NOT NULL,
  
  -- Relationship metadata
  relationship TEXT,  -- 'colleague', 'classmate', 'reports_to', 'worked_with', etc
  strength INTEGER DEFAULT 50,  -- 0-100
  evidence TEXT,  -- How we determined this connection
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate edges
  UNIQUE(user_id, source_type, source_id, target_type, target_id)
);

-- ============================================
-- ENRICHMENT_JOBS (background processing queue)
-- ============================================
CREATE TABLE IF NOT EXISTS enrichment_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- What to enrich
  target_type TEXT NOT NULL CHECK (target_type IN ('contact', 'discovered_person', 'company', 'path_query')),
  target_id UUID NOT NULL,
  
  -- Job lifecycle
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  priority INTEGER DEFAULT 5,  -- 1 = highest, 10 = lowest
  
  -- Enrichment phases
  phases JSONB DEFAULT '{}'::jsonb,
  -- e.g. {"ddg_search": "done", "digital_footprint": "running", "ai_scoring": "pending"}
  
  -- Results tracking
  sources_tried JSONB DEFAULT '[]'::jsonb,
  sources_succeeded JSONB DEFAULT '[]'::jsonb,
  error_log JSONB DEFAULT '[]'::jsonb,
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Retry logic
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ
);

-- ============================================
-- FEED_ITEMS (AI-generated action items)
-- ============================================
CREATE TABLE IF NOT EXISTS feed_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  type TEXT NOT NULL CHECK (type IN (
    'outreach', 'follow_up', 'congratulate', 'warm_intro',
    'event', 'content_share', 'path_opportunity', 'insight'
  )),
  
  title TEXT NOT NULL,
  description TEXT,
  rationale TEXT,  -- Why this matters
  tactics TEXT,    -- What to say/do
  
  -- Related entities
  related_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  related_discovered_id UUID REFERENCES discovered_people(id) ON DELETE SET NULL,
  related_path_query TEXT,
  
  -- State
  is_completed BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  priority TEXT DEFAULT 'mid' CHECK (priority IN ('high', 'mid', 'low')),
  
  -- Timing
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PATH_QUERIES (saved "find me a route to X")
-- ============================================
CREATE TABLE IF NOT EXISTS path_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Query
  query_text TEXT NOT NULL,  -- "Product Director at Google"
  target_role TEXT,
  target_company TEXT,
  target_industry TEXT,
  target_person TEXT,
  
  -- Results
  paths JSONB DEFAULT '[]'::jsonb,
  -- [{hops: [{person_id, person_name, relationship, approach_script}], warmth: 85, feasibility: 70}]
  
  best_path_score INTEGER DEFAULT 0,
  
  -- State
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'searching', 'found', 'no_paths', 'failed')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CHAT_MESSAGES (AI command center history)
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  
  -- Context that was active when message was sent
  active_context TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_enrichment_status ON contacts(user_id, enrichment_status);
CREATE INDEX IF NOT EXISTS idx_contacts_career_fit ON contacts(user_id, career_fit_score DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_strategic_value ON contacts(user_id, strategic_value DESC);
CREATE INDEX IF NOT EXISTS idx_discovered_user_id ON discovered_people(user_id);
CREATE INDEX IF NOT EXISTS idx_connections_user_id ON connections(user_id);
CREATE INDEX IF NOT EXISTS idx_connections_source ON connections(user_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_connections_target ON connections(user_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue ON enrichment_jobs(user_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_feed_user_active ON feed_items(user_id, is_completed, is_dismissed);
CREATE INDEX IF NOT EXISTS idx_chat_user_id ON chat_messages(user_id, created_at);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovered_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE path_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Profiles: users can CRUD their own
CREATE POLICY "Users manage own profile" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Contacts: users can CRUD their own
CREATE POLICY "Users manage own contacts" ON contacts
  FOR ALL USING (auth.uid() = user_id);

-- Discovered people: users can CRUD their own
CREATE POLICY "Users manage own discovered people" ON discovered_people
  FOR ALL USING (auth.uid() = user_id);

-- Connections: users can CRUD their own
CREATE POLICY "Users manage own connections" ON connections
  FOR ALL USING (auth.uid() = user_id);

-- Enrichment jobs: users can CRUD their own
CREATE POLICY "Users manage own enrichment jobs" ON enrichment_jobs
  FOR ALL USING (auth.uid() = user_id);

-- Feed items: users can CRUD their own
CREATE POLICY "Users manage own feed items" ON feed_items
  FOR ALL USING (auth.uid() = user_id);

-- Path queries: users can CRUD their own
CREATE POLICY "Users manage own path queries" ON path_queries
  FOR ALL USING (auth.uid() = user_id);

-- Chat messages: users can CRUD their own
CREATE POLICY "Users manage own chat messages" ON chat_messages
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
DROP TRIGGER IF EXISTS contacts_updated_at ON contacts;
CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS discovered_people_updated_at ON discovered_people;
CREATE TRIGGER discovered_people_updated_at
  BEFORE UPDATE ON discovered_people
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS path_queries_updated_at ON path_queries;
CREATE TRIGGER path_queries_updated_at
  BEFORE UPDATE ON path_queries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
`;

console.log('=== MESSAIAH Supabase Schema ===\n');
console.log('Copy and paste the following SQL into your Supabase SQL Editor');
console.log('(Dashboard → SQL Editor → New query → Paste → Run)\n');
console.log('Or use this script to apply via the Supabase API.\n');
console.log(SCHEMA_SQL);

// Write the SQL to a file for easy access
import { writeFileSync } from 'fs';
writeFileSync(resolve(__dirname, 'schema.sql'), SCHEMA_SQL);
console.log('\n✓ Schema SQL also saved to scripts/schema.sql');
