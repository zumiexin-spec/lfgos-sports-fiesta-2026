# LFGOS Sports Fiesta 2026 — Official Public Portal

Official read-only Progressive Web App (PWA) and live feed service for the **Little Flower Group of Schools (LFGOS) Sports Fiesta 2026**.

- **Venue:** Dr. Bhimrao Ambedkar Sports Stadium, Mau, Uttar Pradesh
- **Match Days:**
  - **13 Nov 2026:** Cricket Day 1
  - **14 Nov 2026:** All other events, Finals & Official Live Stream
- **Official Contact:** [https://lfcsschools.com/](https://lfcsschools.com/)
- **Theme Support:** Light, Dark, Auto (System Default)

## Key Technical Features
1. **Zero Client Secrets:** The browser code never holds tokens, API keys, or SDK clients. All public requests call `/api/public_feed`.
2. **Deterministic Scoring:** Real-time points calculated directly from PointsLedger excluding reversed entries; medals strictly from approved results.
3. **Animated Logo Experience:** Session-scoped (max 1.8s) SVG progress ring splash, topbar pop and idle sheens, live moment Action Orange pulse.
4. **Vercel Serverless Ready:** Mumbai (`bom1`) edge deployment with immutable content-hashed asset caching, stale-while-revalidate public feed, and strict CSP headers.

## Quick Start (Local Development)
```bash
# 1. Install dependencies
npm install

# 2. Build production assets
npm run build

# 3. Start local development server
npm run dev
# Server runs on http://localhost:3000
```

## Testing & Quality Assurance
```bash
# Run unit tests and mock upstream sync tests
npm test

# Run full Playwright UI & axe-core accessibility audit
npm run test:ui
```
