#!/usr/bin/env node
/**
 * Apply schema to Supabase via the SQL endpoint
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(resolve(__dirname, '../../.config/supabase/messaiah.json'), 'utf-8'));

const SUPABASE_URL = config.url;
const SERVICE_KEY = config.service_role_key;
const sql = readFileSync(resolve(__dirname, 'schema.sql'), 'utf-8');

// Split into individual statements and run via PostgREST rpc
// Actually, the cleanest way is to use the /pg endpoint or the management API

// Method: Use the Supabase SQL API (available via service role)
async function applySchemaDirect() {
  // The Supabase project has a pg connection string we can use
  // Format: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
  const ref = 'xnwzvcfseuptqovyagom';
  const password = config.db_password;
  
  // Try using the REST SQL endpoint first
  console.log('Applying schema via Supabase REST...');
  
  // Split SQL into individual statements
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 10);
  
  let success = 0;
  let failed = 0;
  
  for (const stmt of statements) {
    try {
      // Use the PostgREST rpc endpoint - won't work for DDL
      // Instead, use fetch to the /rest/v1/ with raw SQL header
      // Actually the best approach for DDL is the Supabase Management API
      
      // Supabase exposes a /query endpoint via the management API
      // But that requires the management API key, not the service role key
      
      // The most reliable approach: use pg directly
      // Let's just output psql command
    } catch (e) {
      // 
    }
  }
  
  // Output the psql connection command
  console.log('\n=== Direct Database Connection ===');
  console.log(`Connection string: postgresql://postgres.${ref}:${password}@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`);
  console.log('\nTo apply schema:');
  console.log(`psql "postgresql://postgres.${ref}:${password}@aws-0-eu-west-2.pooler.supabase.com:6543/postgres" -f scripts/schema.sql`);
}

applySchemaDirect();
