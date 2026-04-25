# Build Plan: MESSAIAH — Network Intelligence Platform

## Overview
Full-stack networking intelligence platform. Supabase backend, React frontend, free enrichment pipeline.
Deploy to joshuaaugustine.page/messaiah.

## Constraints
- ZERO paid API credits (no Apollo enrichment, no Orange Slice, no ZoomInfo)
- FREE methods only: Apollo People Search (free), DuckDuckGo, web scraping, public profiles
- Nightwatch patterns for overnight build

## Tasks

### Wave 1 — Foundation (sequential)
- [x] T1: Supabase schema + RLS policies + auth config — DONE ✓ 48/48 statements applied
- [x] T2: Project scaffold — DONE ✓ 20 files, build passing, all pages render

### Wave 2 — Data Layer (parallel, after T2)
- [x] T3: Auth flow — DONE ✓ Login, onboarding, UserMenu, ProtectedRoute enhanced
- [x] T4: CSV import + contact CRUD — DONE ✓ Import service, hooks, enhanced ContactsPage
- [x] T5: Enrichment engine — DONE ✓ 9 files: DDG search, Apollo free, web scraper, AI scorer, pipeline, batch runner, hooks

### Wave 3 — UI Screens (parallel, after T3 + T4)
- [x] T6: Dashboard — DONE ✓ Health ring, stats cards, action feed, opportunity list, CSS charts
- [x] T7: CRM/Contacts — DONE (merged into T4)
- [x] T8: Network graph — DONE ✓ Force graph, node detail panel, controls, legend, zoom

### Wave 4 — Advanced Features (after T5 + T7 + T8)
- [x] T9: Path Finder + Command Center — DONE ✓ BFS graph engine, NL query parser, chat UI, enrichment jobs monitor

### Wave 5 — Polish + Deploy (after all above)
- [x] T11: Integration + polish — DONE ✓ ContactDetailPanel, EnrichmentBadge, UserMenu wired, README
- [ ] T12: Deploy to joshuaaugustine.page/messaiah — Orchestrator

## Parallel Groups
- Wave 1: T1 → T2 (sequential)
- Wave 2: T3, T4, T5 (parallel after T2)
- Wave 3: T6, T7, T8 (parallel after T3 + T4)
- Wave 4: T9, T10 (parallel after T5 + T7 + T8)
- Wave 5: T11 → T12 (sequential, after all)

## Model Assignment
- T1: Orchestrator direct (SQL + API calls)
- T5, T9: Opus (complex reasoning, multi-source integration, graph algorithms)
- All others: Sonnet (UI components, mechanical work)
