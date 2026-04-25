#!/usr/bin/env node
/**
 * Apply schema to Supabase via HTTP (pg-meta API)
 * Uses the /pg/query endpoint available on all Supabase projects
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(resolve(__dirname, '../../.config/supabase/messaiah.json'), 'utf-8'));

const SUPABASE_URL = config.url;
const SERVICE_KEY = config.service_role_key;

async function runQuery(sql, label = '') {
  const resp = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    // Try alternative endpoint
    const resp2 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ sql }),
    });
    
    if (!resp2.ok) {
      console.error(`  ✗ ${label}: ${resp.status} - ${text.substring(0, 200)}`);
      return false;
    }
  }
  
  if (label) console.log(`  ✓ ${label}`);
  return true;
}

async function main() {
  const sql = readFileSync(resolve(__dirname, 'schema.sql'), 'utf-8');
  
  // First try running the whole thing at once
  console.log('Attempting to apply full schema...\n');
  
  const resp = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (resp.ok) {
    console.log('✓ Full schema applied successfully!');
    const data = await resp.json();
    console.log('Response:', JSON.stringify(data).substring(0, 500));
    return;
  }

  // If that didn't work, try splitting into statements
  console.log(`Full schema failed (${resp.status}), trying statement-by-statement...\n`);
  const errorText = await resp.text();
  console.log(`Error: ${errorText.substring(0, 300)}\n`);
  
  // Split by semicolons, keeping multi-line statements together
  // But be careful with function bodies that contain semicolons
  const blocks = [];
  let current = '';
  let inFunction = false;
  
  for (const line of sql.split('\n')) {
    const trimmed = line.trim();
    
    // Track function/trigger bodies
    if (trimmed.match(/^CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/i)) inFunction = true;
    if (inFunction && trimmed.match(/\$\$\s*LANGUAGE/i)) inFunction = false;
    
    current += line + '\n';
    
    if (!inFunction && trimmed.endsWith(';') && current.trim().length > 5) {
      blocks.push(current.trim());
      current = '';
    }
  }
  if (current.trim().length > 5) blocks.push(current.trim());
  
  console.log(`Split into ${blocks.length} statements\n`);
  
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const firstLine = block.split('\n').find(l => l.trim() && !l.trim().startsWith('--')) || `Statement ${i+1}`;
    const label = firstLine.substring(0, 80);
    
    const ok = await runQuery(block, label);
    if (ok) success++;
    else failed++;
    
    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`\nResults: ${success} succeeded, ${failed} failed`);
}

main().catch(console.error);
