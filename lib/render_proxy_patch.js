/**
 * LFGOS Sports Fiesta 2026 - Render Proxy Security Patch
 * Drop-in security middleware for the Render proxy server (Express / Fastify / Node).
 *
 * Requirements:
 * 1. Require X-Proxy-Key on every route except /health (constant-time compare; 401 otherwise).
 * 2. Support PROXY_KEY_NEXT for zero-downtime key rotation.
 * 3. Deny by default: 404 for forbidden slugs (access_code, audit_log, user, registration, protest, verify_code).
 * 4. 405 Method Not Allowed for non-GET entity requests.
 * 5. No CORS (browsers should never call Render directly).
 * 6. Input validation on entity slugs and IDs (alphanumeric only).
 * 7. Redact secrets from logs.
 * 8. Per-IP rate limiting (120 req/min).
 */

const crypto = require('crypto');

const ALLOWED_ENTITIES = new Set([
  'school',
  'points_config',
  'sport_event',
  'team_competition',
  'fixture',
  'event_result',
  'points_ledger',
  'announcement',
  'display_state',
  'live_snapshot',
  'media_item'
]);

const ALLOWED_FUNCTIONS = new Set([
  'tournament.sync',
  'display.get_state'
]);

// In-memory sliding window rate limiter
const ipRequestCounts = new Map();
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 120;

function isRateLimited(ip) {
  const now = Date.now();
  const record = ipRequestCounts.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + RATE_LIMIT_WINDOW_MS;
    ipRequestCounts.set(ip, record);
    return false;
  }
  record.count++;
  ipRequestCounts.set(ip, record);
  return record.count > MAX_REQUESTS_PER_WINDOW;
}

/**
 * Constant-time string equality check to prevent timing attacks.
 */
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Validates request proxy key against PROXY_KEY or PROXY_KEY_NEXT.
 */
function isValidProxyKey(providedKey) {
  if (!providedKey) return false;
  const currentKey = process.env.PROXY_KEY || process.env.RENDER_PROXY_KEY;
  const nextKey = process.env.PROXY_KEY_NEXT;

  if (currentKey && safeCompare(providedKey, currentKey)) return true;
  if (nextKey && safeCompare(providedKey, nextKey)) return true;

  // Fallback for development if no key configured
  if (!currentKey && !nextKey && process.env.NODE_ENV !== 'production') {
    return true;
  }

  return false;
}

/**
 * Express / Node.js Middleware
 */
function renderSecurityMiddleware(req, res, next) {
  const urlPath = req.path || req.url.split('?')[0];

  // 1. Health check is always public
  if (urlPath === '/health') {
    return next();
  }

  // 2. Per-IP Rate Limiting
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' });
    return res.end(JSON.stringify({ error: 'Too Many Requests', message: 'Rate limit exceeded.' }));
  }

  // 3. Remove CORS headers (Browsers must not access Render directly)
  if (res.removeHeader) {
    res.removeHeader('Access-Control-Allow-Origin');
    res.removeHeader('Access-Control-Allow-Credentials');
  }

  // 4. Require X-Proxy-Key with constant-time comparison
  const providedKey = req.headers['x-proxy-key'];
  if (!isValidProxyKey(providedKey)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      error: 'Unauthorized',
      message: 'Valid X-Proxy-Key header required.'
    }));
  }

  // 5. Parse and validate /v1/ entity routes
  const v1Match = urlPath.match(/^\/v1\/([a-zA-Z0-9_-]+)(?:\/([a-zA-Z0-9_-]+))?$/);
  if (v1Match) {
    const slug = v1Match[1].toLowerCase();
    const id = v1Match[2];

    // Functions allowlist check
    if (slug === 'fn') {
      const fnName = req.url.split('/v1/fn/')[1]?.split('?')[0];
      if (!ALLOWED_FUNCTIONS.has(fnName)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Not Found', message: 'Unknown function' }));
      }
      return next();
    }

    // Entity allowlist check: Deny by default (404 for forbidden slugs)
    if (!ALLOWED_ENTITIES.has(slug)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        error: 'Not Found',
        message: 'Entity not found or access restricted.'
      }));
    }

    // Enforce GET/HEAD only on entity endpoints
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'application/json', 'Allow': 'GET, HEAD' });
      return res.end(JSON.stringify({
        error: 'Method Not Allowed',
        message: 'Only read-only GET requests are permitted on entity endpoints.'
      }));
    }

    // Validate ID if present (alphanumeric, max 64 chars)
    if (id && !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Bad Request', message: 'Invalid ID parameter.' }));
    }

    return next();
  }

  // Any other unmatched route -> 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
}

module.exports = {
  renderSecurityMiddleware,
  safeCompare,
  isValidProxyKey,
  ALLOWED_ENTITIES
};
