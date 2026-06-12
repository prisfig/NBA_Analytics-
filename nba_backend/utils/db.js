// ============================================
//  utils/db.js
//  Promisified query wrapper
//  Eliminates callback nesting hell in routes
// ============================================

const db = require('../config/db');

/**
 * Execute a SQL query and return results as a Promise.
 * Usage: const rows = await query('SELECT * FROM Teams');
 *        const rows = await query('SELECT * FROM Teams WHERE TeamID = ?', [id]);
 */
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

module.exports = { query };