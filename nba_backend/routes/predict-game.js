// ============================================
//  routes/predict-game.js
//  Modelo mejorado: 70% estadísticas + 30% H2H
// ============================================

const express = require('express');
const router  = express.Router();
const { query } = require('../utils/db');
const { asyncHandler } = require('../middleware/errorHandler');

router.get('/predict-game', asyncHandler(async (req, res) => {
  const { teamA, teamB, season } = req.query;

  if (!teamA || !teamB) {
    return res.status(400).json({ error: 'teamA and teamB are required.' });
  }

  // ── Season filter ─────────────────────────────────────────────────────
  const seasonJoin = season
    ? `JOIN Seasons s ON s.StartYear = (
         CASE WHEN MONTH(g.GameDate) >= 10
           THEN YEAR(g.GameDate)
           ELSE YEAR(g.GameDate) - 1
         END
       ) AND s.SeasonName = ${require('mysql2').escape(season)}`
    : '';

  // ── 1. General stats for both teams ───────────────────────────────────
  const sql = `
    SELECT
      T.TeamID,
      T.TeamName,
      ROUND(AVG(
        CASE WHEN g.HomeTeamID = T.TeamID THEN g.HomePoints
             WHEN g.AwayTeamID = T.TeamID THEN g.AwayPoints END
      ), 2) AS AvgPointsFor,
      ROUND(AVG(
        CASE WHEN g.HomeTeamID = T.TeamID THEN g.AwayPoints
             WHEN g.AwayTeamID = T.TeamID THEN g.HomePoints END
      ), 2) AS AvgPointsAgainst,
      ROUND(
        SUM(CASE WHEN g.HomeTeamID = T.TeamID AND g.HomePoints > g.AwayPoints THEN 1 ELSE 0 END)
        / NULLIF(SUM(CASE WHEN g.HomeTeamID = T.TeamID THEN 1 ELSE 0 END), 0) * 100
      , 2) AS HomeWinRate,
      SUM(
        CASE WHEN g.HomeTeamID = T.TeamID AND g.HomePoints > g.AwayPoints THEN 1
             WHEN g.AwayTeamID = T.TeamID AND g.AwayPoints > g.HomePoints THEN 1
             ELSE 0 END
      ) AS TotalWins,
      COUNT(
        CASE WHEN g.HomeTeamID = T.TeamID THEN 1
             WHEN g.AwayTeamID = T.TeamID THEN 1 END
      ) AS TotalGames
    FROM Games g
    JOIN Teams T ON g.HomeTeamID = T.TeamID OR g.AwayTeamID = T.TeamID
    ${seasonJoin}
    WHERE NOT (g.HomePoints = 0 AND g.AwayPoints = 0)
      AND (LOWER(T.TeamName) LIKE LOWER(?) OR LOWER(T.TeamName) LIKE LOWER(?))
    GROUP BY T.TeamID, T.TeamName
  `;

  const rows = await query(sql, [`%${teamA}%`, `%${teamB}%`]);

  if (rows.length < 2) {
    return res.status(404).json({
      error: `Could not find stats for both teams. Found: ${rows.map(r => r.TeamName).join(', ') || 'none'}`
    });
  }

  const findTeam = (kw) => rows.find(r => r.TeamName.toLowerCase().includes(kw.toLowerCase()));
  const statsA = findTeam(teamA);
  const statsB = findTeam(teamB);

  if (!statsA || !statsB) {
    return res.status(404).json({ error: 'Could not match both teams in query results.' });
  }

  // ── 2. Head-to-head record ────────────────────────────────────────────
  const h2hRows = await query(`
    SELECT
      SUM(CASE
        WHEN g.HomeTeamID = ? AND g.HomePoints > g.AwayPoints THEN 1
        WHEN g.AwayTeamID = ? AND g.AwayPoints > g.HomePoints THEN 1
        ELSE 0 END) AS WinsA,
      SUM(CASE
        WHEN g.HomeTeamID = ? AND g.HomePoints > g.AwayPoints THEN 1
        WHEN g.AwayTeamID = ? AND g.AwayPoints > g.HomePoints THEN 1
        ELSE 0 END) AS WinsB,
      COUNT(*) AS Total
    FROM Games g
    WHERE NOT (g.HomePoints = 0 AND g.AwayPoints = 0)
      AND (
        (g.HomeTeamID = ? AND g.AwayTeamID = ?)
        OR (g.HomeTeamID = ? AND g.AwayTeamID = ?)
      )
  `, [
    statsA.TeamID, statsA.TeamID,
    statsB.TeamID, statsB.TeamID,
    statsA.TeamID, statsB.TeamID,
    statsB.TeamID, statsA.TeamID
  ]);

  const h2hTotal  = Number(h2hRows[0]?.Total  || 0);
  const h2hWinsA  = Number(h2hRows[0]?.WinsA  || 0);
  const h2hWinsB  = Number(h2hRows[0]?.WinsB  || 0);

  // If no H2H data, use 50/50; otherwise use actual record
  const h2hPctA = h2hTotal > 0 ? h2hWinsA / h2hTotal : 0.5;
  const h2hPctB = h2hTotal > 0 ? h2hWinsB / h2hTotal : 0.5;

  // ── 3. Statistical model (Elo-inspired) ──────────────────────────────
  const compute = (stats) => {
    const pointDiff = Number(stats.AvgPointsFor) - Number(stats.AvgPointsAgainst);
    const winPct    = stats.TotalGames > 0 ? Number(stats.TotalWins) / Number(stats.TotalGames) : 0.5;
    const homeAdv   = (Number(stats.HomeWinRate) || 50) * 0.4;
    const strength  = (pointDiff * 2) + (winPct * 60) + homeAdv;
    return { pointDiff, winPct, homeAdv, strength };
  };

  const modelA = compute(statsA);
  const modelB = compute(statsB);

  const ratingDiff = modelA.strength - modelB.strength;
  const statProbA  = 1 / (1 + Math.pow(10, -ratingDiff / 15));
  const statProbB  = 1 - statProbA;

  // ── 4. Combine: 70% statistical + 30% head-to-head ───────────────────
  const W_STAT = h2hTotal >= 3 ? 0.50 : 1.0;
  const W_H2H  = h2hTotal >= 3 ? 0.50 : 0.0;

  const rawA = (statProbA * W_STAT) + (h2hPctA * W_H2H);
  const rawB = (statProbB * W_STAT) + (h2hPctB * W_H2H);

  // Renormalize to exactly 100%
  const total  = rawA + rawB;
  const probA  = rawA / total;
  const probB  = rawB / total;

  // ── 5. Projected score ────────────────────────────────────────────────
  const leagueAvg  = (Number(statsA.AvgPointsFor) + Number(statsB.AvgPointsFor)) / 2;
  const projectedA = Math.round(leagueAvg + modelA.pointDiff * 0.4);
  const projectedB = Math.round(leagueAvg + modelB.pointDiff * 0.4);

  // ── 6. Confidence ────────────────────────────────────────────────────
  const diff       = Math.abs(probA - probB);
  const confidence = diff < 0.08 ? 'Low' : diff < 0.18 ? 'Medium' : 'High';

  // ── 7. Factors explanation ───────────────────────────────────────────
  const favorite = probA >= probB ? statsA : statsB;
  const underdog = probA >= probB ? statsB : statsA;
  const favModel = probA >= probB ? modelA : modelB;
  const undModel = probA >= probB ? modelB : modelA;

  const factors = [];
  if (favModel.pointDiff > undModel.pointDiff)
    factors.push(`Better point differential (${favModel.pointDiff.toFixed(1)} vs ${undModel.pointDiff.toFixed(1)})`);
  if (favModel.winPct > undModel.winPct)
    factors.push(`Higher win percentage (${(favModel.winPct*100).toFixed(1)}% vs ${(undModel.winPct*100).toFixed(1)}%)`);
  if (Number(favorite.AvgPointsFor) > Number(underdog.AvgPointsFor))
    factors.push(`Better offensive rating (${favorite.AvgPointsFor} vs ${underdog.AvgPointsFor} PPG)`);
  if (Number(favorite.AvgPointsAgainst) < Number(underdog.AvgPointsAgainst))
    factors.push(`Better defensive rating (${favorite.AvgPointsAgainst} vs ${underdog.AvgPointsAgainst} pts allowed)`);
  if (h2hTotal >= 3) {
    const favH2H = probA >= probB ? h2hWinsA : h2hWinsB;
    const undH2H = probA >= probB ? h2hWinsB : h2hWinsA;
    factors.push(`Head-to-head record: ${favH2H}W–${undH2H}L in ${h2hTotal} matchups`);
  }
  if (factors.length === 0)
    factors.push('Very closely matched teams based on available statistics');

  const favProb = probA >= probB ? probA : probB;
  const explanation = `${favorite.TeamName} (${(favProb*100).toFixed(1)}%) is favored because: ${factors.join('; ')}.`;

  res.json({
    teamA: {
      name:           statsA.TeamName,
      probability:    parseFloat((probA * 100).toFixed(1)),
      avgPtsFor:      statsA.AvgPointsFor,
      avgPtsAgainst:  statsA.AvgPointsAgainst,
      winPct:         parseFloat((modelA.winPct * 100).toFixed(1)),
      pointDiff:      parseFloat(modelA.pointDiff.toFixed(2)),
      strength:       parseFloat(modelA.strength.toFixed(2)),
      projectedScore: projectedA,
      h2hWins:        h2hWinsA,
    },
    teamB: {
      name:           statsB.TeamName,
      probability:    parseFloat((probB * 100).toFixed(1)),
      avgPtsFor:      statsB.AvgPointsFor,
      avgPtsAgainst:  statsB.AvgPointsAgainst,
      winPct:         parseFloat((modelB.winPct * 100).toFixed(1)),
      pointDiff:      parseFloat(modelB.pointDiff.toFixed(2)),
      strength:       parseFloat(modelB.strength.toFixed(2)),
      projectedScore: projectedB,
      h2hWins:        h2hWinsB,
    },
    favorite:    favorite.TeamName,
    confidence,
    explanation,
    factors,
    season:      season || 'All Seasons',
    h2h: {
      total:       h2hTotal,
      winsA:       h2hWinsA,
      winsB:       h2hWinsB,
      used:        h2hTotal >= 3,
      weight:      h2hTotal >= 3 ? '30%' : '0% (insufficient data)',
    },
    model: {
      formula:     'TeamStrength = (PointDiff × 2) + (WinPct × 60) + (HomeWinRate × 0.4)',
      probFormula: 'Final P = 70% Elo-model + 30% Head-to-Head record',
    }
  });
}));

module.exports = router;