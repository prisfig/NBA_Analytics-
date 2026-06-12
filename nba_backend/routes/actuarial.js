// ============================================
//  routes/actuarial.js
//  Actuarial Analytics — Complete Statistical Engine
//  
//  Endpoints:
//  GET /actuarial/asi              — Actuarial Strength Index rankings
//  GET /actuarial/risk/:team       — Risk metrics for a team
//  GET /actuarial/confidence/:team — Confidence intervals for scoring
//  POST /actuarial/montecarlo      — Monte Carlo simulation
//  GET /actuarial/championship     — Championship probability for all teams
//  GET /actuarial/volatility       — Offensive/defensive volatility all teams
// ============================================

const express = require('express');
const router  = express.Router();
const { query } = require('../utils/db');
const { asyncHandler } = require('../middleware/errorHandler');

// ── Filter constant: exclude 0-0 (future/pending) games ──────────────────
const PLAYED = `NOT (g.HomePoints = 0 AND g.AwayPoints = 0)`;
const PLAYED_SIMPLE = `NOT (HomePoints = 0 AND AwayPoints = 0)`;

// ══════════════════════════════════════════════════════════════
//  HELPER: Get full stats for a team (or all teams)
// ══════════════════════════════════════════════════════════════
async function getTeamStats(teamName = null, seasonName = null) {
  let sql = `
    SELECT
      T.TeamID,
      T.TeamName,
      ROUND(AVG(CASE WHEN g.HomeTeamID = T.TeamID THEN g.HomePoints
                     WHEN g.AwayTeamID = T.TeamID THEN g.AwayPoints END), 2) AS AvgPtsFor,
      ROUND(STDDEV(CASE WHEN g.HomeTeamID = T.TeamID THEN g.HomePoints
                        WHEN g.AwayTeamID = T.TeamID THEN g.AwayPoints END), 2) AS StdPtsFor,
      ROUND(AVG(CASE WHEN g.HomeTeamID = T.TeamID THEN g.AwayPoints
                     WHEN g.AwayTeamID = T.TeamID THEN g.HomePoints END), 2) AS AvgPtsAgainst,
      ROUND(STDDEV(CASE WHEN g.HomeTeamID = T.TeamID THEN g.AwayPoints
                        WHEN g.AwayTeamID = T.TeamID THEN g.HomePoints END), 2) AS StdPtsAgainst,
      SUM(CASE WHEN g.HomeTeamID = T.TeamID AND g.HomePoints > g.AwayPoints THEN 1
               WHEN g.AwayTeamID = T.TeamID AND g.AwayPoints > g.HomePoints THEN 1
               ELSE 0 END) AS TotalWins,
      COUNT(*) AS TotalGames,
      ROUND(SUM(CASE WHEN g.HomeTeamID = T.TeamID AND g.HomePoints > g.AwayPoints THEN 1
                     WHEN g.AwayTeamID = T.TeamID AND g.AwayPoints > g.HomePoints THEN 1
                     ELSE 0 END) / COUNT(*), 4) AS WinPct,
      ROUND(SUM(CASE WHEN g.HomeTeamID = T.TeamID AND g.HomePoints > g.AwayPoints THEN 1 ELSE 0 END)
        / NULLIF(SUM(CASE WHEN g.HomeTeamID = T.TeamID THEN 1 ELSE 0 END), 0), 4) AS HomeWinRate,
      ROUND(AVG(CASE WHEN g.HomeTeamID = T.TeamID THEN g.HomePoints - g.AwayPoints
                     WHEN g.AwayTeamID = T.TeamID THEN g.AwayPoints - g.HomePoints END), 2) AS AvgPointDiff
    FROM Teams T
    JOIN Games g ON (g.HomeTeamID = T.TeamID OR g.AwayTeamID = T.TeamID)
    WHERE NOT (g.HomePoints = 0 AND g.AwayPoints = 0)
  `;

  const conditions = [];
  const params = [];

  if (teamName) {
    conditions.push('LOWER(T.TeamName) LIKE LOWER(?)');
    params.push(`%${teamName}%`);
  }

  if (seasonName) {
    sql += `
    AND EXISTS (
      SELECT 1 FROM Seasons s
      WHERE s.SeasonName = ?
        AND s.StartYear = (
          CASE WHEN MONTH(g.GameDate) >= 10
            THEN YEAR(g.GameDate) ELSE YEAR(g.GameDate) - 1 END
        )
    )`;
    params.push(seasonName);
  }

  if (conditions.length) sql += ' AND ' + conditions.join(' AND ');
  sql += ' GROUP BY T.TeamID, T.TeamName HAVING TotalGames >= 5';

  return query(sql, params);
}

// ══════════════════════════════════════════════════════════════
//  HELPER: Recent form — last N games win rate
// ══════════════════════════════════════════════════════════════
async function getRecentForm(teamId, n = 10) {
  const rows = await query(`
    SELECT
      CASE
        WHEN g.HomeTeamID = ? AND g.HomePoints > g.AwayPoints THEN 1
        WHEN g.AwayTeamID = ? AND g.AwayPoints > g.HomePoints THEN 1
        ELSE 0
      END AS Won
    FROM Games g
    WHERE (g.HomeTeamID = ? OR g.AwayTeamID = ?)
      AND NOT (g.HomePoints = 0 AND g.AwayPoints = 0)
    ORDER BY g.GameDate DESC
    LIMIT ?
  `, [teamId, teamId, teamId, teamId, n]);

  if (!rows.length) return 0.5;
  return rows.reduce((sum, r) => sum + r.Won, 0) / rows.length;
}

// ══════════════════════════════════════════════════════════════
//  HELPER: Compute ASI from stats
//  ASI = WinPct×40 + NormPointDiff×30 + RecentForm×20 + HomeAdv×10
// ══════════════════════════════════════════════════════════════
function computeASI(stats, recentForm) {
  const winPctScore    = (stats.WinPct || 0) * 40;
  // Normalize point differential: map [-20,+20] → [0,30]
  const diff           = Math.max(-20, Math.min(20, stats.AvgPointDiff || 0));
  const diffScore      = ((diff + 20) / 40) * 30;
  const recentScore    = (recentForm || 0.5) * 20;
  const homeAdvScore   = (stats.HomeWinRate || 0.5) * 10;
  return winPctScore + diffScore + recentScore + homeAdvScore;
}

// ══════════════════════════════════════════════════════════════
//  GET /actuarial/asi
//  Actuarial Strength Index for all teams
// ══════════════════════════════════════════════════════════════
router.get('/actuarial/asi', asyncHandler(async (req, res) => {
  const { season } = req.query;
  const allStats = await getTeamStats(null, season || null);

  // Get recent form for each team
  const results = await Promise.all(allStats.map(async (t) => {
    const recentForm = await getRecentForm(t.TeamID);
    const asi = computeASI(t, recentForm);
    return {
      TeamName:       t.TeamName,
      ASI:            parseFloat(asi.toFixed(2)),
      WinPct:         parseFloat((Number(t.WinPct) * 100).toFixed(1)),
      AvgPointDiff:   parseFloat(Number(t.AvgPointDiff).toFixed(2)),
      RecentForm:     parseFloat((recentForm * 100).toFixed(1)),
      HomeWinRate:    parseFloat((Number(t.HomeWinRate || 0.5) * 100).toFixed(1)),
      TotalGames:     t.TotalGames,
      TotalWins:      t.TotalWins,
    };
  }));

  results.sort((a, b) => b.ASI - a.ASI);
  res.json(results);
}));

// ══════════════════════════════════════════════════════════════
//  GET /actuarial/risk/:team
//  Risk metrics: avg, stddev, volatility, consistency label
// ══════════════════════════════════════════════════════════════
router.get('/actuarial/risk/:team', asyncHandler(async (req, res) => {
  const { team } = req.params;
  const stats = await getTeamStats(team);
  if (!stats.length) return res.status(404).json({ error: `Team "${team}" not found.` });

  const t = stats[0];
  const avgFor      = Number(t.AvgPtsFor);
  const stdFor      = Number(t.StdPtsFor);
  const avgAgainst  = Number(t.AvgPtsAgainst);
  const stdAgainst  = Number(t.StdPtsAgainst);

  // Coefficient of Variation = StdDev / Mean (lower = more consistent)
  const cvOffense = stdFor / avgFor;
  const cvDefense = stdAgainst / avgAgainst;

  const offLabel = cvOffense < 0.08 ? 'Very Consistent' : cvOffense < 0.12 ? 'Consistent' : cvOffense < 0.16 ? 'Moderate Volatility' : 'High Volatility';
  const defLabel = cvDefense < 0.08 ? 'Very Consistent' : cvDefense < 0.12 ? 'Consistent' : cvDefense < 0.16 ? 'Moderate Volatility' : 'High Volatility';

  res.json({
    TeamName: t.TeamName,
    offense: {
      avg:         parseFloat(avgFor.toFixed(2)),
      stddev:      parseFloat(stdFor.toFixed(2)),
      cv:          parseFloat((cvOffense * 100).toFixed(2)),
      label:       offLabel,
    },
    defense: {
      avg:         parseFloat(avgAgainst.toFixed(2)),
      stddev:      parseFloat(stdAgainst.toFixed(2)),
      cv:          parseFloat((cvDefense * 100).toFixed(2)),
      label:       defLabel,
    },
    pointDiff:     parseFloat(Number(t.AvgPointDiff).toFixed(2)),
    winPct:        parseFloat((Number(t.WinPct) * 100).toFixed(1)),
    totalGames:    t.TotalGames,
  });
}));

// ══════════════════════════════════════════════════════════════
//  GET /actuarial/confidence/:team
//  95% confidence intervals for scoring
//  IC = mean ± 1.96 * (stddev / sqrt(n))
// ══════════════════════════════════════════════════════════════
router.get('/actuarial/confidence/:team', asyncHandler(async (req, res) => {
  const { team } = req.params;
  const stats = await getTeamStats(team);
  if (!stats.length) return res.status(404).json({ error: `Team "${team}" not found.` });

  const t = stats[0];
  const n = Number(t.TotalGames);
  const z = 1.96; // 95% CI

  const offMean = Number(t.AvgPtsFor);
  const offStd  = Number(t.StdPtsFor);
  const offME   = z * (offStd / Math.sqrt(n));

  const defMean = Number(t.AvgPtsAgainst);
  const defStd  = Number(t.StdPtsAgainst);
  const defME   = z * (defStd / Math.sqrt(n));

  res.json({
    TeamName: t.TeamName,
    n,
    scoring: {
      expected:  parseFloat(offMean.toFixed(1)),
      lower95:   parseFloat((offMean - offME).toFixed(1)),
      upper95:   parseFloat((offMean + offME).toFixed(1)),
      stddev:    parseFloat(offStd.toFixed(2)),
    },
    conceding: {
      expected:  parseFloat(defMean.toFixed(1)),
      lower95:   parseFloat((defMean - defME).toFixed(1)),
      upper95:   parseFloat((defMean + defME).toFixed(1)),
      stddev:    parseFloat(defStd.toFixed(2)),
    },
  });
}));

// ══════════════════════════════════════════════════════════════
//  POST /actuarial/montecarlo
//  Body: { teamA, teamB, simulations?, season? }
//
//  Model:
//  Each simulation draws scores from Normal distributions:
//    scoreA ~ N(avgPtsFor_A, stdPtsFor_A)
//    scoreB ~ N(avgPtsFor_B, stdPtsFor_B)
//  Adjusted by the opponent's defensive average.
//
//  P(A wins) = simulations where scoreA > scoreB / total
// ══════════════════════════════════════════════════════════════
router.post('/actuarial/montecarlo', asyncHandler(async (req, res) => {
  const { teamA, teamB, simulations = 10000, season } = req.body;
  if (!teamA || !teamB) return res.status(400).json({ error: 'teamA and teamB required.' });

  const [statsA, statsB] = await Promise.all([
    getTeamStats(teamA, season),
    getTeamStats(teamB, season),
  ]);

  if (!statsA.length) return res.status(404).json({ error: `Team A "${teamA}" not found.` });
  if (!statsB.length) return res.status(404).json({ error: `Team B "${teamB}" not found.` });

  const sA = statsA[0];
  const sB = statsB[0];

  // Adjusted expected score = (team avg offense + opponent avg conceded) / 2
  const muA = (Number(sA.AvgPtsFor) + Number(sB.AvgPtsAgainst)) / 2;
  const muB = (Number(sB.AvgPtsFor) + Number(sA.AvgPtsAgainst)) / 2;
  const sigA = Number(sA.StdPtsFor) || 10;
  const sigB = Number(sB.StdPtsFor) || 10;

  // Box-Muller transform: standard normal sample
  const randn = () => {
    const u1 = Math.random(), u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  const N = Math.min(Math.max(Number(simulations), 1000), 100000);
  let winsA = 0, winsB = 0;
  const scoresA = [], scoresB = [];

  for (let i = 0; i < N; i++) {
    const sampleA = muA + sigA * randn();
    const sampleB = muB + sigB * randn();
    scoresA.push(sampleA);
    scoresB.push(sampleB);
    if (sampleA > sampleB) winsA++;
    else winsB++;
  }

  // Percentiles of simulated scores
  scoresA.sort((a, b) => a - b);
  scoresB.sort((a, b) => a - b);
  const pct = (arr, p) => arr[Math.floor(arr.length * p)];

  const probA = winsA / N;
  const probB = winsB / N;

  // Confidence of prediction: how far from 50/50
  const diff = Math.abs(probA - probB);
  const confidence = diff < 0.06 ? 'Low' : diff < 0.15 ? 'Medium' : 'High';

  // Explain factors
  const factors = [];
  if (Number(sA.WinPct) > Number(sB.WinPct))
    factors.push(`${sA.TeamName} has a higher win rate (${(Number(sA.WinPct)*100).toFixed(1)}% vs ${(Number(sB.WinPct)*100).toFixed(1)}%)`);
  else
    factors.push(`${sB.TeamName} has a higher win rate (${(Number(sB.WinPct)*100).toFixed(1)}% vs ${(Number(sA.WinPct)*100).toFixed(1)}%)`);
  if (Number(sA.AvgPointDiff) > Number(sB.AvgPointDiff))
    factors.push(`${sA.TeamName} has a better point differential (+${Number(sA.AvgPointDiff).toFixed(1)} vs ${Number(sB.AvgPointDiff).toFixed(1)})`);
  else
    factors.push(`${sB.TeamName} has a better point differential (+${Number(sB.AvgPointDiff).toFixed(1)} vs ${Number(sA.AvgPointDiff).toFixed(1)})`);
  if (muA > muB)
    factors.push(`${sA.TeamName} has higher adjusted expected scoring (${muA.toFixed(1)} vs ${muB.toFixed(1)})`);
  else
    factors.push(`${sB.TeamName} has higher adjusted expected scoring (${muB.toFixed(1)} vs ${muA.toFixed(1)})`);

  res.json({
    simulations: N,
    teamA: {
      name:        sA.TeamName,
      wins:        winsA,
      probability: parseFloat((probA * 100).toFixed(2)),
      expectedScore: parseFloat(muA.toFixed(1)),
      scoreP10:    parseFloat(pct(scoresA, 0.10).toFixed(1)),
      scoreP50:    parseFloat(pct(scoresA, 0.50).toFixed(1)),
      scoreP90:    parseFloat(pct(scoresA, 0.90).toFixed(1)),
    },
    teamB: {
      name:        sB.TeamName,
      wins:        winsB,
      probability: parseFloat((probB * 100).toFixed(2)),
      expectedScore: parseFloat(muB.toFixed(1)),
      scoreP10:    parseFloat(pct(scoresB, 0.10).toFixed(1)),
      scoreP50:    parseFloat(pct(scoresB, 0.50).toFixed(1)),
      scoreP90:    parseFloat(pct(scoresB, 0.90).toFixed(1)),
    },
    favorite:    probA >= probB ? sA.TeamName : sB.TeamName,
    confidence,
    factors,
    model: 'Normal distribution N(μ_adjusted, σ) · Box-Muller sampling · μ = (team_offense + opponent_defense) / 2',
  });
}));

// ══════════════════════════════════════════════════════════════
//  GET /actuarial/championship
//  Championship probability for all teams using ASI
//  Method: Softmax over ASI scores
// ══════════════════════════════════════════════════════════════
router.get('/actuarial/championship', asyncHandler(async (req, res) => {
  const { season } = req.query;
  const allStats = await getTeamStats(null, season || null);

  const withASI = await Promise.all(allStats.map(async (t) => {
    const rf = await getRecentForm(t.TeamID);
    return { ...t, asi: computeASI(t, rf) };
  }));

  // Softmax: P(i) = exp(asi_i / temp) / sum(exp(asi_j / temp))
  const temp = 15; // temperature controls spread
  const exps = withASI.map(t => Math.exp(t.asi / temp));
  const total = exps.reduce((s, v) => s + v, 0);

  const result = withASI
    .map((t, i) => ({
      TeamName:    t.TeamName,
      ASI:         parseFloat(t.asi.toFixed(2)),
      ChampPct:    parseFloat(((exps[i] / total) * 100).toFixed(2)),
      WinPct:      parseFloat((Number(t.WinPct) * 100).toFixed(1)),
      PointDiff:   parseFloat(Number(t.AvgPointDiff).toFixed(2)),
    }))
    .sort((a, b) => b.ChampPct - a.ChampPct);

  res.json(result);
}));

// ══════════════════════════════════════════════════════════════
//  GET /actuarial/volatility
//  Offensive and defensive volatility for all teams
// ══════════════════════════════════════════════════════════════
router.get('/actuarial/volatility', asyncHandler(async (req, res) => {
  const { season } = req.query;
  const allStats = await getTeamStats(null, season || null);

  const result = allStats.map(t => {
    const avgFor     = Number(t.AvgPtsFor);
    const stdFor     = Number(t.StdPtsFor);
    const avgAgainst = Number(t.AvgPtsAgainst);
    const stdAgainst = Number(t.StdPtsAgainst);
    const cvOff = (stdFor / avgFor) * 100;
    const cvDef = (stdAgainst / avgAgainst) * 100;

    return {
      TeamName:          t.TeamName,
      OffenseAvg:        parseFloat(avgFor.toFixed(1)),
      OffenseStd:        parseFloat(stdFor.toFixed(2)),
      OffenseCV:         parseFloat(cvOff.toFixed(2)),
      DefenseAvg:        parseFloat(avgAgainst.toFixed(1)),
      DefenseStd:        parseFloat(stdAgainst.toFixed(2)),
      DefenseCV:         parseFloat(cvDef.toFixed(2)),
      OverallVolatility: parseFloat(((cvOff + cvDef) / 2).toFixed(2)),
      Label:             ((cvOff + cvDef) / 2) < 8 ? 'Very Consistent'
                       : ((cvOff + cvDef) / 2) < 12 ? 'Consistent'
                       : ((cvOff + cvDef) / 2) < 16 ? 'Moderate Volatility'
                       : 'High Volatility',
    };
  }).sort((a, b) => a.OverallVolatility - b.OverallVolatility);

  res.json(result);
}));

module.exports = router;