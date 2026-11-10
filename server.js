// LFGOS Sports Fiesta 2026 - Production Backend & PWA Server
// Strictly read-only public feed server linked to Base44 tournament data.
// Zero exposed tokens in browser code. Token lives strictly in server .env.

const http = require('http');
const fs = require('fs');
const path = require('path');
// Safe resilient import of Base44 client
let createClient;
try {
  ({ createClient } = require('@base44/sdk'));
} catch (e) {
  // Resilient fallback client using native fetch if SDK package is ever uninstalled
  createClient = function({ appId, headers }) {
    const baseUrl = `https://base44.app/api/apps/${appId}`;
    const entityHandler = (name) => ({
      list: async () => {
        try {
          const res = await fetch(`${baseUrl}/entities/${name}/records`, { headers });
          if (!res.ok) return [];
          const data = await res.json();
          return Array.isArray(data) ? data : (data.records || []);
        } catch (err) {
          return [];
        }
      }
    });
    return {
      entities: new Proxy({}, { get: (t, p) => entityHandler(p) }),
      functions: {
        invoke: async (fn, body) => {
          try {
            const res = await fetch(`${baseUrl}/functions/${fn}`, {
              method: 'POST',
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });
            return res.ok ? await res.json() : null;
          } catch (err) {
            return null;
          }
        }
      }
    };
  };
}

// Load environment variables from .env
try {
  if (fs.existsSync(path.join(__dirname, '.env'))) {
    const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || '').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    });
  }
} catch (e) {}

const PORT = parseInt(process.env.PORT, 10) || 3000;
const CACHE_TTL_MS = 18000; // 18 seconds cache (15-20s requirement)
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 60;

const ipRequests = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const record = ipRequests.get(ip) || [];
  const validTimestamps = record.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    ipRequests.set(ip, validTimestamps);
    return true;
  }
  validTimestamps.push(now);
  ipRequests.set(ip, validTimestamps);
  return false;
}

const BASE44_APP_ID = process.env.BASE44_APP_ID || "6ae207dd9d28a2cb601530ec";
const BASE44_TOKEN = process.env.BASE44_APP_TOKEN || "";

const base44 = createClient({
  appId: BASE44_APP_ID,
  headers: {
    "Authorization": `Bearer ${BASE44_TOKEN}`
  }
});

// Ground Rule 4: School crests are shields shown with object-fit: contain, never in circles.
// Served from /assets/crests/ folder and resolved by school code
const CREST_MAP = {
  'sikatiya': 'assets/crests/sikatiya.png',
  'ghosi': 'assets/crests/ghoshi.png',
  'lfis_mau': 'assets/crests/international.png',
  'nizamuddinpura': 'assets/crests/nizamuddinpura.png',
  'kiriharapur': 'assets/crests/kiriharpur.png',
  'kasimabad': 'assets/crests/kasimabad.png'
};

const CODE_MAP = {
  'SKT': 'assets/crests/sikatiya.png',
  'GHS': 'assets/crests/ghoshi.png',
  'KHL': 'assets/crests/international.png',
  'NZM': 'assets/crests/nizamuddinpura.png',
  'KRP': 'assets/crests/kiriharpur.png',
  'KSM': 'assets/crests/kasimabad.png'
};

function resolveCrest(school) {
  if (!school) return 'assets/crests/international.png';
  if (school.code && CODE_MAP[school.code]) return CODE_MAP[school.code];
  if (school.brand_key && CREST_MAP[school.brand_key]) return CREST_MAP[school.brand_key];
  const name = (school.name || '').toLowerCase();
  const logo = (school.logo || '').toLowerCase();
  if (name.includes('sikatiya') || logo.includes('sikatiya')) return 'assets/crests/sikatiya.png';
  if (name.includes('ghosi') || logo.includes('ghosi') || logo.includes('ghoshi')) return 'assets/crests/ghoshi.png';
  if (name.includes('international') || name.includes('lfis') || logo.includes('international')) return 'assets/crests/international.png';
  if (name.includes('nizamuddinpura') || logo.includes('nizamuddinpura')) return 'assets/crests/nizamuddinpura.png';
  if (name.includes('kirihar') || logo.includes('kirihar') || logo.includes('kiriharpur')) return 'assets/crests/kiriharpur.png';
  if (name.includes('kasimabad') || logo.includes('kasimabad')) return 'assets/crests/kasimabad.png';
  return 'assets/crests/international.png';
}

// Load static school contacts
let schoolContacts = {};
try {
  schoolContacts = JSON.parse(fs.readFileSync(path.join(__dirname, 'school_contacts.json'), 'utf8'));
} catch (e) {}

// Verified consent-approved photos
const VERIFIED_PHOTOS = [
  {
    id: "6af1da6c45b4cbe671e63d68",
    title: "Opening Ceremony",
    kind: "photo",
    file_url: "https://base44.app/api/apps/6ae207dd9d28a2cb601530ec/entities/MediaItem/records/6af1da6c45b4cbe671e63d68/file",
    url: "https://base44.app/api/apps/6ae207dd9d28a2cb601530ec/entities/MediaItem/records/6af1da6c45b4cbe671e63d68/file",
    caption: "",
    event_id: null,
    competition_id: null,
    order: 1,
    active: true,
    consent_approved: true
  },
  {
    id: "6af1dafb7d75530ad0e0533c",
    title: "100m Sprint Heats",
    kind: "photo",
    file_url: "https://base44.app/api/apps/6ae207dd9d28a2cb601530ec/entities/MediaItem/records/6af1dafb7d75530ad0e0533c/file",
    url: "https://base44.app/api/apps/6ae207dd9d28a2cb601530ec/entities/MediaItem/records/6af1dafb7d75530ad0e0533c/file",
    caption: "",
    event_id: null,
    competition_id: null,
    order: 2,
    active: true,
    consent_approved: true
  },
  {
    id: "6af1dafce0004a80d9690d3f",
    title: "Tug of War Senior Boys",
    kind: "photo",
    file_url: "https://base44.app/api/apps/6ae207dd9d28a2cb601530ec/entities/MediaItem/records/6af1dafce0004a80d9690d3f/file",
    url: "https://base44.app/api/apps/6ae207dd9d28a2cb601530ec/entities/MediaItem/records/6af1dafce0004a80d9690d3f/file",
    caption: "",
    event_id: null,
    competition_id: null,
    order: 3,
    active: true,
    consent_approved: true
  },
  {
    id: "6af1dafc6d733cca2f466bce",
    title: "Volleyball Semifinal Action",
    kind: "photo",
    file_url: "https://base44.app/api/apps/6ae207dd9d28a2cb601530ec/entities/MediaItem/records/6af1dafc6d733cca2f466bce/file",
    url: "https://base44.app/api/apps/6ae207dd9d28a2cb601530ec/entities/MediaItem/records/6af1dafc6d733cca2f466bce/file",
    caption: "",
    event_id: null,
    competition_id: null,
    order: 4,
    active: true,
    consent_approved: true
  },
  {
    id: "6af1dafcf6b1b443669677cb",
    title: "Relay 4x100m Exchange",
    kind: "photo",
    file_url: "https://base44.app/api/apps/6ae207dd9d28a2cb601530ec/entities/MediaItem/records/6af1dafcf6b1b443669677cb/file",
    url: "https://base44.app/api/apps/6ae207dd9d28a2cb601530ec/entities/MediaItem/records/6af1dafcf6b1b443669677cb/file",
    caption: "",
    event_id: null,
    competition_id: null,
    order: 5,
    active: true,
    consent_approved: true
  },
  {
    id: "6af1dafdd5c458778040c1cf",
    title: "Kho-Kho Junior Girls",
    kind: "photo",
    file_url: "https://base44.app/api/apps/6ae207dd9d28a2cb601530ec/entities/MediaItem/records/6af1dafdd5c458778040c1cf/file",
    url: "https://base44.app/api/apps/6ae207dd9d28a2cb601530ec/entities/MediaItem/records/6af1dafdd5c458778040c1cf/file",
    caption: "",
    event_id: null,
    competition_id: null,
    order: 6,
    active: true,
    consent_approved: true
  },
  {
    id: "6af1dafdf640739e6fcd9bae",
    title: "Long Jump Senior Boys",
    kind: "photo",
    file_url: "https://base44.app/api/apps/6ae207dd9d28a2cb601530ec/entities/MediaItem/records/6af1dafdf640739e6fcd9bae/file",
    url: "https://base44.app/api/apps/6ae207dd9d28a2cb601530ec/entities/MediaItem/records/6af1dafdf640739e6fcd9bae/file",
    caption: "",
    event_id: null,
    competition_id: null,
    order: 7,
    active: true,
    consent_approved: true
  },
  {
    id: "6af1dafebc264e79b1abc66f",
    title: "Medal Ceremony Sub-Junior Boys",
    kind: "photo",
    file_url: "https://base44.app/api/apps/6ae207dd9d28a2cb601530ec/entities/MediaItem/records/6af1dafebc264e79b1abc66f/file",
    url: "https://base44.app/api/apps/6ae207dd9d28a2cb601530ec/entities/MediaItem/records/6af1dafebc264e79b1abc66f/file",
    caption: "",
    event_id: null,
    competition_id: null,
    order: 8,
    active: true,
    consent_approved: true
  }
];

// In-Memory Cached Feed Object
let cachedFeed = null;
let lastCacheTime = 0;

async function getPublicFeed() {
  const now = Date.now();
  if (cachedFeed && (now - lastCacheTime < CACHE_TTL_MS)) {
    return cachedFeed;
  }

  try {
    let snapData = null;
    let snapshot = null;
    try {
      const snapList = await base44.entities.LiveSnapshot.list().catch(() => []);
      if (snapList && snapList.length > 0) {
        snapshot = snapList[snapList.length - 1];
        if (snapshot.payload_json) {
          snapData = JSON.parse(snapshot.payload_json);
        }
      }
    } catch (e) {}

    // Concurrently fetch tournament entities and sync status
    const [
      tourneySyncRes,
      configs,
      schoolsRaw,
      eventsRaw,
      compsRaw,
      resultsRaw,
      fixturesRaw,
      announcementsRaw,
      mediaRaw,
      displays,
      ledger
    ] = await Promise.all([
      base44.functions.invoke('tournament', { action: 'sync' }).catch(() => null),
      base44.entities.PointsConfig.list().catch(() => snapData?.config ? [snapData.config] : []),
      base44.entities.School.list().catch(() => snapData?.schools || []),
      base44.entities.SportEvent.list().catch(() => snapData?.events || []),
      base44.entities.TeamCompetition.list().catch(() => snapData?.competitions || []),
      base44.entities.EventResult.list().catch(() => snapData?.results || []),
      base44.entities.Fixture.list().catch(() => snapData?.fixtures || []),
      base44.entities.Announcement.list().catch(() => snapData?.announcements || []),
      base44.entities.MediaItem.list().catch(() => snapData?.media || []),
      base44.entities.DisplayState.list().catch(() => []),
      base44.entities.PointsLedger.list().catch(() => [])
    ]);

    const config = configs[0] || tourneySyncRes?.data?.config || snapData?.config || {};
    const displayState = displays[0] || tourneySyncRes?.data?.display || {};

    const meet = {
      title: config.meet_title || "LFGOS Sports Fiesta 2026",
      subtitle: "Hosted by LFIS Mau",
      venue: "Dr. Bhimrao Ambedkar Sports Stadium, Mau",
      dates: ["2026-11-13", "2026-11-14"],
      scoring_profile: config.scoring_profile || "official",
      publish_mode: config.publish_mode || "approval",
      contact_website: "https://lfcsschools.com/",
      rules: {
        single_first: config.first || 20,
        single_second: config.second || 15,
        single_third: config.third || 10,
        team_first: config.team_first || 45,
        team_second: config.team_second || 30,
        team_third: config.team_third || 15,
        misconduct_penalty: config.penalty_points || 10
      }
    };

    // Filter APPROVED results only (respect publish_mode)
    // Never show draft, pending, or rejected results
    const allRawResults = (resultsRaw && resultsRaw.length > 0)
      ? resultsRaw
      : (tourneySyncRes?.data?.results || snapData?.results || []);

    const isApprovedResult = (r) => {
      if (!r) return false;
      if (r.status === 'draft' || r.status === 'pending' || r.status === 'rejected') return false;
      return r.status === 'completed' || r.status === 'approved' || r.status === 'published' || Boolean(r.approved_by && r.approved_date);
    };

    const approvedResults = (allRawResults || []).filter(isApprovedResult);

    const medalsBySchool = {};
    for (const r of approvedResults) {
      if (r.first_school_id) {
        medalsBySchool[r.first_school_id] = medalsBySchool[r.first_school_id] || { first: 0, second: 0, third: 0 };
        medalsBySchool[r.first_school_id].first += 1;
      }
      if (r.second_school_id) {
        medalsBySchool[r.second_school_id] = medalsBySchool[r.second_school_id] || { first: 0, second: 0, third: 0 };
        medalsBySchool[r.second_school_id].second += 1;
      }
      if (r.third_school_id) {
        medalsBySchool[r.third_school_id] = medalsBySchool[r.third_school_id] || { first: 0, second: 0, third: 0 };
        medalsBySchool[r.third_school_id].third += 1;
      }
    }

    const pointsBySchool = {};
    for (const l of (ledger || [])) {
      if (l.school_id && l.reversed !== true) {
        pointsBySchool[l.school_id] = (pointsBySchool[l.school_id] || 0) + (Number(l.points) || 0);
      }
    }
    // Merge from tournament sync totals if any school missing
    const totalsList = tourneySyncRes?.data?.totals || [];
    for (const t of totalsList) {
      if (t.school_id && !pointsBySchool[t.school_id]) {
        pointsBySchool[t.school_id] = Number(t.sum_points) || 0;
      }
    }

    const allRawFixtures = (fixturesRaw && fixturesRaw.length > 0)
      ? fixturesRaw
      : (tourneySyncRes?.data?.fixtures || snapData?.fixtures || []);

    const matchesWonBySchool = {};
    for (const f of allRawFixtures) {
      if (f.status === 'Completed' && f.winner_school_id) {
        matchesWonBySchool[f.winner_school_id] = (matchesWonBySchool[f.winner_school_id] || 0) + 1;
      }
    }

    const allRawSchools = (schoolsRaw && schoolsRaw.length > 0)
      ? schoolsRaw
      : (tourneySyncRes?.data?.static?.schools || snapData?.schools || []);

    const schools = allRawSchools.map(s => {
      const crest = resolveCrest(s);
      const pts = pointsBySchool[s.id] || 0;
      const medals = medalsBySchool[s.id] || { first: 0, second: 0, third: 0 };
      const mw = matchesWonBySchool[s.id] || 0;
      // Known mapping issue: Kiriharapur (KRP) contact is currently unconfirmed/disputed with Ballia;
      // explicitly hide contact block until confirmed by user.
      const isKiriharapur = s.code === 'KRP' || s.id === '6ae208b1fe097a3f4f0d6fbd' || (s.name && s.name.toLowerCase().includes('kirihar'));
      const contact = isKiriharapur ? null : (schoolContacts[s.id] || null);
      return {
        id: s.id,
        name: s.name,
        short_name: s.short_name,
        code: s.code,
        accent_color: s.color || "#2448FF",
        crest: crest,
        brand_key: s.brand_key,
        seed: s.seed,
        points: pts,
        medals: medals,
        matches_won: mw,
        contact: contact
      };
    }).sort((a, b) => b.points - a.points || b.medals.first - a.medals.first || b.medals.second - a.medals.second || b.medals.third - a.medals.third || a.seed - b.seed);

    const allRawComps = (compsRaw && compsRaw.length > 0)
      ? compsRaw
      : (tourneySyncRes?.data?.static?.competitions || snapData?.competitions || []);

    const competitions = allRawComps.map(c => {
      const finalFix = allRawFixtures.find(f => f.competition_id === c.id && f.round === 'Final');
      const champ = finalFix?.winner_school_id || (c.status === 'Completed' ? c.seed_1_school_id : null);
      const cName = (c.game || c.name || '').toLowerCase();
      const isCricket = cName.includes('cricket');
      const day = isCricket ? "2026-11-13" : "2026-11-14";
      return {
        id: c.id,
        name: c.game || c.name,
        gender: c.gender,
        classes: c.classes,
        code: c.code,
        order: c.order,
        status: c.status || "Scheduled",
        champion_school_id: champ,
        day: day
      };
    }).sort((a, b) => (a.order || 0) - (b.order || 0));

    const allRawEvents = (eventsRaw && eventsRaw.length > 0)
      ? eventsRaw
      : (tourneySyncRes?.data?.static?.events || snapData?.events || []);

    const events = allRawEvents.map(e => {
      const hasApprovedResult = approvedResults.some(r => r.event_id === e.id);
      const evStatus = hasApprovedResult ? "Completed" : (e.status || "Scheduled");
      const eName = (e.name || '').toLowerCase();
      const isCricket = eName.includes('cricket');
      const day = isCricket ? "2026-11-13" : "2026-11-14";
      return {
        id: e.id,
        name: e.name,
        type: e.type,
        category: e.category,
        classes: e.classes,
        gender: e.gender,
        order: e.order,
        status: evStatus,
        time: (e.scheduled_time && e.scheduled_time !== "[Time]") ? e.scheduled_time : "09:00 AM",
        venue: (e.venue && e.venue !== "[Venue]") ? e.venue : "Dr. Bhimrao Ambedkar Sports Stadium, Mau",
        day: day
      };
    }).sort((a, b) => (a.order || 0) - (b.order || 0));

    const results = approvedResults.map(r => {
      const places = [];
      if (r.first_school_id) {
        places.push({ rank: 1, school_id: r.first_school_id, athlete_name: r.athlete_first || "", points: r.points_first || 20 });
      }
      if (r.second_school_id) {
        places.push({ rank: 2, school_id: r.second_school_id, athlete_name: r.athlete_second || "", points: r.points_second || 15 });
      }
      if (r.third_school_id) {
        places.push({ rank: 3, school_id: r.third_school_id, athlete_name: r.athlete_third || "", points: r.points_third || 10 });
      }
      return {
        id: r.id || r.event_id,
        event_id: r.event_id,
        event_label: r.event_label,
        places: places
      };
    });

    // Rule 6: Drop all fixtures where both schools are not known!
    // Never show "Awaiting opponent" or placeholder pairs
    const fixtures = allRawFixtures
      .filter(f => f.school_a_id && f.school_b_id)
      .map(f => {
        const comp = allRawComps.find(c => c.id === f.competition_id);
        const compName = ((comp?.game || comp?.name) || '').toLowerCase();
        const isCricket = compName.includes('cricket');
        const day = isCricket ? "2026-11-13" : "2026-11-14";
        return {
          id: f.id,
          competition_id: f.competition_id,
          code: f.code,
          round: f.round,
          order: f.order,
          school_a_id: f.school_a_id,
          school_b_id: f.school_b_id,
          winner_school_id: f.winner_school_id || null, // APPROVED winner ONLY
          status: f.status || "Scheduled",
          time: (f.scheduled_time && f.scheduled_time !== "[Time]") ? f.scheduled_time : "10:00 AM",
          ground: (f.ground && f.ground !== "[Ground]") ? f.ground : "Dr. Bhimrao Ambedkar Sports Stadium, Mau",
          day: day
        };
      }).sort((a, b) => (a.order || 0) - (b.order || 0));

    const allRawAnnouncements = (announcementsRaw && announcementsRaw.length > 0)
      ? announcementsRaw
      : (tourneySyncRes?.data?.announcements || snapData?.announcements || []);

    const announcements = allRawAnnouncements
      .filter(a => a.active !== false && a.message)
      .map(a => ({
        id: a.id,
        message: a.message,
        kind: a.kind || "ticker",
        created_at: a.created_date
      }));

    // Stream settings: live stream exists ONLY on 14 Nov 2026
    let streamState = displayState?.mode || "live";
    const ytVideoId = displayState?.youtube_id || "jfKfPfyJRdk";
    const embedUrl = `https://www.youtube-nocookie.com/embed/${ytVideoId}?autoplay=1&mute=0&playsinline=1&rel=0`;
    const fallbackUrl = `https://www.youtube.com/watch?v=${ytVideoId}`;

    const stream = {
      state: streamState,
      starts_at: "2026-11-14T09:00:00.000Z",
      youtube_id: ytVideoId,
      embed_url: embedUrl,
      fallback_url: fallbackUrl,
      headline: displayState?.headline || "LFGOS Sports Fiesta 2026 — Official Live Stream",
      subhead: displayState?.subhead || "Broadcasting live from Dr. Bhimrao Ambedkar Sports Stadium, Mau"
    };

    // Filter MediaItem rows that pass consent rule:
    // active = true AND consent_approved = true
    // NEVER use a logo or crest asset as a "photo"
    const isLogoOrCrest = (url) => {
      if (!url) return true;
      const u = url.toLowerCase();
      return u.includes('logo') || u.includes('fiesta.png') || u.includes('og-image') ||
             u.includes('sikatiya') || u.includes('ghosi') || u.includes('international') ||
             u.includes('nizamuddinpura') || u.includes('kirihar') || u.includes('kasimabad') ||
             u.includes('12b9cd2525b3068159fe87a68bc94a3d') || u.includes('02a09ce377405278f550e7d541446a23') ||
             u.includes('3168939c662fa8414a3ab96e6e5a1e26') || u.includes('45deb8e07d6bdb1f24e9769187092a2d') ||
             u.includes('46212054e7f085d2a9b18e984fa050ff') || u.includes('98e470134e67b2d8b73e02d8caa3bc31') ||
             u.includes('c2b52b349ac003bade028a2f1f4ae794');
    };

    let media = (mediaRaw || [])
      .filter(m => m.consent_approved === true && m.active !== false)
      .filter(m => !isLogoOrCrest(m.file_url) && !isLogoOrCrest(m.title))
      .map(m => ({
        id: m.id,
        kind: m.kind || "photo",
        url: m.file_url,
        file_url: m.file_url,
        caption: m.caption || m.title || "",
        school_id: m.school_id || null,
        event_id: m.event_id || null,
        competition_id: m.competition_id || null,
        created_at: m.created_date || m.created_at || null,
        order: m.order || 0
      }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const version = 500 + (snapshot?.version || 1) + (displayState?.state_version || 0) + approvedResults.length * 10 + (ledger?.length || 0) * 5 + media.length;

    const feed = {
      version: version,
      updated_at: new Date().toISOString(),
      meet: meet,
      schools: schools,
      events: events,
      competitions: competitions,
      results: results,
      fixtures: fixtures,
      announcements: announcements,
      stream: stream,
      media: media
    };

    console.log(`[public_feed] Built feed v${feed.version}: ${schools.length} schools, ${events.length} events, ${fixtures.length} fixtures, ${media.length} photos`);

    try {
      fs.writeFileSync(path.join(__dirname, 'public_feed.json'), JSON.stringify(feed, null, 2));
    } catch (e) {}

    cachedFeed = feed;
    lastCacheTime = now;
    return feed;
  } catch (err) {
    console.error("[public_feed] Error querying database, falling back to cached snapshot:", err.message);
    if (cachedFeed) return cachedFeed;
    try {
      const fallback = JSON.parse(fs.readFileSync(path.join(__dirname, 'public_feed.json'), 'utf8'));
      cachedFeed = fallback;
      lastCacheTime = now;
      return fallback;
    } catch (e) {
      throw err;
    }
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

function requestHandler(req, res) {
  const ip = req.socket.remoteAddress || '127.0.0.1';
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = parsedUrl.pathname;

  // Security Rule 1: Strictly read-only public app. Block all writes.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method Not Allowed', message: 'Public app is strictly read-only.' }));
    return;
  }

  // Security Rule 2: Strictly block access to internal /v1/* or /entities/* routes
  if (pathname.startsWith('/v1/') || pathname.startsWith('/entities/')) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden', message: 'Access to administrative endpoints is strictly forbidden.' }));
    return;
  }

  // Security Rule 3: Strictly block sensitive server-side files, configurations, scripts and tests
  const normPath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '').toLowerCase();
  const isSensitiveFile = 
    normPath.startsWith('/.') ||
    normPath.startsWith('\\.') ||
    normPath === '/.env' ||
    normPath === '\\.env' ||
    normPath === '/server.js' ||
    normPath === '\\server.js' ||
    normPath === '/doctor.js' ||
    normPath === '\\doctor.js' ||
    normPath === '/package.json' ||
    normPath === '\\package.json' ||
    normPath === '/package-lock.json' ||
    normPath === '\\package-lock.json' ||
    normPath.startsWith('/scratch') ||
    normPath.startsWith('\\scratch') ||
    normPath.startsWith('/tests') ||
    normPath.startsWith('\\tests') ||
    normPath.startsWith('/test-results') ||
    normPath.startsWith('\\test-results') ||
    normPath.startsWith('/node_modules') ||
    normPath.startsWith('\\node_modules') ||
    normPath.includes('..');

  if (isSensitiveFile) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden', message: 'Access to internal server configuration, source code, and tests is strictly forbidden.' }));
    return;
  }

  // Rate Limiting and ETag Conditional Serving on API endpoint
  if (pathname === '/api/public_feed' || pathname === '/public_feed') {
    if (isRateLimited(ip)) {
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '30' });
      res.end(JSON.stringify({ error: 'Too Many Requests', message: 'Rate limit exceeded. Try again in 30 seconds.' }));
      return;
    }

    getPublicFeed().then(feed => {
      const etag = `"v${feed.version}"`;
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, {
          'ETag': etag,
          'Cache-Control': 'public, max-age=18, stale-while-revalidate=60',
          'Access-Control-Allow-Origin': '*'
        });
        res.end();
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=18, stale-while-revalidate=60',
        'Access-Control-Allow-Origin': '*',
        'ETag': etag
      });
      res.end(JSON.stringify(feed));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    });
    return;
  }

  // Static File Serving
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  const filePath = path.join(__dirname, pathname);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(__dirname, 'index.html'), (err2, indexContent) => {
          if (err2) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(indexContent);
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400'
      });
      res.end(content);
    }
  });
}

function verifyStartupEnvironment() {
  const nodeVer = process.version;
  const majorVer = parseInt(nodeVer.replace('v', '').split('.')[0], 10);
  if (majorVer < 18) {
    console.error(`\n❌ Node.js version ${nodeVer} is unsupported. Please install Node.js 18 or higher (https://nodejs.org).\n`);
    process.exit(1);
  }
  const base44Dir = path.join(__dirname, 'node_modules', '@base44', 'sdk');
  if (!fs.existsSync(base44Dir)) {
    console.warn(`\n⚠️  Warning: '@base44/sdk' not found in node_modules. Run: npm install\n`);
  }
}

function startServer(port) {
  verifyStartupEnvironment();
  const srv = http.createServer(requestHandler);
  srv.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[server] Port ${port} is in use, attempting port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('[server] Fatal server error:', err);
    }
  });
  srv.listen(port, () => {
    console.log(`\n============================================================`);
    console.log(` LFGOS Sports Fiesta 2026 - PWA Server is Running!`);
    console.log(` Local URL:     http://localhost:${port}`);
    console.log(` Public Feed:   http://localhost:${port}/api/public_feed`);
    console.log(` YouTube Live:  http://localhost:${port}/#live`);
    console.log(`============================================================\n`);
  });
  return srv;
}

if (require.main === module) {
  startServer(PORT);
}

module.exports = { startServer, getPublicFeed };
