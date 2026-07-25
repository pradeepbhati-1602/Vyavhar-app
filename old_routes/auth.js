const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbGet } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'eyevengers_super_secret_key';

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Session expired or invalid token' });
    req.user = user;
    next();
  });
};

// Check role permission helper
const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user && req.user.role === role) {
      next();
    } else {
      res.status(403).json({ error: 'Permission denied. Owner role required.' });
    }
  };
};

// Login API
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username.toLowerCase()]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { userId: user.user_id, username: user.username, role: user.role, name: user.name, store_id: user.store_id, cross_store_read: user.cross_store_read },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        userId: user.user_id,
        username: user.username,
        role: user.role,
        name: user.name,
        store_id: user.store_id,
        cross_store_read: user.cross_store_read
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token API
router.get('/verify', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
module.exports.authenticateToken = authenticateToken;
module.exports.requireRole = requireRole;
