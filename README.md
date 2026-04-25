# MESSAIAH

**Your personal AI-powered network intelligence platform.**

MESSAIAH turns your LinkedIn connections into a living, enriched relationship graph — scoring contacts, surfacing hidden paths, and telling you exactly who to reach out to and why.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + Vite + TypeScript (strict) |
| Styling | Tailwind CSS v4 (dark theme, CSS variables) |
| State | Zustand |
| Routing | React Router v7 |
| Animation | Framer Motion |
| Graph | react-force-graph-2d |
| Backend | Supabase (Postgres + Auth + Realtime) |
| Icons | Lucide React |
| Enrichment | Apollo People Search (free) + DuckDuckGo SERP |

---

## Features

| Feature | Description |
|---|---|
| **Contact Graph** | Force-directed network graph of your LinkedIn connections with clustering, filtering, and click-to-explore |
| **Contact Enrichment** | Automated enrichment pipeline: DDG profile → social footprint → Apollo colleagues → AI scoring |
| **AI Scoring** | Four scores per contact: Discovery, Career Fit, Connection Strength, Strategic Value |
| **Path Finder** | Find the shortest introduction path between you and any target person |
| **Command Center** | Natural-language chat interface to query your network |
| **Contact Detail** | Full enrichment view: bio, work history, education, skills, AI summary, talking points, social links |
| **CSV Import** | Import LinkedIn connections CSV directly (no OAuth required) |
| **Onboarding** | Goal-setting wizard to personalise scoring and recommendations |

---

## Setup

### Prerequisites

- Node.js 20+ (or 25+ for latest)
- A [Supabase](https://supabase.com) project (free tier works)

### 1. Clone & Install

```bash
git clone <repo-url>
cd messaiah
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env — fill in your Supabase URL and anon key
```

See [`.env.example`](.env.example) for all required variables and documentation.

### 3. Set Up Supabase

1. Create a project at [app.supabase.com](https://app.supabase.com)
2. Enable **Google OAuth** and **Magic Link** in Authentication → Providers
3. Run the SQL migrations from `supabase/migrations/` in the SQL Editor (or use Supabase CLI)
4. Enable Row Level Security on all tables (migrations handle this)

### 4. Run Locally

```bash
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173)

### 5. Build for Production

```bash
npm run build
# Output → dist/
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ server-only | For enrichment workers only — never expose in browser |

See `.env.example` for the full list with comments.

---

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Layout.tsx       # App shell (sidebar + header)
│   ├── UserMenu.tsx     # User avatar + dropdown
│   ├── ContactDetailPanel.tsx  # Full contact detail slide-in
│   ├── EnrichmentBadge.tsx     # Status pill with color coding
│   └── ...
├── pages/               # Route-level pages
│   ├── DashboardPage.tsx
│   ├── ContactsPage.tsx
│   ├── GraphPage.tsx
│   ├── PathFinderPage.tsx
│   ├── CommandCenterPage.tsx
│   └── ...
├── stores/              # Zustand state stores
│   ├── authStore.ts
│   ├── contactStore.ts
│   └── uiStore.ts
├── types/               # TypeScript type definitions
│   ├── database.ts      # Supabase schema types
│   └── enrichment.ts    # Enrichment pipeline types
├── services/            # API + enrichment services
├── hooks/               # Custom React hooks
└── lib/                 # Supabase client + utilities
```

---

## Enrichment Pipeline

MESSAIAH uses **zero paid API credits** by default:

1. **DDG Profile** — DuckDuckGo search for public profile info
2. **DDG Footprint** — Social media + web presence discovery
3. **DDG Activity** — Recent news, posts, and events
4. **Apollo Colleagues** — Free Apollo People Search for 2nd-degree connections
5. **AI Scoring** — Scores and talking points generation

---

## Deployment

The app is a standard Vite SPA. Deploy the `dist/` folder to:

- **Vercel** — `vercel --prod`
- **Netlify** — drag & drop `dist/` or CI
- **Railway** — push to GitHub branch, auto-deploy
- **Cloudflare Pages** — connect GitHub repo

Set the same env vars in your hosting provider's dashboard.

---

## License

Private / proprietary. All rights reserved.
