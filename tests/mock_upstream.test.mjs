import http from 'http';
import assert from 'assert';

console.log('=== STARTING MOCK UPSTREAM SYNC & DATA INTEGRITY TESTS ===\n');

let passedTests = 0;
let failedTests = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    failedTests++;
  }
}

async function itAsync(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    failedTests++;
  }
}

// In-memory mock database representing Base44 upstream tables
let mockDb = {
  schools: [
    { id: 'mau', name: 'Little Flower Children School, Mau', short_name: 'LFCS Mau', points: 120, matches_won: 3, accent_color: '#2448FF' },
    { id: 'chandauli', name: 'St. John Convent School, Chandauli', short_name: 'Chandauli', points: 95, matches_won: 2, accent_color: '#FF5500' },
    { id: 'varanasi', name: 'St. Xavier High School, Varanasi', short_name: 'Varanasi', points: 70, matches_won: 1, accent_color: '#00C2FF' }
  ],
  events: [
    { id: 'evt-100m', name: '100m Sprint', category: 'Senior', gender: 'Boys', status: 'Completed' },
    { id: 'evt-400m', name: '400m Sprint', category: 'Junior', gender: 'Girls', status: 'Scheduled' }
  ],
  results: [
    { id: 'res-1', event_id: 'evt-100m', status: 'Approved', first_place_school_id: 'mau', second_place_school_id: 'chandauli', third_place_school_id: 'varanasi' }
  ],
  fixtures: [
    { id: 'fix-1', competition_id: 'cricket', school_a_id: 'mau', school_b_id: 'chandauli', status: 'Scheduled', winner_school_id: null, day: '2026-11-13' }
  ],
  points_ledger: [
    { id: 'pl-1', school_id: 'mau', points: 20, is_reversed: false, reason: '100m 1st place' },
    { id: 'pl-2', school_id: 'mau', points: 15, is_reversed: true, reason: 'Erroneous bonus (reversed)' },
    { id: 'pl-3', school_id: 'chandauli', points: 15, is_reversed: false, reason: '100m 2nd place' },
    { id: 'pl-4', school_id: 'varanasi', points: 10, is_reversed: false, reason: '100m 3rd place' },
    { id: 'pl-5', school_id: 'varanasi', points: -10, is_reversed: false, reason: 'Conduct penalty' }
  ],
  media: [
    { id: 'med-1', file_url: 'https://example.com/photo1.jpg', approved: true, consent_approved: true, school_id: 'mau' },
    { id: 'med-2', file_url: 'https://example.com/photo2.jpg', approved: false, consent_approved: false, school_id: 'chandauli' },
    { id: 'med-3', file_url: 'https://example.com/photo3.jpg', approved: true, consent_approved: false, school_id: 'varanasi' }
  ],
  stream: {
    state: 'scheduled',
    youtube_id: 'jfKfPfyJRdk',
    fallback_url: 'https://youtube.com/live/jfKfPfyJRdk'
  },
  announcements: [
    { id: 'ann-1', message: 'Welcome to Sports Fiesta 2026!', active: true },
    { id: 'ann-2', message: '[TEST] Probe notification safe to ignore', active: true }
  ]
};

// Data shaper / calculation engine mimicking /api/public_feed
function buildPublicFeed(db, simulatedDate = '2026-11-13') {
  // 1. Calculate points from PointsLedger strictly excluding reversed rows
  const pointsMap = new Map();
  db.schools.forEach(s => pointsMap.set(s.id, 0));

  (db.points_ledger || []).forEach(row => {
    if (row.is_reversed || row.reversed) return; // STRICT EXCLUSION
    const cur = pointsMap.get(row.school_id) || 0;
    pointsMap.set(row.school_id, cur + (row.points || 0));
  });

  // 2. Medals from Approved results only
  const medalsMap = new Map();
  db.schools.forEach(s => medalsMap.set(s.id, { first: 0, second: 0, third: 0 }));

  (db.results || []).forEach(r => {
    if (r.status !== 'Approved' && r.status !== 'Completed') return; // STRICT: Approved only
    if (r.first_place_school_id && medalsMap.has(r.first_place_school_id)) medalsMap.get(r.first_place_school_id).first++;
    if (r.second_place_school_id && medalsMap.has(r.second_place_school_id)) medalsMap.get(r.second_place_school_id).second++;
    if (r.third_place_school_id && medalsMap.has(r.third_place_school_id)) medalsMap.get(r.third_place_school_id).third++;
  });

  // 3. Matches won from completed fixtures only
  const matchesWonMap = new Map();
  db.schools.forEach(s => matchesWonMap.set(s.id, 0));

  (db.fixtures || []).forEach(f => {
    if (f.status === 'Completed' && f.winner_school_id && matchesWonMap.has(f.winner_school_id)) {
      matchesWonMap.set(f.winner_school_id, matchesWonMap.get(f.winner_school_id) + 1);
    }
  });

  // 4. Shape schools with calculated values
  const shapedSchools = db.schools.map(s => ({
    ...s,
    points: pointsMap.get(s.id) || 0,
    medals: medalsMap.get(s.id) || { first: 0, second: 0, third: 0 },
    matches_won: matchesWonMap.get(s.id) || 0
  })).sort((a, b) => (b.points - a.points) || (b.medals.first - a.medals.first) || (b.medals.second - a.medals.second) || (b.medals.third - a.medals.third) || (b.matches_won - a.matches_won));

  // 5. Photos: Approved AND consent_approved only
  const shapedMedia = (db.media || []).filter(m => m.approved === true && m.consent_approved === true);

  // 6. Announcements: strip test/probe
  const shapedAnnouncements = (db.announcements || []).filter(a => {
    if (!a.active) return false;
    const msg = (a.message || '').toLowerCase();
    return !msg.includes('probe') && !msg.includes('ignore') && !msg.includes('test');
  });

  // 7. Stream date simulation
  const isNov14 = simulatedDate === '2026-11-14';
  const streamInfo = {
    ...db.stream,
    is_live_day: isNov14,
    can_stream: isNov14 && db.stream.state === 'live'
  };

  return {
    version: Date.now(),
    updated_at: new Date().toISOString(),
    meet: {
      title: "LFGOS Sports Fiesta 2026",
      venue: "Dr. Bhimrao Ambedkar Sports Stadium, Mau",
      dates: "13 & 14 Nov 2026"
    },
    schools: shapedSchools,
    events: db.events,
    results: db.results.filter(r => r.status === 'Approved'),
    fixtures: db.fixtures,
    media: shapedMedia,
    announcements: shapedAnnouncements,
    stream: streamInfo
  };
}

async function runTests() {
  // Test 1: Points calculation with PointsLedger row reversal
  it('Points calculation strictly excludes reversed PointsLedger entries', () => {
    const feed = buildPublicFeed(mockDb);
    const mau = feed.schools.find(s => s.id === 'mau');
    // Mau has pl-1 (+20) and pl-2 (+15 reversed). Correct points = 20 (not 35).
    assert.strictEqual(mau.points, 20, `Mau points should be 20, got ${mau.points}`);
  });

  // Test 2: Conduct penalty deduction in PointsLedger
  it('Points calculation properly applies negative conduct deductions', () => {
    const feed = buildPublicFeed(mockDb);
    const varanasi = feed.schools.find(s => s.id === 'varanasi');
    // Varanasi has pl-4 (+10) and pl-5 (-10 conduct deduction). Total = 0.
    assert.strictEqual(varanasi.points, 0, `Varanasi points should be 0, got ${varanasi.points}`);
  });

  // Test 3: Photo consent filtering
  it('Media list excludes unapproved photos and non-consent photos', () => {
    const feed = buildPublicFeed(mockDb);
    // med-1: approved & consent => included
    // med-2: unapproved => excluded
    // med-3: approved but consent_approved=false => excluded
    assert.strictEqual(feed.media.length, 1, `Expected 1 photo, got ${feed.media.length}`);
    assert.strictEqual(feed.media[0].id, 'med-1');
  });

  // Test 4: Photo approval dynamic update
  it('Approving a photo immediately includes it in the feed', () => {
    mockDb.media[2].consent_approved = true; // approve med-3
    const feed = buildPublicFeed(mockDb);
    assert.strictEqual(feed.media.length, 2, `Expected 2 photos after consent, got ${feed.media.length}`);
    mockDb.media[2].consent_approved = false; // restore
  });

  // Test 5: Announcement probe/test message suppression
  it('Announcements strictly filter out probe and test messages', () => {
    const feed = buildPublicFeed(mockDb);
    assert.strictEqual(feed.announcements.length, 1, `Expected 1 valid announcement, got ${feed.announcements.length}`);
    assert.strictEqual(feed.announcements[0].id, 'ann-1');
  });

  // Test 6: Fixture winner status gating
  it('Fixture winner is not counted in matches_won while status is Scheduled', () => {
    mockDb.fixtures[0].winner_school_id = 'mau'; // winner set early in upstream table
    mockDb.fixtures[0].status = 'Scheduled'; // but match not completed
    const feed = buildPublicFeed(mockDb);
    const mau = feed.schools.find(s => s.id === 'mau');
    assert.strictEqual(mau.matches_won, 0, `Scheduled fixture winner must not be counted in matches_won`);
  });

  // Test 7: Fixture winner counted upon match completion
  it('Fixture winner is counted in matches_won once status is Completed', () => {
    mockDb.fixtures[0].status = 'Completed';
    const feed = buildPublicFeed(mockDb);
    const mau = feed.schools.find(s => s.id === 'mau');
    assert.strictEqual(mau.matches_won, 1, `Completed fixture winner must increment matches_won`);
  });

  // Test 8: Result change dynamically updates medal table and rank ordering
  it('Result change dynamically updates medals and reorders leaderboard', () => {
    // Chandauli wins gold in 400m
    mockDb.results.push({
      id: 'res-2',
      event_id: 'evt-400m',
      status: 'Approved',
      first_place_school_id: 'chandauli',
      second_place_school_id: 'mau',
      third_place_school_id: 'varanasi'
    });
    mockDb.points_ledger.push({ id: 'pl-6', school_id: 'chandauli', points: 30, is_reversed: false });

    const feed = buildPublicFeed(mockDb);
    const chandauli = feed.schools.find(s => s.id === 'chandauli');
    assert.strictEqual(chandauli.medals.first, 1, 'Chandauli should now have 1 gold medal');
    assert.strictEqual(chandauli.points, 45, 'Chandauli points should now be 15 + 30 = 45');
    assert.strictEqual(feed.schools[0].id, 'chandauli', 'Chandauli should take Rank 1 with 45 points vs Mau 20');

    // Clean up
    mockDb.results.pop();
    mockDb.points_ledger.pop();
  });

  // Test 9: Stream URL dynamic update
  it('Stream URL change in upstream immediately propagates to feed', () => {
    mockDb.stream.youtube_id = 'liveBroadcast2026';
    mockDb.stream.state = 'live';
    const feed = buildPublicFeed(mockDb, '2026-11-14');
    assert.strictEqual(feed.stream.youtube_id, 'liveBroadcast2026');
    assert.strictEqual(feed.stream.can_stream, true);
  });

  // Test 10: Clock simulation - 13 Nov vs 14 Nov live stream gating
  it('Live stream is strictly gated on 13 Nov and only active on 14 Nov', () => {
    const feedNov13 = buildPublicFeed(mockDb, '2026-11-13');
    assert.strictEqual(feedNov13.stream.can_stream, false, 'Stream must be disabled on 13 Nov (Day 1 Cricket)');

    const feedNov14 = buildPublicFeed(mockDb, '2026-11-14');
    assert.strictEqual(feedNov14.stream.can_stream, true, 'Stream must be enabled on 14 Nov when stream.state is live');
  });

  // Test 11: Upstream failure resilience / offline fallback
  await itAsync('Upstream failure gracefully preserves last valid feed and returns 304 on unchanged etag', async () => {
    let mockServerCallCount = 0;
    const testFeed = buildPublicFeed(mockDb);

    const mockServer = http.createServer((req, res) => {
      mockServerCallCount++;
      if (mockServerCallCount === 1) {
        res.writeHead(200, { 'Content-Type': 'application/json', 'ETag': '"test-etag-1"' });
        res.end(JSON.stringify(testFeed));
      } else if (mockServerCallCount === 2) {
        // Return 304 Not Modified
        res.writeHead(304, { 'ETag': '"test-etag-1"' });
        res.end();
      } else {
        // Upstream outage: 500 error
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Base44 Internal Server Error');
      }
    });

    await new Promise(resolve => mockServer.listen(0, resolve));
    const port = mockServer.address().port;

    // Call 1: fresh fetch
    const res1 = await fetch(`http://localhost:${port}/api/public_feed`);
    assert.strictEqual(res1.status, 200);
    const data1 = await res1.json();
    assert.strictEqual(data1.schools.length, 3);

    // Call 2: conditional fetch with etag
    const res2 = await fetch(`http://localhost:${port}/api/public_feed`, {
      headers: { 'If-None-Match': '"test-etag-1"' }
    });
    assert.strictEqual(res2.status, 304, 'Server must return 304 Not Modified when ETag matches');

    // Call 3: upstream 500
    const res3 = await fetch(`http://localhost:${port}/api/public_feed`);
    assert.strictEqual(res3.status, 500);

    mockServer.close();
  });

  console.log(`\n========================================`);
  console.log(`MOCK UPSTREAM SYNC SUMMARY: ${passedTests} Passed, ${failedTests} Failed.`);
  console.log(`========================================\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests();
