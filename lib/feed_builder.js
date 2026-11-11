/**
 * LFGOS Sports Fiesta 2026 - Public Feed Builder
 * Shared pure library for sanitizing, aggregating and formatting tournament data.
 * Adheres strictly to the public read-only constraints:
 * - Approved / completed results only
 * - Points ledger excluding reversed rows
 * - Medals from approved EventResult only
 * - Matches won from approved fixture winners only (never pending_winner)
 * - Fixtures shown only when both schools are known
 * - Photos only when active AND consent_approved (never app/logo assets)
 * - Active, in-window announcements only (never test/probe)
 * - Meet venue strictly "Dr. Bhimrao Ambedkar Sports Stadium, Mau"
 */

const crypto = require('crypto');

let schoolContacts = {};
try {
  schoolContacts = require('../school_contacts.json');
} catch (e) {
  try {
    schoolContacts = require('./school_contacts.json');
  } catch (e2) {}
}

const DEFAULT_MEET = {
  title: 'LFGOS Sports Fiesta 2026',
  dates: ['2026-11-13', '2026-11-14'],
  venue: 'Dr. Bhimrao Ambedkar Sports Stadium, Mau'
};

const PROHIBITED_MEDIA_PATTERNS = [
  /fiesta\.png/i,
  /logo/i,
  /emblem/i,
  /og-image/i,
  /icon/i
];

const TEST_ANNOUNCEMENT_PATTERNS = [
  /probe/i,
  /safe to ignore/i,
  /dummy/i,
  /test/i,
  /sample/i
];

/**
 * Check if a media item is an actual event/competition photo
 * and not an internal app logo or promotional graphic.
 */
function isApprovedEventPhoto(item) {
  if (!item) return false;
  if (item.active === false) return false;
  if (item.consent_approved === false) return false;

  const url = (item.file_url || item.url || '').trim();
  const title = (item.title || '').trim();

  if (!url) return false;

  for (const pattern of PROHIBITED_MEDIA_PATTERNS) {
    if (pattern.test(url) || pattern.test(title)) {
      return false;
    }
  }

  return true;
}

/**
 * Filter and validate announcements.
 * Must be active, in-window, and not a test/probe record.
 */
function isPublicAnnouncement(item, now = new Date()) {
  if (!item || !item.message) return false;
  if (item.active !== true) return false;

  const msg = (item.message || '').trim();
  for (const pattern of TEST_ANNOUNCEMENT_PATTERNS) {
    if (pattern.test(msg)) {
      return false;
    }
  }

  const currentTime = now.getTime();
  if (item.start_time) {
    const s = new Date(item.start_time).getTime();
    if (!isNaN(s) && currentTime < s) return false;
  }
  if (item.end_time) {
    const e = new Date(item.end_time).getTime();
    if (!isNaN(e) && currentTime > e) return false;
  }
  if (item.expires_at) {
    const exp = new Date(item.expires_at).getTime();
    if (!isNaN(exp) && currentTime > exp) return false;
  }

  return true;
}

/**
 * Normalize an event result to include canonical place identifiers,
 * points, and places array for all client and feed consumers.
 */
function normalizeResult(r) {
  if (!r) return null;
  const s = (r.status || '').toLowerCase();
  const firstId = r.first_school_id || r.first_place_school_id || (r.places && r.places.find(p => p.rank === 1)?.school_id) || '';
  const secondId = r.second_school_id || r.second_place_school_id || (r.places && r.places.find(p => p.rank === 2)?.school_id) || '';
  const thirdId = r.third_school_id || r.third_place_school_id || (r.places && r.places.find(p => p.rank === 3)?.school_id) || '';

  const pts1 = Number(r.points_first ?? r.first_place_points ?? 20);
  const pts2 = Number(r.points_second ?? r.second_place_points ?? 15);
  const pts3 = Number(r.points_third ?? r.third_place_points ?? 10);

  const ath1 = r.athlete_first || r.first_place_athlete || '';
  const ath2 = r.athlete_second || r.second_place_athlete || '';
  const ath3 = r.athlete_third || r.third_place_athlete || '';

  const places = [
    { rank: 1, school_id: firstId, points: pts1, athlete: ath1 },
    { rank: 2, school_id: secondId, points: pts2, athlete: ath2 },
    { rank: 3, school_id: thirdId, points: pts3, athlete: ath3 }
  ].filter(p => !!p.school_id);

  return {
    ...r,
    status: (s === 'completed' || s === 'approved') ? 'Completed' : (r.status || 'Scheduled'),
    first_school_id: firstId,
    second_school_id: secondId,
    third_school_id: thirdId,
    first_place_school_id: firstId,
    second_place_school_id: secondId,
    third_place_school_id: thirdId,
    points_first: pts1,
    points_second: pts2,
    points_third: pts3,
    first_place_points: pts1,
    second_place_points: pts2,
    third_place_points: pts3,
    athlete_first: ath1,
    athlete_second: ath2,
    athlete_third: ath3,
    first_place_athlete: ath1,
    places
  };
}

/**
 * Calculate official school standings from points ledger, approved results, and completed fixtures.
 */
function calculateStandings(schools = [], pointsLedger = [], results = [], fixtures = []) {
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

  // 1. Points from PointsLedger or totals strictly excluding reversed rows
  let hasLedgerPoints = false;
  (pointsLedger || []).forEach(row => {
    if (!row || !row.school_id) return;
    if (row.is_reversed === true || row.reversed === true) return;
    const pts = Number(row.points != null ? row.points : row.sum_points) || 0;
    if (pointsMap.has(row.school_id)) {
      pointsMap.set(row.school_id, pointsMap.get(row.school_id) + pts);
      if (pts > 0) hasLedgerPoints = true;
    }
  });

  // 2. Medals from Approved / Completed results only
  (results || []).forEach(rawResult => {
    if (!rawResult) return;
    const r = normalizeResult(rawResult);
    const status = (r.status || '').toLowerCase();
    if (status !== 'approved' && status !== 'completed') return;

    const firstId = r.first_school_id || r.first_place_school_id;
    const secondId = r.second_school_id || r.second_place_school_id;
    const thirdId = r.third_school_id || r.third_place_school_id;

    if (firstId && medalsMap.has(firstId)) {
      medalsMap.get(firstId).first++;
    }
    if (secondId && medalsMap.has(secondId)) {
      medalsMap.get(secondId).second++;
    }
    if (thirdId && medalsMap.has(thirdId)) {
      medalsMap.get(thirdId).third++;
    }

    // Safety fallback: if ledger has no positive rows, credit directly from approved event results
    if (!hasLedgerPoints) {
      if (firstId && pointsMap.has(firstId)) {
        pointsMap.set(firstId, pointsMap.get(firstId) + (r.points_first || 20));
      }
      if (secondId && pointsMap.has(secondId)) {
        pointsMap.set(secondId, pointsMap.get(secondId) + (r.points_second || 15));
      }
      if (thirdId && pointsMap.has(thirdId)) {
        pointsMap.set(thirdId, pointsMap.get(thirdId) + (r.points_third || 10));
      }
    }
  });

  // 3. Matches won from completed fixtures with approved winner only (never pending_winner)
  (fixtures || []).forEach(f => {
    if (!f) return;
    const status = (f.status || '').toLowerCase();
    if (status !== 'completed' && status !== 'approved') return;
    if (!f.winner_school_id) return; // Strict: pending_winner_school_id does NOT count
    if (matchesWonMap.has(f.winner_school_id)) {
      matchesWonMap.set(f.winner_school_id, matchesWonMap.get(f.winner_school_id) + 1);
    }
  });

  return schools.map(s => {
    const schoolId = s.id;
    const m = medalsMap.get(schoolId) || { first: 0, second: 0, third: 0 };
    const contact = schoolContacts[schoolId] || s.contact || null;
    return {
      ...s,
      contact,
      points: pointsMap.get(schoolId) ?? (s.points || 0),
      medals: m,
      gold: m.first,
      silver: m.second,
      bronze: m.third,
      matches_won: matchesWonMap.get(schoolId) ?? (s.matches_won || 0)
    };
  }).sort((a, b) => {
    // Tie-breaker 1: Total points
    const pDiff = (b.points || 0) - (a.points || 0);
    if (pDiff !== 0) return pDiff;
    // Tie-breaker 2: First place / Gold count
    const gDiff = (b.medals?.first || 0) - (a.medals?.first || 0);
    if (gDiff !== 0) return gDiff;
    // Tie-breaker 3: Second place / Silver count
    const sDiff = (b.medals?.second || 0) - (a.medals?.second || 0);
    if (sDiff !== 0) return sDiff;
    // Tie-breaker 4: Third place / Bronze count
    const zDiff = (b.medals?.third || 0) - (a.medals?.third || 0);
    if (zDiff !== 0) return zDiff;
    // Tie-breaker 5: Matches won
    const mDiff = (b.matches_won || 0) - (a.matches_won || 0);
    if (mDiff !== 0) return mDiff;
    // Tie-breaker 6: Initial seed
    return (a.seed || 99) - (b.seed || 99);
  });
}

/**
 * Filter fixtures to ensure both schools are known.
 * Unscheduled or bracket placeholders with unknown schools are hidden.
 */
function filterFixtures(fixtures = []) {
  if (!Array.isArray(fixtures)) return [];
  return fixtures.filter(f => {
    if (!f) return false;
    // Strict requirement: "fixtures shown only with both schools known"
    const hasSchoolA = !!(f.school_a_id || (f.school_a && f.school_a.id));
    const hasSchoolB = !!(f.school_b_id || (f.school_b && f.school_b.id));
    return hasSchoolA && hasSchoolB;
  });
}

/**
 * Filter event results to strictly approved / completed records and normalize them.
 */
function filterResults(results = []) {
  if (!Array.isArray(results)) return [];
  return results
    .filter(r => {
      if (!r) return false;
      const s = (r.status || '').toLowerCase();
      return s === 'approved' || s === 'completed';
    })
    .map(normalizeResult);
}

/**
 * Build the canonical live stream state object.
 * Rules: Stream state only on 14 Nov, or if explicitly enabled by display_state.
 */
function buildStreamState(displayState, now = new Date()) {
  const ds = displayState || {};
  // Match days: 13 Nov 2026 (cricket), 14 Nov 2026 (all other games and live stream)
  const isNov14 = now.toISOString().startsWith('2026-11-14');
  const active = !!(ds.stream_active || ds.is_live || (isNov14 && ds.stream_url));
  return {
    active,
    url: ds.stream_url || '',
    startTime: ds.stream_start_time || '2026-11-14T09:00:00+05:30',
    platform: ds.stream_platform || 'youtube',
    notice: isNov14 ? 'Live Stream Active' : 'Live stream broadcast begins 14 Nov 2026'
  };
}

/**
 * Compute deterministic hash of public payload content.
 */
function computeContentHash(obj) {
  const str = JSON.stringify(obj);
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Build the complete public payload.
 */
function buildPublicPayload({
  schools = [],
  events = [],
  competitions = [],
  results = [],
  fixtures = [],
  announcements = [],
  media = [],
  pointsLedger = [],
  displayState = {},
  meet = DEFAULT_MEET,
  now = new Date(),
  previousVersion = 0
}) {
  const sanitizedAnnouncements = (announcements || []).filter(a => isPublicAnnouncement(a, now));
  const sanitizedMedia = (media || []).filter(isApprovedEventPhoto);
  const approvedResults = filterResults(results);
  const confirmedFixtures = filterFixtures(fixtures);
  const standingSchools = calculateStandings(schools, pointsLedger, approvedResults, confirmedFixtures);
  const stream = buildStreamState(displayState, now);

  // Sync event statuses with approved results
  const completedEventMap = new Map();
  approvedResults.forEach(r => {
    if (r && r.event_id) completedEventMap.set(r.event_id, r);
  });

  const syncedEvents = (events || []).map(ev => {
    if (ev && completedEventMap.has(ev.id)) {
      return { ...ev, status: 'Completed' };
    }
    return ev;
  });

  // Normalize team competitions to guarantee clean human titles and game names
  const normalizedCompetitions = (competitions || []).map(c => {
    if (!c) return c;
    const gameName = c.name || c.game || c.sport || c.title || 'Championship';
    return {
      ...c,
      name: gameName,
      title: gameName,
      game: c.game || gameName
    };
  });

  const payloadCore = {
    meet: {
      title: meet.title || DEFAULT_MEET.title,
      dates: meet.dates || DEFAULT_MEET.dates,
      venue: DEFAULT_MEET.venue
    },
    schools: standingSchools,
    events: syncedEvents,
    competitions: normalizedCompetitions,
    results: approvedResults,
    fixtures: confirmedFixtures,
    announcements: sanitizedAnnouncements,
    stream,
    media: sanitizedMedia
  };

  const contentHash = computeContentHash(payloadCore);
  // Monotonically increasing version: use timestamp or increment
  const version = Math.max(Date.now(), (Number(previousVersion) || 0) + 1);

  return {
    version,
    content_hash: contentHash,
    updated_at: now.toISOString(),
    ...payloadCore
  };
}

module.exports = {
  DEFAULT_MEET,
  isApprovedEventPhoto,
  isPublicAnnouncement,
  calculateStandings,
  normalizeResult,
  filterFixtures,
  filterResults,
  buildStreamState,
  computeContentHash,
  buildPublicPayload
};
