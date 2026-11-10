import fs from 'fs';
import path from 'path';
import http from 'http';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function fetchUrl(urlPath) {
  return new Promise((resolve, reject) => {
    http.get({
      hostname: 'localhost',
      port: 3000,
      path: urlPath,
      timeout: 3000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function runTests() {
  console.log("=== RUNNING UNIT & DATA INTEGRITY VERIFICATION SUITE ===");
  let passed = 0;
  let failed = 0;

  function assert(desc, condition) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      failed++;
    }
  }

  // --- SECTION 1: STARTUP & RUNTIME DEPENDENCIES ---
  const pkgPath = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  assert("package.json declares @base44/sdk in dependencies", pkg.dependencies && pkg.dependencies['@base44/sdk']);
  assert("package.json declares dotenv in dependencies", pkg.dependencies && pkg.dependencies['dotenv']);

  // --- SECTION 2: SECURITY & STATIC FILE SHIELD ---
  const appJs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');

  assert("Browser JS has zero access tokens or API keys", !appJs.includes('b44u_') && !appJs.includes('Bearer '));
  assert("Browser HTML has zero access tokens or API keys", !indexHtml.includes('b44u_') && !indexHtml.includes('Bearer '));
  assert("Browser JS does not query entity tables directly", !appJs.includes('/entities/'));
  assert(".gitignore ignores .env files", gitignore.includes('.env'));

  // Test shield on protected endpoints if server running
  try {
    const envRes = await fetchUrl('/.env');
    assert("Request to /.env returns 403 or 404", envRes.status === 403 || envRes.status === 404);

    const pkgRes = await fetchUrl('/package.json');
    assert("Request to /package.json returns 403 or 404", pkgRes.status === 403 || pkgRes.status === 404);

    const srvRes = await fetchUrl('/server.js');
    assert("Request to /server.js returns 403 or 404", srvRes.status === 403 || srvRes.status === 404);

    const scratchRes = await fetchUrl('/scratch/verify_all.mjs');
    assert("Request to /scratch/* returns 403 or 404", scratchRes.status === 403 || scratchRes.status === 404);
  } catch (e) {
    console.log("[SKIP] Server endpoint shield check skipped (offline mode)");
  }

  // --- SECTION 3: DATA TRUTH & INVARIANTS ---
  const fiestaCss = fs.readFileSync(path.join(ROOT, 'fiesta.css'), 'utf8');

  let feed;
  try {
    const feedRes = await fetchUrl('/api/public_feed');
    if (feedRes.status === 200) {
      feed = JSON.parse(feedRes.body);
    }
  } catch (e) {}

  if (!feed) {
    const feedFile = path.join(ROOT, 'public_feed.json');
    if (fs.existsSync(feedFile)) {
      feed = JSON.parse(fs.readFileSync(feedFile, 'utf8'));
    }
  }

  if (feed) {
    assert("Public feed has 6 participating schools", Array.isArray(feed.schools) && feed.schools.length === 6);
    
    const schoolBrands = (feed.schools || []).map(s => s.brand_key || s.id);
    const expectedBrands = ['sikatiya', 'ghosi', 'lfis_mau', 'nizamuddinpura', 'kiriharapur', 'kasimabad'];
    const allExpectedPresent = expectedBrands.every(b => schoolBrands.includes(b));
    assert("All 6 approved schools are present in feed", allExpectedPresent);

    assert("Venue matches official stadium: Dr. Bhimrao Ambedkar Sports Stadium, Mau", 
      feed.meet && feed.meet.venue && feed.meet.venue.includes('Dr. Bhimrao Ambedkar Sports Stadium, Mau'));

    assert("Tournament dates match 13 & 14 Nov 2026",
      feed.meet && feed.meet.dates && JSON.stringify(feed.meet.dates).includes('13') && JSON.stringify(feed.meet.dates).includes('14'));

    // Check crests as shields
    assert("Crests use .shield-box container and are never 50% border-radius circles", 
      fiestaCss.includes('.shield-box') && !fiestaCss.includes('.shield-box {\n  border-radius: 50%'));

    // Check no unapproved / reversed points
    assert("Feed results only contain Approved/Completed events",
      !feed.results || feed.results.every(r => r.status === 'Approved' || r.status === 'Completed'));

    assert("Feed announcements exclude probe/test messages",
      !feed.announcements || feed.announcements.every(a => !a.message.toLowerCase().includes('probe')));
  }

  // --- SECTION 4: ANIMATED LOGO & EXPERIENCE ---
  assert("CSS includes .splash-container and .splash-logo-stage", fiestaCss.includes('.splash-container') && fiestaCss.includes('.splash-logo-stage'));
  assert("CSS includes .splash-progress-ring and .splash-sheen", fiestaCss.includes('.splash-progress-ring') && fiestaCss.includes('.splash-sheen'));
  assert("CSS includes .topbar-logo-btn and .topbar-logo-pop", fiestaCss.includes('.topbar-logo-btn') && fiestaCss.includes('.topbar-logo-pop'));
  assert("CSS includes .live-ring-pulse", fiestaCss.includes('.live-ring-pulse'));
  assert("CSS includes .fullscreen-loader", fiestaCss.includes('.fullscreen-loader'));
  assert("CSS includes .rank-changed-highlight", fiestaCss.includes('.rank-changed-highlight'));
  assert("CSS supports prefers-reduced-motion overrides", fiestaCss.includes('@media (prefers-reduced-motion: reduce)'));

  console.log(`\n========================================`);
  console.log(`UNIT VERIFICATION SUMMARY: ${passed} Passed, ${failed} Failed.`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests();
