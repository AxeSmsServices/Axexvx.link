const express = require('express');
const router = express.Router();
const { nanoid } = require('nanoid');
const validUrl = require('valid-url');
const { getDB } = require('../db/database');

// POST /api/links — shorten a URL
router.post('/', (req, res) => {
  const { url, alias, domain = 'axexvx.link', expires_at, max_clicks } = req.body;

  if (!url) return res.status(400).json({ error: 'URL is required' });
  if (!validUrl.isWebUri(url)) return res.status(400).json({ error: 'Invalid URL. Must start with http:// or https://' });

  const db = getDB();

  // Check alias uniqueness
  const code = alias ? alias.trim().replace(/[^a-zA-Z0-9_-]/g, '') : nanoid(6);
  if (!code) return res.status(400).json({ error: 'Invalid alias' });

  const existing = db.prepare('SELECT id FROM links WHERE code = ? AND domain = ?').get(code, domain);
  if (existing) return res.status(409).json({ error: 'Alias already taken. Choose a different one.' });

  const stmt = db.prepare(`
    INSERT INTO links (code, original, domain, alias, expires_at, max_clicks)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  try {
    const result = stmt.run(
      code,
      url,
      domain,
      alias || null,
      expires_at ? Math.floor(new Date(expires_at).getTime() / 1000) : null,
      max_clicks || null
    );

    const link = db.prepare('SELECT * FROM links WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json({
      id: link.id,
      short_url: `https://${link.domain}/${link.code}`,
      code: link.code,
      original: link.original,
      domain: link.domain,
      created_at: link.created_at
    });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Alias already taken.' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/links — list all links (paginated)
router.get('/', (req, res) => {
  const db = getDB();
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  const links = db.prepare(`
    SELECT l.*, COUNT(c.id) as click_count
    FROM links l
    LEFT JOIN clicks c ON c.link_id = l.id
    WHERE l.is_active = 1
    GROUP BY l.id
    ORDER BY l.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  const total = db.prepare('SELECT COUNT(*) as count FROM links WHERE is_active = 1').get().count;

  return res.json({
    links: links.map(l => ({
      ...l,
      short_url: `https://${l.domain}/${l.code}`
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
});

// GET /api/links/:code — get link info + stats
router.get('/:code', (req, res) => {
  const db = getDB();
  const { code } = req.params;

  const link = db.prepare('SELECT * FROM links WHERE code = ? AND is_active = 1').get(code);
  if (!link) return res.status(404).json({ error: 'Link not found' });

  const clicks = db.prepare('SELECT COUNT(*) as count FROM clicks WHERE link_id = ?').get(link.id);
  const recent = db.prepare(`
    SELECT clicked_at, country, device, referer
    FROM clicks WHERE link_id = ?
    ORDER BY clicked_at DESC LIMIT 10
  `).all(link.id);

  return res.json({
    ...link,
    short_url: `https://${link.domain}/${link.code}`,
    click_count: clicks.count,
    recent_clicks: recent
  });
});

// DELETE /api/links/:code — deactivate a link
router.delete('/:code', (req, res) => {
  const db = getDB();
  const { code } = req.params;

  const link = db.prepare('SELECT id FROM links WHERE code = ? AND is_active = 1').get(code);
  if (!link) return res.status(404).json({ error: 'Link not found' });

  db.prepare('UPDATE links SET is_active = 0, updated_at = unixepoch() WHERE id = ?').run(link.id);
  return res.json({ success: true, message: 'Link deactivated' });
});

module.exports = router;
