import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'assets', 'splash');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const splashSizes = [
  { width: 1179, height: 2556, name: 'apple-splash-1179-2556.png' },
  { width: 1290, height: 2796, name: 'apple-splash-1290-2796.png' },
  { width: 1170, height: 2532, name: 'apple-splash-1170-2532.png' },
  { width: 1284, height: 2778, name: 'apple-splash-1284-2778.png' },
  { width: 1242, height: 2688, name: 'apple-splash-1242-2688.png' },
  { width: 828, height: 1792, name: 'apple-splash-828-1792.png' },
  { width: 750, height: 1334, name: 'apple-splash-750-1334.png' }
];

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (err) {
    return await chromium.launch({ channel: 'msedge', headless: true });
  }
}

async function generate() {
  console.log('Generating PWA iOS startup splash images...');
  const browser = await launchBrowser();

  const logoBase64 = fs.readFileSync(path.join(rootDir, 'assets', 'logo.png')).toString('base64');
  const logoDataUri = `data:image/png;base64,${logoBase64}`;

  for (const s of splashSizes) {
    const context = await browser.newContext({
      viewport: { width: s.width, height: s.height },
      deviceScaleFactor: 1
    });
    const page = await context.newPage();

    const logoSize = Math.round(Math.min(s.width, s.height) * 0.42);

    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body {
            width: ${s.width}px;
            height: ${s.height}px;
            background: #EAF2FF;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          .logo-wrapper {
            width: ${logoSize}px;
            height: ${logoSize}px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .logo-img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          .tagline {
            margin-top: 24px;
            font-weight: 800;
            font-style: italic;
            font-size: ${Math.round(logoSize * 0.09)}px;
            letter-spacing: 0.08em;
            color: #080F2B;
          }
        </style>
      </head>
      <body>
        <div class="logo-wrapper">
          <img class="logo-img" src="${logoDataUri}" alt="LFGOS Sports Fiesta 2026">
        </div>
        <div class="tagline">PLAY • COMPETE • ACHIEVE</div>
      </body>
      </html>
    `);

    const outPath = path.join(outDir, s.name);
    await page.screenshot({ path: outPath, type: 'png' });
    console.log(`Generated: ${s.name} (${s.width}x${s.height})`);
    await context.close();
  }

  await browser.close();
  console.log('All iOS splash images generated successfully!');
}

generate().catch(err => {
  console.error('Error generating splash images:', err);
  process.exit(1);
});
