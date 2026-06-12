// ============================================
//  config/db.js
//  MySQL connection — credentials via .env
//  NEVER hardcode passwords in source code!
// ============================================

const mysql = require('mysql2');

const db = mysql.createConnection({
  host:     process.env.DB_HOST     || 'localhost',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'NBA_db',
  // Connection pool settings for resilience
  connectTimeout: 10000,
});

module.exports = db;