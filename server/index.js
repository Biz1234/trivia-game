// server/index.js
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('./sockets/game')(io);
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const db = require('./config/db');

app.use(express.json());
app.use('/auth', authRoutes);
app.use('/rooms', roomRoutes);

app.get('/stats/:userId', async (req, res) => {
  try {
    const [stats] = await db.query('SELECT * FROM player_stats WHERE user_id = ?', [req.params.userId]);
    if (stats.length === 0) {
      return res.json({ games_played: 0, games_won: 0, total_score: 0 });
    }
    res.json(stats[0]);
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

http.listen(5000, () => {
  console.log('Server running on port 5000');
});