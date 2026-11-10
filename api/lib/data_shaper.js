// Data shaper & calculation engine for LFGOS Sports Fiesta 2026
// Excludes reversed PointsLedger entries, unapproved results, and non-consent media

function sanitizeFeed(feed) {
  if (!feed) return null;

  // 1. Filter probe/test announcements
  if (Array.isArray(feed.announcements)) {
    feed.announcements = feed.announcements.filter(a => {
      if (!a || !a.message) return false;
      if (a.active === false) return false;
      if (a.expires_at && new Date(a.expires_at).getTime() < Date.now()) return false;
      const msg = a.message.toLowerCase();
      if (msg.includes('probe') || msg.includes('safe to ignore') || msg.includes('dummy') || msg.includes('test message')) {
        return false;
      }
      return true;
    });
  }

  // 2. Filter media: approved AND consent_approved only
  if (Array.isArray(feed.media)) {
    feed.media = feed.media.filter(m => {
      if (m.approved === false) return false;
      if (m.consent_approved === false) return false;
      return true;
    });
  }

  // 3. Strict privacy / read-only: strip internal secrets
  delete feed.secret;
  delete feed.token;
  delete feed.api_key;
  delete feed.base44_secret;

  return feed;
}

function calculateStandings(schools, pointsLedger, results, fixtures) {
  const pointsMap = new Map();
  const medalsMap = new Map();
  const matchesWonMap = new Map();

  schools.forEach(s => {
    pointsMap.set(s.id, 0);
    medalsMap.set(s.id, { first: 0, second: 0, third: 0 });
    matchesWonMap.set(s.id, 0);
  });

  // Calculate points from PointsLedger strictly excluding reversed rows
  (pointsLedger || []).forEach(row => {
    if (row.is_reversed || row.reversed) return;
    const cur = pointsMap.get(row.school_id) || 0;
    pointsMap.set(row.school_id, cur + (row.points || 0));
  });

  // Medals from Approved / Completed results only
  (results || []).forEach(r => {
    if (r.status !== 'Approved' && r.status !== 'Completed') return;
    if (r.first_place_school_id && medalsMap.has(r.first_place_school_id)) medalsMap.get(r.first_place_school_id).first++;
    if (r.second_place_school_id && medalsMap.has(r.second_place_school_id)) medalsMap.get(r.second_place_school_id).second++;
    if (r.third_place_school_id && medalsMap.has(r.third_place_school_id)) medalsMap.get(r.third_place_school_id).third++;
  });

  // Matches won from completed fixtures only
  (fixtures || []).forEach(f => {
    if (f.status === 'Completed' && f.winner_school_id && matchesWonMap.has(f.winner_school_id)) {
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

module.exports = {
  sanitizeFeed,
  calculateStandings
};
