# Changelog - LFGOS Sports Fiesta 2026

## [1.0.0] - 2026-11-10 (Production Release)
- **Animated Logo Experience:**
  - Session-scoped 1.8s splash screen with circular drawing progress ring, logo scale, light sweep, and "PLAY • COMPETE • ACHIEVE" tagline.
  - Top bar logo with tap spring pop and idle diagonal sheen.
  - Fullscreen loader with circular SVG progress ring and logo.
  - Live Moment Action Orange ring pulse on Live tab raised button.
  - Generated iOS startup images for all standard iPhone viewport ratios on Ice background.
  - Exported 1080p 3-second MP4 and transparent WebM stream loops into `/exports/`.
- **UI/UX & Visual Refinements:**
  - Enforced 5-item bottom nav with raised center Live button.
  - Standardized school crest shields (`.c20` through `.c160`), never circular.
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
  - Configured `bom1` (Mumbai) serverless region.
  - Implemented immutable content-hashed asset caching.
  - Added preview deployment ribbon for preview branches.
  - Established secret scan and static file shield (HTTP 403/404 on sensitive paths).
