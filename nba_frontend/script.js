/* ============================================
   NBA Analytics AI — Frontend Logic
   ============================================ */

const API = 'http://localhost:3000';

// ── Chart Instances ───────────────────────────
let mainChartInstance = null;
let secondaryChartInstance = null;
let currentTeam = null;

// ── Shared Chart.js defaults ──────────────────
Chart.defaults.color = '#8895b3';
Chart.defaults.font.family = "'DM Sans', sans-serif";

// ══════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
});

async function loadDashboard() {
  const season = document.getElementById('seasonFilter')?.value || 'all';
  await Promise.allSettled([
    loadKPIs(),
    loadMainChart('wins'),
    loadWinRateDonut(season)
  ]);
}

// ══════════════════════════════════════════════
//  KPI CARDS
// ══════════════════════════════════════════════
async function loadKPIs() {
  try {
    const [dashRes, homeRes] = await Promise.all([
      fetch(`${API}/dashboard-stats`),
      fetch(`${API}/best-home-team`)
    ]);
    const dash = await dashRes.json();
    const home = await homeRes.json();
    setText('bestHomeTeam', dash.BestHomeTeam ?? '—');
    setText('totalSeasons', dash.TotalSeasons ?? '—');
    setText('bestArena',    dash.BestArena ?? '—');
    setText('homeWinPct',   home[0] ? `${home[0].HomeWinPct}%` : '—');
  } catch (e) {
    console.error('KPI load failed', e);
  }
}

// ══════════════════════════════════════════════
//  MAIN CHART
// ══════════════════════════════════════════════
async function loadMainChart(type = 'wins') {
  let endpoint, labelKey, valueKey, title, chartLabel;
  switch (type) {
    case 'offense':
      endpoint = `${API}/top-offense`;
      labelKey = 'TeamName'; valueKey = 'AvgPoints';
      title = 'Top Offensive Teams'; chartLabel = 'Avg Points';
      break;
    case 'defense':
      endpoint = `${API}/top-defense`;
      labelKey = 'TeamName'; valueKey = 'DefensiveRating';
      title = 'Best Defensive Teams'; chartLabel = 'Pts Allowed';
      break;
    default:
      endpoint = `${API}/top-wins`;
      labelKey = 'TeamName'; valueKey = 'Wins';
      title = 'Top Teams by Wins'; chartLabel = 'Wins';
  }
  try {
    const res = await fetch(endpoint);
    const data = await res.json();
    const top = data.slice(0, 8);
    setText('mainChartTitle', title);
    const labels = top.map(d => d[labelKey]);
    const values = top.map(d => Number(d[valueKey]));
    const colors = values.map((_, i) =>
      i === 0 ? 'rgba(232,86,26,0.85)' : `rgba(59,130,246,${0.7 - i * 0.06})`
    );
    destroyChart(mainChartInstance);
    const ctx = document.getElementById('mainChart');
    mainChartInstance = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: chartLabel, data: values, backgroundColor: colors, borderRadius: 6, borderSkipped: false }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#141d2e', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, padding: 12, titleColor: '#f0f4ff', bodyColor: '#8895b3' } },
        scales: { x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8895b3' } }, y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8895b3' } } }
      }
    });
  } catch (e) { console.error('Main chart failed', e); }
}

async function loadWinRateDonut(season = 'all') {
  const seasonParam = season !== 'all' ? `?season=${season}` : '';
  try {
    const res = await fetch(`${API}/home-win-rate${seasonParam}`);
    const data = await res.json();
    const top5 = data.slice(0, 5);
    destroyChart(secondaryChartInstance);
    secondaryChartInstance = null;
    await new Promise(r => setTimeout(r, 50));
    const ctx = document.getElementById('secondaryChart');
    secondaryChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: top5.map(d => d.TeamName),
        datasets: [{ data: top5.map(d => Number(d.HomeWinPercentage)), backgroundColor: ['#e8561a','#3b82f6','#22c55e','#f59e0b','#8b5cf6'], borderColor: '#18233a', borderWidth: 3, hoverOffset: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        plugins: { legend: { position: 'bottom', labels: { padding: 14, color: '#8895b3', font: { size: 12 } } }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.toFixed(1)}% home wins` } } }
      }
    });
    setText('secondaryChartTitle', 'Win Rate Distribution');
  } catch (e) { console.error('Donut chart failed', e); }
}

function switchMainChart(type) {
  document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  loadMainChart(type);
}

// ══════════════════════════════════════════════
//  TEAM ANALYTICS
// ══════════════════════════════════════════════
async function loadTeamAnalytics(teamName) {
  currentTeam = teamName;
  setActiveNav(`team-${teamName.toLowerCase()}`);
  updatePageTitle(`${teamName}`, 'Team Season History');

  const logoUrl = `https://cdn.nba.com/logos/nba/${getNBATeamId(teamName)}/global/L/logo.svg`;
  setText('pageSubtitle', '');
  document.getElementById('pageSubtitle').innerHTML = `
    <img src="${logoUrl}" onerror="this.style.display='none'" style="height:32px;vertical-align:middle;margin-right:8px;filter:drop-shadow(0 0 6px rgba(255,255,255,0.2))" />
    Team Season History
  `;

  try {
    const res = await fetch(`${API}/team-analytics/${teamName}`);
    const data = await res.json();
    if (!data.length) { showEmpty('No data found for this team.'); return; }
    const selectedSeason = document.getElementById('seasonFilter')?.value || 'all';
    let displayRow = selectedSeason !== 'all'
      ? data.find(d => String(d.Season) === String(selectedSeason))
      : data[data.length - 1];
    if (!displayRow) { showEmpty(`No data for ${teamName} in ${selectedSeason}.`); return; }
    const latest = displayRow;

    renderDynamic(`
      <div class="section-header"><span class="section-title">${teamName} — Season Breakdown</span></div>
      <div class="team-profile">
        <div class="team-stat-card">
          <div class="team-stat-title">${latest.Season} Wins</div>
          <div class="team-stat-value">${latest.Wins}</div>
          <div class="team-stat-sub">of ${latest.GamesPlayed} games played</div>
        </div>
        <div class="team-stat-card">
          <div class="team-stat-title">Home Win %</div>
          <div class="team-stat-value">${latest.HomeWinPct}%</div>
          <div class="team-stat-sub">at home this season</div>
        </div>
      </div>
    `);

    destroyChart(mainChartInstance);
    setText('mainChartTitle', `${teamName} — Wins Per Season`);
    const ctx = document.getElementById('mainChart');
    mainChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(d => String(d.Season)),
        datasets: [{ label: 'Wins', data: data.map(d => d.Wins), borderColor: '#e8561a', backgroundColor: 'rgba(232,86,26,0.12)', pointBackgroundColor: '#e8561a', pointRadius: 5, tension: 0.35, fill: true }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#141d2e', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, padding: 12, callbacks: { label: ctx => ` ${ctx.parsed.y} wins` } } },
        scales: { x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8895b3' } }, y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8895b3' } } }
      }
    });

    destroyChart(secondaryChartInstance);
    secondaryChartInstance = null;
    await new Promise(r => setTimeout(r, 50));
    setText('secondaryChartTitle', `${latest.Season} Win/Loss`);
    const ctx2 = document.getElementById('secondaryChart');
    secondaryChartInstance = new Chart(ctx2, {
      type: 'pie',
      data: {
        labels: ['Wins', 'Losses'],
        datasets: [{ data: [latest.Wins, latest.GamesPlayed - latest.Wins], backgroundColor: ['#e8561a', '#3b82f6'], borderColor: '#18233a', borderWidth: 3, hoverOffset: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#8895b3', padding: 14 } } }
      }
    });

  } catch (e) {
    console.error('Team analytics failed', e);
    showEmpty('Could not load team data.');
  }

  setTimeout(() => {
    const chat = document.getElementById('chatSection');
    if (chat) {
      const y = chat.getBoundingClientRect().top + window.scrollY - 20;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }, 600);
}

// ══════════════════════════════════════════════
//  GAMES TABLE
// ══════════════════════════════════════════════
async function showGamesTable() {
  currentTeam = null;
  setActiveNav('games');
  updatePageTitle('Recent Games', 'Last 100 games in the database');
  try {
    const res = await fetch(`${API}/games-table`);
    const data = await res.json();
    const rows = data.map(g => `
      <tr>
        <td>${formatDate(g.GameDate)}</td>
        <td><strong style="color:var(--text-primary)">${g.HomeTeam}</strong> vs ${g.AwayTeam}</td>
        <td><span class="score-badge">${g.Score}</span></td>
        <td>${g.Attendance ? Number(g.Attendance).toLocaleString() : '—'}</td>
        <td>${g.Arena ?? '—'}</td>
        <td>${g.GameLength ?? '—'}</td>
      </tr>
    `).join('');
    renderDynamic(`
      <div class="section-header">
        <span class="section-title">Recent Games</span>
        <span style="font-size:12px;color:var(--text-muted)">${data.length} results</span>
      </div>
      <div class="table-wrap">
        <table class="nba-table">
          <thead><tr><th>Date</th><th>Matchup</th><th>Score</th><th>Attendance</th><th>Arena</th><th>Length</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `);
  } catch (e) { showEmpty('Could not load games data.'); }
}

// ══════════════════════════════════════════════
//  RANKINGS
// ══════════════════════════════════════════════
async function showRankings() {
  currentTeam = null;
  const season = document.getElementById('seasonFilter')?.value || 'all';
  const seasonParam = season !== 'all' ? `?season=${season}` : '';
  setActiveNav('rankings');
  updatePageTitle('Overall Rankings', `Composite score — ${season !== 'all' ? season : 'All Seasons'}`);
  try {
    const res = await fetch(`${API}/overall-rankings${seasonParam}`);
    const data = await res.json();
    const cards = data.map((team, i) => `
      <div class="rank-card" style="animation-delay:${i * 0.04}s">
        <div class="rank-number ${i < 3 ? 'top' : ''}">#${i + 1}</div>
        <div class="rank-info">
          <div class="rank-name">${team.TeamName}</div>
          <div class="rank-stats">
            <div class="rank-stat"><span class="rank-stat-label">Offense</span><span class="rank-stat-value">${team.OffensiveRating}</span></div>
            <div class="rank-stat"><span class="rank-stat-label">Defense</span><span class="rank-stat-value">${team.DefensiveRating}</span></div>
            <div class="rank-stat"><span class="rank-stat-label">Win %</span><span class="rank-stat-value">${team.WinRate}%</span></div>
          </div>
        </div>
        <div class="rank-score">${team.OverallScore}</div>
      </div>
    `).join('');
    renderDynamic(`
      <div class="section-header"><span class="section-title">Overall Rankings${season !== 'all' ? ` — ${season}` : ''}</span></div>
      <div class="rankings-grid">${cards}</div>
    `);
  } catch (e) { showEmpty('Could not load rankings.'); }
  await loadMainChartWithSeason(season);
}

// ══════════════════════════════════════════════
//  HEAD TO HEAD
// ══════════════════════════════════════════════
async function showHeadToHead(team1, team2) {
  currentTeam = null;
  updatePageTitle(`${team1} vs ${team2}`, 'Head-to-Head History');
  try {
    const res = await fetch(`${API}/head-to-head/${team1}/${team2}`);
    if (!res.ok) { showEmpty('No games found between these teams.'); return; }
    const data = await res.json();
    const { summary, games } = data;
    const rows = games.map(g => {
      const isTeam1Win = g.Winner.toLowerCase().includes(team1.toLowerCase());
      return `
        <tr>
          <td>${g.GameDate}</td>
          <td><strong style="color:var(--text-primary)">${g.HomeTeam}</strong> vs ${g.AwayTeam}</td>
          <td><span class="score-badge">${g.HomePoints} - ${g.AwayPoints}</span></td>
          <td style="color:${isTeam1Win ? 'var(--green)' : 'var(--accent)'}">${g.Winner}</td>
          <td>${g.Arena ?? '—'}</td>
        </tr>
      `;
    }).join('');
    renderDynamic(`
      <div class="section-header"><span class="section-title">${team1} vs ${team2}</span></div>
      <div class="kpi-grid" style="grid-template-columns: repeat(3,1fr); margin-bottom:16px;">
        <div class="kpi-card"><div class="kpi-icon">🏆</div><div class="kpi-body"><span class="kpi-label">${team1} Wins</span><span class="kpi-value" style="color:var(--green)">${summary.team1Wins}</span></div></div>
        <div class="kpi-card"><div class="kpi-icon">📊</div><div class="kpi-body"><span class="kpi-label">Total Games</span><span class="kpi-value">${summary.total}</span></div></div>
        <div class="kpi-card"><div class="kpi-icon">🏆</div><div class="kpi-body"><span class="kpi-label">${team2} Wins</span><span class="kpi-value" style="color:var(--accent)">${summary.team2Wins}</span></div></div>
      </div>
      <div class="table-wrap">
        <table class="nba-table">
          <thead><tr><th>Date</th><th>Matchup</th><th>Score</th><th>Winner</th><th>Arena</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `);
    destroyChart(mainChartInstance);
    setText('mainChartTitle', 'Head-to-Head Record');
    const ctx = document.getElementById('mainChart');
    mainChartInstance = new Chart(ctx, {
      type: 'bar',
      data: { labels: [team1, team2], datasets: [{ label: 'Wins', data: [summary.team1Wins, summary.team2Wins], backgroundColor: ['rgba(34,197,94,0.8)', 'rgba(232,86,26,0.8)'], borderRadius: 8, borderSkipped: false }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8895b3' } }, y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8895b3', stepSize: 1 } } } }
    });
  } catch (e) { showEmpty('Could not load head-to-head data.'); }
}

// ══════════════════════════════════════════════
//  TEAM COMPARISON RADAR CHART
// ══════════════════════════════════════════════
async function showTeamComparison(team1, team2) {
  currentTeam = null;
  updatePageTitle(`${team1} vs ${team2}`, 'Team Comparison');
  try {
    const res = await fetch(`${API}/compare/${team1}/${team2}`);
    const data = await res.json();
    if (!data.teams?.length) { showEmpty('Could not find both teams.'); return; }
    const [t1, t2] = data.teams.length >= 2 ? [data.teams[0], data.teams[1]] : [data.teams[0], data.teams[0]];
    renderDynamic(`
      <div class="section-header"><span class="section-title">${t1.TeamName} vs ${t2.TeamName}</span></div>
      <div class="charts-row" style="padding:0 0 16px">
        <div class="chart-card">
          <div class="chart-card-header"><span class="chart-title">Radar Comparison</span></div>
          <div class="chart-wrap"><canvas id="radarChart"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header"><span class="chart-title">Overall Score</span></div>
          <div class="chart-wrap"><canvas id="comparisonBarChart"></canvas></div>
        </div>
      </div>
      <div class="rankings-grid">
        ${[t1, t2].map(t => `
          <div class="rank-card">
            <div class="rank-info" style="width:100%">
              <div class="rank-name">${t.TeamName}</div>
              <div class="rank-stats" style="flex-wrap:wrap;gap:16px;margin-top:8px">
                <div class="rank-stat"><span class="rank-stat-label">Offense</span><span class="rank-stat-value">${t.OffensiveRating}</span></div>
                <div class="rank-stat"><span class="rank-stat-label">Defense</span><span class="rank-stat-value">${t.DefensiveRating}</span></div>
                <div class="rank-stat"><span class="rank-stat-label">Win Rate</span><span class="rank-stat-value">${t.WinRate}%</span></div>
                <div class="rank-stat"><span class="rank-stat-label">Overall</span><span class="rank-stat-value" style="color:var(--blue)">${t.OverallScore}</span></div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `);
    new Chart(document.getElementById('radarChart'), {
      type: 'radar',
      data: {
        labels: ['Offense', 'Defense\n(inverted)', 'Win Rate', 'Home Win%', 'Overall'],
        datasets: [
          { label: t1.TeamName, data: [Number(t1.OffensiveRating), 120-Number(t1.DefensiveRating), Number(t1.WinRate), Number(t1.WinRate)*1.1, Number(t1.OverallScore)], borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.15)', pointBackgroundColor: '#22c55e', borderWidth: 2 },
          { label: t2.TeamName, data: [Number(t2.OffensiveRating), 120-Number(t2.DefensiveRating), Number(t2.WinRate), Number(t2.WinRate)*1.1, Number(t2.OverallScore)], borderColor: '#e8561a', backgroundColor: 'rgba(232,86,26,0.15)', pointBackgroundColor: '#e8561a', borderWidth: 2 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#8895b3' } } }, scales: { r: { grid: { color: 'rgba(255,255,255,0.08)' }, pointLabels: { color: '#8895b3', font: { size: 11 } }, ticks: { display: false } } } }
    });
    new Chart(document.getElementById('comparisonBarChart'), {
      type: 'bar',
      data: { labels: [t1.TeamName, t2.TeamName], datasets: [{ label: 'Overall Score', data: [Number(t1.OverallScore), Number(t2.OverallScore)], backgroundColor: ['rgba(34,197,94,0.8)', 'rgba(232,86,26,0.8)'], borderRadius: 8, borderSkipped: false }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8895b3' } }, y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8895b3' } } } }
    });
  } catch (e) { showEmpty('Could not load comparison data.'); }
}

// ══════════════════════════════════════════════
//  QUICK ANALYTICS FILTERS
// ══════════════════════════════════════════════
async function filterAnalytics(type) {
  currentTeam = null;
  const season = document.getElementById('seasonFilter')?.value || 'all';
  const seasonParam = season !== 'all' ? `?season=${season}` : '';
  const config = {
    offense:    { ep: `/top-offense${seasonParam}`,     title: 'Top Offensive Teams',   key: 'AvgPoints',       label: 'PPG',  sub: 'Avg Points Per Game' },
    defense:    { ep: `/top-defense${seasonParam}`,     title: 'Best Defensive Teams',  key: 'DefensiveRating', label: 'PA',   sub: 'Avg Points Allowed' },
    attendance: { ep: `/best-attendance${seasonParam}`, title: 'Best Arena Attendance', key: 'AvgAttendance',   label: 'Fans', sub: 'Avg Attendance' }
  };
  const c = config[type];
  updatePageTitle(c.title, c.sub + (season !== 'all' ? ` — ${season}` : ''));
  try {
    const res = await fetch(`${API}${c.ep}`);
    const data = await res.json();
    const cards = data.slice(0, 10).map((item, i) => {
      const name  = item.TeamName || item.Arena || '—';
      const value = item[c.key];
      return `
        <div class="rank-card" style="animation-delay:${i * 0.04}s">
          <div class="rank-number ${i < 3 ? 'top' : ''}">#${i + 1}</div>
          <div class="rank-info">
            <div class="rank-name">${name}</div>
            <div class="rank-stats"><div class="rank-stat"><span class="rank-stat-label">${c.label}</span><span class="rank-stat-value">${Number(value).toLocaleString()}</span></div></div>
          </div>
        </div>
      `;
    }).join('');
    renderDynamic(`
      <div class="section-header"><span class="section-title">${c.title}${season !== 'all' ? ` — ${season}` : ''}</span></div>
      <div class="rankings-grid">${cards}</div>
    `);
  } catch (e) { showEmpty('Could not load analytics data.'); }
}

// ══════════════════════════════════════════════
//  HOME
// ══════════════════════════════════════════════

// ══════════════════════════════════════════════
//  SYNC
// ══════════════════════════════════════════════
async function syncNBAData() {
  const btn = document.getElementById('syncBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> Syncing…'; }
  const loadingId = appendLoadingMessage();
  try {
    const res  = await fetch(`${API}/api/admin/sync`, { method: 'POST' });
    const data = await res.json();
    removeMessage(loadingId);
    const rows = [
      ...(data.updated||[]).map(g=>`<div class="sync-row sync-updated">✅ ${g.matchup} (${g.date})</div>`),
      ...(data.inserted||[]).map(g=>`<div class="sync-row sync-inserted">➕ ${g.matchup} (${g.date})</div>`),
      ...(data.errors||[]).map(e=>`<div class="sync-row sync-error">⚠️ ${e}</div>`),
    ].join('');
    appendMessageHTML('bot', `<div style="display:flex;flex-direction:column;gap:8px">
      <div style="font-weight:600;color:var(--text-primary)">Sync completado</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px">
        <span style="color:var(--green)"><b>${data.summary?.updated??0}</b> actualizados</span>
        <span style="color:var(--blue)"><b>${data.summary?.inserted??0}</b> insertados</span>
        <span style="color:var(--text-muted)"><b>${data.summary?.skipped??0}</b> sin cambio</span>
        <span style="color:var(--red)"><b>${data.summary?.errors??0}</b> errores</span>
      </div>
      ${rows ? `<div style="display:flex;flex-direction:column;gap:3px;max-height:200px;overflow-y:auto">${rows}</div>` : ''}
    </div>`);
  } catch(e) {
    removeMessage(loadingId);
    appendMessage('bot','⚠️ Sync falló. Verifica que el backend esté corriendo.');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> Sync'; }
  }
}

// ══════════════════════════════════════════════
//  PREDICTIONS
// ══════════════════════════════════════════════
const ALL_NBA_TEAMS = [
  'Atlanta Hawks','Boston Celtics','Brooklyn Nets','Charlotte Hornets',
  'Chicago Bulls','Cleveland Cavaliers','Dallas Mavericks','Denver Nuggets',
  'Detroit Pistons','Golden State Warriors','Houston Rockets','Indiana Pacers',
  'Los Angeles Clippers','Los Angeles Lakers','Memphis Grizzlies','Miami Heat',
  'Milwaukee Bucks','Minnesota Timberwolves','New Orleans Pelicans','New York Knicks',
  'Oklahoma City Thunder','Orlando Magic','Philadelphia 76ers','Phoenix Suns',
  'Portland Trail Blazers','Sacramento Kings','San Antonio Spurs','Toronto Raptors',
  'Utah Jazz','Washington Wizards'
];

async function showPredictions(preTeamA='', preTeamB='') {
  currentTeam = null;
  setActiveNav('predictions');
updatePageTitle('🔮 Pronósticos / Predictions', 'Modelo estadístico · Sin IA requerida');
  let upcomingOpts = '<option value="">— Select upcoming game —</option>';
  try {
    const upData = await (await fetch(`${API}/upcoming-games`)).json();
    upcomingOpts += upData.map(g =>
      `<option value="${g.HomeTeam}|${g.AwayTeam}" data-home="${g.HomeTeam}" data-away="${g.AwayTeam}">
        ${g.GameDate}${g.StartTime?' '+g.StartTime:''} — ${g.HomeTeam} vs ${g.AwayTeam}${g.Arena?' @ '+g.Arena:''}
      </option>`
    ).join('');
  } catch(_){}

  const teamOpts = ALL_NBA_TEAMS.map(t=>`<option value="${t}">${t}</option>`).join('');

  renderDynamic(`
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="upcoming-select-card">
        <span class="chart-title">📅 Select Upcoming Game (NBA Finals 2026)</span>
        <select class="prediction-select" id="upcomingGameSelect" onchange="fillFromUpcoming(this)" style="width:100%">
          ${upcomingOpts}
        </select>
      </div>
      <div class="prediction-form">
        <div class="prediction-form-group">
          <label>Team A</label>
          <select class="prediction-select" id="predTeamA">
            <option value="">Select team…</option>${teamOpts}
          </select>
        </div>
        <div class="prediction-form-group">
          <label>Team B</label>
          <select class="prediction-select" id="predTeamB">
            <option value="">Select team…</option>${teamOpts}
          </select>
        </div>
        <button class="predict-btn" id="predictRunBtn" onclick="runPrediction()">
          🔮 Generate
        </button>
      </div>
      <div id="predictionOutput"></div>
    </div>
  `);

  if (preTeamA) {
    const selA = document.getElementById('predTeamA');
    if (selA) { const m = ALL_NBA_TEAMS.find(t=>t.toLowerCase().includes(preTeamA.toLowerCase())); if(m) selA.value=m; }
  }
  if (preTeamB) {
    const selB = document.getElementById('predTeamB');
    if (selB) { const m = ALL_NBA_TEAMS.find(t=>t.toLowerCase().includes(preTeamB.toLowerCase())); if(m) selB.value=m; }
  }
  if (preTeamA && preTeamB) setTimeout(runPrediction, 150);
}

function fillFromUpcoming(select) {
  const opt = select.options[select.selectedIndex];
  const home = opt.getAttribute('data-home');
  const away = opt.getAttribute('data-away');
  if (!home || !away) return;
  const selA = document.getElementById('predTeamA');
  const selB = document.getElementById('predTeamB');
  if (selA) selA.value = home;
  if (selB) selB.value = away;
}

async function runPrediction() {
  const teamA = document.getElementById('predTeamA')?.value;
  const teamB = document.getElementById('predTeamB')?.value;
  const out = document.getElementById('predictionOutput');
  if (!teamA || !teamB) { out.innerHTML='<p style="color:var(--red);padding:12px 0">⚠️ Select both teams.</p>'; return; }
  if (teamA===teamB)    { out.innerHTML='<p style="color:var(--red);padding:12px 0">⚠️ Select two different teams.</p>'; return; }

  const btn = document.getElementById('predictRunBtn');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Calculating…'; }

  try {
    const res  = await fetch(`${API}/predict-game?teamA=${encodeURIComponent(teamA)}&teamB=${encodeURIComponent(teamB)}`);
    const data = await res.json();
    if (data.error) { out.innerHTML=`<p style="color:var(--red);padding:12px 0">⚠️ ${data.error}</p>`; return; }
    renderPredictionResult(data, 'predictionOutput');
  } catch(e) {
    out.innerHTML='<p style="color:var(--red);padding:12px 0">⚠️ Could not reach server.</p>';
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='🔮 Generate'; }
  }
}

async function showPredictionResult(teamAKw, teamBKw) {
  showPredictions(teamAKw, teamBKw);
  setTimeout(()=>{ document.getElementById('dynamicSection')?.scrollIntoView({behavior:'smooth'}); }, 300);
}

function renderPredictionResult(data, containerId) {
  const {teamA,teamB,favorite,confidence,explanation,factors,season,model} = data;
  const probAClass = teamA.probability >= teamB.probability ? 'favorite' : 'underdog';
  const probBClass = teamB.probability >= teamA.probability ? 'favorite' : 'underdog';
  const factorItems = (factors||[]).map(f=>`<div class="prediction-factor-item"><span class="prediction-factor-dot"></span>${f}</div>`).join('');

  document.getElementById(containerId).innerHTML = `
    <div class="prediction-result">
      <div class="prediction-matchup">
        <div class="prediction-team-block">
          <div class="prediction-team-name">${teamA.name}</div>
          <div class="prediction-prob ${probAClass}">${teamA.probability}%</div>
          <div class="prediction-score-label">Projected Score</div>
          <div class="prediction-score-value">${teamA.projectedScore} pts</div>
        </div>
        <div class="prediction-vs-block">
          <span class="prediction-vs">VS</span>
          <div class="prediction-projected-score">
            <span class="prediction-projected-label">Projected Final</span>
            <span class="prediction-projected-value">${teamA.projectedScore} – ${teamB.projectedScore}</span>
          </div>
        </div>
        <div class="prediction-team-block">
          <div class="prediction-team-name">${teamB.name}</div>
          <div class="prediction-prob ${probBClass}">${teamB.probability}%</div>
          <div class="prediction-score-label">Projected Score</div>
          <div class="prediction-score-value">${teamB.projectedScore} pts</div>
        </div>
      </div>
      <div class="confidence-row">
        <span class="confidence-label">Confidence:</span>
        <span class="confidence-badge ${confidence}">${confidence}</span>
        <span class="confidence-label">Data: ${season}</span>
      </div>
      <div class="prediction-explanation"><strong>🏆 ${favorite}</strong> is projected to win. ${explanation}</div>
      <div class="prediction-factors">
        <div class="prediction-factors-title">Key Factors</div>
        ${factorItems}
      </div>
      <div class="prediction-charts">
        <div class="chart-card"><div class="chart-card-header"><span class="chart-title">Win Probability</span></div><div class="chart-wrap"><canvas id="predProbChart"></canvas></div></div>
        <div class="chart-card"><div class="chart-card-header"><span class="chart-title">Offensive Rating</span></div><div class="chart-wrap"><canvas id="predOffChart"></canvas></div></div>
        <div class="chart-card"><div class="chart-card-header"><span class="chart-title">Defensive Rating</span></div><div class="chart-wrap"><canvas id="predDefChart"></canvas></div></div>
      </div>
      <div class="prediction-model-info">📐 ${model.formula}<br>📊 ${model.probFormula}</div>
    </div>`;
  setTimeout(()=>drawPredictionCharts(data), 50);
}

function drawPredictionCharts(data) {
  const {teamA,teamB} = data;
  const bo = { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false},tooltip:{backgroundColor:'#161d2e',titleColor:'#eef2ff',bodyColor:'#94a3b8'}}, scales:{x:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#94a3b8'}},y:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#94a3b8'}}} };
  const pc = document.getElementById('predProbChart');
  if(pc) new Chart(pc,{type:'doughnut',data:{labels:[teamA.name,teamB.name],datasets:[{data:[teamA.probability,teamB.probability],backgroundColor:['#e8561a','#3b82f6'],borderColor:'#161d2e',borderWidth:3,hoverOffset:5}]},options:{responsive:true,maintainAspectRatio:false,cutout:'66%',plugins:{legend:{position:'bottom',labels:{color:'#94a3b8',padding:10,font:{size:11}}}}}});
  const oc = document.getElementById('predOffChart');
  if(oc) new Chart(oc,{type:'bar',data:{labels:[teamA.name,teamB.name],datasets:[{data:[teamA.avgPtsFor,teamB.avgPtsFor],backgroundColor:['rgba(232,86,26,0.8)','rgba(59,130,246,0.8)'],borderRadius:6,borderSkipped:false}]},options:bo});
  const dc = document.getElementById('predDefChart');
  if(dc) new Chart(dc,{type:'bar',data:{labels:[teamA.name,teamB.name],datasets:[{data:[teamA.avgPtsAgainst,teamB.avgPtsAgainst],backgroundColor:['rgba(232,86,26,0.45)','rgba(59,130,246,0.45)'],borderRadius:6,borderSkipped:false}]},options:bo});
}

// ============================================
//  Actuarial Analytics — Frontend Module
//  Paste this entire block into your script.js
//  BEFORE the goHome() function
// ============================================

// ══════════════════════════════════════════════
//  ACTUARIAL ANALYTICS MAIN VIEW
// ══════════════════════════════════════════════
async function showActuarial() {
  currentTeam = null;
  setActiveNav('actuarial');
  updatePageTitle('📊 Actuarial Analytics', 'Statistical & Actuarial Analysis Engine');

  renderDynamic(`
    <div class="actuarial-tabs" id="actuarialTabs">
      <button class="act-tab active" onclick="showActuarialTab('asi')">
        <span>🏆</span> ASI Rankings
      </button>
      <button class="act-tab" onclick="showActuarialTab('montecarlo')">
        <span>🎲</span> Monte Carlo
      </button>
      <button class="act-tab" onclick="showActuarialTab('risk')">
        <span>📉</span> Risk & Volatility
      </button>
      <button class="act-tab" onclick="showActuarialTab('championship')">
        <span>🥇</span> Championship Odds
      </button>
      <button class="act-tab" onclick="showActuarialTab('confidence')">
        <span>📐</span> Confidence Intervals
      </button>
    </div>
    <div id="actuarialContent" class="actuarial-content"></div>
  `);

  showActuarialTab('asi');
}

function showActuarialTab(tab) {
  document.querySelectorAll('.act-tab').forEach(t => t.classList.remove('active'));
  const idx = ['asi','montecarlo','risk','championship','confidence'].indexOf(tab);
  const tabs = document.querySelectorAll('.act-tab');
  if (tabs[idx]) tabs[idx].classList.add('active');

  switch(tab) {
    case 'asi':          loadASI();          break;
    case 'montecarlo':   loadMonteCarloUI(); break;
    case 'risk':         loadVolatility();   break;
    case 'championship': loadChampionship(); break;
    case 'confidence':   loadConfidenceUI(); break;
  }
}

// ══════════════════════════════════════════════
//  ASI RANKINGS
// ══════════════════════════════════════════════
async function loadASI() {
  const content = document.getElementById('actuarialContent');
  content.innerHTML = '<div class="act-loading">⚙️ Computing Actuarial Strength Index…</div>';

  try {
    const season = document.getElementById('seasonFilter')?.value || 'all';
    const param  = season !== 'all' ? `?season=${season}` : '';
    const data   = await (await fetch(`${API}/actuarial/asi${param}`)).json();

    const maxASI = data[0]?.ASI || 100;

    const rows = data.map((t, i) => `
      <div class="asi-row" style="animation-delay:${i*0.04}s">
        <div class="asi-rank ${i < 3 ? 'asi-rank-top' : ''}">#${i+1}</div>
        <div class="asi-team-info">
          <div class="asi-team-name">${t.TeamName}</div>
          <div class="asi-bar-wrap">
            <div class="asi-bar" style="width:${(t.ASI/maxASI*100).toFixed(1)}%"></div>
          </div>
          <div class="asi-stats">
            <span>Win% <b>${t.WinPct}%</b></span>
            <span>Diff <b>${t.AvgPointDiff > 0 ? '+' : ''}${t.AvgPointDiff}</b></span>
            <span>Recent <b>${t.RecentForm}%</b></span>
            <span>Home <b>${t.HomeWinRate}%</b></span>
          </div>
        </div>
        <div class="asi-score">${t.ASI}</div>
      </div>
    `).join('');

    content.innerHTML = `
      <div class="act-description">
        <div class="act-desc-title">What is this?</div>
        <div class="act-desc-text">
          The <strong>Actuarial Strength Index (ASI)</strong> combines four weighted factors into a single score per team:
          win percentage (40%), normalized point differential (30%), recent form over last 10 games (20%), and home win advantage (10%).
          This produces an objective ranking of team strength — the same weighted-index methodology used in actuarial risk scoring.
        </div>
      </div>
      <div class="act-section-header">
        <h3>Actuarial Strength Index</h3>
        <span class="act-formula">ASI = WinPct×40 + NormDiff×30 + RecentForm×20 + HomeAdv×10</span>
      </div>
      <div class="asi-list">${rows}</div>
    `;

    // Draw chart after DOM settles
    setTimeout(() => drawASIChart(data.slice(0, 10)), 80);

  } catch(e) {
    content.innerHTML = `<p style="color:var(--red)">⚠️ Error loading ASI data.</p>`;
  }
}

function drawASIChart(data) {
  const content = document.getElementById('actuarialContent');
  if (!content) return;

  const chartDiv = document.createElement('div');
  chartDiv.id = 'asiChartContainer';
  chartDiv.innerHTML = `
    <div class="act-chart-card" style="margin-top:16px">
      <div class="act-chart-title">ASI Score — Top 10 Teams</div>
      <div class="chart-wrap"><canvas id="asiChart"></canvas></div>
    </div>
  `;
  content.appendChild(chartDiv);

  setTimeout(() => {
    const ctx = document.getElementById('asiChart');
    if (!ctx) return;
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.TeamName),
        datasets: [{
          label: 'ASI',
          data: data.map(d => d.ASI),
          backgroundColor: data.map((_, i) =>
            i === 0 ? 'rgba(232,86,26,0.85)' :
            i === 1 ? 'rgba(232,86,26,0.65)' :
            i === 2 ? 'rgba(232,86,26,0.45)' :
            'rgba(59,130,246,0.5)'
          ),
          borderRadius: 6, borderSkipped: false
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#161d2e', titleColor: '#eef2ff', bodyColor: '#94a3b8' } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { size: 11 } } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8' }, min: 40 }
        }
      }
    });
  }, 30);
}

// ══════════════════════════════════════════════
//  MONTE CARLO
// ══════════════════════════════════════════════
function loadMonteCarloUI() {
  const teamOpts = ALL_NBA_TEAMS.map(t => `<option value="${t}">${t}</option>`).join('');
  const content  = document.getElementById('actuarialContent');

  content.innerHTML = `
    <div class="act-description">
      <div class="act-desc-title">What is this?</div>
      <div class="act-desc-text">
        <strong>Monte Carlo Simulation</strong> runs thousands of virtual games using statistical distributions based on each team's historical scoring.
        Each simulation draws a probable score for both teams from a Normal distribution N(μ, σ), where μ is the adjusted expected score
        and σ is the historical standard deviation. The proportion of simulations won by each team becomes a statistically robust win probability —
        the same method actuaries use to estimate future risk across thousands of scenarios.
      </div>
    </div>
    <div class="act-section-header">
      <h3>Monte Carlo Simulation</h3>
      <span class="act-formula">Score ~ N(μ_adj, σ) · μ = (team_offense + opponent_defense) / 2</span>
    </div>
    <div class="mc-form">
      <div class="prediction-form-group">
        <label>Team A</label>
        <select class="prediction-select" id="mcTeamA">
          <option value="">Select team…</option>${teamOpts}
        </select>
      </div>
      <div class="prediction-form-group">
        <label>Team B</label>
        <select class="prediction-select" id="mcTeamB">
          <option value="">Select team…</option>${teamOpts}
        </select>
      </div>
      <div class="prediction-form-group">
        <label>Simulations</label>
        <select class="prediction-select" id="mcSims">
          <option value="1000">1,000</option>
          <option value="10000" selected>10,000</option>
          <option value="50000">50,000</option>
          <option value="100000">100,000</option>
        </select>
      </div>
      <button class="predict-btn" onclick="runMonteCarlo()">🎲 Run Simulation</button>
    </div>
    <div id="mcResult"></div>
  `;
}

async function runMonteCarlo() {
  const teamA = document.getElementById('mcTeamA')?.value;
  const teamB = document.getElementById('mcTeamB')?.value;
  const sims  = document.getElementById('mcSims')?.value;
  const out   = document.getElementById('mcResult');

  if (!teamA || !teamB) { out.innerHTML = '<p style="color:var(--red);padding:12px 0">⚠️ Select both teams.</p>'; return; }
  if (teamA === teamB)  { out.innerHTML = '<p style="color:var(--red);padding:12px 0">⚠️ Select two different teams.</p>'; return; }

  out.innerHTML = `<div class="act-loading">🎲 Running ${Number(sims).toLocaleString()} simulations…</div>`;

  try {
    const res  = await fetch(`${API}/actuarial/montecarlo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamA, teamB, simulations: Number(sims) })
    });
    const data = await res.json();
    if (data.error) { out.innerHTML = `<p style="color:var(--red)">${data.error}</p>`; return; }

    const probAClass = data.teamA.probability >= data.teamB.probability ? 'favorite' : 'underdog';
    const probBClass = data.teamB.probability >= data.teamA.probability ? 'favorite' : 'underdog';
    const favColor   = '#e8561a';
    const undColor   = '#3b82f6';

    out.innerHTML = `
      <div class="mc-result">
        <!-- Header banner -->
        <div class="mc-banner">
          <div class="mc-team-block">
            <div class="mc-team-name">${data.teamA.name}</div>
            <div class="mc-prob ${probAClass}">${data.teamA.probability}%</div>
            <div class="mc-wins">${data.teamA.wins.toLocaleString()} wins</div>
          </div>
          <div class="mc-center">
            <div class="mc-vs">VS</div>
            <div class="mc-sims">${data.simulations.toLocaleString()} simulations</div>
            <span class="confidence-badge ${data.confidence}">${data.confidence} confidence</span>
          </div>
          <div class="mc-team-block">
            <div class="mc-team-name">${data.teamB.name}</div>
            <div class="mc-prob ${probBClass}">${data.teamB.probability}%</div>
            <div class="mc-wins">${data.teamB.wins.toLocaleString()} wins</div>
          </div>
        </div>

        <!-- Score distributions -->
        <div class="mc-distributions">
          <div class="mc-dist-card">
            <div class="mc-dist-title">${data.teamA.name} — Score Distribution</div>
            <div class="mc-dist-row">
              <span class="mc-dist-label">P10</span><span class="mc-dist-val">${data.teamA.scoreP10}</span>
              <span class="mc-dist-label">Median</span><span class="mc-dist-val">${data.teamA.scoreP50}</span>
              <span class="mc-dist-label">Expected</span><span class="mc-dist-val" style="color:var(--accent)">${data.teamA.expectedScore}</span>
              <span class="mc-dist-label">P90</span><span class="mc-dist-val">${data.teamA.scoreP90}</span>
            </div>
          </div>
          <div class="mc-dist-card">
            <div class="mc-dist-title">${data.teamB.name} — Score Distribution</div>
            <div class="mc-dist-row">
              <span class="mc-dist-label">P10</span><span class="mc-dist-val">${data.teamB.scoreP10}</span>
              <span class="mc-dist-label">Median</span><span class="mc-dist-val">${data.teamB.scoreP50}</span>
              <span class="mc-dist-label">Expected</span><span class="mc-dist-val" style="color:var(--blue)">${data.teamB.expectedScore}</span>
              <span class="mc-dist-label">P90</span><span class="mc-dist-val">${data.teamB.scoreP90}</span>
            </div>
          </div>
        </div>

        <!-- Factors -->
        <div class="prediction-factors" style="margin-top:14px">
          <div class="prediction-factors-title">Key Factors Used in Model</div>
          ${data.factors.map(f => `<div class="prediction-factor-item"><span class="prediction-factor-dot"></span>${f}</div>`).join('')}
        </div>

        <!-- Model note -->
        <div class="prediction-model-info" style="margin-top:12px">
          📐 Model: ${data.model}
        </div>
      </div>
    `;

    // Draw probability donut
    setTimeout(() => {
      const mc = document.createElement('div');
      mc.innerHTML = `
        <div class="mc-charts-row" style="margin-top:14px">
          <div class="act-chart-card">
            <div class="act-chart-title">Win Probability</div>
            <div class="chart-wrap"><canvas id="mcProbChart"></canvas></div>
          </div>
          <div class="act-chart-card">
            <div class="act-chart-title">Expected Score Comparison</div>
            <div class="chart-wrap"><canvas id="mcScoreChart"></canvas></div>
          </div>
        </div>`;
      out.appendChild(mc);

      new Chart(document.getElementById('mcProbChart'), {
        type: 'doughnut',
        data: {
          labels: [data.teamA.name, data.teamB.name],
          datasets: [{ data: [data.teamA.probability, data.teamB.probability], backgroundColor: [favColor, undColor], borderColor: '#161d2e', borderWidth: 3, hoverOffset: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 10 } } } }
      });

      new Chart(document.getElementById('mcScoreChart'), {
        type: 'bar',
        data: {
          labels: ['P10', 'Median', 'Expected', 'P90'],
          datasets: [
            { label: data.teamA.name, data: [data.teamA.scoreP10, data.teamA.scoreP50, data.teamA.expectedScore, data.teamA.scoreP90], backgroundColor: 'rgba(232,86,26,0.7)', borderRadius: 5 },
            { label: data.teamB.name, data: [data.teamB.scoreP10, data.teamB.scoreP50, data.teamB.expectedScore, data.teamB.scoreP90], backgroundColor: 'rgba(59,130,246,0.7)', borderRadius: 5 }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8' } }, tooltip: { backgroundColor: '#161d2e' } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8' } }, y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8' }, min: 80 } } }
      });
    }, 50);

  } catch(e) {
    out.innerHTML = '<p style="color:var(--red)">⚠️ Simulation failed.</p>';
  }
}

// ══════════════════════════════════════════════
//  VOLATILITY / RISK
// ══════════════════════════════════════════════
async function loadVolatility() {
  const content = document.getElementById('actuarialContent');
  content.innerHTML = '<div class="act-loading">⚙️ Computing risk metrics…</div>';

  try {
    const season = document.getElementById('seasonFilter')?.value || 'all';
    const param  = season !== 'all' ? `?season=${season}` : '';
    const data   = await (await fetch(`${API}/actuarial/volatility${param}`)).json();

    const labelColor = { 'Very Consistent': '#22c55e', 'Consistent': '#3b82f6', 'Moderate Volatility': '#f59e0b', 'High Volatility': '#ef4444' };

    const rows = data.map((t, i) => `
      <div class="risk-row" style="animation-delay:${i*0.035}s">
        <div class="risk-team">${t.TeamName}</div>
        <div class="risk-metrics">
          <div class="risk-metric">
            <span class="risk-label">OFF AVG</span>
            <span class="risk-value">${t.OffenseAvg}</span>
          </div>
          <div class="risk-metric">
            <span class="risk-label">OFF σ</span>
            <span class="risk-value">${t.OffenseStd}</span>
          </div>
          <div class="risk-metric">
            <span class="risk-label">DEF AVG</span>
            <span class="risk-value">${t.DefenseAvg}</span>
          </div>
          <div class="risk-metric">
            <span class="risk-label">DEF σ</span>
            <span class="risk-value">${t.DefenseStd}</span>
          </div>
          <div class="risk-metric">
            <span class="risk-label">CV%</span>
            <span class="risk-value">${t.OverallVolatility}%</span>
          </div>
        </div>
        <span class="risk-label-badge" style="color:${labelColor[t.Label]||'#94a3b8'};border-color:${labelColor[t.Label]||'#94a3b8'}">${t.Label}</span>
      </div>
    `).join('');

    content.innerHTML = `
      <div class="act-description">
        <div class="act-desc-title">What is this?</div>
        <div class="act-desc-text">
          <strong>Volatility</strong> is measured using the Coefficient of Variation (CV = σ/μ × 100).
          A low CV means a consistent team — scoring close to their average every game.
          A high CV signals unpredictability — capable of both blowout wins and bad losses.
          In actuarial science, CV is used to measure policy risk: the higher the CV, the less predictable the outcome.
          Teams are sorted from most consistent (lowest CV) to most volatile.
        </div>
      </div>
      <div class="act-section-header">
        <h3>Risk & Volatility Analysis</h3>
        <span class="act-formula">CV = σ / μ × 100 · Sorted by consistency (lowest CV = most consistent)</span>
      </div>
      <div class="risk-list">${rows}</div>
    `;

    // Scatter-style chart: offense avg vs std
    setTimeout(() => {
      const cd = document.createElement('div');
      cd.innerHTML = `
        <div class="mc-charts-row" style="margin-top:16px">
          <div class="act-chart-card">
            <div class="act-chart-title">Offensive Volatility (Avg vs StdDev)</div>
            <div class="chart-wrap" style="height:300px"><canvas id="volOffChart"></canvas></div>
          </div>
          <div class="act-chart-card">
            <div class="act-chart-title">Defensive Volatility (Avg Points Allowed vs StdDev)</div>
            <div class="chart-wrap" style="height:300px"><canvas id="volDefChart"></canvas></div>
          </div>
        </div>`;
      content.appendChild(cd);

      const chartOpts = (title) => ({
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#161d2e', titleColor: '#eef2ff', bodyColor: '#94a3b8', callbacks: { label: ctx => `${data[ctx.dataIndex].TeamName}: avg=${ctx.parsed.x}, σ=${ctx.parsed.y}` } } },
        scales: { x: { title: { display: true, text: 'Average Points', color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8' } }, y: { title: { display: true, text: 'Std Deviation', color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8' } } }
      });

      new Chart(document.getElementById('volOffChart'), {
        type: 'scatter',
        data: { datasets: [{ data: data.map(t => ({ x: t.OffenseAvg, y: t.OffenseStd })), backgroundColor: 'rgba(232,86,26,0.7)', pointRadius: 6, pointHoverRadius: 9 }] },
        options: chartOpts('Offensive Volatility')
      });
      new Chart(document.getElementById('volDefChart'), {
        type: 'scatter',
        data: { datasets: [{ data: data.map(t => ({ x: t.DefenseAvg, y: t.DefenseStd })), backgroundColor: 'rgba(59,130,246,0.7)', pointRadius: 6, pointHoverRadius: 9 }] },
        options: chartOpts('Defensive Volatility')
      });
    }, 50);

  } catch(e) {
    content.innerHTML = '<p style="color:var(--red)">⚠️ Error loading volatility data.</p>';
  }
}

// ══════════════════════════════════════════════
//  CHAMPIONSHIP ODDS
// ══════════════════════════════════════════════
async function loadChampionship() {
  const content = document.getElementById('actuarialContent');
  content.innerHTML = '<div class="act-loading">⚙️ Computing championship probabilities…</div>';

  try {
    const season = document.getElementById('seasonFilter')?.value || 'all';
    const param  = season !== 'all' ? `?season=${season}` : '';
    const data   = await (await fetch(`${API}/actuarial/championship${param}`)).json();

    const rows = data.map((t, i) => `
      <div class="champ-row" style="animation-delay:${i*0.04}s">
        <div class="champ-rank ${i<3?'champ-rank-top':''}">#${i+1}</div>
        <div class="champ-info">
          <div class="champ-name">${t.TeamName}</div>
          <div class="champ-bar-wrap">
            <div class="champ-bar" style="width:${Math.min(t.ChampPct * 5, 100).toFixed(1)}%;opacity:${0.4 + i*0.02 < 1 ? 0.4+i*0.02 : 1}"></div>
          </div>
        </div>
        <div class="champ-pct">${t.ChampPct}%</div>
        <div class="champ-asi" style="color:var(--text-muted);font-size:12px">ASI ${t.ASI}</div>
      </div>
    `).join('');

    content.innerHTML = `
      <div class="act-description">
        <div class="act-desc-title">What is this?</div>
        <div class="act-desc-text">
          Championship probability is estimated using a <strong>Softmax function over ASI scores</strong>.
          The full 100% probability is distributed among all teams proportionally to their actuarial strength.
          This is not a bracket simulation — it is a relative probability estimate based on cumulative historical performance.
          The higher a team's ASI, the larger their share of the championship probability pool.
        </div>
      </div>
      <div class="act-section-header">
        <h3>Championship Probability</h3>
        <span class="act-formula">Softmax(ASI/τ) · τ=15 · Based on Actuarial Strength Index</span>
      </div>
      <div class="champ-list">${rows}</div>
    `;

    setTimeout(() => {
      const cd = document.createElement('div');
      cd.innerHTML = `<div class="act-chart-card" style="margin-top:16px"><div class="act-chart-title">Championship Probability — Top 10</div><div class="chart-wrap"><canvas id="champChart"></canvas></div></div>`;
      content.appendChild(cd);

      const top10 = data.slice(0, 10);
      new Chart(document.getElementById('champChart'), {
        type: 'bar',
        data: {
          labels: top10.map(d => d.TeamName),
          datasets: [{
            label: 'Championship %',
            data: top10.map(d => d.ChampPct),
            backgroundColor: top10.map((_, i) => i === 0 ? 'rgba(232,86,26,0.85)' : i < 3 ? 'rgba(232,86,26,0.5)' : 'rgba(59,130,246,0.45)'),
            borderRadius: 6, borderSkipped: false
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#161d2e', callbacks: { label: c => ` ${c.parsed.y}% championship probability` } } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { size: 11 } } }, y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', callback: v => v + '%' } } } }
      });
    }, 50);

  } catch(e) {
    content.innerHTML = '<p style="color:var(--red)">⚠️ Error loading championship data.</p>';
  }
}

// ══════════════════════════════════════════════
//  CONFIDENCE INTERVALS
// ══════════════════════════════════════════════
function loadConfidenceUI() {
  const teamOpts = ALL_NBA_TEAMS.map(t => `<option value="${t}">${t}</option>`).join('');
  const content  = document.getElementById('actuarialContent');

  content.innerHTML = `
    <div class="act-description">
      <div class="act-desc-title">What is this?</div>
      <div class="act-desc-text">
        A <strong>95% Confidence Interval</strong> defines the range in which a team's score will fall in 95% of future games,
        calculated as μ ± 1.96 × (σ/√n). A narrow interval means high predictability; a wide interval indicates scoring volatility.
        This is the standard actuarial and statistical tool for quantifying uncertainty in a prediction — used in insurance, finance, and sports analytics.
      </div>
    </div>
    <div class="act-section-header">
      <h3>Confidence Intervals for Scoring</h3>
      <span class="act-formula">IC 95% = μ ± 1.96 · (σ/√n)</span>
    </div>
    <div class="mc-form" style="grid-template-columns:1fr auto">
      <div class="prediction-form-group">
        <label>Select Team</label>
        <select class="prediction-select" id="ciTeam">
          <option value="">Select team…</option>${teamOpts}
        </select>
      </div>
      <button class="predict-btn" onclick="loadCI()">📐 Calculate</button>
    </div>
    <div id="ciResult"></div>
  `;
}

async function loadCI() {
  const team = document.getElementById('ciTeam')?.value;
  const out  = document.getElementById('ciResult');
  if (!team) { out.innerHTML = '<p style="color:var(--red);padding:12px 0">⚠️ Select a team.</p>'; return; }

  out.innerHTML = '<div class="act-loading">⚙️ Computing confidence intervals…</div>';

  try {
    const [ciRes, riskRes] = await Promise.all([
      fetch(`${API}/actuarial/confidence/${encodeURIComponent(team)}`).then(r=>r.json()),
      fetch(`${API}/actuarial/risk/${encodeURIComponent(team)}`).then(r=>r.json()),
    ]);

    if (ciRes.error) { out.innerHTML = `<p style="color:var(--red)">${ciRes.error}</p>`; return; }

    out.innerHTML = `
      <div class="ci-result">
        <div class="ci-header">${ciRes.TeamName} — Based on ${ciRes.n} games</div>

        <div class="ci-cards">
          <div class="ci-card ci-offense">
            <div class="ci-card-title">⚔️ Offense (Points Scored)</div>
            <div class="ci-expected">${ciRes.scoring.expected}</div>
            <div class="ci-label">Expected Points</div>
            <div class="ci-range">
              <span class="ci-lower">${ciRes.scoring.lower95}</span>
              <div class="ci-bar-container">
                <div class="ci-bar-fill" style="left:${((ciRes.scoring.lower95-80)/80*100).toFixed(1)}%;width:${((ciRes.scoring.upper95-ciRes.scoring.lower95)/80*100).toFixed(1)}%"></div>
              </div>
              <span class="ci-upper">${ciRes.scoring.upper95}</span>
            </div>
            <div class="ci-range-label">95% Confidence Interval</div>
            <div class="ci-stddev">Standard Deviation: <b>${ciRes.scoring.stddev}</b></div>
          </div>

          <div class="ci-card ci-defense">
            <div class="ci-card-title">🛡️ Defense (Points Conceded)</div>
            <div class="ci-expected">${ciRes.conceding.expected}</div>
            <div class="ci-label">Expected Conceded</div>
            <div class="ci-range">
              <span class="ci-lower">${ciRes.conceding.lower95}</span>
              <div class="ci-bar-container">
                <div class="ci-bar-fill ci-bar-defense" style="left:${((ciRes.conceding.lower95-80)/80*100).toFixed(1)}%;width:${((ciRes.conceding.upper95-ciRes.conceding.lower95)/80*100).toFixed(1)}%"></div>
              </div>
              <span class="ci-upper">${ciRes.conceding.upper95}</span>
            </div>
            <div class="ci-range-label">95% Confidence Interval</div>
            <div class="ci-stddev">Standard Deviation: <b>${ciRes.conceding.stddev}</b></div>
          </div>
        </div>

        <div class="ci-risk-summary">
          <div class="ci-risk-item">
            <span class="ci-risk-label">Offensive Profile</span>
            <span class="ci-risk-value" style="color:${riskRes.offense.cv<12?'#22c55e':riskRes.offense.cv<16?'#f59e0b':'#ef4444'}">${riskRes.offense.label}</span>
          </div>
          <div class="ci-risk-item">
            <span class="ci-risk-label">Defensive Profile</span>
            <span class="ci-risk-value" style="color:${riskRes.defense.cv<12?'#22c55e':riskRes.defense.cv<16?'#f59e0b':'#ef4444'}">${riskRes.defense.label}</span>
          </div>
          <div class="ci-risk-item">
            <span class="ci-risk-label">Win Rate</span>
            <span class="ci-risk-value">${riskRes.winPct}%</span>
          </div>
          <div class="ci-risk-item">
            <span class="ci-risk-label">Avg Point Diff</span>
            <span class="ci-risk-value" style="color:${riskRes.pointDiff>0?'#22c55e':'#ef4444'}">${riskRes.pointDiff>0?'+':''}${riskRes.pointDiff}</span>
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      const cd = document.createElement('div');
      cd.innerHTML = `<div class="act-chart-card" style="margin-top:14px"><div class="act-chart-title">Score Distribution — Offense vs Defense</div><div class="chart-wrap"><canvas id="ciChart"></canvas></div></div>`;
      out.appendChild(cd);

      new Chart(document.getElementById('ciChart'), {
        type: 'bar',
        data: {
          labels: ['Lower 95%', 'Expected', 'Upper 95%'],
          datasets: [
            { label: 'Offense', data: [ciRes.scoring.lower95, ciRes.scoring.expected, ciRes.scoring.upper95], backgroundColor: 'rgba(232,86,26,0.75)', borderRadius: 5 },
            { label: 'Defense (Conceded)', data: [ciRes.conceding.lower95, ciRes.conceding.expected, ciRes.conceding.upper95], backgroundColor: 'rgba(59,130,246,0.65)', borderRadius: 5 }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8' } }, tooltip: { backgroundColor: '#161d2e' } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8' } }, y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8' }, min: 80 } } }
      });
    }, 50);

  } catch(e) {
    out.innerHTML = '<p style="color:var(--red)">⚠️ Error computing intervals.</p>';
  }
}


function goHome() {
  currentTeam = null;
  setActiveNav('home');
  updatePageTitle('League Overview', 'Season Performance Analytics');
  renderDynamic('');
  document.getElementById('pageSubtitle').textContent = 'Season Performance Analytics';
  destroyChart(mainChartInstance);
  destroyChart(secondaryChartInstance);
  mainChartInstance = null;
  secondaryChartInstance = null;
  setText('mainChartTitle', 'Top Teams by Wins');
  setText('secondaryChartTitle', 'Win Rate Distribution');
  document.querySelectorAll('.chart-tab').forEach((t, i) => { t.classList.toggle('active', i === 0); });
  const season = document.getElementById('seasonFilter')?.value || 'all';
  setTimeout(() => {
    loadMainChart('wins');
    loadWinRateDonut(season);
  }, 100);
}

// ══════════════════════════════════════════════
//  SEASON FILTER
// ══════════════════════════════════════════════
function onSeasonChange(season) {
  // Si hay un equipo activo, recargarlo con la nueva temporada
  if (currentTeam) {
    loadTeamAnalytics(currentTeam);
    return;
  }

  const activeNav = document.querySelector('.nav-btn.active')?.dataset.view;
  if (activeNav === 'rankings') { showRankings(); return; }

  const currentTitle = document.getElementById('pageTitle')?.textContent || '';
  if (currentTitle.includes('Offensive')) { filterAnalytics('offense'); return; }
  if (currentTitle.includes('Defensive') || currentTitle.includes('Defense')) { filterAnalytics('defense'); return; }
  if (currentTitle.includes('Attendance')) { filterAnalytics('attendance'); return; }

  loadMainChartWithSeason(season);
  loadWinRateDonut(season);
}

async function loadMainChartWithSeason(season) {
  const param = season !== 'all' ? `?season=${season}` : '';
  try {
    const res = await fetch(`${API}/top-wins${param}`);
    const data = await res.json();
    const top = data.slice(0, 8);
    const labels = top.map(d => d.TeamName);
    const values = top.map(d => Number(d.Wins));
    const colors = values.map((_, i) => i === 0 ? 'rgba(232,86,26,0.85)' : `rgba(59,130,246,${0.7 - i * 0.06})`);
    destroyChart(mainChartInstance);
    const ctx = document.getElementById('mainChart');
    mainChartInstance = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: season !== 'all' ? `Wins ${season}` : 'All-time Wins', data: values, backgroundColor: colors, borderRadius: 6, borderSkipped: false }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8895b3' } }, y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8895b3' } } } }
    });
    setText('mainChartTitle', season !== 'all' ? `Top Teams — ${season} Season` : 'Top Teams by Wins');
  } catch (e) { console.error('Season filter failed', e); }
}

// ══════════════════════════════════════════════
//  AI CHAT
// ══════════════════════════════════════════════
async function sendQuestion() {
  const input    = document.getElementById('question');
  const question = input.value.trim();
  if (!question) return;
  appendMessage('user', question);
  input.value = '';
  hideSuggestions();
  const loadingId = appendLoadingMessage();
  try {
    const { endpoint, method } = resolveEndpoint(question);
    let res;
    if (method === 'POST') {
      res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }) });
    } else {
      res = await fetch(endpoint);
    }
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    removeMessage(loadingId);
    const html = formatResponse(question.toLowerCase(), data);
    appendMessageHTML('bot', html);
  } catch (e) {
    removeMessage(loadingId);
    appendMessage('bot', '⚠️ Could not reach the server. Make sure the backend is running on port 3000.');
  }
}

function askSuggestion(text) {
  document.getElementById('question').value = text;
  sendQuestion();
}

function resolveEndpoint(q) {
  const low = q.toLowerCase();
  const teams = extractTeams(low);
  const season = extractYear(low);
  const seasonParam = season ? `?season=${season}` : '';

  if (low.includes('compare') || low.includes('comparison') || low.includes('comparar')) {
    if (teams.length >= 2) { showTeamComparison(teams[0], teams[1]); return { endpoint: `${API}/compare/${teams[0]}/${teams[1]}`, method: 'GET' }; }
  }
  if (low.includes('head to head') || low.includes('historial') || low.includes('partidos entre')) {
    if (teams.length >= 2) { showHeadToHead(teams[0], teams[1]); return { endpoint: `${API}/head-to-head/${teams[0]}/${teams[1]}`, method: 'GET' }; }
  }
  if (/predict|who wins|quien gana|prediccion|predicción|final|ganar|favorito/.test(low)) {
    if (teams.length >= 2) {
      showPredictionResult(teams[0], teams[1]);
      const season = document.getElementById('seasonFilter')?.value || 'all';
      return { endpoint: `${API}/predict-game?teamA=${teams[0]}&teamB=${teams[1]}`, method: 'GET' };
    }
    // Single team or no teams - let AI handle
  }
  if (/offense|scoring|points per|ppg|best offense/.test(low))
    return { endpoint: `${API}/top-offense${seasonParam}`, method: 'GET' };
  if (/defense|defensive|points allowed|best defense/.test(low))
    return { endpoint: `${API}/top-defense${seasonParam}`, method: 'GET' };
  if (/win rate|win %|win percentage|home team|local/.test(low))
    return { endpoint: `${API}/home-win-rate`, method: 'GET' };
  if (/wins|victories|most wins|top teams/.test(low))
    return { endpoint: `${API}/top-wins${seasonParam}`, method: 'GET' };
  if (/ranking|overall|strongest|best team|top team/.test(low))
    return { endpoint: `${API}/overall-rankings${seasonParam}`, method: 'GET' };

  const isGameSpecificQuestion = /arena (del|de|es|sera|será)|en qué arena|en que arena|where.*play|where.*game|asistencia.*(partido|game|del|de los|tuvo|en)|partido.*asistencia|\d{1,2}.*(de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre).*asistencia|asistencia.*\d{1,2}.*(de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/.test(low);
  if (isGameSpecificQuestion)
    return { endpoint: `${API}/ai-chat`, method: 'POST' };

  const isWorstAttendance = /peor|menor|worst|lowest|less/.test(low);
  const isAttendanceRanking = /mejor asistencia|best attendance|top arena|mayor asistencia|menor asistencia|peor asistencia|worst attendance|asistencia promedio|asistencia/.test(low);
  if (isAttendanceRanking) {
    const orderParam = isWorstAttendance ? 'asc' : 'desc';
    const attendanceUrl = season ? `${API}/best-attendance?season=${season}&order=${orderParam}` : `${API}/best-attendance?order=${orderParam}`;
    return { endpoint: attendanceUrl, method: 'GET' };
  }

  const dateMatch = low.match(/(\d{1,2})\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december)/i);
  if (dateMatch && season && teams.length > 0) {
    const monthMap = { enero:1,january:1,february:2,febrero:2,marzo:3,march:3,abril:4,april:4,mayo:5,may:5,junio:6,june:6,julio:7,july:7,agosto:8,august:8,septiembre:9,september:9,octubre:10,october:10,noviembre:11,november:11,diciembre:12,december:12 };
    const day   = dateMatch[1].padStart(2, '0');
    const month = String(monthMap[dateMatch[2].toLowerCase()]).padStart(2, '0');
    const dateStr = `${season}-${month}-${day}`;
    return { endpoint: `${API}/game-search?team=${teams[0]}&date=${dateStr}`, method: 'GET' };
  }

  return { endpoint: `${API}/ai-chat`, method: 'POST' };
}

function extractYear(text) {
  const match = text.match(/\b(2022|2023|2024|2025|2026)\b/);
  return match ? match[1] : null;
}

const TEAM_KEYWORDS = [
  'lakers','celtics','warriors','nuggets','heat','bulls',
  'knicks','nets','suns','clippers','bucks','76ers',
  'raptors','mavericks','spurs','rockets','thunder',
  'jazz','grizzlies','pelicans','kings','blazers',
  'hawks','hornets','wizards','cavaliers','pistons',
  'pacers','magic','timberwolves'
];

function extractTeams(text) {
  return TEAM_KEYWORDS.filter(t => text.includes(t));
}

// ══════════════════════════════════════════════
//  RESPONSE FORMATTER
// ══════════════════════════════════════════════
function formatResponse(low, data) {
  if (data.reply) return `<p>${data.reply.replace(/\n/g, '<br>')}</p>`;
  if (data.teams && data.winner) {
    const cards = data.teams.map((t, i) => `
      <div class="inline-card">
        <span class="inline-card-rank">#${i + 1}</span>
        <div><div class="inline-card-name">${t.TeamName}</div><div class="inline-card-sub">Off: ${t.OffensiveRating} · Def: ${t.DefensiveRating} · Win%: ${t.WinRate}%</div></div>
        <span class="inline-card-stat">${t.OverallScore}</span>
      </div>
    `).join('');
    return `<p><strong>${data.winner.TeamName}</strong> has the stronger overall profile.</p><div class="inline-cards">${cards}</div>`;
  }
  // New predict-game response
  if (data.teamA && data.teamB && data.favorite && data.confidence) {
    const prob = data.teamA.probability >= data.teamB.probability ? data.teamA.probability : data.teamB.probability;
    return `<p>🔮 <strong style="color:var(--accent)">${data.favorite}</strong> es el favorito (${prob}% — confianza ${data.confidence}). ${data.explanation} <em>Predicción completa cargada arriba ↑</em></p>`;
  }
  // Legacy
  if (data.favorite) {
    return `<div class="inline-cards">
      <div class="inline-card"><span class="inline-card-rank">🏆</span><div><div class="inline-card-name">${data.favorite} proyectado a ganar</div></div><span class="inline-card-stat">${data.score}</span></div>
    </div>`;
  }
  if (Array.isArray(data) && data.length) {
    const key    = data[0].TeamName ? 'TeamName' : data[0].Arena ? 'Arena' : Object.keys(data[0])[0];
    const valKey = Object.keys(data[0]).find(k => k !== key && k !== 'TeamID') ?? '';
    const cards  = data.slice(0, 8).map((item, i) => `
      <div class="inline-card">
        <span class="inline-card-rank">#${i + 1}</span>
        <div><div class="inline-card-name">${item[key]}</div></div>
        <span class="inline-card-stat">${valKey ? Number(item[valKey]).toLocaleString() : ''}</span>
      </div>
    `).join('');
    return `<div class="inline-cards">${cards}</div>`;
  }
  return '<p>I found data but could not format it. Check the browser console.</p>';
}

// ══════════════════════════════════════════════
//  CHAT HELPERS
// ══════════════════════════════════════════════
let msgIdCounter = 0;

function appendMessage(role, text) {
  const id = `msg-${++msgIdCounter}`;
  const avatar = role === 'user' ? '👤' : '🤖';
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.id = id;
  div.innerHTML = `<div class="message-avatar">${avatar}</div><div class="message-bubble"><p>${text}</p></div>`;
  document.getElementById('chatMessages').appendChild(div);
  scrollChat();
  return id;
}

function appendMessageHTML(role, html) {
  const avatar = role === 'user' ? '👤' : '🤖';
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.innerHTML = `<div class="message-avatar">${avatar}</div><div class="message-bubble">${html}</div>`;
  document.getElementById('chatMessages').appendChild(div);
  scrollChat();
}

function appendLoadingMessage() {
  const id = `msg-${++msgIdCounter}`;
  const div = document.createElement('div');
  div.className = 'message bot';
  div.id = id;
  div.innerHTML = `<div class="message-avatar">🤖</div><div class="message-bubble loading">Analyzing data<div class="loading-dots"><span></span><span></span><span></span></div></div>`;
  document.getElementById('chatMessages').appendChild(div);
  scrollChat();
  return id;
}

function removeMessage(id) { const el = document.getElementById(id); if (el) el.remove(); }
function scrollChat() { const c = document.getElementById('chatMessages'); c.scrollTop = c.scrollHeight; }
function hideSuggestions() { const s = document.getElementById('chatSuggestions'); if (s) s.style.display = 'none'; }

// ══════════════════════════════════════════════
//  LAYOUT HELPERS
// ══════════════════════════════════════════════
function renderDynamic(html) { document.getElementById('dynamicSection').innerHTML = html; }
function showEmpty(msg) { renderDynamic(`<p style="color:var(--text-muted);padding:8px 0">${msg}</p>`); }
function updatePageTitle(title, subtitle = '') { setText('pageTitle', title); setText('pageSubtitle', subtitle); }
function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }
function setActiveNav(view) { document.querySelectorAll('.nav-btn').forEach(btn => { btn.classList.toggle('active', btn.dataset.view === view); }); }
function destroyChart(instance) { if (instance) { try { instance.destroy(); } catch (_) {} } }
function formatDate(dateStr) {
  if (!dateStr) return '—';
  // Add T00:00:00 to force local time parsing instead of UTC
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// ══════════════════════════════════════════════
//  ALL TEAMS LOADER
// ══════════════════════════════════════════════
async function toggleAllTeams() {
  const list = document.getElementById('allTeamsList');
  const btn  = document.getElementById('allTeamsBtn');
  if (list.style.display === 'flex') {
    list.style.display = 'none';
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> All Teams`;
    return;
  }
  if (!list.innerHTML.trim()) {
    try {
      const res  = await fetch(`${API}/teams`);
      const data = await res.json();
      list.innerHTML = data.map(t => `
        <button class="nav-btn" data-view="team-${t.TeamName.toLowerCase().replace(/\s+/g,'-')}"
          onclick="loadTeamAnalytics('${t.TeamName}')" style="padding-left:20px;font-size:13px">
          <span class="team-dot" style="background:${teamColor(t.TeamName)}"></span>
          ${t.TeamName}
        </button>
      `).join('');
    } catch (e) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:12px;padding:8px 12px">Could not load teams</p>';
    }
  }
  list.style.display = 'flex';
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg> Hide Teams`;
}

function teamColor(name) {
  const colors = {
    'Los Angeles Lakers':'#552583','Boston Celtics':'#007A33','Golden State Warriors':'#1D428A',
    'Denver Nuggets':'#0E2240','Miami Heat':'#98002E','Chicago Bulls':'#CE1141',
    'New York Knicks':'#F58426','Brooklyn Nets':'#000000','Phoenix Suns':'#1D1160',
    'Los Angeles Clippers':'#C8102E','Milwaukee Bucks':'#00471B','Philadelphia 76ers':'#006BB6',
    'Toronto Raptors':'#CE1141','Dallas Mavericks':'#00538C','San Antonio Spurs':'#C4CED4',
    'Houston Rockets':'#CE1141','Oklahoma City Thunder':'#007AC1','Utah Jazz':'#002B5C',
    'Memphis Grizzlies':'#5D76A9','New Orleans Pelicans':'#0C2340','Sacramento Kings':'#5A2D81',
    'Portland Trail Blazers':'#E03A3E','Atlanta Hawks':'#E03A3E','Charlotte Hornets':'#1D1160',
    'Washington Wizards':'#002B5C','Cleveland Cavaliers':'#860038','Detroit Pistons':'#C8102E',
    'Indiana Pacers':'#002D62','Orlando Magic':'#0077C0','Minnesota Timberwolves':'#236192',
  };
  return colors[name] || '#4a5568';
}

function getNBATeamId(teamName) {
  const ids = {
    'Lakers':1610612747,'Los Angeles Lakers':1610612747,'Celtics':1610612738,'Boston Celtics':1610612738,
    'Warriors':1610612744,'Golden State Warriors':1610612744,'Nuggets':1610612743,'Denver Nuggets':1610612743,
    'Heat':1610612748,'Miami Heat':1610612748,'Bulls':1610612741,'Chicago Bulls':1610612741,
    'Knicks':1610612752,'New York Knicks':1610612752,'Nets':1610612751,'Brooklyn Nets':1610612751,
    'Suns':1610612756,'Phoenix Suns':1610612756,'Clippers':1610612746,'Los Angeles Clippers':1610612746,
    'Bucks':1610612749,'Milwaukee Bucks':1610612749,'76ers':1610612755,'Philadelphia 76ers':1610612755,
    'Raptors':1610612761,'Toronto Raptors':1610612761,'Mavericks':1610612742,'Dallas Mavericks':1610612742,
    'Spurs':1610612759,'San Antonio Spurs':1610612759,'Rockets':1610612745,'Houston Rockets':1610612745,
    'Thunder':1610612760,'Oklahoma City Thunder':1610612760,'Jazz':1610612762,'Utah Jazz':1610612762,
    'Grizzlies':1610612763,'Memphis Grizzlies':1610612763,'Pelicans':1610612740,'New Orleans Pelicans':1610612740,
    'Kings':1610612758,'Sacramento Kings':1610612758,'Blazers':1610612757,'Portland Trail Blazers':1610612757,
    'Hawks':1610612737,'Atlanta Hawks':1610612737,'Hornets':1610612766,'Charlotte Hornets':1610612766,
    'Wizards':1610612764,'Washington Wizards':1610612764,'Cavaliers':1610612739,'Cleveland Cavaliers':1610612739,
    'Pistons':1610612765,'Detroit Pistons':1610612765,'Pacers':1610612754,'Indiana Pacers':1610612754,
    'Magic':1610612753,'Orlando Magic':1610612753,'Timberwolves':1610612750,'Minnesota Timberwolves':1610612750,
  };
  return ids[teamName] || 1610612747;
}