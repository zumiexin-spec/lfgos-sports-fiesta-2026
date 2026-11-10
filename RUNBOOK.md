# LFGOS Sports Fiesta 2026 — Tournament Operations Runbook

## 1. Architecture Overview
```
Browser (PWA)
   │ (Read-Only GET /api/public_feed with ETag)
   ▼
Vercel Serverless Lambda (bom1 Mumbai)
   │ (Cached 15s in memory, ETag validation)
   │ (Server-side credentials in Vercel Environment Variables)
   ▼
Base44 Backend Tables & Functions
   ├── School
   ├── SportEvent
   ├── TeamCompetition
   ├── EventResult (Approved results only)
   ├── Fixture (Completed winners only)
   ├── PointsLedger (Reversed entries strictly excluded)
   ├── MediaItem (Approved & consent_approved only)
   └── DisplayState
```

## 2. Deployment Instructions (Vercel)
```bash
# Install Vercel CLI if needed
npm install -g vercel

# Deploy to Vercel Preview
vercel

# Deploy to Vercel Production
vercel --prod
```

### Required Environment Variables in Vercel Project Settings:
- `BASE44_APP_ID`: Base44 Application ID
- `BASE44_APP_SECRET`: Base44 Read-Only Secret Token
- `NODE_ENV`: `production`

## 3. Live Matchday Procedures
- **13 Nov 2026 (Cricket Day 1):** Live arena displays scheduled broadcast placeholder ("Starts 14 Nov 2026 at 09:00 AM IST"). Cricket matches and scores update live.
- **14 Nov 2026 (Grand Championship):** YouTube Live Stream activates automatically when stream status is set to `live` in Base44 DisplayState.
