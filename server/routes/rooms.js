// server/routes/rooms.js
const express = require('express');
const db = require('../config/db');
const router = express.Router();

// Generate a random 6-character room code
const generateRoomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Create a new room
router.post('/create', async (req, res) => {
  try {
    const roomCode = generateRoomCode();
    const [result] = await db.query('INSERT INTO game_rooms (room_code) VALUES (?)', [roomCode]);
    res.json({ roomId: result.insertId, roomCode });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating room');
  }
});

// Join an existing room
router.post('/join', async (req, res) => {
  const { roomCode } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM game_rooms WHERE room_code = ?', [roomCode]);
    if (rows.length === 0) {
      return res.status(404).send('Room not found');
    }
    if (rows[0].status !== 'waiting') {
      return res.status(400).send('Room is not accepting players');
    }
    res.json({ roomId: rows[0].id, roomCode });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error joining room');
  }
});

module.exports = router;