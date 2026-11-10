// Vercel Serverless Function: /api/public_feed
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sanitizeFeed, calculateStandings } = require('./lib/data_shaper');

let cachedFeed = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 15000; // 15-second in-memory cache

function getLocalFallbackFeed() {
  const possiblePaths = [
    path.join(__dirname, '..', 'public', 'public_feed.json'),
    path.join(__dirname, '..', 'public_feed.json'),
    path.join(process.cwd(), 'public', 'public_feed.json'),
    path.join(process.cwd(), 'public_feed.json')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const data = fs.readFileSync(p, 'utf8');
        return JSON.parse(data);
      } catch (e) {}
    }
  }
  return null;
}

async function fetchFromBase44() {
  const appId = process.env.BASE44_APP_ID;
  const appSecret = process.env.BASE44_APP_SECRET;

  if (!appId || !appSecret) {
    return null;
  }

  try {
    const { createClient } = require('@base44/sdk');
    const base44 = createClient({ appId, appSecret });

    const [
      schoolsRaw,
      eventsRaw,
      compsRaw,
      resultsRaw,
      fixturesRaw,
      announcementsRaw,
      mediaRaw,
      displaysRaw,
      pointsLedgerRaw
    ] = await Promise.all([
      base44.entities.School.list().catch(() => []),
      base44.entities.SportEvent.list().catch(() => []),
      base44.entities.TeamCompetition.list().catch(() => []),
      base44.entities.EventResult.list().catch(() => []),
      base44.entities.Fixture.list().catch(() => []),
      base44.entities.Announcement.list().catch(() => []),
      base44.entities.MediaItem.list().catch(() => []),
      base44.entities.DisplayState.list().catch(() => []),
      (base44.entities.PointsLedger ? base44.entities.PointsLedger.list().catch(() => []) : Promise.resolve([]))
    ]);

    const displayState = displaysRaw && displaysRaw.length > 0 ? displaysRaw[displaysRaw.length - 1] : {};
    const schools = calculateStandings(schoolsRaw || [], pointsLedgerRaw || [], resultsRaw || [], fixturesRaw || []);

    return {
      version: Date.now(),
      updated_at: new Date().toISOString(),
      meet: {
        title: "LFGOS Sports Fiesta 2026",
        dates: "13 & 14 Nov 2026",
        venue: "Dr. Bhimrao Ambedkar Sports Stadium, Mau"
      },
      schools: schools,
      events: eventsRaw || [],
      competitions: compsRaw || [],
      results: resultsRaw || [],
      fixtures: fixturesRaw || [],
      announcements: announcementsRaw || [],
      media: (mediaRaw || []).filter(m => m.approved !== false),
      display_state: displayState
    };
  } catch (err) {
    console.warn('[Vercel API] Base44 query failed, using static fallback:', err.message);
    return null;
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

  // Read-only public endpoint
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ error: 'Method Not Allowed', message: 'The public feed is strictly read-only.' });
    return;
  }

  const now = Date.now();
  let feed = cachedFeed;

  if (!feed || (now - lastCacheTime > CACHE_TTL_MS)) {
    const liveFeed = await fetchFromBase44();
    if (liveFeed) {
      feed = liveFeed;
    } else if (!feed) {
      feed = getLocalFallbackFeed();
    }
    if (feed) {
      feed = sanitizeFeed(feed);
      cachedFeed = feed;
      lastCacheTime = now;
    }
  }

  if (!feed) {
    res.status(503).json({ error: 'Service Unavailable', message: 'Feed data is temporarily unavailable.' });
    return;
  }

  const payload = JSON.stringify(feed);
  const etag = `"${crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16)}"`;

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60');
  res.setHeader('ETag', etag);
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Conditional 304 response
  if (req.headers['if-none-match'] === etag) {
    res.status(304).end();
    return;
  }

  res.status(200).send(payload);
};
