import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '..');
const targetDir = 'E:\\fiesta-vercel';

console.log(`--- Assembling Clean Git-Ready Vercel Project in ${targetDir} ---`);

// 1. Create target directory
if (fs.existsSync(targetDir)) {
  fs.rmSync(targetDir, { recursive: true, force: true });
}
fs.mkdirSync(targetDir, { recursive: true });

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

// 2. Ensure fresh production build in srcDir/public
console.log('Running fresh production build...');
execSync('node tools/build.mjs', { cwd: srcDir, stdio: 'inherit' });

// 3. Copy public/ folder
console.log('Copying public/ distribution...');
copyRecursive(path.join(srcDir, 'public'), path.join(targetDir, 'public'));

// 4. Copy api/ folder
console.log('Copying api/ serverless lambdas...');
copyRecursive(path.join(srcDir, 'api'), path.join(targetDir, 'api'));

// 5. Copy tests/ folder
console.log('Copying tests/ suite...');
copyRecursive(path.join(srcDir, 'tests'), path.join(targetDir, 'tests'));

// 6. Copy tools/ folder
console.log('Copying tools/ directory...');
copyRecursive(path.join(srcDir, 'tools'), path.join(targetDir, 'tools'));

// 7. Copy root source files for build reproduction
copyRecursive(path.join(srcDir, 'app.js'), path.join(targetDir, 'app.js'));
copyRecursive(path.join(srcDir, 'fiesta.css'), path.join(targetDir, 'fiesta.css'));
copyRecursive(path.join(srcDir, 'index.html'), path.join(targetDir, 'index.html'));
copyRecursive(path.join(srcDir, 'manifest.json'), path.join(targetDir, 'manifest.json'));
copyRecursive(path.join(srcDir, 'public_feed.json'), path.join(targetDir, 'public_feed.json'));
copyRecursive(path.join(srcDir, 'fiesta.png'), path.join(targetDir, 'fiesta.png'));
copyRecursive(path.join(srcDir, 'LICENSES'), path.join(targetDir, 'LICENSES'));
copyRecursive(path.join(srcDir, 'assets'), path.join(targetDir, 'assets'));
copyRecursive(path.join(srcDir, 'vendor'), path.join(targetDir, 'vendor'));
copyRecursive(path.join(srcDir, 'exports'), path.join(targetDir, 'exports'));

// 8. Copy or create root config files
console.log('Creating root configuration and documentation files...');

// vercel.json
copyRecursive(path.join(srcDir, 'vercel.json'), path.join(targetDir, 'vercel.json'));

// .vercelignore
copyRecursive(path.join(srcDir, '.vercelignore'), path.join(targetDir, '.vercelignore'));

// .gitignore
const gitignoreContent = `# Dependencies
node_modules/
.pnpm-store/

# Environment Variables
.env
.env.*
!.env.example

# Local logs and test outputs
*.log
test-results/
.system_generated/
scratch/

# OS metadata
Thumbs.db
.DS_Store
`;
fs.writeFileSync(path.join(targetDir, '.gitignore'), gitignoreContent, 'utf8');

// .gitattributes
const gitattributesContent = `* text=auto eol=lf
*.png binary
*.jpg binary
*.webp binary
*.mp4 binary
*.webm binary
*.wav binary
*.ico binary
`;
fs.writeFileSync(path.join(targetDir, '.gitattributes'), gitattributesContent, 'utf8');

// .env.example
const envExampleContent = `# Base44 Read-Only API Credentials (Server-side only)
# Never expose these keys in browser JS or commit actual values to Git
BASE44_APP_ID=<your_base44_app_id>
BASE44_APP_SECRET=<your_base44_read_only_secret>
PORT=3000
NODE_ENV=production
`;
fs.writeFileSync(path.join(targetDir, '.env.example'), envExampleContent, 'utf8');

// package.json for fiesta-vercel
const vercelPkg = {
  name: "lfgos-sports-fiesta-2026",
  version: "1.0.0",
  private: true,
  description: "Official public read-only PWA and feed server for LFGOS Sports Fiesta 2026",
  main: "public/index.html",
  engines: {
    node: ">=18.0.0"
  },
  scripts: {
    build: "node tools/build.mjs",
    dev: "node server.js",
    start: "node server.js",
    test: "node tests/mock_upstream.test.mjs && node tests/unit.test.mjs",
    "test:ui": "node tests/ui.test.mjs"
  },
  dependencies: {
    "@base44/sdk": "^0.8.59",
    "dotenv": "^18.0.10"
  },
  devDependencies: {
    "axe-core": "^4.14.0",
    "playwright": "^1.65.0"
  }
};
fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify(vercelPkg, null, 2), 'utf8');

// server.js for local development
copyRecursive(path.join(srcDir, 'server.js'), path.join(targetDir, 'server.js'));

// .github/workflows/ci.yml
const ciDir = path.join(targetDir, '.github', 'workflows');
fs.mkdirSync(ciDir, { recursive: true });
const ciContent = `name: CI Audit & Build

on:
  push:
    branches: [ main, staging ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Build Production Assets
        run: npm run build

      - name: Run Unit & Upstream Tests
        run: npm test
`;
fs.writeFileSync(path.join(ciDir, 'ci.yml'), ciContent, 'utf8');

// README.md
const readmeContent = `# LFGOS Sports Fiesta 2026 — Official Public Portal

Official read-only Progressive Web App (PWA) and live feed service for the **Little Flower Group of Schools (LFGOS) Sports Fiesta 2026**.

- **Venue:** Dr. Bhimrao Ambedkar Sports Stadium, Mau, Uttar Pradesh
- **Match Days:**
  - **13 Nov 2026:** Cricket Day 1
  - **14 Nov 2026:** All other events, Finals & Official Live Stream
- **Official Contact:** [https://lfcsschools.com/](https://lfcsschools.com/)
- **Theme Support:** Light, Dark, Auto (System Default)

## Key Technical Features
1. **Zero Client Secrets:** The browser code never holds tokens, API keys, or SDK clients. All public requests call \`/api/public_feed\`.
2. **Deterministic Scoring:** Real-time points calculated directly from PointsLedger excluding reversed entries; medals strictly from approved results.
3. **Animated Logo Experience:** Session-scoped (max 1.8s) SVG progress ring splash, topbar pop and idle sheens, live moment Action Orange pulse.
4. **Vercel Serverless Ready:** Mumbai (\`bom1\`) edge deployment with immutable content-hashed asset caching, stale-while-revalidate public feed, and strict CSP headers.

## Quick Start (Local Development)
\`\`\`bash
# 1. Install dependencies
npm install

# 2. Build production assets
npm run build

# 3. Start local development server
npm run dev
# Server runs on http://localhost:3000
\`\`\`

## Testing & Quality Assurance
\`\`\`bash
# Run unit tests and mock upstream sync tests
npm test

# Run full Playwright UI & axe-core accessibility audit
npm run test:ui
\`\`\`
`;
fs.writeFileSync(path.join(targetDir, 'README.md'), readmeContent, 'utf8');

// RUNBOOK.md
const runbookContent = `# LFGOS Sports Fiesta 2026 — Tournament Operations Runbook

## 1. Architecture Overview
\`\`\`
Browser (PWA)
   │ (Read-Only GET /api/public_feed with ETag)
   ▼
Vercel Serverless Lambda (bom1 Mumbai)
   │ (Cached 15s in memory, ETag validation)
   │ (Server-side credentials in Vercel Environment Variables)
   ▼
Base44 Backend Tables & Functions
   ├── School
   ├── SportEvent
   ├── TeamCompetition
   ├── EventResult (Approved results only)
   ├── Fixture (Completed winners only)
   ├── PointsLedger (Reversed entries strictly excluded)
   ├── MediaItem (Approved & consent_approved only)
   └── DisplayState
\`\`\`

## 2. Deployment Instructions (Vercel)
\`\`\`bash
# Install Vercel CLI if needed
npm install -g vercel

# Deploy to Vercel Preview
vercel

# Deploy to Vercel Production
vercel --prod
\`\`\`

### Required Environment Variables in Vercel Project Settings:
- \`BASE44_APP_ID\`: Base44 Application ID
- \`BASE44_APP_SECRET\`: Base44 Read-Only Secret Token
- \`NODE_ENV\`: \`production\`

## 3. Live Matchday Procedures
- **13 Nov 2026 (Cricket Day 1):** Live arena displays scheduled broadcast placeholder ("Starts 14 Nov 2026 at 09:00 AM IST"). Cricket matches and scores update live.
- **14 Nov 2026 (Grand Championship):** YouTube Live Stream activates automatically when stream status is set to \`live\` in Base44 DisplayState.
`;
fs.writeFileSync(path.join(targetDir, 'RUNBOOK.md'), runbookContent, 'utf8');

// CHANGELOG.md
const changelogContent = `# Changelog - LFGOS Sports Fiesta 2026

## [1.0.0] - 2026-11-10 (Production Release)
- **Animated Logo Experience:**
  - Session-scoped 1.8s splash screen with circular drawing progress ring, logo scale, light sweep, and "PLAY • COMPETE • ACHIEVE" tagline.
  - Top bar logo with tap spring pop and idle diagonal sheen.
  - Fullscreen loader with circular SVG progress ring and logo.
  - Live Moment Action Orange ring pulse on Live tab raised button.
  - Generated iOS startup images for all standard iPhone viewport ratios on Ice background.
  - Exported 1080p 3-second MP4 and transparent WebM stream loops into \`/exports/\`.
- **UI/UX & Visual Refinements:**
  - Enforced 5-item bottom nav with raised center Live button.
  - Standardized school crest shields (\`.c20\` through \`.c160\`), never circular.
  - Bracket cards standardized to compact 72px height with truncated school names.
  - Inlined 25-symbol Lucide SVG sprite for crisp rendering and zero icon pop-in.
  - Gold exclusively reserved for 1st place winners; Action Orange for LIVE and alerts.
- **Data & Scoring Integrity:**
  - Points calculated from PointsLedger strictly excluding reversed entries.
  - Medals calculated exclusively from approved/completed event results.
  - Matches won calculated exclusively from completed fixtures.
  - Probe and test announcements filtered out.
  - Photos restricted to active and consent-approved items.
- **Vercel Readiness:**
  - Configured \`bom1\` (Mumbai) serverless region.
  - Implemented immutable content-hashed asset caching.
  - Added preview deployment ribbon for preview branches.
  - Established secret scan and static file shield (HTTP 403/404 on sensitive paths).
`;
fs.writeFileSync(path.join(targetDir, 'CHANGELOG.md'), changelogContent, 'utf8');

console.log('\n[SUCCESS] E:\\fiesta-vercel created and fully assembled!');
