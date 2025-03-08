// server/routes/questions.js
const express = require('express');
const db = require('../config/db');
const router = express.Router();

// Get all questions
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM questions');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

module.exports = router;