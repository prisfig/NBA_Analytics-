// ============================================
//  routes/analytics.js
//  CAMBIO CLAVE: todos los endpoints ahora
//  excluyen partidos con HomePoints = 0 AND
//  AwayPoints = 0 (partidos futuros/pendientes)
//  para que no distorsionen las métricas.
// ============================================

const express = require('express');
const router  = express.Router();
const { query } = require('../utils/db');
const { asyncHandler } = require('../middleware/errorHandler');

// ── Filtro global: excluir partidos pendientes (0-0) ─────────────────────
// Se añade a todos los WHERE como:
//   AND NOT (G.HomePoints = 0 AND G.AwayPoints = 0)
// Esto ignora partidos futuros que aún no tienen marcador real.

// ── Routes ────────────────────────────────

router.get('/top-wins', asyncHandler(async (req, res) => {
  const { season } = req.query;

  let sql = `
    SELECT T.TeamName, COUNT(*) AS Wins
    FROM Games G
    JOIN Teams T ON G.HomeTeamID = T.TeamID
    WHERE G.HomePoints > G.AwayPoints
      AND NOT (G.HomePoints = 0 AND G.AwayPoints = 0)
  `;

  const params = [];
  if (season && season !== 'all') {
    sql += ' AND YEAR(G.GameDate) = ?';
    params.push(Number(season));
  }

  sql += ' GROUP BY T.TeamName ORDER BY Wins DESC LIMIT 10';
  const results = await query(sql, params);
  res.json(results);
}));

router.get('/home-win-rate', asyncHandler(async (req, res) => {
  const results = await query(`
    SELECT
      T.TeamName,
      ROUND(
        SUM(CASE WHEN G.HomePoints > G.AwayPoints THEN 1 ELSE 0 END)
        / COUNT(*) * 100, 2
      ) AS HomeWinPercentage,
      COUNT(*) AS HomeGames
    FROM Games G
    JOIN Teams T ON G.HomeTeamID = T.TeamID
    WHERE NOT (G.HomePoints = 0 AND G.AwayPoints = 0)
    GROUP BY T.TeamName
    ORDER BY HomeWinPercentage DESC
  `);
  res.json(results);
}));

router.get('/best-home-team', asyncHandler(async (_req, res) => {
  const results = await query(`
    SELECT
      T.TeamName,
      ROUND(
        SUM(CASE WHEN G.HomePoints > G.AwayPoints THEN 1 ELSE 0 END)
        / COUNT(*) * 100, 1
      ) AS HomeWinPct
    FROM Games G
    JOIN Teams T ON G.HomeTeamID = T.TeamID
    WHERE NOT (G.HomePoints = 0 AND G.AwayPoints = 0)
    GROUP BY T.TeamID, T.TeamName
    ORDER BY HomeWinPct DESC
    LIMIT 1
  `);
  res.json(results);
}));

router.get('/best-attendance', asyncHandler(async (req, res) => {
  const { season, order = 'desc' } = req.query;

  let sql = `
    SELECT Arena, ROUND(AVG(Attendance), 0) AS AvgAttendance
    FROM Games
    WHERE Arena IS NOT NULL AND Attendance IS NOT NULL
      AND NOT (HomePoints = 0 AND AwayPoints = 0)
  `;

  const params = [];
  if (season && season !== 'all') {
    sql += ' AND YEAR(GameDate) = ?';
    params.push(Number(season));
  }

  sql += ` GROUP BY Arena ORDER BY AvgAttendance ${order === 'asc' ? 'ASC' : 'DESC'} LIMIT 10`;
  const results = await query(sql, params);
  res.json(results);
}));

router.get('/dashboard-stats', asyncHandler(async (_req, res) => {
  const results = await query(`
    SELECT
      (
        SELECT T.TeamName
        FROM Games G
        JOIN Teams T ON G.HomeTeamID = T.TeamID
        WHERE NOT (G.HomePoints = 0 AND G.AwayPoints = 0)
        GROUP BY T.TeamName
        ORDER BY ROUND(
          SUM(CASE WHEN G.HomePoints > G.AwayPoints THEN 1 ELSE 0 END) / COUNT(*) * 100, 2
        ) DESC
        LIMIT 1
      ) AS BestHomeTeam,
      (
        SELECT Arena
        FROM Games
        WHERE Arena IS NOT NULL AND Attendance IS NOT NULL
          AND NOT (HomePoints = 0 AND AwayPoints = 0)
        GROUP BY Arena
        ORDER BY AVG(Attendance) DESC
        LIMIT 1
      ) AS BestArena,
      (SELECT COUNT(*) FROM Seasons) AS TotalSeasons
  `);
  res.json(results[0]);
}));

router.get('/top-offense', asyncHandler(async (req, res) => {
  const { season } = req.query;

  let sql = `
    SELECT T.TeamName, ROUND(AVG(G.HomePoints), 2) AS AvgPoints
    FROM Games G
    JOIN Teams T ON G.HomeTeamID = T.TeamID
    WHERE NOT (G.HomePoints = 0 AND G.AwayPoints = 0)
  `;

  const params = [];
  if (season && season !== 'all') {
    sql += ' AND YEAR(G.GameDate) = ?';
    params.push(Number(season));
  }

  sql += ' GROUP BY T.TeamName ORDER BY AvgPoints DESC LIMIT 10';
  const results = await query(sql, params);
  res.json(results);
}));

router.get('/top-defense', asyncHandler(async (req, res) => {
  const { season } = req.query;

  let sql = `
    SELECT T.TeamName, ROUND(AVG(G.AwayPoints), 2) AS DefensiveRating
    FROM Games G
    JOIN Teams T ON G.HomeTeamID = T.TeamID
    WHERE NOT (G.HomePoints = 0 AND G.AwayPoints = 0)
  `;

  const params = [];
  if (season && season !== 'all') {
    sql += ' AND YEAR(G.GameDate) = ?';
    params.push(Number(season));
  }

  sql += ' GROUP BY T.TeamName ORDER BY DefensiveRating ASC LIMIT 10';
  const results = await query(sql, params);
  res.json(results);
}));

router.get('/overall-rankings', asyncHandler(async (req, res) => {
  const { season } = req.query;

  let sql = `
    SELECT
      T.TeamName,
      ROUND(AVG(G.HomePoints), 2) AS OffensiveRating,
      ROUND(AVG(G.AwayPoints), 2) AS DefensiveRating,
      ROUND(
        SUM(CASE WHEN G.HomePoints > G.AwayPoints THEN 1 ELSE 0 END)
        / COUNT(*) * 100, 2
      ) AS WinRate
    FROM Games G
    JOIN Teams T ON G.HomeTeamID = T.TeamID
    WHERE NOT (G.HomePoints = 0 AND G.AwayPoints = 0)
  `;

  const params = [];
  if (season && season !== 'all') {
    sql += ' AND YEAR(G.GameDate) = ?';
    params.push(Number(season));
  }

  sql += ' GROUP BY T.TeamName';

  const results = await query(sql, params);
  const scored = results.map(t => ({
    ...t,
    OverallScore: (
      Number(t.OffensiveRating) * 0.4 +
      (120 - Number(t.DefensiveRating)) * 0.3 +
      Number(t.WinRate) * 0.3
    ).toFixed(2)
  })).sort((a, b) => b.OverallScore - a.OverallScore);

  res.json(scored.slice(0, 10));
}));

router.get('/compare/:team1/:team2', asyncHandler(async (req, res) => {
  const { team1, team2 } = req.params;
  const results = await query(`
    SELECT
      T.TeamName,
      ROUND(AVG(G.HomePoints), 2) AS OffensiveRating,
      ROUND(AVG(G.AwayPoints), 2) AS DefensiveRating,
      ROUND(
        SUM(CASE WHEN G.HomePoints > G.AwayPoints THEN 1 ELSE 0 END)
        / COUNT(*) * 100, 2
      ) AS WinRate
    FROM Games G
    JOIN Teams T ON G.HomeTeamID = T.TeamID
    WHERE NOT (G.HomePoints = 0 AND G.AwayPoints = 0)
      AND (LOWER(T.TeamName) LIKE LOWER(?) OR LOWER(T.TeamName) LIKE LOWER(?))
    GROUP BY T.TeamName
  `, [`%${team1}%`, `%${team2}%`]);

  const scored = results.map(t => ({
    ...t,
    OverallScore: (
      Number(t.OffensiveRating) * 0.4 +
      (120 - Number(t.DefensiveRating)) * 0.3 +
      Number(t.WinRate) * 0.3
    ).toFixed(2)
  })).sort((a, b) => b.OverallScore - a.OverallScore);

  res.json({ winner: scored[0], teams: scored });
}));

router.get('/predict/:team1/:team2', asyncHandler(async (req, res) => {
  const { team1, team2 } = req.params;

  const results = await query(`
    SELECT
      T.TeamName,
      ROUND(
        SUM(CASE WHEN G.HomePoints > G.AwayPoints THEN 1 ELSE 0 END) / COUNT(*) * 100, 2
      ) AS HomeWinPercentage,
      ROUND(AVG(pts.Points), 2) AS AvgPoints
    FROM Teams T
    JOIN Games G ON G.HomeTeamID = T.TeamID
    JOIN (
      SELECT HomeTeamID AS TeamID, HomePoints AS Points FROM Games
        WHERE NOT (HomePoints = 0 AND AwayPoints = 0)
      UNION ALL
      SELECT AwayTeamID AS TeamID, AwayPoints AS Points FROM Games
        WHERE NOT (HomePoints = 0 AND AwayPoints = 0)
    ) pts ON pts.TeamID = T.TeamID
    WHERE NOT (G.HomePoints = 0 AND G.AwayPoints = 0)
      AND (LOWER(T.TeamName) LIKE LOWER(?) OR LOWER(T.TeamName) LIKE LOWER(?))
    GROUP BY T.TeamID, T.TeamName
  `, [`%${team1}%`, `%${team2}%`]);

  if (results.length < 2) {
    return res.status(404).json({ error: 'Could not find both teams.' });
  }

  const scored = results.map(t => ({
    ...t,
    PredictionScore: (
      Number(t.HomeWinPercentage) * 0.7 +
      Number(t.AvgPoints) * 0.3
    ).toFixed(2)
  })).sort((a, b) => b.PredictionScore - a.PredictionScore);

  res.json({
    favorite:  scored[0].TeamName,
    winRate:   scored[0].HomeWinPercentage,
    avgPoints: scored[0].AvgPoints,
    score:     scored[0].PredictionScore,
    all:       scored
  });
}));

router.get('/team-analytics/:team', asyncHandler(async (req, res) => {
  const { team } = req.params;

  const teamRows = await query(
    'SELECT TeamID FROM Teams WHERE LOWER(TeamName) LIKE LOWER(?)',
    [`%${team}%`]
  );

  if (!teamRows.length) {
    return res.status(404).json({ error: `Team "${team}" not found.` });
  }

  const teamId = teamRows[0].TeamID;

  const results = await query(`
    SELECT
      YEAR(GameDate) AS Season,
      COUNT(
        CASE
          WHEN (HomeTeamID = ? AND HomePoints > AwayPoints)
            OR (AwayTeamID = ? AND AwayPoints > HomePoints)
          THEN 1
        END
      ) AS Wins,
      COUNT(*) AS GamesPlayed,
      ROUND(
        100 * SUM(
          CASE WHEN HomeTeamID = ? AND HomePoints > AwayPoints THEN 1 ELSE 0 END
        ) / NULLIF(
          SUM(CASE WHEN HomeTeamID = ? THEN 1 ELSE 0 END), 0
        ), 1
      ) AS HomeWinPct
    FROM Games
    WHERE (HomeTeamID = ? OR AwayTeamID = ?)
      AND NOT (HomePoints = 0 AND AwayPoints = 0)
    GROUP BY YEAR(GameDate)
    ORDER BY YEAR(GameDate)
  `, [teamId, teamId, teamId, teamId, teamId, teamId]);

  res.json(results);
}));

router.get('/games-table', asyncHandler(async (req, res) => {
  const { season, limit = 100, includePending } = req.query;

  let sql = `
    SELECT
      DATE_FORMAT(g.GameDate, '%Y-%m-%d') AS GameDate,
      ht.TeamName AS HomeTeam,
      at.TeamName AS AwayTeam,
      CONCAT(g.HomePoints, ' - ', g.AwayPoints) AS Score,
      g.HomePoints,
      g.AwayPoints,
      g.Attendance,
      g.Arena,
      g.GameLength
    FROM Games g
    JOIN Teams ht ON g.HomeTeamID = ht.TeamID
    JOIN Teams at ON g.AwayTeamID = at.TeamID
  `;

  const params = [];
  const conditions = [];

  if (season) conditions.push('YEAR(g.GameDate) = ?') && params.push(Number(season));

  // Include pending (0-0) only when explicitly requested
  if (includePending !== 'true') {
    conditions.push('NOT (g.HomePoints = 0 AND g.AwayPoints = 0)');
  }

  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY g.GameDate DESC LIMIT ?';
  params.push(Number(limit));

  const results = await query(sql, params);
  res.json(results);
}));

// ── Upcoming games (0-0 only) ─────────────────────────────────────────────
router.get('/upcoming-games', asyncHandler(async (req, res) => {
  const results = await query(`
    SELECT
      g.GameID,
      DATE_FORMAT(g.GameDate, '%Y-%m-%d') AS GameDate,
      g.StartTime,
      ht.TeamName AS HomeTeam,
      at.TeamName AS AwayTeam,
      g.Arena,
      g.HomeTeamID,
      g.AwayTeamID
    FROM Games g
    JOIN Teams ht ON g.HomeTeamID = ht.TeamID
    JOIN Teams at ON g.AwayTeamID = at.TeamID
    WHERE g.HomePoints = 0 AND g.AwayPoints = 0
    ORDER BY g.GameDate ASC
    LIMIT 30
  `);
  res.json(results);
}));

router.get('/team-home-rate/:team', asyncHandler(async (req, res) => {
  const { team } = req.params;
  const results = await query(`
    SELECT
      T.TeamName,
      ROUND(
        SUM(CASE WHEN G.HomePoints > G.AwayPoints THEN 1 ELSE 0 END) / COUNT(*) * 100, 2
      ) AS HomeWinPercentage
    FROM Games G
    JOIN Teams T ON G.HomeTeamID = T.TeamID
    WHERE LOWER(T.TeamName) LIKE LOWER(?)
      AND NOT (G.HomePoints = 0 AND G.AwayPoints = 0)
    GROUP BY T.TeamName
  `, [`%${team}%`]);
  res.json(results);
}));

router.get('/game-search', asyncHandler(async (req, res) => {
  const { team, date } = req.query;

  let sql = `
    SELECT
      DATE_FORMAT(g.GameDate, '%Y-%m-%d') AS GameDate,
      g.StartTime,
      ht.TeamName AS HomeTeam,
      at.TeamName AS AwayTeam,
      g.HomePoints,
      g.AwayPoints,
      g.Arena,
      g.Attendance,
      g.GameLength
    FROM Games g
    JOIN Teams ht ON g.HomeTeamID = ht.TeamID
    JOIN Teams at ON g.AwayTeamID = at.TeamID
    WHERE 1=1
  `;

  const params = [];
  if (team) {
    sql += ` AND (LOWER(ht.TeamName) LIKE LOWER(?) OR LOWER(at.TeamName) LIKE LOWER(?))`;
    params.push(`%${team}%`, `%${team}%`);
  }
  if (date) {
    sql += ` AND DATE(g.GameDate) = ?`;
    params.push(date);
  }

  sql += ` ORDER BY g.GameDate DESC LIMIT 10`;
  const results = await query(sql, params);
  res.json(results);
}));

router.get('/head-to-head/:team1/:team2', asyncHandler(async (req, res) => {
  const { team1, team2 } = req.params;

  const results = await query(`
    SELECT
      DATE_FORMAT(g.GameDate, '%Y-%m-%d') AS GameDate,
      g.StartTime,
      ht.TeamName AS HomeTeam,
      at.TeamName AS AwayTeam,
      g.HomePoints,
      g.AwayPoints,
      g.Arena,
      g.Attendance,
      CASE
        WHEN g.HomePoints > g.AwayPoints THEN ht.TeamName
        ELSE at.TeamName
      END AS Winner
    FROM Games g
    JOIN Teams ht ON g.HomeTeamID = ht.TeamID
    JOIN Teams at ON g.AwayTeamID = at.TeamID
    WHERE NOT (g.HomePoints = 0 AND g.AwayPoints = 0)
      AND (
        (LOWER(ht.TeamName) LIKE LOWER(?) AND LOWER(at.TeamName) LIKE LOWER(?))
        OR (LOWER(ht.TeamName) LIKE LOWER(?) AND LOWER(at.TeamName) LIKE LOWER(?))
      )
    ORDER BY g.GameDate DESC
    LIMIT 20
  `, [`%${team1}%`, `%${team2}%`, `%${team2}%`, `%${team1}%`]);

  if (!results.length) {
    return res.status(404).json({ error: 'No games found between these teams.' });
  }

  const team1Wins = results.filter(g => g.Winner.toLowerCase().includes(team1.toLowerCase())).length;
  const team2Wins = results.length - team1Wins;

  res.json({
    summary: { team1: results[0].HomeTeam, team2: results[0].AwayTeam, team1Wins, team2Wins, total: results.length },
    games: results
  });
}));

// ── Season stats ─────────────────────────────────────────────────────────
router.get('/season-stats', asyncHandler(async (req, res) => {
  const { season } = req.query;

  let sql = `
    SELECT
      s.SeasonName,
      T.TeamName,
      COUNT(*)                                                        AS HomeGames,
      SUM(CASE WHEN g.HomePoints > g.AwayPoints THEN 1 ELSE 0 END)  AS HomeWins,
      ROUND(AVG(g.HomePoints), 2)                                    AS AvgPointsFor,
      ROUND(AVG(g.AwayPoints), 2)                                    AS AvgPointsAgainst,
      MIN(DATE_FORMAT(g.GameDate, '%Y-%m-%d'))                       AS FirstGame,
      MAX(DATE_FORMAT(g.GameDate, '%Y-%m-%d'))                       AS LastGame
    FROM Games g
    JOIN Teams T ON g.HomeTeamID = T.TeamID
    JOIN Seasons s ON s.StartYear = (
      CASE WHEN MONTH(g.GameDate) >= 10
        THEN YEAR(g.GameDate)
        ELSE YEAR(g.GameDate) - 1
      END
    )
    WHERE NOT (g.HomePoints = 0 AND g.AwayPoints = 0)
  `;

  const params = [];
  if (season) {
    sql += ' AND s.SeasonName = ?';
    params.push(season);
  }

  sql += ' GROUP BY s.SeasonName, T.TeamName ORDER BY s.StartYear DESC, HomeWins DESC';
  const results = await query(sql, params);

  if (!results.length) {
    return res.status(404).json({ error: `No data found for season "${season}"` });
  }
  res.json(results);
}));

router.get('/seasons', asyncHandler(async (_req, res) => {
  const results = await query(`
    SELECT
      s.SeasonName,
      s.StartYear,
      s.EndYear,
      COUNT(g.GameID)                          AS TotalGames,
      MIN(DATE_FORMAT(g.GameDate, '%Y-%m-%d')) AS FirstGame,
      MAX(DATE_FORMAT(g.GameDate, '%Y-%m-%d')) AS LastGame
    FROM Seasons s
    LEFT JOIN Games g ON s.StartYear = (
      CASE WHEN MONTH(g.GameDate) >= 10
        THEN YEAR(g.GameDate)
        ELSE YEAR(g.GameDate) - 1
      END
    ) AND NOT (g.HomePoints = 0 AND g.AwayPoints = 0)
    GROUP BY s.SeasonName, s.StartYear, s.EndYear
    ORDER BY s.StartYear DESC
  `);
  res.json(results);
}));

module.exports = router;