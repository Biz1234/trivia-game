// server/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors'); // Required for frontend-backend communication
const authRoutes = require('./routes/auth');
const questionRoutes = require('./routes/questions');
const roomRoutes = require('./routes/rooms');
const setupSockets = require('./sockets/game');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000', // Allow frontend origin
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(express.json()); // Parse JSON request bodies
app.use(cors({ origin: 'http://localhost:3000' })); // Enable CORS for API requests

// Routes
app.get('/', (req, res) => {
  res.send('Trivia Game Server Running'); // Basic health check
});
app.use('/auth', authRoutes); // Authentication routes (login/register)
app.use('/questions', questionRoutes); // Question-related routes
app.use('/rooms', roomRoutes); // Room management routes

// Socket.IO setup
setupSockets(io);

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`); // Confirm server start
});