# LFGOS Sports Fiesta 2026 — Tournament Operations Runbook

## 1. System Architecture
```
[Public Browser / PWA]
       │
       │ HTTPS GET /api/public_feed (Strictly single clean URL, zero client secrets)
       ▼
[Vercel Serverless Function (bom1 Mumbai)]
       │
       │ Upstream proxy call with X-Proxy-Key & 8s timeout
       │ Handles Render free-tier cold starts with non-blocking 503 {"warming": true} + waitUntil()
       ▼
[Render API Server (https://lfgos-api.onrender.com)]
       │
       │ Server-to-server internal proxy with constant-time authentication
       ▼
[Base44 Datastore & Functions]
       ├── School
       ├── PointsConfig
       ├── SportEvent
       ├── TeamCompetition
       ├── EventResult (Approved results only)
       ├── Fixture (Both schools confirmed; completed winners only)
       ├── PointsLedger (Reversed rows strictly excluded)
       ├── MediaItem (Approved & consent_approved only, non-logos)
       ├── Announcement (In-window only, no test/probe messages)
       └── LiveSnapshot
```

---

## 2. Local Development & Testing (Windows cmd / PowerShell)

### Prerequisites:
- Node.js >= 18.0.0
- Git

### Commands:
```powershell
# Navigate to deployment directory
cd E:\fiesta-vercel

# Optional: set environment variables in .env
# RENDER_API_BASE=https://lfgos-api.onrender.com
# RENDER_PROXY_KEY=<your-secret-key>

# Run full automated test suite (Unit, Mock Upstream, Real Render Contract, Proxy Security)
npm test

# Build production assets (hashes, bundles, Service Worker)
npm run build

# Start local dev server (calls api/public_feed.js directly, identical to Vercel)
npm run dev

# Run full browser UI & accessibility audit
npm run test:ui
```

---

## 3. Render Proxy Security Patch Instructions

The security patch is provided as a standalone middleware in `lib/render_proxy_patch.js`.

### How to apply on your Render server:
1. Copy `lib/render_proxy_patch.js` into your Render server project (e.g., `src/security_middleware.js`).
2. Add the middleware before any `/v1/*` routes in your Express/Fastify server:
```javascript
const { renderSecurityMiddleware } = require('./lib/render_proxy_patch');

// Apply security middleware to protect upstream data
app.use(renderSecurityMiddleware({
  proxyKey: process.env.PROXY_KEY,
  proxyKeyNext: process.env.PROXY_KEY_NEXT,
  rateLimitWindowMs: 60000,
  maxRequestsPerWindow: 120
}));
```
3. Set the environment variable on Render:
   - `PROXY_KEY`: 32+ character hex or base64url secret (e.g. `openssl rand -hex 32`).
   - `PROXY_KEY_NEXT`: (Optional) Next key for zero-downtime key rotation.

---

## 4. Windows curl Security Checklist (10 Scenarios)

Run these PowerShell / cmd `curl.exe` commands against your Render upstream:

```powershell
$RENDER_URL = "https://lfgos-api.onrender.com"
$SECRET_KEY = "YOUR_PROXY_KEY_HERE"

# 1. /health check without any proxy key (must return 200 OK)
curl.exe -i -s "$RENDER_URL/health"

# 2. /v1/school without proxy key (must return 401 Unauthorized)
curl.exe -i -s "$RENDER_URL/v1/school"

# 3. /v1/school with invalid proxy key (must return 401 Unauthorized)
curl.exe -i -s -H "X-Proxy-Key: bad-token-123" "$RENDER_URL/v1/school"

# 4. /v1/school with valid proxy key (must return 200 OK with schools array)
curl.exe -i -s -H "X-Proxy-Key: $SECRET_KEY" "$RENDER_URL/v1/school"

# 5. Forbidden slug: /v1/access_code (must return 404 Not Found even with valid key)
curl.exe -i -s -H "X-Proxy-Key: $SECRET_KEY" "$RENDER_URL/v1/access_code"

# 6. Forbidden slug: /v1/audit_log (must return 404 Not Found even with valid key)
curl.exe -i -s -H "X-Proxy-Key: $SECRET_KEY" "$RENDER_URL/v1/audit_log"

# 7. Forbidden slug: /v1/user (must return 404 Not Found even with valid key)
curl.exe -i -s -H "X-Proxy-Key: $SECRET_KEY" "$RENDER_URL/v1/user"

# 8. Non-GET method on entity: POST /v1/school (must return 405 Method Not Allowed)
curl.exe -i -s -X POST -H "X-Proxy-Key: $SECRET_KEY" "$RENDER_URL/v1/school"

# 9. GET /v1/live_snapshot with matching ETag (must return 304 Not Modified)
$snap = curl.exe -s -i -H "X-Proxy-Key: $SECRET_KEY" "$RENDER_URL/v1/live_snapshot"
$etag = ($snap | Select-String -Pattern "ETag: (.*)" | ForEach-Object { $_.Matches[0].Groups[1].Value.Trim() })
curl.exe -i -s -H "X-Proxy-Key: $SECRET_KEY" -H "If-None-Match: $etag" "$RENDER_URL/v1/live_snapshot"

# 10. CORS & Cross-Origin header check (No wildcards on protected endpoints)
curl.exe -i -s -H "Origin: https://malicious-site.com" "$RENDER_URL/v1/school"
```

---

## 5. Vercel Project Setup & Deployment

1. **Import Project to Vercel**:
   - Push `E:\fiesta-vercel` to your Git repository or link via Vercel CLI (`vercel link`).
2. **Configure Environment Variables** in Vercel Project Settings:
   - `RENDER_API_BASE`: `https://lfgos-api.onrender.com` (no trailing slash)
   - `RENDER_PROXY_KEY`: `<Your-Render-Proxy-Secret>`
   *(DO NOT configure Base44 tokens, app IDs, or database credentials on Vercel)*
3. **Build & Output Settings**:
   - Framework Preset: `Other`
   - Build Command: `node tools/build.mjs`
   - Output Directory: `public`
4. **Deploy**:
   ```bash
   vercel --prod
   ```

---

## 6. Production Smoke Test

Run against your deployed Vercel URL (e.g. `https://sportsfiesta.vercel.app`):

```powershell
$VERCEL_URL = "https://sportsfiesta.vercel.app"

# 1. Verify single clean URL (index.html shell)
curl.exe -i -s "$VERCEL_URL/"

# 2. Verify /api/public_feed returns valid tournament payload
curl.exe -i -s "$VERCEL_URL/api/public_feed"

# 3. Check conditional 304 Not Modified
$res = curl.exe -s -i "$VERCEL_URL/api/public_feed"
$etag = ($res | Select-String -Pattern "ETag: (.*)" | ForEach-Object { $_.Matches[0].Groups[1].Value.Trim() })
curl.exe -i -s -H "If-None-Match: $etag" "$VERCEL_URL/api/public_feed"

# 4. Verify 405 Method Not Allowed on POST
curl.exe -i -s -X POST "$VERCEL_URL/api/public_feed"
```

---

## 7. Day-of-Event Operations (13 & 14 Nov 2026)

### Render Free-Tier Sleeping:
- **Normal Idle Behavior:** If Render has been idle for >15 minutes, Render spins down.
- **First Visitor Experience:** The first visitor receives a quick 503 `{"warming": true}` response within 8 seconds. The client automatically displays a calm warming banner: *"Connecting to the live server, this can take up to a minute..."* and automatically retries with exponential backoff (8s, 8s, 12s, 12s, 20s).
- **Background Wakeup:** Vercel's `waitUntil` executes the warming call in the background. Once Render wakes (30-60s), subsequent requests are served live data and cached for 15s.
- **Stale Fallback:** If Render becomes temporarily unresponsive while games are in progress, Vercel continues to serve the last valid payload with `X-Stale: true`.

### One-Click Rollback in Vercel:
1. Navigate to `https://vercel.com/aryans-projects-d7da2640/sportsfiesta/deployments`.
2. Locate the previous stable deployment tagged `v1.0.0` or select any prior deployment.
3. Click the `...` menu on the right and select **Promote to Production**. Instant rollback takes under 5 seconds.

### Immediate Contact / Escalation:
- **Venue Coordinator:** Dr. Bhimrao Ambedkar Sports Stadium, Mau
- **Tournament Ops Lead:** Little Flower Children School, Mau
- **Live Stream Date:** 14 Nov 2026 Grand Championship
