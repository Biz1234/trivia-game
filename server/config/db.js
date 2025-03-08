const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root', 
  password: 'mysql', 
  database: 'trivia_game'
});

module.exports = pool;