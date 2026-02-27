const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

// GET /api/stats — global platform stats
router.get('/', (req, res) => {
  const db = getDB();

  const totalLinks = db.prepare('SELECT COUNT(*) as count FROM links WHERE is_active = 1').get().count;
  const totalClicks = db.prepare('SELECT COUNT(*) as count FROM clicks').get().count;
  const totalCampaigns = db.prepare('SELECT COUNT(*) as count FROM sms_campaigns').get().count;
  const totalApks = db.prepare('SELECT COUNT(*) as count FROM apk_files').get().count;

  // Links created in last 24h
  const recentLinks = db.prepare(`
    SELECT COUNT(*) as count FROM links
    WHERE created_at > unixepoch() - 86400 AND is_active = 1
  `).get().count;

  // Clicks in last 24h
  const recentClicks = db.prepare(`
    SELECT COUNT(*) as count FROM clicks
    WHERE clicked_at > unixepoch() - 86400
  `).get().count;

  return res.json({
    total_links: totalLinks,
    total_clicks: totalClicks,
    total_campaigns: totalCampaigns,
    total_apks: totalApks,
    links_last_24h: recentLinks,
    clicks_last_24h: recentClicks
  });
});

// GET /api/stats/:code — stats for a specific link
router.get('/:code', (req, res) => {
  const db = getDB();
  const { code } = req.params;

  const link = db.prepare('SELECT * FROM links WHERE code = ? AND is_active = 1').get(code);
  if (!link) return res.status(404).json({ error: 'Link not found' });

  const totalClicks = db.prepare('SELECT COUNT(*) as count FROM clicks WHERE link_id = ?').get(link.id).count;

  // Clicks by day (last 30 days)
  const clicksByDay = db.prepare(`
    SELECT date(clicked_at, 'unixepoch') as day, COUNT(*) as count
    FROM clicks
    WHERE link_id = ? AND clicked_at > unixepoch() - 2592000
    GROUP BY day
    ORDER BY day ASC
  `).all(link.id);

  // Top countries
  const topCountries = db.prepare(`
    SELECT country, COUNT(*) as count
    FROM clicks WHERE link_id = ? AND country IS NOT NULL
    GROUP BY country ORDER BY count DESC LIMIT 10
  `).all(link.id);

  // Top devices
  const topDevices = db.prepare(`
    SELECT device, COUNT(*) as count
    FROM clicks WHERE link_id = ? AND device IS NOT NULL
    GROUP BY device ORDER BY count DESC LIMIT 5
  `).all(link.id);

  // Top referrers
  const topReferrers = db.prepare(`
    SELECT referer, COUNT(*) as count
    FROM clicks WHERE link_id = ? AND referer IS NOT NULL
    GROUP BY referer ORDER BY count DESC LIMIT 10
  `).all(link.id);

  return res.json({
    link: {
      ...link,
      short_url: `https://${link.domain}/${link.code}`
    },
    total_clicks: totalClicks,
    clicks_by_day: clicksByDay,
    top_countries: topCountries,
    top_devices: topDevices,
    top_referrers: topReferrers
  });
});

module.exports = router;
