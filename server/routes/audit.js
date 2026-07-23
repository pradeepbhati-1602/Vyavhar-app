const express = require('express');
const router = express.Router();
const { dbAll } = require('../db');
const { authenticateToken, requireRole } = require('./auth');

// GET audit logs (Owner only)
router.get('/', authenticateToken, requireRole('Owner'), async (req, res) => {
  const { limit = 200, action } = req.query;
  let sql = 'SELECT * FROM audit_logs';
  const params = [];

  if (action) {
    sql += ' WHERE action = ?';
    params.push(action);
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  try {
    const logs = await dbAll(sql, params);
    res.json(logs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to retrieve audit log trail' });
  }
});

module.exports = router;
