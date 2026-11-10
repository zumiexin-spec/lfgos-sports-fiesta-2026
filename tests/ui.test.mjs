import { chromium } from 'playwright';
import axe from 'axe-core';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const ARTIFACT_DIR = 'C:/Users/Aryan/.gemini/antigravity/brain/0cf6e103-2cb3-4a95-a6de-df395073d5d9/screenshots/ui_audit';
const LOCAL_RESULTS_DIR = path.resolve('test-results');

const VIEWPORTS = [
  { name: 'iPhone-12-13-14', width: 390, height: 844 },
  { name: 'Android-Common', width: 360, height: 740 }
];

const THEMES = ['light', 'dark'];

const ROUTES = [
  { hash: '#home', name: 'Home' },
  { hash: '#scores?mode=points', name: 'Scores-Points' },
  { hash: '#scores?mode=medals', name: 'Scores-Medals' },
  { hash: '#school?id=sikatiya&tab=matches', name: 'School-Sikatiya-Matches' },
  { hash: '#school?id=sikatiya&tab=medals', name: 'School-Sikatiya-Medals' },
  { hash: '#school?id=sikatiya&tab=trophies', name: 'School-Sikatiya-Trophies' },
  { hash: '#school?id=kiriharapur', name: 'School-Kiriharapur-NoContact' },
  { hash: '#games', name: 'Games-Index' },
  { hash: '#game?event=6ae208b7fe097a3f4f0d6fc6&cat=Sub-Junior&gender=Boys', name: 'Game-Individual-Podium' },
  { hash: '#team?comp=6ae208b1fe097a3f4f0d6fb9&tab=fixtures', name: 'Team-Cricket-Fixtures' },
  { hash: '#team?comp=6ae208b1fe097a3f4f0d6fb9&tab=bracket', name: 'Team-Cricket-Bracket' },
  { hash: '#team?comp=6ae208b1fe097a3f4f0d6fb2&tab=bracket', name: 'Team-Volleyball-Bracket' },
  { hash: '#team?comp=6ae208b1fe097a3f4f0d6fb9&tab=result', name: 'Team-Cricket-Result' },
  { hash: '#fixtures?day=13', name: 'Fixtures-Day13' },
  { hash: '#fixtures?day=14', name: 'Fixtures-Day14' },
  { hash: '#match?id=6af1f4df94e87e134abe8646', name: 'MatchDetail' },
  { hash: '#live?tab=now', name: 'LiveArena-Now' },
  { hash: '#live?tab=medals', name: 'LiveArena-Medals' },
  { hash: '#live?tab=schedule', name: 'LiveArena-Schedule' },
  { hash: '#photos', name: 'Photos' },
  { hash: '#search', name: 'Search' },
  { hash: '#info', name: 'EventInfo' },
  { hash: '#settings', name: 'Settings' },
  { hash: '#notFoundScreen', name: '404' }
];

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    totalPassed++;
  } else {
    console.error(`[FAIL] ${message}`);
    totalFailed++;
  }
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (err) {
    return await chromium.launch({ channel: 'msedge', headless: true });
  }
}

async function saveScreenshot(page, filename) {
  const localPath = path.join(LOCAL_RESULTS_DIR, filename);
  await page.screenshot({ path: localPath, fullPage: false });
  try {
    const artPath = path.join(ARTIFACT_DIR, filename);
    fs.copyFileSync(localPath, artPath);
  } catch (e) {}
}

async function runSuite() {
  console.log('=== STARTING AUTOMATED UI & ACCESSIBILITY AUDIT ===\n');
  const browser = await launchBrowser();

  try {
    // 1. Comprehensive Route Verification across Viewports & Themes
    for (const vp of VIEWPORTS) {
      for (const theme of THEMES) {
        console.log(`\n--- Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) | Theme: ${theme.toUpperCase()} ---`);
        
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: 2
        });

        const page = await context.newPage();
        const consoleErrors = [];
        const pageErrors = [];

        page.on('console', msg => {
          if (msg.type() === 'error') {
            const txt = msg.text();
            // Ignore intentional favicon 404 if any
            if (!txt.includes('favicon.ico')) {
              consoleErrors.push(txt);
            }
          }
        });

        page.on('pageerror', err => {
          pageErrors.push(err.message);
        });

        // Set theme before navigation
        await page.addInitScript((t) => {
          localStorage.setItem('fiesta_theme', t);
        }, theme);

        // Load Home first
        await page.goto(`${BASE_URL}/#home`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(500);

        // Verify Theme Application
        const htmlTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
        assert(htmlTheme === theme, `Page root correctly has data-theme="${theme}"`);

        // Iterate over routes
        for (const route of ROUTES) {
          await page.evaluate((h) => { window.location.hash = h; }, route.hash);
          await page.waitForTimeout(400);

          // a. Zero console errors & zero page errors
          assert(consoleErrors.length === 0, `Route ${route.name} (${route.hash}): 0 console errors (found: ${consoleErrors.length})`);
          if (consoleErrors.length > 0) {
            console.error('Console errors:', consoleErrors.splice(0, consoleErrors.length));
          }
          assert(pageErrors.length === 0, `Route ${route.name} (${route.hash}): 0 unhandled exceptions`);

          // b. No horizontal overflow (document.documentElement.scrollWidth <= window.innerWidth)
          const overflowCheck = await page.evaluate(() => {
            const docWidth = document.documentElement.scrollWidth;
            const winWidth = window.innerWidth;
            return { docWidth, winWidth, ok: docWidth <= winWidth + 1 };
          });
          assert(overflowCheck.ok, `Route ${route.name}: No horizontal overflow (${overflowCheck.docWidth}px <= ${overflowCheck.winWidth}px)`);

          // c. Width check: cards, hero, rows must fill container (width >= container width - 40px)
          const widthCheck = await page.evaluate(() => {
            const main = document.querySelector('.main');
            if (!main) return { ok: true, details: 'no .main' };
            const mainWidth = main.clientWidth;
            const elements = Array.from(main.querySelectorAll('.card, .hero, .srow'));
            for (const el of elements) {
              const w = el.offsetWidth;
              // Card should be at least main width minus internal padding/margins (~30-40px)
              if (w < mainWidth - 40) {
                return { ok: false, elClass: el.className, w, mainWidth };
              }
            }
            return { ok: true, count: elements.length };
          });
          assert(widthCheck.ok, `Route ${route.name}: Elements fill viewport width (1/3rd width bug prevented: ${JSON.stringify(widthCheck)})`);

          // d. No stuck skeleton shimmer visible after data resolves
          const skeletonCount = await page.evaluate(() => document.querySelectorAll('.skeleton-shimmer').length);
          assert(skeletonCount === 0, `Route ${route.name}: Zero stuck skeleton shimmers`);

          // e. No browser-default button styles
          const defaultButtonCheck = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            for (const b of buttons) {
              const comp = window.getComputedStyle(b);
              if (comp.borderStyle === 'outset') {
                return { ok: false, btn: b.outerHTML };
              }
            }
            return { ok: true };
          });
          assert(defaultButtonCheck.ok, `Route ${route.name}: All buttons styled without browser outset defaults`);

          // f. Axe accessibility check (0 serious or critical violations)
          await page.evaluate(axe.source);
          const axeResults = await page.evaluate(() => {
            return axe.run({
              runOnly: {
                type: 'tag',
                values: ['wcag2a', 'wcag2aa']
              }
            });
          });
          const severeViolations = (axeResults.violations || []).filter(v => v.impact === 'critical' || v.impact === 'serious');
          assert(severeViolations.length === 0, `Route ${route.name}: 0 critical/serious axe-core violations (found: ${severeViolations.length})`);
          if (severeViolations.length > 0) {
            console.warn(`[WARN] Axe violations on ${route.name}:`, severeViolations.map(v => `${v.id} (${v.impact}): ${v.help}`));
          }

          // g. Icon sprite check: all <use> symbols must resolve in the sprite
          const brokenIcons = await page.evaluate(() => {
            const uses = Array.from(document.querySelectorAll('use'));
            const broken = [];
            for (const u of uses) {
              const href = u.getAttribute('href') || u.getAttribute('xlink:href');
              if (href && href.startsWith('#')) {
                const target = document.querySelector(href);
                if (!target) broken.push(href);
              }
            }
            return broken;
          });
          assert(brokenIcons.length === 0, `Route ${route.name}: All <use> references resolve to symbols (broken: ${brokenIcons.join(', ')})`);

          // h. Tab bar order and Live center button check
          const bnavCheck = await page.evaluate(() => {
            const bnav = document.querySelector('.bnav');
            if (!bnav) return { ok: true, note: 'no bnav' };
            const btns = Array.from(bnav.querySelectorAll('.bnav-btn'));
            const labels = btns.map(b => b.querySelector('span:last-child')?.textContent?.trim());
            const liveHasRaised = !!btns[2]?.querySelector('.bnav-btn-live-raised');
            return {
              count: btns.length,
              labels,
              is5Buttons: btns.length === 5,
              correctOrder: labels[0] === 'Home' && labels[1] === 'Scores' && labels[2] === 'Live' && labels[3] === 'Fixtures' && labels[4] === 'Photos',
              liveHasRaised
            };
          });
          assert(bnavCheck.is5Buttons, `Route ${route.name}: Tab bar has 5 items`);
          assert(bnavCheck.correctOrder, `Route ${route.name}: Tab bar items in exact order (Home, Scores, Live, Fixtures, Photos)`);
          assert(bnavCheck.liveHasRaised, `Route ${route.name}: Live button is raised centre button (item 3)`);

          // i. Specific route checks
          if (route.name === 'Home') {
            const homeCheck = await page.evaluate(() => {
              const podium = document.querySelector('.home-podium');
              if (!podium) return { ok: true };
              const r1Crest = podium.querySelector('.rank-1 .shield-box');
              const r2Crest = podium.querySelector('.rank-2 .shield-box');
              const r3Crest = podium.querySelector('.rank-3 .shield-box');
              const hasC72 = r1Crest?.classList.contains('c72');
              const hasC56_2 = r2Crest?.classList.contains('c56');
              const hasC56_3 = r3Crest?.classList.contains('c56');

              const text = document.body.innerText.toLowerCase();
              const hasProbe = text.includes('probe message') || text.includes('safe to ignore');
              return { hasC72, hasC56_2, hasC56_3, hasProbe };
            });
            if (homeCheck.hasC72 !== undefined) {
              assert(homeCheck.hasC72, 'Home Podium 1st place crest uses .c72 size');
              assert(homeCheck.hasC56_2 && homeCheck.hasC56_3, 'Home Podium 2nd & 3rd place crests use .c56 size');
            }
            assert(!homeCheck.hasProbe, 'Home Announcements strictly filters out probe/test messages');
          }

          if (route.name.includes('Bracket') || route.name === 'MatchDetail') {
            const bracketCheck = await page.evaluate(() => {
              const matchCards = Array.from(document.querySelectorAll('.bracket-match-card'));
              if (matchCards.length === 0) return { ok: true, count: 0, allAround72: true };
              const heights = matchCards.map(c => c.offsetHeight);
              const allAround72 = heights.every(h => h >= 68 && h <= 76);
              return { count: matchCards.length, heights, allAround72 };
            });
            assert(bracketCheck.allAround72, `Tournament Bracket match cards have ~72px height (found: ${bracketCheck.heights ? bracketCheck.heights.slice(0, 3).join(', ') : 'none'}px)`);
          }

          // Specific assertion: Kiriharapur school page MUST NOT show contact block
          if (route.name === 'School-Kiriharapur-NoContact') {
            const hasContact = await page.evaluate(() => {
              return !!document.querySelector('.school-contact-card') || document.body.innerText.includes('Campus & Contact');
            });
            assert(!hasContact, 'School Kiriharapur strictly hides contact card pending user confirmation');
          }

          // Capture screenshot for routes at 390px
          if (vp.width === 390) {
            const shotName = `${route.name}_${theme}_390.png`;
            await saveScreenshot(page, shotName);
          }
        }

        await context.close();
      }
    }

    // 2. Interactive Modal Notification Sheet Verification
    console.log('\n--- Testing Modal Notification Sheet Interactions ---');
    const notifContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2
    });
    const notifPage = await notifContext.newPage();
    await notifPage.goto(`${BASE_URL}/#home`, { waitUntil: 'networkidle' });

    // Open sheet via bell button
    const bellBtn = notifPage.locator('.notif-bell-btn');
    await bellBtn.click();
    await notifPage.waitForTimeout(350);

    const sheetOpen = await notifPage.evaluate(() => {
      const sheet = document.getElementById('notif-sheet');
      const backdrop = document.getElementById('notif-sheet-backdrop');
      const bodyOverflow = document.body.style.overflow;
      return {
        sheetHasOpen: sheet?.classList.contains('open'),
        backdropHasOpen: backdrop?.classList.contains('open'),
        bodyLocked: bodyOverflow === 'hidden',
        emptyTitle: sheet?.querySelector('.notif-empty-box div:nth-child(2)')?.textContent?.trim(),
        emptyDesc: sheet?.querySelector('.notif-empty-box div:nth-child(3)')?.textContent?.trim()
      };
    });

    assert(sheetOpen.sheetHasOpen, 'Notification sheet has .open class on bell tap');
    assert(sheetOpen.backdropHasOpen, 'Backdrop has .open class on bell tap');
    assert(sheetOpen.bodyLocked, 'Body scroll is locked (overflow: hidden) when sheet is open');
    assert(sheetOpen.emptyTitle === 'No notifications yet', `Empty state title matches spec: "${sheetOpen.emptyTitle}"`);
    assert(sheetOpen.emptyDesc === 'Results, live alerts and announcements will appear here.', `Empty state body matches spec: "${sheetOpen.emptyDesc}"`);

    // Capture open sheet screenshot
    await saveScreenshot(notifPage, 'NotificationSheet_Open_Light_390.png');

    // Close via backdrop click
    await notifPage.locator('#notif-sheet-backdrop').click({ position: { x: 50, y: 50 } });
    await notifPage.waitForTimeout(350);

    const sheetClosed = await notifPage.evaluate(() => {
      const sheet = document.getElementById('notif-sheet');
      const bodyOverflow = document.body.style.overflow;
      return {
        sheetClosed: !sheet?.classList.contains('open'),
        bodyRestored: bodyOverflow === ''
      };
    });
    assert(sheetClosed.sheetClosed, 'Notification sheet closes on backdrop tap');
    assert(sheetClosed.bodyRestored, 'Body scroll unlocked on backdrop tap');

    // Re-open and close via ESC key
    await bellBtn.click();
    await notifPage.waitForTimeout(300);
    await notifPage.keyboard.press('Escape');
    await notifPage.waitForTimeout(350);

    const sheetEscClosed = await notifPage.evaluate(() => {
      const sheet = document.getElementById('notif-sheet');
      return !sheet?.classList.contains('open');
    });
    assert(sheetEscClosed, 'Notification sheet closes on ESC key press');

    await notifContext.close();

    // 3. Zero-Data Edge Case Verification (New Event / Pre-Tournament State)
    console.log('\n--- Testing Zero-Data Pre-Tournament State ---');
    const zeroContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2
    });
    const zeroPage = await zeroContext.newPage();

    // Mock zero-data feed
    await zeroPage.route('**/api/public_feed', async route => {
      const zeroFeed = {
        version: 9999,
        updated_at: new Date().toISOString(),
        meet: {
          title: "LFGOS Sports Fiesta 2026",
          dates: "13 & 14 Nov 2026",
          venue: "Dr. Bhimrao Ambedkar Sports Stadium, Mau"
        },
        schools: [
          { id: "sikatiya", name: "Little Flower Children School, Sikatiya, Mau", short_name: "LFCS Sikatiya", code: "SIK", points: 0, medals: { first: 0, second: 0, third: 0 }, matches_won: 0 },
          { id: "ghoshi", name: "Little Flower Children School, Ghoshi, Mau", short_name: "LFCS Ghoshi", code: "GHO", points: 0, medals: { first: 0, second: 0, third: 0 }, matches_won: 0 },
          { id: "international", name: "Little Flower International School, Mau", short_name: "LFIS Mau", code: "INT", points: 0, medals: { first: 0, second: 0, third: 0 }, matches_won: 0 }
        ],
        competitions: [],
        events: [],
        results: [],
        fixtures: [],
        media: [],
        announcements: []
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(zeroFeed)
      });
    });

    await zeroPage.goto(`${BASE_URL}/#home`, { waitUntil: 'networkidle' });
    await zeroPage.waitForTimeout(400);

    const zeroHomeStatus = await zeroPage.evaluate(() => {
      const errorBoxes = document.querySelectorAll('.card [onclick*="retrySection"]').length;
      const shimmers = document.querySelectorAll('.skeleton-shimmer').length;
      return { errorBoxes, shimmers, hasContent: document.body.innerText.length > 50 };
    });

    assert(zeroHomeStatus.errorBoxes === 0, 'Zero-data feed renders without section errors');
    assert(zeroHomeStatus.shimmers === 0, 'Zero-data feed leaves zero stuck skeletons');
    assert(zeroHomeStatus.hasContent, 'Zero-data feed renders friendly empty states cleanly');

    await saveScreenshot(zeroPage, 'ZeroData_Home_390.png');

    await zeroContext.close();

  } finally {
    await browser.close();
  }

  console.log('\n========================================');
  console.log(`UI TEST SUITE SUMMARY: ${totalPassed} Passed, ${totalFailed} Failed.`);
  console.log('========================================');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
