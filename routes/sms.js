const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');

// POST /api/sms — create SMS campaign
router.post('/', (req, res) => {
  const { name, sender_id, message, phone_numbers, scheduled_at } = req.body;

  if (!name) return res.status(400).json({ error: 'Campaign name is required' });
  if (!sender_id) return res.status(400).json({ error: 'Sender ID is required' });
  if (!message) return res.status(400).json({ error: 'Message is required' });
  if (!phone_numbers || !Array.isArray(phone_numbers) || phone_numbers.length === 0) {
    return res.status(400).json({ error: 'At least one phone number is required' });
  }

  const db = getDB();

  const stmt = db.prepare(`
    INSERT INTO sms_campaigns (name, sender_id, message, phone_numbers, scheduled_at, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    name,
    sender_id,
    message,
    JSON.stringify(phone_numbers),
    scheduled_at ? Math.floor(new Date(scheduled_at).getTime() / 1000) : null,
    scheduled_at ? 'scheduled' : 'pending'
  );

  const campaign = db.prepare('SELECT * FROM sms_campaigns WHERE id = ?').get(result.lastInsertRowid);

  return res.status(201).json({
    ...campaign,
    phone_numbers: JSON.parse(campaign.phone_numbers),
    recipient_count: phone_numbers.length,
    message: 'Campaign created. Pro/Business plan required for live SMS sending.'
  });
});

// GET /api/sms — list campaigns
router.get('/', (req, res) => {
  const db = getDB();
  const campaigns = db.prepare('SELECT * FROM sms_campaigns ORDER BY created_at DESC LIMIT 50').all();

  return res.json(campaigns.map(c => ({
    ...c,
    phone_numbers: JSON.parse(c.phone_numbers),
    recipient_count: JSON.parse(c.phone_numbers).length
  })));
});

// GET /api/sms/:id — get campaign details
router.get('/:id', (req, res) => {
  const db = getDB();
  const campaign = db.prepare('SELECT * FROM sms_campaigns WHERE id = ?').get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  return res.json({
    ...campaign,
    phone_numbers: JSON.parse(campaign.phone_numbers),
    recipient_count: JSON.parse(campaign.phone_numbers).length
  });
});

module.exports = router;
