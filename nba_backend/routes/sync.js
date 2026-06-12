// ============================================
//  routes/sync.js
//  POST /api/admin/sync
//
//  Sincronización manual de datos NBA.
//  Scraping de Basketball-Reference para
//  actualizar partidos pendientes (0-0) e
//  insertar partidos nuevos sin duplicados.
// ============================================

const express  = require('express');
const router   = express.Router();
const https    = require('https');
const { query } = require('../utils/db');
const { asyncHandler } = require('../middleware/errorHandler');
const db = require('../config/db');

// ── Team ID mapping: DB TeamID → BR abbreviation ────────────────────────
const TEAM_BR_MAP = {
  1:  'ATL', 2:  'BOS', 3:  'BRK', 4:  'CHA', 5:  'CHI',
  6:  'CLE', 7:  'DAL', 8:  'DEN', 9:  'DET', 10: 'GSW',
  11: 'HOU', 12: 'IND', 13: 'LAC', 14: 'LAL', 15: 'MEM',
  16: 'MIA', 17: 'MIL', 18: 'MIN', 19: 'NOP', 20: 'NYK',
  21: 'OKC', 22: 'ORL', 23: 'PHI', 24: 'PHO', 25: 'POR',
  26: 'SAC', 27: 'SAS', 28: 'TOR', 29: 'UTA', 30: 'WAS',
  // Add more if your TeamIDs differ
};

// BR abbreviation → DB TeamID (reverse map)
const BR_TO_TEAM_ID = Object.fromEntries(
  Object.entries(TEAM_BR_MAP).map(([id, abbr]) => [abbr, Number(id)])
);

// Full name → DB TeamID — matches your actual NBA_db.Teams table
const NAME_TO_TEAM_ID = {
  'Boston Celtics': 1,        'Golden State Warriors': 2,
  'Detroit Pistons': 3,       'Indiana Pacers': 4,
  'Atlanta Hawks': 5,         'Brooklyn Nets': 6,
  'Memphis Grizzlies': 7,     'Miami Heat': 8,
  'Toronto Raptors': 9,       'Minnesota Timberwolves': 10,
  'San Antonio Spurs': 11,    'Utah Jazz': 12,
  'Phoenix Suns': 13,         'Sacramento Kings': 14,
  'Philadelphia 76ers': 15,   'Los Angeles Lakers': 16,
  'Charlotte Hornets': 17,    'Washington Wizards': 18,
  'New York Knicks': 19,      'Houston Rockets': 20,
  'Portland Trail Blazers': 21,'Orlando Magic': 22,
  'Chicago Bulls': 23,        'Milwaukee Bucks': 24,
  'Dallas Mavericks': 25,     'Denver Nuggets': 26,
  'Cleveland Cavaliers': 27,  'New Orleans Pelicans': 28,
  'Oklahoma City Thunder': 29,'Los Angeles Clippers': 30,
};

// ── Fetch helper (plain HTTPS, no external deps) ──────────────────────────
function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NBA-Analytics-Bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      }
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// ── Parse Basketball-Reference schedule page ────────────────────────────
// Returns array of: { date, homeTeamName, awayTeamName, homePoints, awayPoints }
function parseBRSchedulePage(html) {
  const games = [];

  // BR table rows look like:
  // <tr>...<td data-stat="date_game">...<td data-stat="home_team_name">...<td data-stat="pts_home">...
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const row = rowMatch[1];

    // Skip header rows
    if (row.includes('data-stat="date_game">Date') || !row.includes('data-stat="date_game"')) continue;

    const getCell = (stat) => {
      const r = new RegExp(`data-stat="${stat}"[^>]*>([^<]*(?:<[^>]+>[^<]*<\/[^>]+>)?[^<]*)<`, 'i');
      const m = r.exec(row);
      return m ? m[1].replace(/<[^>]+>/g, '').trim() : null;
    };

    const dateRaw    = getCell('date_game');
    const homeName   = getCell('home_team_name');
    const awayName   = getCell('visitor_team_name');
    const ptsHome    = getCell('pts_home');
    const ptsAway    = getCell('pts_visitor');

    if (!dateRaw || !homeName || !awayName) continue;

    // Parse date: "Mon, Oct 20, 2025" → "2025-10-20"
    let parsedDate = null;
    try {
      const d = new Date(dateRaw.replace(/^\w+,\s*/, ''));
      if (!isNaN(d)) {
        parsedDate = d.toISOString().split('T')[0];
      }
    } catch (_) {}

    if (!parsedDate) continue;

    games.push({
      date:          parsedDate,
      homeTeamName:  homeName,
      awayTeamName:  awayName,
      homePoints:    ptsHome && ptsHome !== '' ? Number(ptsHome) : null,
      awayPoints:    ptsAway && ptsAway !== '' ? Number(ptsAway) : null,
    });
  }

  return games;
}

// ── Main sync logic ───────────────────────────────────────────────────────
async function syncNBAData() {
  const results = {
    updated:  [],
    inserted: [],
    errors:   [],
    skipped:  0,
  };

  // 1. Get all pending games (HomePoints = 0 AND AwayPoints = 0)
  const pendingGames = await query(`
    SELECT
      g.GameID,
      DATE_FORMAT(g.GameDate, '%Y-%m-%d') AS GameDate,
      g.HomeTeamID,
      g.AwayTeamID,
      g.SeasonID,
      ht.TeamName AS HomeTeamName,
      at.TeamName AS AwayTeamName
    FROM Games g
    JOIN Teams ht ON g.HomeTeamID = ht.TeamID
    JOIN Teams at ON g.AwayTeamID = at.TeamID
    WHERE g.HomePoints = 0 AND g.AwayPoints = 0
    ORDER BY g.GameDate ASC
  `);

  if (!pendingGames.length) {
    return { ...results, message: 'No pending games found.' };
  }

  // 2. Determine which months/years to fetch from BR
  const monthsToFetch = new Set();
  for (const g of pendingGames) {
    const d = new Date(g.GameDate);
    // BR URL format: /leagues/NBA_2026_games-may.html
    const year  = d.getMonth() >= 9 ? d.getFullYear() + 1 : d.getFullYear(); // NBA season year
    const month = d.toLocaleString('en-US', { month: 'long' }).toLowerCase();
    monthsToFetch.add(`${year}|${month}`);
  }

  // 3. Fetch and parse BR pages
  const brGames = [];
  for (const key of monthsToFetch) {
    const [year, month] = key.split('|');
    const url = `https://www.basketball-reference.com/leagues/NBA_${year}_games-${month}.html`;
    try {
      console.log(`[sync] Fetching: ${url}`);
      const html = await fetchURL(url);
      const parsed = parseBRSchedulePage(html);
      console.log(`[sync] Parsed ${parsed.length} games from ${month} ${year}`);
      brGames.push(...parsed);
    } catch (e) {
      results.errors.push(`Failed to fetch ${url}: ${e.message}`);
    }
  }

  // 4. Build BR lookup map: "YYYY-MM-DD|HomeTeamID|AwayTeamID" → game
  const brMap = new Map();
  for (const g of brGames) {
    const homeID = NAME_TO_TEAM_ID[g.homeTeamName];
    const awayID = NAME_TO_TEAM_ID[g.awayTeamName];
    if (!homeID || !awayID) {
      // Try partial name match
      const homeIDPartial = Object.entries(NAME_TO_TEAM_ID).find(([n]) =>
        g.homeTeamName && n.toLowerCase().includes(g.homeTeamName.toLowerCase().split(' ').pop())
      )?.[1];
      const awayIDPartial = Object.entries(NAME_TO_TEAM_ID).find(([n]) =>
        g.awayTeamName && n.toLowerCase().includes(g.awayTeamName.toLowerCase().split(' ').pop())
      )?.[1];
      if (homeIDPartial && awayIDPartial) {
        brMap.set(`${g.date}|${homeIDPartial}|${awayIDPartial}`, g);
      }
      continue;
    }
    brMap.set(`${g.date}|${homeID}|${awayID}`, g);
  }

  // 5. Update pending games that now have scores
  for (const pending of pendingGames) {
    const key = `${pending.GameDate}|${pending.HomeTeamID}|${pending.AwayTeamID}`;
    const brGame = brMap.get(key);

    if (!brGame) {
      results.skipped++;
      continue;
    }

    if (brGame.homePoints === null || brGame.awayPoints === null) {
      // Game exists in BR but no score yet (still upcoming)
      results.skipped++;
      continue;
    }

    try {
      await query(`
        UPDATE Games
        SET HomePoints = ?, AwayPoints = ?
        WHERE GameID = ?
      `, [brGame.homePoints, brGame.awayPoints, pending.GameID]);

      results.updated.push({
        GameID:    pending.GameID,
        date:      pending.GameDate,
        matchup:   `${pending.HomeTeamName} ${brGame.homePoints} - ${brGame.awayPoints} ${pending.AwayTeamName}`,
      });
    } catch (e) {
      results.errors.push(`Update GameID ${pending.GameID}: ${e.message}`);
    }
  }

  // 6. Detect and insert new games not in DB
  // Get all existing game keys to avoid duplicates
  const existingKeys = new Set(
    (await query(`
      SELECT DATE_FORMAT(GameDate,'%Y-%m-%d') AS d, HomeTeamID, AwayTeamID
      FROM Games
    `)).map(r => `${r.d}|${r.HomeTeamID}|${r.AwayTeamID}`)
  );

  // Get current SeasonID for 2025-26
  const seasonRows = await query(`SELECT SeasonID FROM Seasons WHERE SeasonName = '2025-26' LIMIT 1`);
  const currentSeasonID = seasonRows[0]?.SeasonID ?? 5;

  for (const [key, brGame] of brMap.entries()) {
    if (existingKeys.has(key)) continue;

    const [date, homeID, awayID] = key.split('|');
    const homePoints = brGame.homePoints ?? 0;
    const awayPoints = brGame.awayPoints ?? 0;

    // Only insert games from this season (2025-26: Oct 2025 - Jun 2026)
    const gameDate = new Date(date);
    const gameYear = gameDate.getFullYear();
    const gameMonth = gameDate.getMonth() + 1; // 1-based
    const inCurrentSeason = (gameYear === 2025 && gameMonth >= 10) || (gameYear === 2026 && gameMonth <= 6);

    if (!inCurrentSeason) continue;

    try {
      await query(`
        INSERT INTO Games (GameDate, HomeTeamID, AwayTeamID, HomePoints, AwayPoints, SeasonID)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [date, Number(homeID), Number(awayID), homePoints, awayPoints, currentSeasonID]);

      results.inserted.push({
        date,
        matchup: `${brGame.homeTeamName} vs ${brGame.awayTeamName}`,
        score:   homePoints > 0 ? `${homePoints}-${awayPoints}` : 'TBD',
      });
    } catch (e) {
      results.errors.push(`Insert ${date} ${brGame.homeTeamName} vs ${brGame.awayTeamName}: ${e.message}`);
    }
  }

  return results;
}

// ── Endpoint ──────────────────────────────────────────────────────────────
router.post('/api/admin/sync', asyncHandler(async (_req, res) => {
  console.log('[sync] Starting NBA data sync...');
  const start = Date.now();

  const results = await syncNBAData();

  console.log(`[sync] Done in ${Date.now() - start}ms — updated: ${results.updated.length}, inserted: ${results.inserted.length}, errors: ${results.errors.length}`);

  res.json({
    success: true,
    duration: `${Date.now() - start}ms`,
    summary: {
      updated:  results.updated.length,
      inserted: results.inserted.length,
      skipped:  results.skipped,
      errors:   results.errors.length,
    },
    updated:  results.updated,
    inserted: results.inserted,
    errors:   results.errors,
  });
}));

// Also expose without /api prefix for legacy compatibility
router.post('/admin/sync', asyncHandler(async (_req, res) => {
  res.redirect(307, '/api/admin/sync');
}));

router.get('/api/admin/sync-debug', asyncHandler(async (_req, res) => {
  const html = await fetchURL('https://www.basketball-reference.com/leagues/NBA_2026_games-june.html');
  
  // Buscar las primeras 3 filas de datos
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  const rows = [];
  let m;
  let count = 0;
  while ((m = rowRegex.exec(html)) !== null && count < 5) {
    if (m[1].includes('data-stat="date_game"')) {
      rows.push(m[1].substring(0, 500));
      count++;
    }
  }
  
  res.json({
    htmlLength: html.length,
    first200chars: html.substring(0, 200),
    sampleRows: rows,
    hasTable: html.includes('data-stat="date_game"'),
    hasGames: html.includes('id="schedule"'),
  });
}));

module.exports = router;