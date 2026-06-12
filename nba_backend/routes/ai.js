// ============================================
//  routes/ai.js
// ============================================

require('dotenv').config();
const express = require('express');
const router  = express.Router();
const OpenAI  = require('openai');
const { query } = require('../utils/db');
const { asyncHandler } = require('../middleware/errorHandler');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/ai-chat', asyncHandler(async (req, res) => {
  const { question } = req.body;
  if (!question?.trim()) {
    return res.status(400).json({ error: 'Question is required.' });
  }

  const [teamStats, attendance, recentGames, seasonStats, dbSummary] = await Promise.all([
    query(`
      SELECT
        T.TeamName,
        ROUND(AVG(G.HomePoints), 2) AS AvgPointsFor,
        ROUND(AVG(G.AwayPoints), 2) AS AvgPointsAgainst,
        ROUND(
          SUM(CASE WHEN G.HomePoints > G.AwayPoints THEN 1 ELSE 0 END)
          / COUNT(*) * 100, 1
        ) AS HomeWinRate
      FROM Games G
      JOIN Teams T ON G.HomeTeamID = T.TeamID
      GROUP BY T.TeamName
      ORDER BY HomeWinRate DESC
    `),
    query(`
      SELECT Arena, ROUND(AVG(Attendance), 0) AS AvgAttendance
      FROM Games
      WHERE Arena IS NOT NULL AND Attendance IS NOT NULL
      GROUP BY Arena
      ORDER BY AvgAttendance DESC
      LIMIT 5
    `),
    query(`
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
      ORDER BY g.GameDate DESC
      LIMIT 500
    `),
    query(`
      SELECT
        YEAR(G.GameDate) AS Season,
        T.TeamName,
        COUNT(CASE WHEN G.HomePoints > G.AwayPoints THEN 1 END) AS Wins,
        COUNT(*) AS Games,
        ROUND(AVG(G.HomePoints), 1) AS AvgPoints
      FROM Games G
      JOIN Teams T ON G.HomeTeamID = T.TeamID
      GROUP BY YEAR(G.GameDate), T.TeamName
      ORDER BY Season DESC, Wins DESC
    `),
    query(`
      SELECT
        COUNT(*) AS TotalGames,
        COUNT(DISTINCT YEAR(GameDate)) AS TotalSeasons,
        MIN(YEAR(GameDate)) AS FirstSeason,
        MAX(YEAR(GameDate)) AS LastSeason
      FROM Games
    `)
  ]);

  const dbContext = buildContext({ teamStats, attendance, recentGames, seasonStats, dbSummary });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    max_tokens: 600,
    temperature: 0.3,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: `${dbContext}\n\nUSER QUESTION:\n${question}` }
    ]
  });

  res.json({ reply: completion.choices[0].message.content });
}));

// ── Helpers ────────────────────────────────

const SYSTEM_PROMPT = `
You are an NBA analytics expert assistant for a basketball analytics web application.

YOUR STRICT RULES:
1. ONLY use data from the NBA_CONTEXT block provided with each message.
2. If the exact data requested is NOT in the context, say: "No tengo ese dato específico en la base de datos."
3. NEVER approximate, substitute, or present similar data as if it were the requested data.
4. NEVER invent dates, scores, or team matchups.
5. If the user asks about a player, say: "Player-level stats are not in this database."
6. StartTime is available in format like "7:30p". Use it for game time questions.
7. GameLength is available for some games. Use it for duration questions.
8. If asked about a specific date, search the RECENT GAMES list for that date.
9. If asked about upcoming or future games, check SEASON STATS and RECENT GAMES for 0-point games.
10. Answer in the same language the user writes in.
11. STATS BY SEASON section has per-year wins — use it for "best team in 2023" questions.
12. For total game counts, use only the DATABASE SUMMARY numbers.

FINALS 2025-26 AWARENESS:
- The 2025-26 NBA Finals are between San Antonio Spurs and New York Knicks.
- Game 1 (Jun 3): Spurs 95 - Knicks 105 → Knicks won.
- Game 2 (Jun 5): Spurs 104 - Knicks 105 → Knicks won. Series: Knicks lead 2-0.
- Games 3-7 are upcoming (Jun 8, 10, 13, 16, 19) — no scores yet.
- When asked who is favored to win the Finals, use the historical stats from the context to analyze both teams.
- The Knicks lead 2-0 in the series as of the latest data.

WHEN ANSWERING:
- Lead with the key insight or answer.
- If you cannot find the exact data, say so clearly.
- Use basketball terminology appropriately.
`.trim();

function buildContext({ teamStats, attendance, recentGames, seasonStats, dbSummary }) {
  const teamsStr = teamStats.map(t =>
    `${t.TeamName}: AvgPts=${t.AvgPointsFor}, PtsAllowed=${t.AvgPointsAgainst}, HomeWin%=${t.HomeWinRate}%`
  ).join('\n');

  const attendanceStr = attendance.map(a =>
    `${a.Arena}: ${Number(a.AvgAttendance).toLocaleString()} avg`
  ).join('\n');

  const recentStr = recentGames.map(g =>
    `${g.GameDate} ${g.StartTime ?? ''}: ${g.HomeTeam} ${g.HomePoints ?? '?'} vs ${g.AwayTeam} ${g.AwayPoints ?? '?'} @ ${g.Arena ?? '?'} | Length: ${g.GameLength ?? 'N/A'} | Attendance: ${g.Attendance ?? 'N/A'}`
  ).join('\n');

  const seasonStr = seasonStats.map(s =>
    `${s.Season} ${s.TeamName}: ${s.Wins}W / ${s.Games}G / AvgPts=${s.AvgPoints}`
  ).join('\n');

  const summary = dbSummary[0];

  return `
=== NBA_CONTEXT ===

DATABASE SUMMARY:
- Total games in database: ${summary.TotalGames}
- Total seasons: ${summary.TotalSeasons} (${summary.FirstSeason} to ${summary.LastSeason})

TEAM ANALYTICS (all-time averages):
${teamsStr}

TOP ARENAS BY AVERAGE ATTENDANCE:
${attendanceStr}

RECENT GAMES (date, time, teams, score, arena, length, attendance):
${recentStr}

STATS BY SEASON (wins per team per year):
${seasonStr}

IMPORTANT: The database contains exactly 5 seasons (2022, 2023, 2024, 2025, 2026). Do not count or infer a different number.

=== END NBA_CONTEXT ===
`.trim();
}

module.exports = router;