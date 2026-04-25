import Papa from 'papaparse'
import { supabase } from '../lib/supabase'

export interface ImportSummary {
  total: number
  imported: number
  skipped: number
  errors: number
  errorDetails: string[]
}

export interface CSVRow {
  'First Name': string
  'Last Name': string
  'URL': string
  'Email Address': string
  'Company': string
  'Position': string
  'Connected On': string
}

export interface ParsedContact {
  first_name: string | null
  last_name: string | null
  email: string | null
  company: string | null
  position: string | null
  linkedin_url: string | null
  connected_on: string | null
  enrichment_status: 'pending'
}

export type ProgressCallback = (progress: number, message: string) => void

/**
 * Parse "22 Nov 2025" → "2025-11-22"
 */
function parseConnectedOn(raw: string): string | null {
  if (!raw || !raw.trim()) return null
  try {
    const d = new Date(raw.trim())
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0]
    }
    return null
  } catch {
    return null
  }
}

function normalizeLinkedInUrl(url: string): string | null {
  if (!url || !url.trim()) return null
  const trimmed = url.trim()
  // Ensure it starts with https://
  if (trimmed.startsWith('http')) return trimmed
  if (trimmed.startsWith('linkedin.com')) return `https://www.${trimmed}`
  return trimmed
}

/**
 * Parse a LinkedIn Connections.csv file.
 * LinkedIn puts 3 header/note lines before the actual CSV data.
 * Returns an array of ParsedContact objects.
 */
export function parseLinkedInCSV(file: File): Promise<ParsedContact[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      // Skip first 3 lines (LinkedIn header/notes)
      const lines = text.split('\n')
      const csvContent = lines.slice(3).join('\n')

      Papa.parse<CSVRow>(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
        transform: (v) => v.trim(),
        complete: (results) => {
          const contacts: ParsedContact[] = results.data
            .filter((row) => row['First Name'] || row['Last Name'])
            .map((row) => ({
              first_name: row['First Name'] || null,
              last_name: row['Last Name'] || null,
              email: row['Email Address'] || null,
              company: row['Company'] || null,
              position: row['Position'] || null,
              linkedin_url: normalizeLinkedInUrl(row['URL']),
              connected_on: parseConnectedOn(row['Connected On']),
              enrichment_status: 'pending' as const,
            }))
          resolve(contacts)
        },
        error: (err: { message: string }) => reject(new Error(err.message)),
      })
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

/**
 * Parse raw text (for preview without a File object).
 */
export function parseLinkedInCSVText(text: string): ParsedContact[] {
  const lines = text.split('\n')
  const csvContent = lines.slice(3).join('\n')

  const results = Papa.parse<CSVRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  })

  return results.data
    .filter((row) => row['First Name'] || row['Last Name'])
    .map((row) => ({
      first_name: row['First Name'] || null,
      last_name: row['Last Name'] || null,
      email: row['Email Address'] || null,
      company: row['Company'] || null,
      position: row['Position'] || null,
      linkedin_url: normalizeLinkedInUrl(row['URL']),
      connected_on: parseConnectedOn(row['Connected On']),
      enrichment_status: 'pending' as const,
    }))
}

/**
 * Import contacts from a LinkedIn CSV file into Supabase.
 * - Deduplicates by linkedin_url
 * - Batches upserts in groups of 50
 * - Reports progress via callback
 */
export async function importLinkedInCSV(
  file: File,
  userId: string,
  onProgress?: ProgressCallback
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    total: 0,
    imported: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
  }

  onProgress?.(0, 'Parsing CSV...')

  let contacts: ParsedContact[]
  try {
    contacts = await parseLinkedInCSV(file)
  } catch (err) {
    throw new Error(`Failed to parse CSV: ${(err as Error).message}`)
  }

  summary.total = contacts.length
  if (contacts.length === 0) {
    onProgress?.(100, 'No contacts found in file')
    return summary
  }

  onProgress?.(5, `Found ${contacts.length} contacts. Checking for duplicates...`)

  // Fetch existing linkedin_urls for this user to dedup client-side
  const { data: existing } = await supabase
    .from('contacts')
    .select('linkedin_url')
    .eq('user_id', userId)
    .not('linkedin_url', 'is', null)

  const existingUrls = new Set<string>(
    (existing ?? []).map((r: { linkedin_url: string | null }) => r.linkedin_url ?? '')
  )

  // Filter contacts — skip those already imported (by linkedin_url)
  const toImport = contacts.filter((c) => {
    if (!c.linkedin_url) return true // no URL → always import
    return !existingUrls.has(c.linkedin_url)
  })

  summary.skipped = contacts.length - toImport.length

  if (toImport.length === 0) {
    onProgress?.(100, 'All contacts already imported')
    return summary
  }

  onProgress?.(10, `Importing ${toImport.length} new contacts...`)

  // Batch upsert in groups of 50
  const BATCH_SIZE = 50
  const batches = Math.ceil(toImport.length / BATCH_SIZE)

  for (let i = 0; i < batches; i++) {
    const batch = toImport.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
    const rows = batch.map((c) => ({
      user_id: userId,
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
      company: c.company,
      position: c.position,
      linkedin_url: c.linkedin_url,
      connected_on: c.connected_on,
      enrichment_status: c.enrichment_status,
    }))

    const { error } = await supabase
      .from('contacts')
      .upsert(rows, { onConflict: 'linkedin_url', ignoreDuplicates: false })

    if (error) {
      summary.errors += batch.length
      summary.errorDetails.push(`Batch ${i + 1}: ${error.message}`)
    } else {
      summary.imported += batch.length
    }

    const progress = 10 + Math.round(((i + 1) / batches) * 90)
    onProgress?.(progress, `Imported batch ${i + 1}/${batches}...`)
  }

  onProgress?.(100, 'Import complete!')
  return summary
}

/**
 * Get a preview of the first N rows from a file (before importing).
 */
export async function previewCSV(file: File, maxRows = 5): Promise<ParsedContact[]> {
  const contacts = await parseLinkedInCSV(file)
  return contacts.slice(0, maxRows)
}
