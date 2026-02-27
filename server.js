require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { getDB } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'axexvx.link';

// ─── Security & Middleware ────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "fonts.gstatic.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  }
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

const shortenLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Too many shorten requests. Please wait a moment.' }
});

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
  index: false // We handle index manually
}));

// Serve HTML pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/docs', (req, res) => res.sendFile(path.join(__dirname, 'public', 'docs.html')));
app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, 'public', 'privacy.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(__dirname, 'public', 'terms.html')));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/links', apiLimiter, require('./routes/links'));
app.use('/api/stats', apiLimiter, require('./routes/stats'));
app.use('/api/sms', apiLimiter, require('./routes/sms'));

// POST /api/shorten — convenience alias
app.post('/api/shorten', shortenLimiter, (req, res, next) => {
  req.url = '/';
  require('./routes/links')(req, res, next);
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  const db = getDB();
  const linkCount = db.prepare('SELECT COUNT(*) as count FROM links').get().count;
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    db: { links: linkCount }
  });
});

// ─── Short Link Redirect ──────────────────────────────────────────────────────
app.get('/:code', (req, res) => {
  const { code } = req.params;

  // Skip known static routes
  const staticRoutes = ['favicon.ico', 'robots.txt', 'sitemap.xml'];
  if (staticRoutes.includes(code)) return res.status(404).send('Not found');

  const db = getDB();
  const now = Math.floor(Date.now() / 1000);

  const link = db.prepare(`
    SELECT * FROM links
    WHERE code = ? AND is_active = 1
    AND (expires_at IS NULL OR expires_at > ?)
  `).get(code, now);

  if (!link) {
    return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'), (err) => {
      if (err) res.status(404).send('<h1>404 — Link not found</h1><p><a href="/">Go home</a></p>');
    });
  }

  // Check max clicks
  if (link.max_clicks) {
    const clickCount = db.prepare('SELECT COUNT(*) as count FROM clicks WHERE link_id = ?').get(link.id).count;
    if (clickCount >= link.max_clicks) {
      return res.status(410).send('<h1>410 — Link expired</h1><p>This link has reached its maximum click limit.</p>');
    }
  }

  // Record click
  const ua = req.headers['user-agent'] || '';
  const device = /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop';
  const referer = req.headers['referer'] || req.headers['referrer'] || null;
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

  db.prepare(`
    INSERT INTO clicks (link_id, ip, user_agent, referer, device)
    VALUES (?, ?, ?, ?, ?)
  `).run(link.id, ip, ua.substring(0, 500), referer, device);

  // Redirect
  return res.redirect(301, link.original);
});

// ─── 404 fallback ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Axexvx.link server running on http://localhost:${PORT}`);
  console.log(`📦 Database: ./data/axexvx.db`);
  console.log(`🌐 Base domain: ${BASE_DOMAIN}`);
});

module.exports = app;
