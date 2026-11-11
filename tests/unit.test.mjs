import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildPublicPayload, calculateStandings, filterFixtures, isApprovedEventPhoto } from '../lib/feed_builder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

async function runTests() {
  console.log("=== RUNNING UNIT & DATA INTEGRITY VERIFICATION SUITE ===\n");
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

  // --- SECTION 1: STARTUP & ZERO BASE44 DEPENDENCIES ---
  const pkgPath = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  assert("package.json has NO @base44/sdk dependency (zero Base44 packages)", !pkg.dependencies || !pkg.dependencies['@base44/sdk']);
  assert("package.json has NO base44 packages anywhere", !JSON.stringify(pkg).toLowerCase().includes('@base44'));
  assert("package.json declares @vercel/functions", pkg.dependencies && pkg.dependencies['@vercel/functions']);

  // --- SECTION 2: SECURITY & STATIC FILE SHIELD ---
  const appJs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  const envExample = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');

  assert("Browser JS has zero access tokens or API keys", !appJs.includes('b44u_') && !appJs.includes('Bearer ') && !appJs.includes('BASE44_'));
  assert("Browser HTML has zero access tokens or API keys", !indexHtml.includes('b44u_') && !indexHtml.includes('Bearer ') && !indexHtml.includes('BASE44_'));
  assert("Browser JS does not query entity tables directly", !appJs.includes('/entities/') && !appJs.includes('onrender.com'));
  assert(".gitignore ignores .env files", gitignore.includes('.env'));
  assert(".env.example contains ONLY RENDER_API_BASE and RENDER_PROXY_KEY (no Base44 credentials)", 
    envExample.includes('RENDER_API_BASE') && envExample.includes('RENDER_PROXY_KEY') && !envExample.includes('BASE44'));

  // --- SECTION 3: FEED-BUILDER TRANSFORMATIONS ---
  const mockSchools = [
    { id: 'mau', name: 'Little Flower Children School, Mau', short_name: 'LFCS Mau', brand_key: 'sikatiya' },
    { id: 'ghosi', name: 'Little Flower School, Ghosi', short_name: 'LFS Ghosi', brand_key: 'ghosi' },
    { id: 'varanasi', name: 'St. Xavier High School, Varanasi', short_name: 'Varanasi', brand_key: 'lfis_mau' }
  ];

  const mockLedger = [
    { id: 'pl-1', school_id: 'mau', points: 20, is_reversed: false },
    { id: 'pl-2', school_id: 'mau', points: 50, is_reversed: true }, // should be excluded
    { id: 'pl-3', school_id: 'ghosi', points: 15, is_reversed: false }
  ];

  const mockResults = [
    { id: 'r-1', status: 'Approved', first_place_school_id: 'mau', second_place_school_id: 'ghosi', third_place_school_id: 'varanasi' },
    { id: 'r-2', status: 'Draft', first_place_school_id: 'varanasi', second_place_school_id: 'mau' } // should be excluded
  ];

  const mockFixtures = [
    { id: 'f-1', school_a_id: 'mau', school_b_id: 'ghosi', status: 'Completed', winner_school_id: 'mau' },
    { id: 'f-2', school_a_id: 'mau', school_b_id: null, status: 'Scheduled', winner_school_id: null }, // incomplete fixture
    { id: 'f-3', school_a_id: 'ghosi', school_b_id: 'varanasi', status: 'In_Progress', winner_school_id: null }
  ];

  const standings = calculateStandings(mockSchools, mockLedger, mockResults, mockFixtures);
  const mauStanding = standings.find(s => s.id === 'mau');
  const ghosiStanding = standings.find(s => s.id === 'ghosi');
  const varanasiStanding = standings.find(s => s.id === 'varanasi');

  assert("Reversed ledger row (50 pts) excluded: Mau points equal 20", mauStanding && mauStanding.points === 20);
  assert("Medal awarded only from Approved result: Mau has 1 gold", mauStanding && (mauStanding.gold === 1 || mauStanding.medals?.first === 1));
  assert("Draft result excluded: Varanasi has 0 gold", varanasiStanding && (varanasiStanding.gold === 0 || varanasiStanding.medals?.first === 0));
  assert("Matches won counted only from Completed fixture: Mau has 1 win", mauStanding && mauStanding.matches_won === 1);
  assert("Incomplete fixture excluded: filterFixtures filters out fixtures with unknown schools", 
    filterFixtures(mockFixtures, mockSchools).length === 2);

  // Photo consent filtering
  assert("Approved event photo with consent included", isApprovedEventPhoto({
    is_active: true,
    consent_approved: true,
    file_url: 'https://example.com/gallery/action.jpg',
    media_type: 'photo'
  }));
  assert("Unapproved consent photo excluded", !isApprovedEventPhoto({
    is_active: true,
    consent_approved: false,
    file_url: 'https://example.com/gallery/action.jpg'
  }));
  assert("Logo/Emblem photo excluded from public photo gallery", !isApprovedEventPhoto({
    is_active: true,
    consent_approved: true,
    file_url: 'https://example.com/logos/school_crest.png',
    tag: 'logo'
  }));

  // --- SECTION 4: CSS COMPONENT SIZING & DESIGN SYSTEM AUDIT ---
  const fiestaCss = fs.readFileSync(path.join(ROOT, 'fiesta.css'), 'utf8');

  // Unified Chip Sizing
  assert("CSS declares .fiesta-chip default height 32px", fiestaCss.includes('.fiesta-chip') && fiestaCss.includes('height: 32px'));
  assert("CSS declares .fiesta-chip compact height 28px", fiestaCss.includes('height: 28px') && (fiestaCss.includes('.fiesta-chip.compact') || fiestaCss.includes('.fiesta-chip-compact')));
  assert("CSS declares .fiesta-chip font-size 13px Barlow SemiBold", fiestaCss.includes('font-size: 13px') && fiestaCss.includes('600'));
  assert("CSS declares .fiesta-chip min-height 48px hit area", fiestaCss.includes('min-height: 48px'));

  // Bracket Card Sizing
  assert("CSS declares .bracket-match-card fixed height 72px", fiestaCss.includes('.bracket-match-card') && fiestaCss.includes('height: 72px'));
  assert("CSS declares .bracket-match-card .shield-box 28px crests", fiestaCss.includes('.bracket-match-card') && fiestaCss.includes('width: 28px') && fiestaCss.includes('height: 28px'));

  // Podium & Crest Sizing (1st: 72px, 2nd/3rd: 56px, rows: 40px, school detail: 160px)
  assert("CSS declares .c72 crest container (72px)", fiestaCss.includes('.c72') && fiestaCss.includes('72px'));
  assert("CSS declares .c56 crest container (56px)", fiestaCss.includes('.c56') && fiestaCss.includes('56px'));
  assert("CSS declares .c40 crest container (40px)", fiestaCss.includes('.c40') && fiestaCss.includes('40px'));
  assert("CSS declares .c160 crest container (160px)", fiestaCss.includes('.c160') && fiestaCss.includes('160px'));
  assert("App.js renders 1st place podium with c72 (72px)", appJs.includes("renderSchoolCrest(s1, 'c72')"));
  assert("App.js renders 2nd/3rd place podium with c56 (56px)", appJs.includes("renderSchoolCrest(s2, 'c56')") && appJs.includes("renderSchoolCrest(s3, 'c56')"));
  assert("App.js renders leaderboard rows with c40 (40px)", appJs.includes("renderSchoolCrest(s, 'c40')"));
  assert("App.js renders school detail hero with c160 (160px)", appJs.includes("renderSchoolCrest(currentSchool, 'c160')"));

  // TabBar & Layout Container
  assert("CSS declares .tab-bar fixed height 56px + safe-area", fiestaCss.includes('height: 56px') || fiestaCss.includes('min-height: 56px'));
  assert("CSS declares .app-shell centered max-width 480px", fiestaCss.includes('max-width: 480px'));

  // Crests Shields Invariant
  assert("Crests use .shield-box container and are never 50% border-radius circles", 
    fiestaCss.includes('.shield-box') && !fiestaCss.includes('.shield-box {\n  border-radius: 50%'));

  // Splash & Experience
  assert("CSS includes .splash-container and .splash-logo-stage", fiestaCss.includes('.splash-container') && fiestaCss.includes('.splash-logo-stage'));
  assert("CSS includes .splash-progress-ring and .splash-sheen", fiestaCss.includes('.splash-progress-ring') && fiestaCss.includes('.splash-sheen'));
  assert("CSS includes .topbar-logo-btn and .topbar-logo-pop", fiestaCss.includes('.topbar-logo-btn') && fiestaCss.includes('.topbar-logo-pop'));
  assert("CSS includes .live-ring-pulse", fiestaCss.includes('.live-ring-pulse'));
  assert("CSS includes .fullscreen-loader", fiestaCss.includes('.fullscreen-loader'));
  assert("CSS supports prefers-reduced-motion overrides", fiestaCss.includes('@media (prefers-reduced-motion: reduce)'));

  console.log(`\n========================================`);
  console.log(`UNIT VERIFICATION SUMMARY: ${passed} Passed, ${failed} Failed.`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests();
