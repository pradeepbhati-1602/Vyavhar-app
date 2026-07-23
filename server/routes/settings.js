const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { dbRun, dbGet, dbAll, logAuditEvent } = require('../db');
const { authenticateToken, requireRole } = require('./auth');

// GET settings (returns simple key-value object)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM settings');
    const settings = {};
    rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json(settings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// POST save settings (Owner role only)
router.post('/', authenticateToken, requireRole('Owner'), async (req, res) => {
  const settingsData = req.body;
  if (!settingsData || typeof settingsData !== 'object') {
    return res.status(400).json({ error: 'Settings object is required' });
  }

  try {
    for (const [key, value] of Object.entries(settingsData)) {
      await dbRun('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?', [key, String(value), String(value)]);
    }
    await logAuditEvent(req.user?.user_id, req.user?.username, 'Settings Updated', { updated_keys: Object.keys(settingsData) });

    res.json({ message: 'Settings saved successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// GET users lists (Owner role only)
router.get('/users', authenticateToken, requireRole('Owner'), async (req, res) => {
  try {
    const users = await dbAll(`
      SELECT u.user_id, u.username, u.role, u.name, u.store_id, u.cross_store_read, u.created_at, s.store_name
      FROM users u
      LEFT JOIN stores s ON u.store_id = s.store_id
    `);
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch employees list' });
  }
});

// POST create user (Owner role only)
router.post('/users', authenticateToken, requireRole('Owner'), async (req, res) => {
  const { username, password, role, name, store_id } = req.body;
  if (!username || !password || !role || !name) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const existing = await dbGet('SELECT * FROM users WHERE username = ?', [username.toLowerCase()]);
    if (existing) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    let finalStoreId = store_id || null;
    if (!finalStoreId && role === 'Employee') {
      const defaultStore = await dbGet('SELECT store_id FROM stores LIMIT 1');
      if (defaultStore) {
        finalStoreId = defaultStore.store_id;
      }
    }

    const hashedPwd = await bcrypt.hash(password, 10);
    const userId = 'usr-' + Date.now();
    await dbRun('INSERT INTO users (user_id, username, password, role, name, store_id) VALUES (?, ?, ?, ?, ?, ?)', 
      [userId, username.toLowerCase(), hashedPwd, role, name, finalStoreId]);

    await logAuditEvent(req.user?.user_id, req.user?.username, 'User Account Created', { target_username: username, role });

    const created = await dbGet('SELECT user_id, username, role, name, store_id FROM users WHERE user_id = ?', [userId]);
    res.status(201).json(created);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add employee account' });
  }
});

// PUT update user permissions (Owner role only)
router.put('/users/:id/permissions', authenticateToken, requireRole('Owner'), async (req, res) => {
  const { cross_store_read } = req.body;
  try {
    await dbRun('UPDATE users SET cross_store_read = ? WHERE user_id = ?', [cross_store_read ? 1 : 0, req.params.id]);
    await logAuditEvent(req.user?.user_id, req.user?.username, 'User Permissions Updated', { target_user_id: req.params.id, cross_store_read: !!cross_store_read });

    res.json({ message: 'Permissions updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update user permissions' });
  }
});

// DELETE user (Owner role only)
router.delete('/users/:id', authenticateToken, requireRole('Owner'), async (req, res) => {
  try {
    const userToDel = await dbGet('SELECT * FROM users WHERE user_id = ?', [req.params.id]);
    if (!userToDel) return res.status(404).json({ error: 'User not found' });
    
    if (userToDel.user_id === req.user.user_id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await dbRun('DELETE FROM users WHERE user_id = ?', [req.params.id]);
    await logAuditEvent(req.user?.user_id, req.user?.username, 'User Account Deleted', { target_username: userToDel.username });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
