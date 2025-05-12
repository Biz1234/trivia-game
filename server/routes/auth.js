// server/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../config/db');

router.post('/register', async (req, res) => {
  const { username, password, avatar } = req.body;
  try {
    const [existing] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (username, password, avatar) VALUES (?, ?, ?)',
      [username, hashedPassword, avatar || '😊']
    );
    res.status(201).json({ userId: result.insertId, username, avatar: avatar || '😊' });
  } catch (err) {
    console.error('Error in register:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    const user = users[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    res.json({ userId: user.id, username: user.username, avatar: user.avatar });
  } catch (err) {
    console.error('Error in login:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;