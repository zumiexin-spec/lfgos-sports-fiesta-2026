import fs from 'fs';
import path from 'path';
import http from 'http';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const playwrightPath = fs.existsSync('E:/Game/node_modules/playwright') ? 'E:/Game/node_modules/playwright' : 'playwright';
const axePath = fs.existsSync('E:/Game/node_modules/axe-core') ? 'E:/Game/node_modules/axe-core' : 'axe-core';

const { chromium } = require(playwrightPath);
const axe = require(axePath);
const { server } = require('../server.js');

const BASE_URL = 'http://localhost:3000';
const ARTIFACT_DIR = 'C:/Users/Aryan/.gemini/antigravity/brain/0cf6e103-2cb3-4a95-a6de-df395073d5d9/screenshots/ui_audit';
const LOCAL_RESULTS_DIR = path.resolve('test-results');

const VIEWPORTS = [
  { name: 'iPhone-390', width: 390, height: 844 },
  { name: 'Android-360', width: 360, height: 740 },
  { name: 'Android-412', width: 412, height: 915 },
  { name: 'Tablet-768', width: 768, height: 1024 },
  { name: 'Desktop-1280', width: 1280, height: 800 }
];

const THEMES = ['light', 'dark'];

const ALL_ROUTES = [
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

const RESPONSIVE_ROUTES = [
  { hash: '#home', name: 'Home' },
  { hash: '#scores?mode=points', name: 'Scores-Points' },
  { hash: '#team?comp=6ae208b1fe097a3f4f0d6fb2&tab=bracket', name: 'Team-Volleyball-Bracket' },
  { hash: '#fixtures?day=13', name: 'Fixtures-Day13' },
  { hash: '#live?tab=now', name: 'LiveArena-Now' }
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
  if (!fs.existsSync(LOCAL_RESULTS_DIR)) fs.mkdirSync(LOCAL_RESULTS_DIR, { recursive: true });
  const localPath = path.join(LOCAL_RESULTS_DIR, filename);
  await page.screenshot({ path: localPath, fullPage: false });
  try {
    if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    const artPath = path.join(ARTIFACT_DIR, filename);
    fs.copyFileSync(localPath, artPath);
  } catch (e) {}
}

async function runSuite() {
  console.log('=== STARTING AUTOMATED UI & ACCESSIBILITY AUDIT ===\n');

  // Check if server is running, if not start server
  let serverStartedLocally = false;
  try {
    await new Promise((resolve, reject) => {
      const checkReq = http.get(BASE_URL, () => resolve(true));
      checkReq.on('error', () => resolve(false));
      checkReq.setTimeout(1000, () => { checkReq.destroy(); resolve(false); });
    });
  } catch (e) {}

  let serverInstance = null;
  try {
    await new Promise((resolve, reject) => {
      serverInstance = server.listen(3000, () => {
        serverStartedLocally = true;
        resolve();
      });
      serverInstance.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          // Port already in use, assuming dev server is already running
          resolve();
        } else {
          reject(err);
        }
      });
    });
  } catch (e) {
    console.warn('[Server startup note]:', e.message);
  }

  const browser = await launchBrowser();

  try {
    // 1. Comprehensive Route Verification across Viewports & Themes
    for (const vp of VIEWPORTS) {
      const is390 = vp.width === 390;
      const routesToTest = is390 ? ALL_ROUTES : RESPONSIVE_ROUTES;

      for (const theme of THEMES) {
        console.log(`\n--- Viewport: ${vp.name} (${vp.width}x${vp.height}) | Theme: ${theme.toUpperCase()} ---`);

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
            if (!txt.includes('favicon.ico') && !txt.includes('serviceWorker')) {
              consoleErrors.push(txt);
            }
          }
        });

        page.on('pageerror', err => {
          pageErrors.push(err.message);
        });

        await page.route('**/disable-devtool.min.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));

        await page.addInitScript((t) => {
          localStorage.setItem('fiesta_theme', t);
        }, theme);

        await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(400);

        const htmlTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
        assert(htmlTheme === theme, `Page root correctly has data-theme="${theme}"`);

        for (const route of routesToTest) {
          await page.evaluate((h) => {
            if (window.App && window.App.navigate) {
              window.App.navigate(h);
            } else {
              window.location.hash = h;
            }
          }, route.hash);
          await page.waitForTimeout(300);

          // a. URL cleanliness check: strictly single clean URL without hash slugging
          const cleanUrlCheck = await page.evaluate(() => {
            return {
              hash: window.location.hash,
              isClean: window.location.hash === '' || window.location.hash === '#'
            };
          });
          assert(cleanUrlCheck.isClean, `Route ${route.name}: URL remains clean without hash slugging in address bar (hash: "${cleanUrlCheck.hash}")`);

          // b. Zero console errors & unhandled exceptions
          assert(consoleErrors.length === 0, `Route ${route.name}: 0 console errors (found: ${consoleErrors.length})`);
          if (consoleErrors.length > 0) {
            console.error('Console errors:', consoleErrors.splice(0, consoleErrors.length));
          }
          assert(pageErrors.length === 0, `Route ${route.name}: 0 unhandled exceptions`);

          // c. No horizontal overflow
          const overflowCheck = await page.evaluate(() => {
            const docWidth = document.documentElement.scrollWidth;
            const winWidth = window.innerWidth;
            return { docWidth, winWidth, ok: docWidth <= winWidth + 1 };
          });
          assert(overflowCheck.ok, `Route ${route.name}: No horizontal overflow (${overflowCheck.docWidth}px <= ${overflowCheck.winWidth}px)`);

          // d. Container width check: elements fill container
          const widthCheck = await page.evaluate(() => {
            const main = document.querySelector('.main');
            if (!main) return { ok: true, details: 'no .main' };
            const mainWidth = main.clientWidth;
            const elements = Array.from(main.querySelectorAll('.card, .hero, .srow'));
            for (const el of elements) {
              const w = el.offsetWidth;
              if (w < mainWidth - 40) {
                return { ok: false, elClass: el.className, w, mainWidth };
              }
            }
            return { ok: true, count: elements.length };
          });
          assert(widthCheck.ok, `Route ${route.name}: Elements fill container width`);

          // e. Axe-core accessibility check
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
          assert(severeViolations.length === 0, `Route ${route.name}: 0 critical/serious axe-core violations`);

          // f. Route-specific checks
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
            assert(bracketCheck.allAround72, `Tournament Bracket match cards have 72px height`);
          }

          if (route.name === 'School-Kiriharapur-NoContact' || route.name === 'School-Kiriharapur-Contact') {
            const hasContact = await page.evaluate(() => {
              return document.body.innerText.includes('Campus & Location') || document.body.innerText.includes('Ballia');
            });
            assert(hasContact, 'School Kiriharapur displays confirmed Ballia campus contact card');
          }

          // Screenshot capture
          if (is390) {
            await saveScreenshot(page, `${route.name}_${theme}_390.png`);
          } else if (route.name === 'Home') {
            await saveScreenshot(page, `Home_${theme}_${vp.width}.png`);
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
    await notifPage.route('**/disable-devtool.min.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await notifPage.addInitScript(() => {
      sessionStorage.setItem('fiesta_splash_done', '1');
    });
    await notifPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await notifPage.waitForTimeout(500);

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
        bodyLocked: bodyOverflow === 'hidden'
      };
    });

    assert(sheetOpen.sheetHasOpen, 'Notification sheet opens with .open class');
    assert(sheetOpen.backdropHasOpen, 'Backdrop activates with .open class');
    assert(sheetOpen.bodyLocked, 'Body scrolling is locked when sheet is open');

    await saveScreenshot(notifPage, 'NotificationSheet_Open_Light_390.png');
    await notifContext.close();

  } finally {
    await browser.close();
    if (serverInstance && serverStartedLocally) {
      serverInstance.close();
    }
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
