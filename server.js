// LFGOS Sports Fiesta 2026 - Local Development & PWA Server
// Strictly calls api/public_feed.js handler directly so local dev and Vercel run identical code.
// Zero Base44 SDK dependency. Upstream proxy handles Render connection.

const http = require('http');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || '').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    });
  }
} catch (e) {}

const PORT = parseInt(process.env.PORT, 10) || 3000;
const PUBLIC_DIR = fs.existsSync(path.join(__dirname, 'public'))
  ? path.join(__dirname, 'public')
  : __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json'
};

const publicFeedHandler = require('./api/public_feed');

// Rate limiting (60 requests per minute per IP)
const ipRequests = new Map();
function isRateLimited(ip) {
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost') return false;
  const now = Date.now();
  const record = ipRequests.get(ip) || [];
  const valid = record.filter(t => now - t < 60000);
  if (valid.length >= 120) return true;
  valid.push(now);
  ipRequests.set(ip, valid);
  return false;
}

/**
 * Augment native http.ServerResponse with Express/Vercel helper methods.
 */
function enhanceResponse(res) {
  if (!res.status) {
    res.status = function(code) {
      this.statusCode = code;
      return this;
    };
  }
  if (!res.json) {
    res.json = function(data) {
      this.setHeader('Content-Type', 'application/json; charset=utf-8');
      this.end(JSON.stringify(data));
      return this;
    };
  }
  if (!res.send) {
    res.send = function(body) {
      if (typeof body === 'object' && body !== null && !Buffer.isBuffer(body)) {
        return this.json(body);
      }
      this.end(body);
      return this;
    };
  }
}

const server = http.createServer(async (req, res) => {
  enhanceResponse(res);
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

  if (isRateLimited(clientIp)) {
    res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' });
    return res.end(JSON.stringify({ error: 'Too Many Requests', retryAfter: 60 }));
  }

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = parsedUrl.pathname;

  // Delegate /api/public_feed directly to Vercel function handler
  if (pathname === '/api/public_feed' || pathname === '/api/public_feed.js') {
    try {
      await publicFeedHandler(req, res);
    } catch (err) {
      console.error('[Server Error in publicFeedHandler]:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal Server Error', message: err.message });
      }
    }
    return;
  }

  // Static files handling
  if (pathname === '/') pathname = '/index.html';
  let filePath = path.join(PUBLIC_DIR, pathname);

  // Security check: stay within PUBLIC_DIR or root
  if (!filePath.startsWith(PUBLIC_DIR) && !filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  // Check if file exists in PUBLIC_DIR; fallback to root if not
  if (!fs.existsSync(filePath)) {
    const rootFallback = path.join(__dirname, pathname);
    if (fs.existsSync(rootFallback)) {
      filePath = rootFallback;
    }
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Clean SPA routing: serve index.html for unknown routes without hashes
      const indexPath = fs.existsSync(path.join(PUBLIC_DIR, 'index.html'))
        ? path.join(PUBLIC_DIR, 'index.html')
        : path.join(__dirname, 'index.html');

      fs.readFile(indexPath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('Not Found');
        }
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, must-revalidate'
        });
        res.end(content);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Caching headers
    if (pathname.includes('/assets/') || pathname.includes('/vendor/') || /fiesta\.[a-f0-9]+\.css/.test(pathname) || /app\.[a-f0-9]+\.js/.test(pathname)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (ext === '.html' || ext === '.json' || pathname === '/sw.js') {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    }

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🏆 LFGOS Sports Fiesta 2026 Dev Server Running!`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`🔗 Upstream: ${process.env.RENDER_API_BASE || 'https://lfgos-api.onrender.com'}`);
    console.log(`⚡ Mode: Identical to Vercel Serverless Function`);
    console.log(`==================================================\n`);
  });
}

module.exports = { server };
