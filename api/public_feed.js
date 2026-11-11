/**
 * LFGOS Sports Fiesta 2026 - Public Feed API
 * Vercel Serverless Function: /api/public_feed
 *
 * Data Path: Browser -> /api/public_feed -> Render Proxy -> Base44
 * Strict Invariants:
 * - Read-only public feed (GET / HEAD / OPTIONS)
 * - Upstream queries restricted to allowlist only
 * - Upstream timeout 8s with non-blocking cold-start 503 {"warming":true} + waitUntil background wake-up
 * - Last good payload caching with stale-while-revalidate & stale-if-error
 * - ETag calculation and conditional 304 Not Modified
 */

const crypto = require('crypto');
const { buildPublicPayload } = require('../lib/feed_builder');
const {
  fetchLiveSnapshot,
  fetchAllEntities,
  fetchGalleryPhotos,
  RenderColdStartTimeoutError,
  RenderClientError
} = require('../lib/render_client');

// Safe graceful fallback for @vercel/functions waitUntil
let vercelWaitUntil = (promise) => {
  if (promise && typeof promise.catch === 'function') {
    promise.catch(err => console.warn('[waitUntil fallback] unhandled background error:', err.message));
  }
};
try {
  const vf = require('@vercel/functions');
  if (vf && typeof vf.waitUntil === 'function') {
    vercelWaitUntil = vf.waitUntil;
  }
} catch (e) {
  // Graceful fallback in environments where @vercel/functions is not installed
}

// In-memory cache across serverless warm invocations
let cachedPayload = null;
let cachedPayloadString = null;
let cachedEtag = null;
let lastCacheTime = 0;
let lastRenderSnapshotEtag = null;
let lastGoodPayloadString = null;
let lastGoodEtag = null;
let isWarmingInProgress = false;

const CACHE_TTL_MS = 3000; // 3 seconds edge/in-memory fresh window

// Guaranteed bundled fallback feed
let bundledFallback = null;
try {
  bundledFallback = require('./fallback_feed.json');
} catch (e) {
  try {
    bundledFallback = require('../public_feed.json');
  } catch (e2) {}
}

/**
 * Fetch fresh data from Render upstream and update cache.
 */
async function fetchAndBuildFeed(timeoutMs = 8000) {
  const baseUrl = process.env.RENDER_API_BASE || 'https://lfgos-api.onrender.com';
  const proxyKey = process.env.RENDER_PROXY_KEY;

  let schools = [];
  let events = [];
  let competitions = [];
  let results = [];
  let fixtures = [];
  let announcements = [];
  let media = [];
  let pointsLedger = [];
  let displayState = {};
  let previousVersion = cachedPayload?.version || 0;

  // 1. Fetch directly from live Render database entities and Photos API concurrently
  try {
    const [dataMap, galleryPhotos] = await Promise.all([
      fetchAllEntities({ baseUrl, proxyKey, timeoutMs }),
      fetchGalleryPhotos(Math.min(timeoutMs, 4000)).catch(() => [])
    ]);
    if (dataMap.school && dataMap.school.length > 0) {
      schools = dataMap.school || [];
      events = dataMap.sport_event || [];
      competitions = dataMap.team_competition || [];
      results = dataMap.event_result || [];
      fixtures = dataMap.fixture || [];
      announcements = dataMap.announcement || [];
      const entityMedia = dataMap.media_item || [];
      media = [...(galleryPhotos || []), ...(entityMedia || [])];
      pointsLedger = dataMap.points_ledger || [];
      displayState = (dataMap.display_state && dataMap.display_state[dataMap.display_state.length - 1]) || {};
    } else {
      throw new Error('Entity read returned empty schools, fallback to snapshot');
    }
  } catch (entityErr) {
    if (entityErr instanceof RenderColdStartTimeoutError) {
      throw entityErr;
    }
    // Fallback to LiveSnapshot if concurrent entity read encounters an error
    try {
      const [snapResult, galleryPhotos] = await Promise.all([
        fetchLiveSnapshot({
          baseUrl,
          proxyKey,
          etag: lastRenderSnapshotEtag,
          timeoutMs: 3000
        }),
        fetchGalleryPhotos(3000).catch(() => [])
      ]);
      if (snapResult && snapResult.data && snapResult.data.schools) {
        const snap = snapResult.data;
        schools = snap.schools || [];
        events = snap.events || [];
        competitions = snap.competitions || [];
        results = snap.results || [];
        fixtures = snap.fixtures || [];
        announcements = snap.announcements || [];
        const snapMedia = snap.media || [];
        media = [...(galleryPhotos || []), ...(snapMedia || [])];
        pointsLedger = snap.totals || [];
        displayState = snap.config || {};
        if (snapResult.etag) lastRenderSnapshotEtag = snapResult.etag;
      } else {
        throw entityErr;
      }
    } catch (snapErr) {
      throw entityErr;
    }
  }

  // 3. Build public payload via strict shared feed builder
  const built = buildPublicPayload({
    schools,
    events,
    competitions,
    results,
    fixtures,
    announcements,
    media,
    pointsLedger,
    displayState,
    previousVersion
  });

  const payloadString = JSON.stringify(built);
  const etag = `"${crypto.createHash('sha256').update(payloadString).digest('hex').slice(0, 16)}"`;

  // Update memory cache
  cachedPayload = built;
  cachedPayloadString = payloadString;
  cachedEtag = etag;
  lastCacheTime = Date.now();
  lastGoodPayloadString = payloadString;
  lastGoodEtag = etag;

  return { payload: built, payloadString, etag };
}

/**
 * Background wake-up task for Render using waitUntil.
 */
async function backgroundWarmRender() {
  if (isWarmingInProgress) return;
  isWarmingInProgress = true;
  try {
    console.log('[Background WakeUp] Waking Render upstream in background...');
    // Allow up to 45 seconds for cold start in background
    await fetchAndBuildFeed(45000);
    console.log('[Background WakeUp] Render is awake and cache is populated.');
  } catch (err) {
    console.warn('[Background WakeUp] Background warming attempt failed:', err.message);
  } finally {
    isWarmingInProgress = false;
  }
}

module.exports = async function handler(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, If-None-Match');
    res.status(204).end();
    return;
  }

  // Read-only enforcement
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD, OPTIONS');
    res.status(405).json({
      error: 'Method Not Allowed',
      message: 'The public feed API is strictly read-only.'
    });
    return;
  }

  const now = Date.now();
  const isFresh = cachedPayload && (now - lastCacheTime < CACHE_TTL_MS);

  // Return fresh in-memory cache if available
  if (isFresh) {
    if (req.headers['if-none-match'] === cachedEtag) {
      res.setHeader('ETag', cachedEtag);
      res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60, stale-if-error=600');
      res.status(304).end();
      return;
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60, stale-if-error=600');
    res.setHeader('ETag', cachedEtag);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).send(cachedPayloadString);
    return;
  }

  // Attempt to fetch fresh data from Render
  try {
    const { payloadString, etag } = await fetchAndBuildFeed(8000);

    if (req.headers['if-none-match'] === etag) {
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60, stale-if-error=600');
      res.status(304).end();
      return;
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60, stale-if-error=600');
    res.setHeader('ETag', etag);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).send(payloadString);
  } catch (err) {
    console.warn('[Vercel Function] Upstream fetch failed or timed out:', err.message);

    // If Render timed out (cold start) or errored, keep warming it in the background via waitUntil
    vercelWaitUntil(backgroundWarmRender());

    // 1. If we have a LAST GOOD payload from earlier in this instance's life, serve it with X-Stale: true
    // (First visitor before any successful fetch gets 503 {"warming": true})
    const stalePayload = lastGoodPayloadString;
    const staleEtag = lastGoodEtag;

    if (stalePayload) {
      if (req.headers['if-none-match'] === staleEtag) {
        res.setHeader('ETag', staleEtag);
        res.setHeader('X-Stale', 'true');
        res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30');
        res.status(304).end();
        return;
      }

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30');
      res.setHeader('ETag', staleEtag);
      res.setHeader('X-Stale', 'true');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.status(200).send(stalePayload);
      return;
    }

    // 2. No good payload available anywhere -> Respond fast with 503 and {"warming": true}
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Retry-After', '8');
    res.status(503).json({
      warming: true,
      error: 'Service Warming Up',
      message: 'The live server is currently waking up from sleep. Please retry in 8 seconds.'
    });
  }
};

module.exports._expireCacheForTesting = () => {
  lastCacheTime = 0;
};

module.exports._resetAllCacheForTesting = () => {
  cachedPayload = null;
  cachedPayloadString = null;
  cachedEtag = null;
  lastCacheTime = 0;
  lastRenderSnapshotEtag = null;
  lastGoodPayloadString = null;
  lastGoodEtag = null;
  isWarmingInProgress = false;
};
