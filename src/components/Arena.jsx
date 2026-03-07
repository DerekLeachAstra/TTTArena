import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getRankBadge, score as calcScore } from '../lib/gameLogic';

const MODES = [
  {
    id: 'classic',
    name: 'Classic',
    desc: 'The original 3x3. First to three in a row wins.',
    color: 'var(--X)',
    bg: 'rgba(232,255,71,0.06)',
    border: 'rgba(232,255,71,0.18)',
    icon: '3x3',
  },
  {
    id: 'ultimate',
    name: 'Ultimate',
    desc: 'Nine boards in a grid. Win three boards in a row to claim victory.',
    color: 'var(--O)',
    bg: 'rgba(71,200,255,0.06)',
    border: 'rgba(71,200,255,0.18)',
    icon: '9x9',
  },
  {
    id: 'mega',
    name: 'MEGA',
    desc: 'Three layers deep. Win small boards, claim mid-boards, conquer the meta.',
    color: 'var(--mega)',
    bg: 'rgba(255,71,200,0.06)',
    border: 'rgba(255,71,200,0.18)',
    icon: '81',
  },
];

const MIN_GLOBAL_GAMES = 5;

function GameModeCard({ mode, counts, onPlayAI, onFindOpponent, isAuthenticated }) {
  const [hovered, setHovered] = useState(false);
  const playing = counts?.playing || 0;
  const waiting = counts?.waiting || 0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? mode.bg : 'var(--sf)',
        borderTop: '3px solid ' + mode.color,
        borderLeft: '1px solid ' + (hovered ? mode.color : 'var(--bd)'),
        borderRight: '1px solid ' + (hovered ? mode.color : 'var(--bd)'),
        borderBottom: '1px solid ' + (hovered ? mode.color : 'var(--bd)'),
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        transition: 'all 0.2s',
        cursor: 'default',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 2, color: mode.color, lineHeight: 1 }}>
            {mode.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--mu)', letterSpacing: 1, marginTop: 4, lineHeight: 1.6 }}>
            {mode.desc}
          </div>
        </div>
        <div style={{
          fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: mode.color, opacity: 0.3,
          background: mode.bg, padding: '4px 10px', letterSpacing: 2, whiteSpace: 'nowrap'
        }}>
          {mode.icon}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 10, letterSpacing: 1.5, color: 'var(--mu)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span className="live-dot" style={{
            width: 6, height: 6, borderRadius: '50%',
            background: playing > 0 ? 'var(--gn)' : 'var(--bd)',
            display: 'inline-block',
            animation: playing > 0 ? 'pulse 2s ease-in-out infinite' : 'none',
          }} />
          <span>{playing * 2} playing</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: waiting > 0 ? 'var(--go)' : 'var(--bd)',
            display: 'inline-block',
            animation: waiting > 0 ? 'pulse 2s ease-in-out infinite' : 'none',
          }} />
          <span>{waiting} waiting</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <button
          onClick={() => onPlayAI(mode.id)}
          style={{
            flex: 1, padding: '11px 10px', background: 'var(--s2)', border: '1px solid ' + mode.color,
            color: mode.color, fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 2,
            textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseOver={e => { e.target.style.background = mode.bg; }}
          onMouseOut={e => { e.target.style.background = 'var(--s2)'; }}
        >
          Play vs AI
        </button>
        <button
          onClick={() => onFindOpponent(mode.id)}
          style={{
            flex: 1, padding: '11px 10px',
            background: isAuthenticated ? mode.color : 'var(--s2)',
            border: '1px solid ' + mode.color,
            color: isAuthenticated ? 'var(--bg)' : 'var(--mu)',
            fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 2,
            textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.15s',
            opacity: isAuthenticated ? 1 : 0.5,
          }}
          title={isAuthenticated ? '' : 'Sign in to play online'}
        >
          {mode.id === 'mega' ? 'Coming Soon' : 'Find Match'}
        </button>
      </div>
    </div>
  );
}

const MODE_COLORS = { classic: 'var(--X)', ultimate: 'var(--O)', mega: 'var(--mega)' };
const MODE_BGS = { classic: 'rgba(232,255,71,0.06)', ultimate: 'rgba(71,200,255,0.06)', mega: 'rgba(255,71,200,0.06)' };

function LeagueCard({ league, isAuthenticated, onView, onSignUp }) {
  const [hovered, setHovered] = useState(false);
  const primaryMode = league.game_modes?.[0] || 'classic';
  const color = MODE_COLORS[primaryMode] || 'var(--ac)';
  const bg = MODE_BGS[primaryMode] || 'rgba(232,255,71,0.06)';
  const members = league.ttt_league_members?.[0]?.count || 0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? bg : 'var(--sf)',
        borderTop: '3px solid ' + color,
        borderLeft: '1px solid ' + (hovered ? color : 'var(--bd)'),
        borderRight: '1px solid ' + (hovered ? color : 'var(--bd)'),
        borderBottom: '1px solid ' + (hovered ? color : 'var(--bd)'),
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'all 0.2s',
        cursor: 'default',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: 2, color, lineHeight: 1 }}>
          {league.name}
        </div>
        {league.seasons_enabled && (
          <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--mu)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            Season {league.season}
          </div>
        )}
      </div>
      {league.description && (
        <div style={{ fontSize: 11, color: 'var(--mu)', letterSpacing: 0.5, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {league.description}
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, fontSize: 10, letterSpacing: 1.5, color: 'var(--mu)' }}>
        <span>{league.game_modes?.join(', ')}</span>
        <span style={{ color: 'var(--bd)' }}>·</span>
        <span>{members} member{members !== 1 ? 's' : ''}</span>
      </div>
      <div style={{ marginTop: 'auto' }}>
        <button
          onClick={isAuthenticated ? () => onView(league) : onSignUp}
          style={{
            width: '100%', padding: '10px 10px',
            background: isAuthenticated ? color : 'var(--s2)',
            border: '1px solid ' + color,
            color: isAuthenticated ? 'var(--bg)' : 'var(--mu)',
            fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 2,
            textTransform: 'uppercase', cursor: 'pointer',
            transition: 'all 0.15s', fontWeight: 500,
            opacity: isAuthenticated ? 1 : 0.5,
          }}
          title={isAuthenticated ? '' : 'Sign in to view leagues'}
        >
          View League
        </button>
      </div>
    </div>
  );
}

function PublicLeagues({ leagues, isAuthenticated, onView, onBrowse, onSignUp }) {
  return (
    <div style={{ marginTop: 36 }}>
      <div style={{ fontSize: 10, letterSpacing: 3, color: 'var(--ac)', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        Public Leagues
        <span style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
        {leagues.length > 0 && (
          <button
            onClick={onBrowse}
            style={{
              background: 'none', border: 'none', color: 'var(--mu)',
              fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 2,
              textTransform: 'uppercase', cursor: 'pointer', padding: 0,
              transition: 'color 0.15s',
            }}
            onMouseOver={e => e.target.style.color = 'var(--ac)'}
            onMouseOut={e => e.target.style.color = 'var(--mu)'}
          >
            Browse All →
          </button>
        )}
      </div>

      {leagues.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 11, letterSpacing: 2, padding: 30, border: '1px dashed var(--bd)' }}>
          No public leagues yet. Create one from the Leagues tab!
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 14,
        }}>
          {leagues.map(l => (
            <LeagueCard
              key={l.id}
              league={l}
              isAuthenticated={isAuthenticated}
              onView={onView}
              onSignUp={onSignUp}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Season Helpers ──────────────────────────────────────
function getQuarterBounds(year, quarter) {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
  return { start, end };
}

function getCurrentQuarter() {
  const now = new Date();
  return { year: now.getFullYear(), quarter: Math.floor(now.getMonth() / 3) + 1 };
}

const QUARTER_LABELS = ['', 'Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)'];

function GlobalRankings({ globalStats }) {
  const [mode, setMode] = useState('classic');
  const [seasonView, setSeasonView] = useState('alltime'); // 'alltime' or 'season'
  const [selectedYear, setSelectedYear] = useState(() => getCurrentQuarter().year);
  const [selectedQuarter, setSelectedQuarter] = useState(() => getCurrentQuarter().quarter);
  const [seasonalData, setSeasonalData] = useState([]);
  const [loadingSeason, setLoadingSeason] = useState(false);

  const modeColors = { classic: 'var(--X)', ultimate: 'var(--O)', mega: 'var(--mega)' };
  const ac = modeColors[mode];

  // Fetch seasonal data when season view is active
  useEffect(() => {
    if (seasonView !== 'season') return;
    fetchSeasonalRankings();
  }, [seasonView, selectedYear, selectedQuarter, mode]);

  async function fetchSeasonalRankings() {
    setLoadingSeason(true);
    const { start, end } = getQuarterBounds(selectedYear, selectedQuarter);

    const { data } = await supabase
      .from('ttt_matches')
      .select('player_x_id, player_o_id, winner_id, is_draw, game_mode')
      .eq('game_mode', mode)
      .gte('completed_at', start.toISOString())
      .lte('completed_at', end.toISOString());

    if (data) {
      // Aggregate W/L/D per player
      const playerMap = {};
      data.forEach(m => {
        [m.player_x_id, m.player_o_id].forEach(pid => {
          if (!pid) return;
          if (!playerMap[pid]) playerMap[pid] = { wins: 0, losses: 0, draws: 0 };
          if (m.is_draw) {
            playerMap[pid].draws++;
          } else if (m.winner_id === pid) {
            playerMap[pid].wins++;
          } else {
            playerMap[pid].losses++;
          }
        });
      });

      // Convert to array with scores
      const entries = Object.entries(playerMap).map(([uid, s]) => ({
        user_id: uid,
        wins: s.wins,
        losses: s.losses,
        draws: s.draws,
        gp: s.wins + s.losses + s.draws,
        score: calcScore(s.wins, s.losses, s.draws),
      })).filter(e => e.gp >= MIN_GLOBAL_GAMES).sort((a, b) => b.score - a.score);

      // Fetch display names for top 20
      const top = entries.slice(0, 20);
      if (top.length > 0) {
        const { data: profiles } = await supabase
          .from('ttt_profiles')
          .select('id, display_name, username')
          .in('id', top.map(e => e.user_id));
        if (profiles) {
          const nameMap = {};
          profiles.forEach(p => { nameMap[p.id] = p; });
          top.forEach(e => {
            e.display_name = nameMap[e.user_id]?.display_name || 'Unknown';
            e.username = nameMap[e.user_id]?.username;
          });
        }
      }
      setSeasonalData(top);
    }
    setLoadingSeason(false);
  }

  const tabs = [
    { id: 'classic', label: 'Classic' },
    { id: 'ultimate', label: 'Ultimate' },
    { id: 'mega', label: 'MEGA' },
  ];

  // Generate year options
  const { year: currentYear, quarter: currentQuarter } = getCurrentQuarter();
  const years = [];
  for (let y = currentYear; y >= currentYear - 2; y--) years.push(y);

  // All-time data
  const allTimeFiltered = (globalStats || []).filter(gs => gs.game_mode === mode && (gs.wins + gs.losses + gs.draws) >= MIN_GLOBAL_GAMES);
  const allTimeUnranked = (globalStats || []).filter(gs => gs.game_mode === mode && (gs.wins + gs.losses + gs.draws) > 0 && (gs.wins + gs.losses + gs.draws) < MIN_GLOBAL_GAMES);

  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: 3, color: 'var(--ac)', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        Global Rankings
        <span style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
      </div>

      {/* View toggle + season selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--bd)' }}>
          {[{ id: 'alltime', label: 'All-Time' }, { id: 'season', label: 'Season' }].map(v => (
            <button key={v.id} onClick={() => setSeasonView(v.id)} style={{
              background: 'none', border: 'none', borderBottom: '2px solid ' + (seasonView === v.id ? 'var(--ac)' : 'transparent'),
              color: seasonView === v.id ? 'var(--ac)' : 'var(--mu)', fontFamily: "'DM Mono',monospace", fontSize: 10,
              letterSpacing: 2, textTransform: 'uppercase', padding: '6px 12px', cursor: 'pointer', marginBottom: -1
            }}>{v.label}</button>
          ))}
        </div>
        {seasonView === 'season' && (
          <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
            <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}
              style={{ background: 'var(--s2)', border: '1px solid var(--bd)', color: 'var(--tx)', fontFamily: "'DM Mono',monospace", fontSize: 11, padding: '4px 8px', outline: 'none' }}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={selectedQuarter} onChange={e => setSelectedQuarter(parseInt(e.target.value))}
              style={{ background: 'var(--s2)', border: '1px solid var(--bd)', color: 'var(--tx)', fontFamily: "'DM Mono',monospace", fontSize: 11, padding: '4px 8px', outline: 'none' }}>
              {[1, 2, 3, 4].map(q => <option key={q} value={q}>{QUARTER_LABELS[q]}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 18, borderBottom: '1px solid var(--bd)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setMode(t.id)} style={{
            background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: '2px solid ' + (mode === t.id ? ac : 'transparent'),
            color: mode === t.id ? ac : 'var(--mu)', fontFamily: "'DM Mono',monospace", fontSize: 10,
            letterSpacing: 2, textTransform: 'uppercase', padding: '9px 16px', cursor: 'pointer', marginBottom: -1
          }}>{t.label}</button>
        ))}
      </div>

      {/* Seasonal Rankings */}
      {seasonView === 'season' ? (
        loadingSeason ? (
          <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 11, letterSpacing: 2, padding: 30 }}>Loading season data...</div>
        ) : seasonalData.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 11, letterSpacing: 2, padding: 30, border: '1px dashed var(--bd)' }}>
            No ranked players this season (need {MIN_GLOBAL_GAMES}+ games).
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid ' + ac }}>
                  <th style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', padding: '10px 12px', textAlign: 'left', width: 40 }}>#</th>
                  <th style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', padding: '10px 12px', textAlign: 'left' }}>Player</th>
                  <th style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', padding: '10px 12px', textAlign: 'right' }}>Score</th>
                  <th style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', padding: '10px 12px', textAlign: 'right' }}>W</th>
                  <th style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', padding: '10px 12px', textAlign: 'right' }}>L</th>
                  <th style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', padding: '10px 12px', textAlign: 'right' }}>D</th>
                </tr>
              </thead>
              <tbody>
                {seasonalData.map((gs, i) => {
                  const rc = i === 0 ? 'var(--go)' : i === 1 ? 'var(--si)' : i === 2 ? 'var(--br)' : ac;
                  return (
                    <tr key={gs.user_id} style={{ borderBottom: '1px solid var(--bd)' }}>
                      <td><div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: i < 3 ? rc : 'var(--mu)', textAlign: 'center' }}>{i + 1}</div></td>
                      <td style={{ padding: '12px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {gs.username ? (
                            <Link to={`/player/${encodeURIComponent(gs.username)}`} style={{ fontWeight: 500, color: 'inherit', textDecoration: 'none', transition: 'color 0.15s' }}
                              onMouseOver={e => e.target.style.color = ac}
                              onMouseOut={e => e.target.style.color = 'inherit'}>
                              {gs.display_name || 'Unknown'}
                            </Link>
                          ) : (
                            <span style={{ fontWeight: 500 }}>{gs.display_name || 'Unknown'}</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 12px', textAlign: 'right', fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, color: rc }}>{gs.score.toFixed(1)}</td>
                      <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: 12, color: 'var(--mu)' }}>{gs.wins}</td>
                      <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: 12, color: 'var(--mu)' }}>{gs.losses}</td>
                      <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: 12, color: 'var(--mu)' }}>{gs.draws}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* All-Time Rankings */
        <>
          {allTimeFiltered.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 11, letterSpacing: 2, padding: 30, border: '1px dashed var(--bd)' }}>
              No ranked players yet for {mode} (need {MIN_GLOBAL_GAMES}+ games). Be the first!
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid ' + ac }}>
                    <th style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', padding: '10px 12px', textAlign: 'left', width: 40 }}>#</th>
                    <th style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', padding: '10px 12px', textAlign: 'left' }}>Player</th>
                    <th style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', padding: '10px 12px', textAlign: 'right' }}>Rating</th>
                    <th style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', padding: '10px 12px', textAlign: 'right' }}>W</th>
                    <th style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', padding: '10px 12px', textAlign: 'right' }}>L</th>
                    <th style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', padding: '10px 12px', textAlign: 'right' }}>D</th>
                  </tr>
                </thead>
                <tbody>
                  {allTimeFiltered.slice(0, 20).map((gs, i) => {
                    const rc = i === 0 ? 'var(--go)' : i === 1 ? 'var(--si)' : i === 2 ? 'var(--br)' : ac;
                    const badge = getRankBadge(gs.elo_rating);
                    return (
                      <tr key={gs.user_id + gs.game_mode} style={{ borderBottom: '1px solid var(--bd)' }}>
                        <td>
                          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: i < 3 ? rc : 'var(--mu)', textAlign: 'center' }}>{i + 1}</div>
                        </td>
                        <td style={{ padding: '12px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {gs.username ? (
                              <Link to={`/player/${encodeURIComponent(gs.username)}`} style={{ fontWeight: 500, color: 'inherit', textDecoration: 'none', transition: 'color 0.15s' }}
                                onMouseOver={e => e.target.style.color = ac}
                                onMouseOut={e => e.target.style.color = 'inherit'}>
                                {gs.display_name || 'Unknown'}
                              </Link>
                            ) : (
                              <span style={{ fontWeight: 500 }}>{gs.display_name || 'Unknown'}</span>
                            )}
                            <span style={{ fontSize: 12, color: badge.color }} title={badge.name}>{badge.icon}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 12px', textAlign: 'right', fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, color: rc }}>{gs.elo_rating}</td>
                        <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: 12, color: 'var(--mu)' }}>{gs.wins}</td>
                        <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: 12, color: 'var(--mu)' }}>{gs.losses}</td>
                        <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: 12, color: 'var(--mu)' }}>{gs.draws}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Unranked section */}
          {allTimeUnranked.length > 0 && (
            <div>
              <div style={{ fontSize: 10, letterSpacing: 3, color: 'var(--mu)', textTransform: 'uppercase', margin: '24px 0 10px', display: 'flex', alignItems: 'center', gap: 12 }}>
                Unranked ({MIN_GLOBAL_GAMES}+ games needed)
                <span style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {allTimeUnranked.slice(0, 20).map(gs => (
                  <div key={gs.user_id + gs.game_mode} style={{ background: 'var(--sf)', border: '1px solid var(--bd)', padding: '6px 12px', fontSize: 11, color: 'var(--mu)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--tx)', fontWeight: 500 }}>{gs.display_name || 'Unknown'}</span>
                    <span>{gs.wins}W-{gs.losses}L-{gs.draws}D</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Arena({ globalStats, onSelectDifficulty, onFindOpponent, isAuthenticated, onSignUp, onViewLeague, onBrowseLeagues }) {
  const [liveCounts, setLiveCounts] = useState({
    classic: { playing: 0, waiting: 0 },
    ultimate: { playing: 0, waiting: 0 },
    mega: { playing: 0, waiting: 0 },
  });
  const [publicLeagues, setPublicLeagues] = useState([]);
  const debounceRef = useRef(null);

  const fetchLiveCounts = useCallback(async () => {
    const modes = ['classic', 'ultimate', 'mega'];
    const results = await Promise.all(
      modes.flatMap(m => [
        supabase.from('ttt_live_games').select('*', { count: 'exact', head: true }).eq('game_mode', m).eq('status', 'active'),
        supabase.from('ttt_live_games').select('*', { count: 'exact', head: true }).eq('game_mode', m).eq('status', 'waiting'),
      ])
    );
    const counts = {};
    modes.forEach((m, i) => {
      counts[m] = {
        playing: results[i * 2].count || 0,
        waiting: results[i * 2 + 1].count || 0,
      };
    });
    setLiveCounts(counts);
  }, []);

  const fetchPublicLeagues = useCallback(async () => {
    const { data } = await supabase
      .from('ttt_leagues')
      .select('*, ttt_league_members(count)')
      .eq('is_public', true)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(6);
    if (data) setPublicLeagues(data);
  }, []);

  useEffect(() => {
    fetchLiveCounts();
    fetchPublicLeagues();
    const channel = supabase.channel('arena-live-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttt_live_games' }, () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(fetchLiveCounts, 2000);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchLiveCounts, fetchPublicLeagues]);

  return (
    <div>
      {/* Game Mode Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 14,
        marginBottom: 36,
      }}>
        {MODES.map(mode => (
          <GameModeCard
            key={mode.id}
            mode={mode}
            counts={liveCounts[mode.id]}
            onPlayAI={onSelectDifficulty}
            onFindOpponent={isAuthenticated ? onFindOpponent : onSignUp}
            isAuthenticated={isAuthenticated}
          />
        ))}
      </div>

      {/* Global Rankings */}
      <GlobalRankings globalStats={globalStats} />

      {/* Public Leagues */}
      <PublicLeagues
        leagues={publicLeagues}
        isAuthenticated={isAuthenticated}
        onView={onViewLeague}
        onBrowse={onBrowseLeagues}
        onSignUp={onSignUp}
      />

      {/* Join CTA */}
      {!isAuthenticated && (
        <div style={{ textAlign: 'center', marginTop: 36, padding: '30px 20px', background: 'var(--sf)', border: '1px solid var(--bd)' }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 2, color: 'var(--ac)', marginBottom: 8 }}>Join the Arena</div>
          <div style={{ fontSize: 11, color: 'var(--mu)', letterSpacing: 1.5, marginBottom: 18, lineHeight: 1.8 }}>Sign up to track your stats, compete in ranked games, and join leagues.</div>
          <button className="savebtn" onClick={onSignUp}>Create Account</button>
        </div>
      )}
    </div>
  );
}
