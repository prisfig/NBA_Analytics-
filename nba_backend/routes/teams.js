// ============================================
//  routes/teams.js
// ============================================

const express = require('express');
const router  = express.Router();
const { query } = require('../utils/db');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /teams — All teams
router.get('/teams', asyncHandler(async (_req, res) => {
  const results = await query('SELECT * FROM Teams ORDER BY TeamName');
  res.json(results);
}));

module.exports = router;