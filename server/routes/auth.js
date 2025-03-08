// server/routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    console.log('Registration failed: Missing fields', { username, password }); // Debug
    return res.status(400).send('Username and password are required');
  }

  try {
    const [existingUsers] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (existingUsers.length > 0) {
      console.log('Registration failed: Username taken', { username }); // Debug
      return res.status(409).send('Username already taken');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hashedPassword]
    );
    console.log('User registered:', { id: result.insertId, username }); // Debug
    res.status(201).send('User registered successfully');
  } catch (err) {
    console.error('Error during registration:', err);
    res.status(500).send('Server error during registration');
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    console.log('Login failed: Missing fields', { username, password }); // Debug
    return res.status(400).send('Username and password are required');
  }

  try {
    const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) {
      console.log('Login failed: User not found', { username }); // Debug
      return res.status(401).send('Invalid username or password');
    }

    const user = users[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log('Login failed: Invalid password', { username }); // Debug
      return res.status(401).send('Invalid username or password');
    }

    console.log('User logged in:', { id: user.id, username }); // Debug
    res.json({ id: user.id, username });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).send('Server error during login');
  }
});

module.exports = router;