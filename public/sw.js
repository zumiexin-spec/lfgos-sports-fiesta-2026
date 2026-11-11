/* LFGOS Sports Fiesta 2026 - Production Service Worker (458e819b) */
const CACHE_NAME = 'fiesta-cache-458e819b';
const DATA_CACHE_NAME = 'fiesta-data-458e819b';

const APP_SHELL = [
  './',
  './index.html',
  './app.6e173194.js',
  './fiesta.cf48f16a.css',
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
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|woff2|woff|ttf)$/i) ||
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
