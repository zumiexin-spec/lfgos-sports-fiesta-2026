// Vercel Serverless Function: /api/public_feed
const crypto = require('crypto');

let cachedFeed = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 15000; // 15-second in-memory cache

// Guaranteed fallback data bundled in lambda directory
let bundledFallback = null;
try {
  bundledFallback = require('./fallback_feed.json');
} catch (e) {
  try {
    bundledFallback = require('../public_feed.json');
  } catch (e2) {}
}

function sanitizeFeed(feed) {
  if (!feed) return null;

  // Filter test announcements
  if (Array.isArray(feed.announcements)) {
    feed.announcements = feed.announcements.filter(a => {
      if (!a || !a.message) return false;
      if (a.active === false) return false;
      if (a.expires_at && new Date(a.expires_at).getTime() < Date.now()) return false;
      const msg = (a.message || '').toLowerCase();
      if (msg.includes('probe') || msg.includes('safe to ignore') || msg.includes('dummy') || msg.includes('test message')) {
        return false;
      }
      return true;
    });
  }

  // Filter media: approved AND consent_approved only
  if (Array.isArray(feed.media)) {
    feed.media = feed.media.filter(m => m && m.approved !== false && m.consent_approved !== false);
  }

  // Remove internal/secret properties
  delete feed.secret;
  delete feed.token;
  delete feed.api_key;
  delete feed.base44_secret;

  return feed;
}

function calculateStandings(schools, pointsLedger, results, fixtures) {
  if (!Array.isArray(schools)) return [];
  const pointsMap = new Map();
  const medalsMap = new Map();
  const matchesWonMap = new Map();

  schools.forEach(s => {
    if (s && s.id) {
      pointsMap.set(s.id, 0);
      medalsMap.set(s.id, { first: 0, second: 0, third: 0 });
      matchesWonMap.set(s.id, 0);
    }
  });

  // Calculate points from PointsLedger strictly excluding reversed rows
  (pointsLedger || []).forEach(row => {
    if (!row || row.is_reversed || row.reversed || !row.school_id) return;
    const cur = pointsMap.get(row.school_id) || 0;
    pointsMap.set(row.school_id, cur + (Number(row.points) || 0));
  });

  // Medals from Approved / Completed results only
  (results || []).forEach(r => {
    if (!r || (r.status !== 'Approved' && r.status !== 'Completed')) return;
    if (r.first_place_school_id && medalsMap.has(r.first_place_school_id)) medalsMap.get(r.first_place_school_id).first++;
    if (r.second_place_school_id && medalsMap.has(r.second_place_school_id)) medalsMap.get(r.second_place_school_id).second++;
    if (r.third_place_school_id && medalsMap.has(r.third_place_school_id)) medalsMap.get(r.third_place_school_id).third++;
  });

  // Matches won from completed fixtures only
  (fixtures || []).forEach(f => {
    if (!f || f.status !== 'Completed' || !f.winner_school_id) return;
    if (matchesWonMap.has(f.winner_school_id)) {
      matchesWonMap.set(f.winner_school_id, matchesWonMap.get(f.winner_school_id) + 1);
    }
  });

  return schools.map(s => ({
    ...s,
    points: pointsMap.has(s.id) ? pointsMap.get(s.id) : (s.points || 0),
    medals: medalsMap.get(s.id) || s.medals || { first: 0, second: 0, third: 0 },
    matches_won: matchesWonMap.get(s.id) || s.matches_won || 0
  })).sort((a, b) => {
    const pDiff = (b.points || 0) - (a.points || 0);
    if (pDiff !== 0) return pDiff;
    const gDiff = (b.medals?.first || 0) - (a.medals?.first || 0);
    if (gDiff !== 0) return gDiff;
    const sDiff = (b.medals?.second || 0) - (a.medals?.second || 0);
    if (sDiff !== 0) return sDiff;
    const zDiff = (b.medals?.third || 0) - (a.medals?.third || 0);
    if (zDiff !== 0) return zDiff;
    return (b.matches_won || 0) - (a.matches_won || 0);
  });
}

// Resilient Base44 Fetcher using Node 18+ native fetch
async function fetchFromBase44() {
  const appId = process.env.BASE44_APP_ID;
  const appSecret = process.env.BASE44_APP_SECRET || process.env.BASE44_APP_TOKEN;

  if (!appId || !appSecret) {
    return null;
  }

  const baseUrl = `https://base44.app/api/apps/${appId}`;
  const headers = {
    'Authorization': `Bearer ${appSecret}`,
    'Accept': 'application/json'
  };

  const fetchEntity = async (entityName) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      const res = await fetch(`${baseUrl}/entities/${entityName}`, {
        headers,
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : (json.records || []);
    } catch (err) {
      return [];
    }
  };

  try {
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
      fetchEntity('School'),
      fetchEntity('SportEvent'),
      fetchEntity('TeamCompetition'),
      fetchEntity('EventResult'),
      fetchEntity('Fixture'),
      fetchEntity('Announcement'),
      fetchEntity('MediaItem'),
      fetchEntity('DisplayState'),
      fetchEntity('PointsLedger')
    ]);

    if (!schoolsRaw || schoolsRaw.length === 0) {
      return null;
    }

    const displayState = displaysRaw && displaysRaw.length > 0 ? displaysRaw[displaysRaw.length - 1] : {};

    // Filter confirmed/scheduled fixtures with confirmed schools or scheduled time/date
    const validFixtures = (fixturesRaw || []).filter(f => {
      if (!f) return false;
      const hasTime = !!(f.scheduled_time || f.date || f.day || f.time);
      const hasSchools = !!(f.school_a_id || f.school_b_id || f.team_a || f.team_b);
      const isConfirmed = f.status && f.status !== 'Awaiting opponent' && f.status !== 'unscheduled';
      return (hasTime || hasSchools) && isConfirmed;
    });

    const schools = calculateStandings(schoolsRaw, pointsLedgerRaw, resultsRaw, validFixtures);

    return {
      version: Date.now(),
      updated_at: new Date().toISOString(),
      meet: {
        title: "LFGOS Sports Fiesta 2026",
        dates: ["2026-11-13", "2026-11-14"],
        venue: "Dr. Bhimrao Ambedkar Sports Stadium, Mau"
      },
      schools,
      events: eventsRaw || [],
      competitions: compsRaw || [],
      results: (resultsRaw || []).filter(r => r.status === 'Approved' || r.status === 'Completed'),
      fixtures: validFixtures,
      announcements: announcementsRaw || [],
      media: (mediaRaw || []).filter(m => m.approved !== false && m.consent_approved !== false),
      display_state: displayState
    };
  } catch (err) {
    console.warn('[Vercel API] Base44 query failed:', err.message);
    return null;
  }
}

module.exports = async function handler(req, res) {
  try {
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
        feed = bundledFallback ? JSON.parse(JSON.stringify(bundledFallback)) : null;
      }
      if (feed) {
        feed = sanitizeFeed(feed);
        cachedFeed = feed;
        lastCacheTime = now;
      }
    }

    // Guaranteed fallback: if still null, use bundledFallback
    if (!feed && bundledFallback) {
      feed = sanitizeFeed(JSON.parse(JSON.stringify(bundledFallback)));
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
  } catch (fatalErr) {
    console.error('[Vercel API] Fatal handler error caught:', fatalErr);
    try {
      if (bundledFallback) {
        const payload = JSON.stringify(bundledFallback);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'public, s-maxage=10');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).send(payload);
        return;
      }
    } catch (e) {}
    res.status(500).json({ error: 'Internal Server Error', message: fatalErr.message });
  }
};
