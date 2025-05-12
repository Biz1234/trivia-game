// server/sockets/game.js
const db = require('../config/db');

module.exports = (io) => {
  const rooms = {};

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinRoom', async ({ roomId, userId }) => {
      try {
        console.log('joinRoom event received:', { roomId, userId });
        const [roomRows] = await db.query('SELECT * FROM game_rooms WHERE id = ?', [roomId]);
        if (roomRows.length === 0) {
          socket.emit('error', 'Room not found');
          return;
        }
        const roomCode = roomRows[0].room_code;
        socket.join(roomCode);

        if (!rooms[roomCode]) {
          rooms[roomCode] = { players: [], questions: [], currentQuestion: 0, timer: null, id: roomId, chat: [] };
        }
        const [userRows] = await db.query('SELECT username, avatar FROM users WHERE id = ?', [userId]);
        const { username, avatar } = userRows[0] || { username: `Player ${userId}`, avatar: '😊' };
        rooms[roomCode].players.push({ socketId: socket.id, userId, username, avatar, score: 0, lastAnswer: null });
        console.log('Player joined room:', roomCode, 'Players:', rooms[roomCode].players);
        io.to(roomCode).emit('playerJoined', rooms[roomCode].players);
        socket.emit('chatHistory', rooms[roomCode].chat);
      } catch (err) {
        console.error('Error in joinRoom:', err);
        socket.emit('error', 'Error joining room');
      }
    });

    socket.on('startGame', async ({ roomId, categories, difficulty }) => {
      console.log('Received startGame event:', { roomId, categories, difficulty });
      try {
        const [roomRows] = await db.query('SELECT room_code FROM game_rooms WHERE id = ?', [roomId]);
        if (roomRows.length === 0) {
          socket.emit('error', 'Room not found');
          return;
        }
        const roomCode = roomRows[0].room_code;
        if (!rooms[roomCode]) {
          socket.emit('error', 'Room not initialized');
          return;
        }
        await db.query('UPDATE game_rooms SET status = "active" WHERE id = ?', [roomId]);

        const placeholders = categories.map(() => '?').join(',');
        let query = `SELECT * FROM questions WHERE category IN (${placeholders})`;
        const params = [...categories];
        if (difficulty !== 'mixed') {
          query += ' AND difficulty = ?';
          params.push(difficulty);
        }
        query += ' ORDER BY RAND() LIMIT 5';
        console.log('Executing query:', query, 'with params:', params);
        const [questions] = await db.query(query, params);
        console.log('Fetched questions:', questions);
        if (questions.length === 0) {
          socket.emit('error', 'No questions available for selected categories and difficulty');
          return;
        }
        rooms[roomCode].questions = questions;

        console.log('Starting game with', questions.length, 'questions');
        io.to(roomCode).emit('gameStarted', {
          questions: rooms[roomCode].questions,
          current: {
            question: questions[0],
            questionNumber: 1,
            totalQuestions: questions.length,
            timeLeft: 15
          }
        });
        startQuestionTimer(roomCode);
      } catch (err) {
        console.error('Error in startGame:', err);
        socket.emit('error', 'Error starting game');
      }
    });

    socket.on('submitAnswer', ({ roomCode, userId, answer }) => {
      const room = rooms[roomCode];
      if (!room || room.currentQuestion >= room.questions.length) return;

      const currentQ = room.questions[room.currentQuestion];
      const player = room.players.find(p => p.userId === userId);
      if (!player.lastAnswer) {
        const isCorrect = answer === currentQ.correct_answer;
        let points = 0; // Define points with default 0
        if (isCorrect) {
          points = currentQ.difficulty === 'easy' ? 5 : currentQ.difficulty === 'medium' ? 10 : 15;
          player.score += points;
        }
        player.lastAnswer = answer;
        console.log('Answer submitted:', { userId, answer, isCorrect, points });
        socket.emit('answerFeedback', { isCorrect, correctAnswer: currentQ.correct_answer });
        io.to(roomCode).emit('scoreUpdate', room.players.map(p => ({ username: p.username, avatar: p.avatar, score: p.score })));
      }

      const allAnswered = room.players.every(p => p.lastAnswer !== undefined);
      if (allAnswered) {
        clearTimeout(room.timer);
        moveToNextQuestion(roomCode);
      }
    });

    socket.on('sendMessage', ({ roomCode, userId, message }) => {
      const room = rooms[roomCode];
      if (!room) return;
      const player = room.players.find(p => p.userId === userId);
      if (!player) return;
      const chatMessage = { username: player.username, avatar: player.avatar, message, timestamp: Date.now() };
      room.chat.push(chatMessage);
      console.log('Chat message:', chatMessage);
      io.to(roomCode).emit('newMessage', chatMessage);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      for (const roomCode in rooms) {
        rooms[roomCode].players = rooms[roomCode].players.filter(p => p.socketId !== socket.id);
        io.to(roomCode).emit('playerJoined', rooms[roomCode].players);
      }
    });
  });

  function startQuestionTimer(roomCode) {
    const room = rooms[roomCode];
    broadcastQuestion(roomCode);
    room.timer = setTimeout(() => moveToNextQuestion(roomCode), 15000);
  }

  function broadcastQuestion(roomCode) {
    const room = rooms[roomCode];
    room.players.forEach(p => (p.lastAnswer = null));
    console.log('Broadcasting question:', room.questions[room.currentQuestion]);
    io.to(roomCode).emit('nextQuestion', {
      question: room.questions[room.currentQuestion],
      questionNumber: room.currentQuestion + 1,
      totalQuestions: room.questions.length,
      timeLeft: 15
    });
  }

  function moveToNextQuestion(roomCode) {
    const room = rooms[roomCode];
    room.currentQuestion++;
    if (room.currentQuestion < room.questions.length) {
      startQuestionTimer(roomCode);
    } else {
      endGame(roomCode);
    }
  }

  async function endGame(roomCode) {
    const room = rooms[roomCode];
    const scoresWithNames = room.players.map(player => ({
      username: player.username,
      avatar: player.avatar,
      score: player.score
    }));
    console.log('Game ended, sending scores:', scoresWithNames);
    io.to(roomCode).emit('gameEnded', { scores: scoresWithNames });

    const maxScore = Math.max(...room.players.map(p => p.score));
    for (const player of room.players) {
      const isWinner = player.score === maxScore && maxScore > 0;
      await db.query(
        'INSERT INTO player_scores (user_id, room_id, score) VALUES (?, ?, ?)',
        [player.userId, room.id, player.score]
      );
      await db.query(
        'INSERT INTO player_stats (user_id, games_played, games_won, total_score) ' +
        'VALUES (?, 1, ?, ?) ON DUPLICATE KEY UPDATE ' +
        'games_played = games_played + 1, ' +
        'games_won = games_won + ?, ' +
        'total_score = total_score + ?',
        [player.userId, isWinner ? 1 : 0, player.score, isWinner ? 1 : 0, player.score]
      );
    }
    await db.query('UPDATE game_rooms SET status = "finished" WHERE room_code = ?', [roomCode]);
    delete rooms[roomCode];
  }
};