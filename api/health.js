// Vercel Serverless Function: /api/health
module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.status(200).json({
    status: 'ok',
    event: 'LFGOS Sports Fiesta 2026',
    dates: '13 & 14 Nov 2026',
    venue: 'Dr. Bhimrao Ambedkar Sports Stadium, Mau',
    timestamp: new Date().toISOString()
  });
};
