// config/db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

db.getConnection()
  .then(conn => {
    console.log(`✅ Connected to database as ID ${conn.threadId}`);
    conn.release();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err);
  });

module.exports = db;
