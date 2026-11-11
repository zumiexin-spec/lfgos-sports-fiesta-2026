import assert from 'assert';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  buildPublicPayload,
  calculateStandings,
  filterFixtures,
  filterResults,
  isApprovedEventPhoto,
  isPublicAnnouncement,
  buildStreamState
} = require('../lib/feed_builder.js');

const {
  assertAllowedEntity,
  fetchEntity,
  fetchLiveSnapshot,
  ForbiddenEntityError
} = require('../lib/render_client.js');

let passed = 0;
let failed = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    failed++;
  }
}

async function itAsync(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    failed++;
  }
}

async function main() {
  console.log('=== TEST SUITE: Feed Pipeline & Upstream Contract ===\n');

  // 1. ALLOWLIST & FORBIDDEN SLUG ENFORCEMENT
  it('assertAllowedEntity accepts allowlisted entities', () => {
    assert.strictEqual(assertAllowedEntity('school'), 'school');
    assert.strictEqual(assertAllowedEntity('fixture'), 'fixture');
    assert.strictEqual(assertAllowedEntity('event_result'), 'event_result');
    assert.strictEqual(assertAllowedEntity('live_snapshot'), 'live_snapshot');
  });

  it('assertAllowedEntity strictly rejects forbidden slugs', () => {
    const forbidden = ['access_code', 'audit_log', 'user', 'registration', 'protest', 'verify_code', 'admin', 'passwords'];
    for (const slug of forbidden) {
      assert.throws(() => assertAllowedEntity(slug), ForbiddenEntityError, `Expected ForbiddenEntityError for ${slug}`);
    }
  });

  await itAsync('fetchEntity refuses to call upstream when forbidden entity requested', async () => {
    try {
      await fetchEntity({ entity: 'access_code' });
      assert.fail('Should have thrown ForbiddenEntityError');
    } catch (err) {
      assert.strictEqual(err.name, 'RenderClientError');
      assert.strictEqual(err.code, 'FORBIDDEN_ENTITY');
    }
  });

  // 2. DATA INVARIANTS: STANDINGS & POINTS LEDGER
  it('calculateStandings strictly excludes reversed rows from points ledger', () => {
    const schools = [
      { id: 's1', name: 'School 1', seed: 1 },
      { id: 's2', name: 'School 2', seed: 2 }
    ];
    const ledger = [
      { school_id: 's1', points: 30, is_reversed: false },
      { school_id: 's1', points: 100, is_reversed: true, reason: 'Erronous bonus' }, // MUST BE EXCLUDED
      { school_id: 's1', points: 100, reversed: true, reason: 'Erronous bonus' }, // MUST BE EXCLUDED
      { school_id: 's2', points: 20, is_reversed: false }
    ];

    const standings = calculateStandings(schools, ledger, [], []);
    const s1 = standings.find(s => s.id === 's1');
    const s2 = standings.find(s => s.id === 's2');
    assert.strictEqual(s1.points, 30, 's1 points should equal 30 (excluding 100 reversed points)');
    assert.strictEqual(s2.points, 20, 's2 points should equal 20');
  });

  // 3. MEDALS FROM APPROVED RESULTS ONLY
  it('calculateStandings awards medals ONLY from Approved / Completed results', () => {
    const schools = [
      { id: 's1', name: 'School 1', seed: 1 },
      { id: 's2', name: 'School 2', seed: 2 }
    ];
    const results = [
      { status: 'Approved', first_place_school_id: 's1', second_place_school_id: 's2' },
      { status: 'Draft', first_place_school_id: 's2', second_place_school_id: 's1' }, // MUST BE IGNORED
      { status: 'Pending', first_place_school_id: 's2', second_place_school_id: 's1' }, // MUST BE IGNORED
      { status: 'Rejected', first_place_school_id: 's2', second_place_school_id: 's1' } // MUST BE IGNORED
    ];

    const standings = calculateStandings(schools, [], results, []);
    const s1 = standings.find(s => s.id === 's1');
    const s2 = standings.find(s => s.id === 's2');
    assert.strictEqual(s1.medals.first, 1, 's1 should have 1 gold medal');
    assert.strictEqual(s2.medals.first, 0, 's2 should have 0 gold medals (draft/pending ignored)');
    assert.strictEqual(s2.medals.second, 1, 's2 should have 1 silver medal');
  });

  // 4. MATCHES WON FROM COMPLETED FIXTURES WITH APPROVED WINNER ONLY
  it('calculateStandings counts matches_won only from completed fixtures with approved winner', () => {
    const schools = [
      { id: 's1', name: 'School 1', seed: 1 },
      { id: 's2', name: 'School 2', seed: 2 }
    ];
    const fixtures = [
      { status: 'Completed', winner_school_id: 's1' },
      { status: 'Scheduled', winner_school_id: 's2' }, // Ignored (not completed)
      { status: 'Completed', winner_school_id: null, pending_winner_school_id: 's2' } // Ignored (pending winner)
    ];

    const standings = calculateStandings(schools, [], [], fixtures);
    const s1 = standings.find(s => s.id === 's1');
    const s2 = standings.find(s => s.id === 's2');
    assert.strictEqual(s1.matches_won, 1);
    assert.strictEqual(s2.matches_won, 0);
  });

  // 5. FIXTURE VISIBILITY: SHOWN ONLY WITH BOTH SCHOOLS KNOWN
  it('filterFixtures shows fixtures only when both schools are known', () => {
    const fixtures = [
      { id: 'f1', school_a_id: 's1', school_b_id: 's2', round: 'Final' },
      { id: 'f2', school_a_id: 's1', school_b_id: null, round: 'Semi Final 1' }, // Hidden: opponent unknown
      { id: 'f3', school_a_id: '', school_b_id: '', round: 'Quarter Final' } // Hidden: both unknown
    ];

    const visible = filterFixtures(fixtures);
    assert.strictEqual(visible.length, 1);
    assert.strictEqual(visible[0].id, 'f1');
  });

  // 6. PHOTO VALIDATION: CONSENT APPROVED AND NEVER LOGO/APP ASSETS
  it('isApprovedEventPhoto requires active, consent_approved, and excludes logo/emblem assets', () => {
    assert.strictEqual(isApprovedEventPhoto({ file_url: './assets/match1.png', active: true, consent_approved: true }), true);
    assert.strictEqual(isApprovedEventPhoto({ file_url: './assets/match2.png', active: false, consent_approved: true }), false);
    assert.strictEqual(isApprovedEventPhoto({ file_url: './assets/match3.png', active: true, consent_approved: false }), false);
    // Exclude app/logo assets
    assert.strictEqual(isApprovedEventPhoto({ file_url: './fiesta.png', active: true, consent_approved: true }), false);
    assert.strictEqual(isApprovedEventPhoto({ file_url: './assets/logo.png', active: true, consent_approved: true }), false);
    assert.strictEqual(isApprovedEventPhoto({ file_url: './assets/og-image.png', active: true, consent_approved: true }), false);
    assert.strictEqual(isApprovedEventPhoto({ file_url: './assets/ceremony_emblem.png', active: true, consent_approved: true }), false);
  });

  // 7. ANNOUNCEMENT VALIDATION: ACTIVE, IN-WINDOW, EXCLUDES PROBE/TEST
  it('isPublicAnnouncement excludes inactive, expired, or probe messages', () => {
    const now = new Date('2026-11-13T10:00:00Z');
    assert.strictEqual(isPublicAnnouncement({ message: 'Welcome to Fiesta!', active: true }, now), true);
    assert.strictEqual(isPublicAnnouncement({ message: 'Welcome to Fiesta!', active: false }, now), false);
    assert.strictEqual(isPublicAnnouncement({ message: 'Probe message (safe to ignore)', active: true }, now), false);
    assert.strictEqual(isPublicAnnouncement({ message: '[TEST] dummy ticker', active: true }, now), false);
    assert.strictEqual(isPublicAnnouncement({
      message: 'Future announcement',
      active: true,
      start_time: '2026-11-14T00:00:00Z'
    }, now), false);
    assert.strictEqual(isPublicAnnouncement({
      message: 'Expired announcement',
      active: true,
      end_time: '2026-11-12T00:00:00Z'
    }, now), false);
  });

  // 8. STREAM STATE: ONLY LIVE ON 14 NOV
  it('buildStreamState activates stream on 14 Nov or explicit display_state', () => {
    const ds = { stream_url: 'https://youtube.com/live/xyz' };
    const nov13 = new Date('2026-11-13T10:00:00Z');
    const nov14 = new Date('2026-11-14T10:00:00Z');

    const s13 = buildStreamState(ds, nov13);
    assert.strictEqual(s13.active, false, 'Stream must not be active on 13 Nov');
    assert.strictEqual(s13.notice.includes('14 Nov'), true);

    const s14 = buildStreamState(ds, nov14);
    assert.strictEqual(s14.active, true, 'Stream should be active on 14 Nov when stream_url is present');
  });

  // 9. READ-ONLY CONTRACT TEST AGAINST REAL RENDER UPSTREAM
  await itAsync('Contract check: Real Render server GET /v1/school matches schema', async () => {
    const res = await fetchEntity({ entity: 'school' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(Array.isArray(res.data), true);
    assert.strictEqual(res.data.length, 6);
    assert.strictEqual(!!res.data[0].name, true);
    assert.strictEqual(!!res.data[0].short_name, true);
    assert.strictEqual(!!res.data[0].code, true);
  });

  await itAsync('Contract check: Real Render server GET /v1/live_snapshot can be assembled', async () => {
    const snap = await fetchLiveSnapshot();
    assert.strictEqual(!!snap, true);
    assert.strictEqual(!!snap.data, true);
    assert.strictEqual(Array.isArray(snap.data.schools), true);
    assert.strictEqual(snap.data.schools.length, 6);
  });

  // 10. VERCEL SERVERLESS FUNCTION HANDLER TESTS
  const handler = require('../api/public_feed.js');

  function createMockRes() {
    const res = {
      statusCode: 200,
      headers: {},
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      setHeader(name, val) {
        this.headers[name.toLowerCase()] = val;
        return this;
      },
      json(data) {
        this.body = JSON.stringify(data);
        return this;
      },
      send(data) {
        this.body = data;
        return this;
      },
      end() {
        return this;
      }
    };
    return res;
  }

  await itAsync('Handler: GET returns 200 with correct ETag and cache headers', async () => {
    const req = { method: 'GET', headers: {} };
    const res = createMockRes();
    await handler(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(!!res.headers['etag'], true);
    assert.strictEqual(res.headers['cache-control'].includes('public'), true);
    assert.strictEqual(res.headers['cache-control'].includes('s-maxage=15'), true);

    const parsed = JSON.parse(res.body);
    assert.strictEqual(parsed.meet.title, 'LFGOS Sports Fiesta 2026');
    assert.strictEqual(parsed.meet.venue, 'Dr. Bhimrao Ambedkar Sports Stadium, Mau');
    assert.strictEqual(Array.isArray(parsed.schools), true);
    assert.strictEqual(parsed.schools.length, 6);
  });

  await itAsync('Handler: Conditional request with matching If-None-Match returns 304', async () => {
    // First get etag
    const req1 = { method: 'GET', headers: {} };
    const res1 = createMockRes();
    await handler(req1, res1);
    const etag = res1.headers['etag'];

    // Send conditional request
    const req2 = { method: 'GET', headers: { 'if-none-match': etag } };
    const res2 = createMockRes();
    await handler(req2, res2);
    assert.strictEqual(res2.statusCode, 304);
  });

  await itAsync('Handler: POST returns 405 Method Not Allowed', async () => {
    const req = { method: 'POST', headers: {} };
    const res = createMockRes();
    await handler(req, res);
    assert.strictEqual(res.statusCode, 405);
  });

  await itAsync('Handler: OPTIONS returns 204 No Content', async () => {
    const req = { method: 'OPTIONS', headers: {} };
    const res = createMockRes();
    await handler(req, res);
    assert.strictEqual(res.statusCode, 204);
  });

  // 11. RENDER PROXY SECURITY PATCH TESTS
  const {
    renderSecurityMiddleware,
    safeCompare,
    isValidProxyKey
  } = require('../lib/render_proxy_patch.js');

  it('safeCompare works and is constant-time', () => {
    assert.strictEqual(safeCompare('secret_key_123', 'secret_key_123'), true);
    assert.strictEqual(safeCompare('secret_key_123', 'wrong_key_1234'), false);
    assert.strictEqual(safeCompare('short', 'much_longer_string'), false);
  });

  it('isValidProxyKey validates against PROXY_KEY and supports rotation via PROXY_KEY_NEXT', () => {
    process.env.PROXY_KEY = 'primary_secret';
    process.env.PROXY_KEY_NEXT = 'rotating_secret';

    assert.strictEqual(isValidProxyKey('primary_secret'), true);
    assert.strictEqual(isValidProxyKey('rotating_secret'), true);
    assert.strictEqual(isValidProxyKey('bad_key'), false);

    delete process.env.PROXY_KEY;
    delete process.env.PROXY_KEY_NEXT;
  });

  function createMockMiddlewareRes() {
    return {
      statusCode: 200,
      headers: {},
      body: '',
      writeHead(code, headers) {
        this.statusCode = code;
        if (headers) Object.assign(this.headers, headers);
        return this;
      },
      end(data) {
        if (data) this.body = data;
        return this;
      }
    };
  }

  it('renderSecurityMiddleware allows /health without any proxy key', () => {
    let nextCalled = false;
    const req = { path: '/health', url: '/health', headers: {} };
    const res = createMockMiddlewareRes();
    renderSecurityMiddleware(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
  });

  it('renderSecurityMiddleware blocks /v1/school without proxy key with 401', () => {
    process.env.PROXY_KEY = 'secure_proxy_key';
    let nextCalled = false;
    const req = { path: '/v1/school', url: '/v1/school', headers: {} };
    const res = createMockMiddlewareRes();
    renderSecurityMiddleware(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
    delete process.env.PROXY_KEY;
  });

  it('renderSecurityMiddleware denies forbidden slugs (/v1/access_code, /v1/audit_log, /v1/user) with 404', () => {
    process.env.PROXY_KEY = 'secure_proxy_key';
    const forbidden = ['access_code', 'audit_log', 'user', 'registration', 'protest', 'verify_code'];
    for (const slug of forbidden) {
      let nextCalled = false;
      const req = {
        path: `/v1/${slug}`,
        url: `/v1/${slug}`,
        headers: { 'x-proxy-key': 'secure_proxy_key' },
        method: 'GET'
      };
      const res = createMockMiddlewareRes();
      renderSecurityMiddleware(req, res, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, false, `Should not call next for ${slug}`);
      assert.strictEqual(res.statusCode, 404, `Should return 404 for ${slug}`);
    }
    delete process.env.PROXY_KEY;
  });

  it('renderSecurityMiddleware rejects non-GET methods on entities with 405', () => {
    process.env.PROXY_KEY = 'secure_proxy_key';
    let nextCalled = false;
    const req = {
      path: '/v1/school',
      url: '/v1/school',
      headers: { 'x-proxy-key': 'secure_proxy_key' },
      method: 'POST'
    };
    const res = createMockMiddlewareRes();
    renderSecurityMiddleware(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 405);
    delete process.env.PROXY_KEY;
  });

  console.log(`\n=== SUITE SUMMARY: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main();
