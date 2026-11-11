import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { LUCIDE_SYMBOLS } from './sprite.mjs';

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.resolve(ROOT_DIR, 'public');

function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    const parent = path.dirname(dest);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

console.log('--- Building LFGOS Sports Fiesta 2026 for Production ---');

// 1. Ensure public directory exists
if (fs.existsSync(PUBLIC_DIR)) {
  fs.rmSync(PUBLIC_DIR, { recursive: true, force: true });
}
fs.mkdirSync(PUBLIC_DIR, { recursive: true });

// 2. Read and hash CSS
const cssContent = fs.readFileSync(path.join(ROOT_DIR, 'fiesta.css'), 'utf8');
const cssHash = hashContent(cssContent);
const cssFileName = `fiesta.${cssHash}.css`;
fs.writeFileSync(path.join(PUBLIC_DIR, cssFileName), cssContent, 'utf8');
console.log(`CSS bundled: ${cssFileName} (${(Buffer.byteLength(cssContent) / 1024).toFixed(1)} KB)`);

// 3. Read and hash JS
const jsContent = fs.readFileSync(path.join(ROOT_DIR, 'app.js'), 'utf8');
const jsHash = hashContent(jsContent);
const jsFileName = `app.${jsHash}.js`;
fs.writeFileSync(path.join(PUBLIC_DIR, jsFileName), jsContent, 'utf8');
console.log(`JS bundled: ${jsFileName} (${(Buffer.byteLength(jsContent) / 1024).toFixed(1)} KB)`);

// 4. Transform index.html
let html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');

// Replace stylesheet link with hashed CSS
html = html.replace(/href=["']\.\/fiesta\.css["']/g, `href="./${cssFileName}"`);
html = html.replace(/href=["']fiesta\.css["']/g, `href="./${cssFileName}"`);

// Replace script tag with hashed JS
html = html.replace(/src=["']\.\/app\.js["']/g, `src="./${jsFileName}"`);
html = html.replace(/src=["']app\.js["']/g, `src="./${jsFileName}"`);

// Ensure inlined sprite is present
if (!html.includes('id="lucide-sprite"')) {
  html = html.replace('<body>', `<body>\n${LUCIDE_SYMBOLS}`);
}

fs.writeFileSync(path.join(PUBLIC_DIR, 'index.html'), html, 'utf8');
console.log(`HTML generated: index.html`);

// 5. Copy static assets and manifests
const copyTargets = [
  'assets',
  'vendor',
  'manifest.json',
  'public_feed.json',
  'fiesta.png',
  'LICENSES',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable.png',
  'og-image.png'
];

for (const target of copyTargets) {
  const srcPath = path.join(ROOT_DIR, target);
  const destPath = path.join(PUBLIC_DIR, target);
  if (fs.existsSync(srcPath)) {
    copyRecursive(srcPath, destPath);
    console.log(`Copied: ${target}`);
  }
}

// Copy root-level icons from assets if not already at root
['icon-192.png', 'icon-512.png', 'icon-maskable.png', 'og-image.png'].forEach(f => {
  const assetSrc = path.join(ROOT_DIR, 'assets', f);
  const rootDest = path.join(PUBLIC_DIR, f);
  if (fs.existsSync(assetSrc) && !fs.existsSync(rootDest)) {
    fs.copyFileSync(assetSrc, rootDest);
  }
});

// 6. Generate Service Worker (public/sw.js) with content-hash cache version
const buildHash = hashContent(cssHash + jsHash + Date.now().toString());
const swTemplate = `/* LFGOS Sports Fiesta 2026 - Production Service Worker (${buildHash}) */
const CACHE_NAME = 'fiesta-cache-${buildHash}';
const DATA_CACHE_NAME = 'fiesta-data-${buildHash}';

const APP_SHELL = [
  './',
  './index.html',
  './${jsFileName}',
  './${cssFileName}',
  './manifest.json',
  './fiesta.png',
  './assets/logo.png',
  './assets/logo-dark.png',
  './assets/logo-36.png',
  './assets/crests/sikatiya.png',
  './assets/crests/ghoshi.png',
  './assets/crests/international.png',
  './assets/crests/nizamuddinpura.png',
  './assets/crests/kiriharpur.png',
  './assets/crests/kasimabad.png',
  './public_feed.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable.png',
  './assets/og-image.png',
  './vendor/plyr.js',
  './vendor/plyr.css',
  './vendor/photoswipe.esm.min.js',
  './vendor/photoswipe-lightbox.esm.min.js',
  './vendor/photoswipe.css',
  './vendor/howler.min.js',
  './vendor/canvas-confetti.min.js',
  './assets/sounds/fiesta_audio_sprite.wav',
  './assets/sounds/sprite_map.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch((err) => {
        console.warn('[SW] Precache incomplete, falling back to runtime caching:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
            console.log('[SW] Deleting stale cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Network-only for live stream video, streams, youtube, or embed
  if (
    url.pathname.includes('/stream') ||
    url.hostname.includes('youtube') ||
    url.hostname.includes('youtu.be') ||
    url.hostname.includes('twitch') ||
    url.pathname.endsWith('.m3u8') ||
    url.pathname.endsWith('.mpd')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. Stale-while-revalidate for public_feed
  if (url.pathname.includes('public_feed') || url.pathname.endsWith('/api/public_feed')) {
    event.respondWith(
      caches.open(DATA_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch((err) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            throw err;
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // 3. Cache-first for logos, images, crests, and fonts
  if (
    url.pathname.match(/\\.(png|jpg|jpeg|svg|webp|woff2|woff|ttf)$/i) ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse);
      })
    );
    return;
  }

  // 4. Stale-while-revalidate for app shell scripts and styles
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
      return cachedResponse || fetchPromise;
    })
  );
});
`;

fs.writeFileSync(path.join(PUBLIC_DIR, 'sw.js'), swTemplate, 'utf8');
console.log(`Service Worker generated: sw.js (cache: fiesta-cache-${buildHash})`);

// 7. Generate robots.txt
const robotsTxt = `User-agent: *
Allow: /
Disallow: /api/health
Disallow: /scratch/
Disallow: /tools/
Disallow: /tests/
`;
fs.writeFileSync(path.join(PUBLIC_DIR, 'robots.txt'), robotsTxt, 'utf8');
console.log('Generated: robots.txt');

// 8. Generate 404.html (Clean branded standalone error page)
const notFoundHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Page Not Found - LFGOS Sports Fiesta 2026</title>
  <link rel="stylesheet" href="./${cssFileName}">
  <style>
    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      text-align: center;
      background: var(--bg);
      color: var(--tx);
      font-family: 'Barlow', -apple-system, BlinkMacSystemFont, sans-serif;
    }
  </style>
</head>
<body>
  <div style="max-width: 400px; display: flex; flex-direction: column; align-items: center; gap: 16px;">
    <img src="./assets/logo.png" alt="Fiesta Logo" style="width: 80px; height: 80px; object-fit: contain;">
    <h1 style="font-size: 32px; font-weight: 800; margin: 0; font-family: 'Barlow Condensed', sans-serif;">PAGE NOT FOUND</h1>
    <p style="color: var(--mut); margin: 0; font-size: 15px;">The page you are looking for does not exist or has moved.</p>
    <a href="./" class="btn-pri" style="margin-top: 12px; display: inline-flex; align-items: center; justify-content: center; text-decoration: none; padding: 12px 24px; border-radius: 999px; background: var(--pri); color: #fff; font-weight: 700;">
      Return to Home
    </a>
  </div>
</body>
</html>
`;
fs.writeFileSync(path.join(PUBLIC_DIR, '404.html'), notFoundHtml, 'utf8');
console.log('Generated: 404.html');

console.log('\n=== BUILD COMPLETE: public/ is ready for Vercel deployment ===\n');
