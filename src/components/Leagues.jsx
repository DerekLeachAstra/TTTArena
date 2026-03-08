import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { getRankBadge, score as calcScore } from '../lib/gameLogic';

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join('');
}

function hasQualifiers(league) {
  return league.req_min_games != null || league.req_min_wins != null ||
    league.req_min_win_pct != null || league.req_min_elo != null;
}

function checkQualifiers(league, playerStats) {
  let totalWins = 0, totalLosses = 0, totalDraws = 0, maxElo = 0;
  (playerStats || []).forEach(s => {
    totalWins += s.wins || 0;
    totalLosses += s.losses || 0;
    totalDraws += s.draws || 0;
    if ((s.elo || 0) > maxElo) maxElo = s.elo;
  });
  const totalGames = totalWins + totalLosses + totalDraws;
  const winPct = totalGames > 0 ? ((totalWins + 0.5 * totalDraws) / totalGames) * 100 : 0;
  if (maxElo === 0) maxElo = 1200;

  const results = [];
  if (league.req_min_games != null) {
    results.push({ label: 'Games Played', required: league.req_min_games, actual: totalGames, met: totalGames >= league.req_min_games });
  }
  if (league.req_min_wins != null) {
    results.push({ label: 'Wins', required: league.req_min_wins, actual: totalWins, met: totalWins >= league.req_min_wins });
  }
  if (league.req_min_win_pct != null) {
    results.push({ label: 'Win %', required: league.req_min_win_pct, actual: Math.round(winPct * 10) / 10, met: winPct >= league.req_min_win_pct });
  }
  if (league.req_min_elo != null) {
    results.push({ label: 'ELO', required: league.req_min_elo, actual: maxElo, met: maxElo >= league.req_min_elo });
  }
  return { qualified: results.every(r => r.met), results };
}

function qualifierBadges(league) {
  const badges = [];
  if (league.req_min_games != null) badges.push(`${league.req_min_games}+ GP`);
  if (league.req_min_wins != null) badges.push(`${league.req_min_wins}+ W`);
  if (league.req_min_win_pct != null) badges.push(`${league.req_min_win_pct}%+ Win`);
  if (league.req_min_elo != null) badges.push(`${league.req_min_elo}+ ELO`);
  return badges;
}

const labelSt = { fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', marginBottom: 10 };
const descSt = { fontSize: 11, color: 'var(--mu)', marginBottom: 12 };
const cardSt = { background: 'var(--sf)', border: '1px solid var(--bd)', padding: 20 };
const inp = { width: '100%', background: 'var(--s2)', border: '1px solid var(--bd)', color: 'var(--tx)', fontFamily: "'DM Mono',monospace", fontSize: 13, padding: '10px 12px', outline: 'none' };

// ── League List ──────────────────────────────────────────
function LeagueList({ leagues, myLeagues, onSelect, onCreate, onJoinCode }) {
  const [code, setCode] = useState('');
  const [tab, setTab] = useState('my');
  const publicLeagues = leagues.filter(l => l.is_public);
  const shown = tab === 'my' ? myLeagues : publicLeagues;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 30, letterSpacing: 2, color: 'var(--ac)' }}>Leagues</div>
        <button className="savebtn" onClick={onCreate}>+ Create League</button>
      </div>

      {/* Join by code */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="INVITE CODE"
          style={{ flex: 1, maxWidth: 260, background: 'var(--s2)', border: '1px solid var(--bd)', color: 'var(--tx)', fontFamily: "'DM Mono',monospace", fontSize: 12, padding: '8px 12px', outline: 'none', letterSpacing: 2 }}
          onKeyDown={e => e.key === 'Enter' && code.trim() && onJoinCode(code.trim())} />
        <button className="smbtn" onClick={() => code.trim() && onJoinCode(code.trim())} disabled={!code.trim()}>Join</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 18, borderBottom: '1px solid var(--bd)' }}>
        {[{ id: 'my', label: 'My Leagues' }, { id: 'browse', label: 'Browse Public' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: 'none', border: 'none', borderBottom: '2px solid ' + (tab === t.id ? 'var(--ac)' : 'transparent'),
            color: tab === t.id ? 'var(--ac)' : 'var(--mu)', fontFamily: "'DM Mono',monospace", fontSize: 10,
            letterSpacing: 2, textTransform: 'uppercase', padding: '8px 14px', cursor: 'pointer', marginBottom: -1
          }}>{t.label} ({t.id === 'my' ? myLeagues.length : publicLeagues.length})</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 11, letterSpacing: 2, padding: 40, border: '1px dashed var(--bd)' }}>
          {tab === 'my' ? 'You haven\'t joined any leagues yet.' : 'No public leagues available.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shown.map(l => (
            <div key={l.id} onClick={() => onSelect(l)} style={{
              background: 'var(--sf)', border: '1px solid var(--bd)', padding: '16px 20px', cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, transition: 'border-color 0.15s'
            }}
              onMouseOver={e => e.currentTarget.style.borderColor = 'var(--ac)'}
              onMouseOut={e => e.currentTarget.style.borderColor = 'var(--bd)'}>
              <div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 1 }}>{l.name}</div>
                <div style={{ fontSize: 10, color: 'var(--mu)', letterSpacing: 1, marginTop: 2, display: 'flex', gap: 10 }}>
                  <span>{l.ttt_league_members?.[0]?.count || 0} members</span>
                  {l.seasons_enabled && <span>Season {l.season}</span>}
                  {l.game_modes && <span style={{ textTransform: 'uppercase' }}>{l.game_modes.join(', ')}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {hasQualifiers(l) && qualifierBadges(l).map((b, i) => (
                  <span key={i} style={{ fontSize: 8, letterSpacing: 1, color: 'var(--hl)', textTransform: 'uppercase', padding: '2px 6px', border: '1px solid rgba(255,200,71,0.3)', borderRadius: 999, whiteSpace: 'nowrap' }}>{b}</span>
                ))}
                {!l.is_public && <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--hl)', textTransform: 'uppercase', padding: '2px 8px', border: '1px solid var(--hl)', borderRadius: 999 }}>Private</span>}
                <span style={{ fontSize: 18, color: 'var(--mu)' }}>&rsaquo;</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Create League Form ───────────────────────────────────
function CreateLeague({ onBack, onCreated }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [modes, setModes] = useState(['classic']);
  const [maxMembers, setMaxMembers] = useState(50);
  const [unlimited, setUnlimited] = useState(false);
  const [reqMinGames, setReqMinGames] = useState('');
  const [reqMinWins, setReqMinWins] = useState('');
  const [reqMinWinPct, setReqMinWinPct] = useState('');
  const [reqMinElo, setReqMinElo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function toggleMode(m) {
    setModes(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  }

  async function handleCreate() {
    if (!name.trim()) { setError('League name is required'); return; }
    if (modes.length === 0) { setError('Select at least one game mode'); return; }
    setSaving(true); setError('');
    try {
      const inviteCode = generateCode();
      const { data: league, error: insertErr } = await supabase.from('ttt_leagues').insert({
        name: name.trim(),
        description: desc.trim() || null,
        game_mode: modes[0],
        game_modes: modes,
        owner_id: user.id,
        is_public: isPublic,
        invite_code: inviteCode,
        max_members: unlimited ? null : maxMembers,
        req_min_games: reqMinGames !== '' ? parseInt(reqMinGames, 10) : null,
        req_min_wins: reqMinWins !== '' ? parseInt(reqMinWins, 10) : null,
        req_min_win_pct: reqMinWinPct !== '' ? parseFloat(reqMinWinPct) : null,
        req_min_elo: reqMinElo !== '' ? parseInt(reqMinElo, 10) : null,
      }).select().single();
      if (insertErr) throw insertErr;

      await supabase.from('ttt_league_members').insert({
        league_id: league.id,
        user_id: user.id,
        role: 'owner',
      });

      onCreated(league);
    } catch (err) { setError(err.message || 'Failed to create league'); }
    finally { setSaving(false); }
  }

  const modeColors = { classic: 'var(--X)', ultimate: 'var(--O)', mega: 'var(--mega)' };

  return (
    <div style={{ maxWidth: 500, margin: '0 auto' }}>
      <button className="smbtn" onClick={onBack} style={{ marginBottom: 16 }}>&larr; Back</button>
      <div style={{ background: 'var(--sf)', border: '1px solid var(--bd)', borderTop: '3px solid var(--ac)', padding: 28 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 2, color: 'var(--ac)', marginBottom: 20 }}>Create League</div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: 4 }}>League Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} style={inp} placeholder="e.g. Office Champions" />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: 4 }}>Description</label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} style={{ ...inp, minHeight: 60, resize: 'vertical' }} placeholder="Optional description" />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: 8 }}>Game Modes</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['classic', 'ultimate', 'mega'].map(m => (
              <button key={m} onClick={() => toggleMode(m)} style={{
                padding: '8px 16px', border: '1px solid ' + (modes.includes(m) ? modeColors[m] : 'var(--bd)'),
                background: modes.includes(m) ? 'rgba(232,255,71,0.06)' : 'var(--s2)',
                color: modes.includes(m) ? modeColors[m] : 'var(--mu)',
                fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer'
              }}>{m}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: 4 }}>Visibility</label>
            <select value={isPublic ? 'public' : 'private'} onChange={e => setIsPublic(e.target.value === 'public')}
              style={{ ...inp, width: '100%' }}>
              <option value="public">Public</option>
              <option value="private">Private (Invite Only)</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: 4 }}>Max Members</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number" min={2} max={1000}
                value={unlimited ? '' : maxMembers}
                onChange={e => {
                  const val = e.target.value;
                  if (val === '') { setMaxMembers(''); return; }
                  const num = parseInt(val, 10);
                  if (!isNaN(num)) setMaxMembers(Math.max(2, num));
                }}
                onBlur={() => { if (maxMembers === '' || maxMembers < 2) setMaxMembers(2); }}
                disabled={unlimited}
                style={{ ...inp, flex: 1, opacity: unlimited ? 0.4 : 1 }}
                placeholder="e.g. 50"
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={unlimited} onChange={e => setUnlimited(e.target.checked)}
                  style={{ accentColor: 'var(--ac)', cursor: 'pointer' }} />
                <span style={{ fontSize: 10, letterSpacing: 1.5, color: unlimited ? 'var(--ac)' : 'var(--mu)', fontFamily: "'DM Mono',monospace", textTransform: 'uppercase' }}>
                  Unlimited
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Entry Requirements */}
        <div style={{ marginBottom: 14, paddingTop: 14, borderTop: '1px solid var(--bd)' }}>
          <label style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--hl)', display: 'block', marginBottom: 4 }}>Entry Requirements <span style={{ color: 'var(--mu)', textTransform: 'none', letterSpacing: 0 }}>(optional — leave blank for no requirement)</span></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
            <div>
              <label style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: 3 }}>Min Games Played</label>
              <input type="number" min={0} value={reqMinGames} onChange={e => setReqMinGames(e.target.value)} style={inp} placeholder="e.g. 10" />
            </div>
            <div>
              <label style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: 3 }}>Min Wins</label>
              <input type="number" min={0} value={reqMinWins} onChange={e => setReqMinWins(e.target.value)} style={inp} placeholder="e.g. 5" />
            </div>
            <div>
              <label style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: 3 }}>Min Win %</label>
              <input type="number" min={0} max={100} step={0.1} value={reqMinWinPct} onChange={e => setReqMinWinPct(e.target.value)} style={inp} placeholder="e.g. 50" />
            </div>
            <div>
              <label style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: 3 }}>Min ELO</label>
              <input type="number" min={0} value={reqMinElo} onChange={e => setReqMinElo(e.target.value)} style={inp} placeholder="e.g. 1400" />
            </div>
          </div>
        </div>

        {error && <div style={{ fontSize: 11, color: 'var(--rd)', marginBottom: 12 }}>{error}</div>}

        <button className="savebtn" onClick={handleCreate} disabled={saving} style={{ width: '100%' }}>
          {saving ? 'Creating...' : 'Create League'}
        </button>
      </div>
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

function shouldTransitionSeason(league) {
  if (!league.seasons_enabled) return false;
  const now = new Date();
  if (league.season_mode === 'quarterly') {
    const { year, quarter } = getCurrentQuarter();
    const started = new Date(league.season_started_at);
    const startedQ = Math.floor(started.getMonth() / 3) + 1;
    const startedY = started.getFullYear();
    return year > startedY || (year === startedY && quarter > startedQ);
  }
  if (league.season_mode === 'custom_days' && league.season_duration_days) {
    const started = new Date(league.season_started_at);
    const elapsed = (now - started) / (1000 * 60 * 60 * 24);
    return elapsed >= league.season_duration_days;
  }
  if (league.season_mode === 'custom_date' && league.season_end_date) {
    return now >= new Date(league.season_end_date);
  }
  return false;
}

// ── League Detail ────────────────────────────────────────
function LeagueDetail({ league, onBack, onRefresh, onPlayLeagueMatch, onDeleted }) {
  const { user } = useAuth();
  const [tab, setTab] = useState('standings');
  const [members, setMembers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [myRole, setMyRole] = useState(null);
  const [leagueStats, setLeagueStats] = useState([]);
  const [standingsMode, setStandingsMode] = useState('overall');
  const [timerEnabled, setTimerEnabled] = useState(league.timer_enabled || false);
  const [timerSeconds, setTimerSeconds] = useState(league.timer_seconds || 45);
  const [timerSaving, setTimerSaving] = useState(false);

  // Season state
  const [viewingSeason, setViewingSeason] = useState(null); // null = current
  const [pastSeasons, setPastSeasons] = useState([]);
  const [pastStandings, setPastStandings] = useState(null);

  // Roster state
  const [editingMember, setEditingMember] = useState(null);
  const [editStats, setEditStats] = useState({ wins: 0, losses: 0, draws: 0 });
  const [editGameMode, setEditGameMode] = useState('classic');
  const [rosterSaving, setRosterSaving] = useState(false);

  // Season settings state
  const [seasonsEnabled, setSeasonsEnabled] = useState(league.seasons_enabled || false);
  const [seasonMode, setSeasonMode] = useState(league.season_mode || 'quarterly');
  const [seasonDurationDays, setSeasonDurationDays] = useState(league.season_duration_days || 30);
  const [seasonEndDate, setSeasonEndDate] = useState(league.season_end_date ? new Date(league.season_end_date).toISOString().split('T')[0] : '');
  const [minGamesQualify, setMinGamesQualify] = useState(league.min_games_qualify || 3);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [leaguePublic, setLeaguePublic] = useState(league.is_public ?? true);
  const [visibilitySaving, setVisibilitySaving] = useState(false);

  // Entry requirements state
  const [reqMinGames, setReqMinGames] = useState(league.req_min_games ?? '');
  const [reqMinWins, setReqMinWins] = useState(league.req_min_wins ?? '');
  const [reqMinWinPct, setReqMinWinPct] = useState(league.req_min_win_pct ?? '');
  const [reqMinElo, setReqMinElo] = useState(league.req_min_elo ?? '');
  const [reqSaving, setReqSaving] = useState(false);

  // Roster qualifier state
  const [globalStats, setGlobalStats] = useState({});
  const [showReqFilter, setShowReqFilter] = useState(false);

  useEffect(() => { fetchData(); }, [league.id, user?.id]);

  // Check for automatic season transition
  useEffect(() => {
    if (shouldTransitionSeason(league) && myRole) {
      performSeasonTransition();
    }
  }, [league.id, myRole]);

  async function fetchData() {
    try {
      const { data: mems } = await supabase
        .from('ttt_league_members')
        .select('*, ttt_profiles(display_name, avatar_url, username)')
        .eq('league_id', league.id)
        .order('joined_at');
      if (mems) {
        setMembers(mems);
        const me = mems.find(m => m.user_id === user?.id);
        setMyRole(me?.role || null);
      }

      const { data: lstats } = await supabase
        .from('ttt_league_stats')
        .select('*')
        .eq('league_id', league.id)
        .eq('season', league.season);
      if (lstats) setLeagueStats(lstats);

      const { data: mtch } = await supabase
        .from('ttt_matches')
        .select('*, player_x:ttt_profiles!player_x_id(display_name), player_o:ttt_profiles!player_o_id(display_name)')
        .eq('league_id', league.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (mtch) setMatches(mtch);

      // Fetch past seasons
      const { data: history } = await supabase
        .from('ttt_league_season_history')
        .select('*')
        .eq('league_id', league.id)
        .order('season', { ascending: false });
      if (history) setPastSeasons(history);

      // Fetch global stats for all members (for qualifier checks)
      if (mems && hasQualifiers(league)) {
        const memberIds = mems.map(m => m.user_id);
        const { data: gStats } = await supabase
          .from('ttt_player_stats')
          .select('*')
          .in('user_id', memberIds);
        if (gStats) {
          const byUser = {};
          gStats.forEach(s => {
            if (!byUser[s.user_id]) byUser[s.user_id] = [];
            byUser[s.user_id].push(s);
          });
          setGlobalStats(byUser);
        }
      }
    } catch (err) {
      console.error('fetchData error:', err);
    }
  }

  async function performSeasonTransition() {
    // Build standings snapshot
    const snapshot = buildStandingsSnapshot();

    // Save to history (unique constraint prevents duplicates if multiple clients trigger)
    const { error: histErr } = await supabase.from('ttt_league_season_history').insert({
      league_id: league.id,
      season: league.season,
      started_at: league.season_started_at,
      standings: snapshot,
    });

    // If duplicate (already transitioned), just refresh
    if (histErr) { onRefresh(); return; }

    // Compute next season end date for custom_date mode
    let nextEndDate = null;
    if (league.season_mode === 'custom_days' && league.season_duration_days) {
      const d = new Date();
      d.setDate(d.getDate() + league.season_duration_days);
      nextEndDate = d.toISOString();
    }

    await supabase.from('ttt_leagues').update({
      season: league.season + 1,
      season_started_at: new Date().toISOString(),
      ...(nextEndDate ? { season_end_date: nextEndDate } : {}),
    }).eq('id', league.id);

    onRefresh();
  }

  function buildStandingsSnapshot() {
    return members.map(m => {
      const profile = m.ttt_profiles || {};
      const userStats = leagueStats.filter(s => s.user_id === m.user_id);
      let totalW = 0, totalL = 0, totalD = 0;
      userStats.forEach(s => { totalW += s.wins; totalL += s.losses; totalD += s.draws; });
      const gp = totalW + totalL + totalD;
      const sc = calcScore(totalW, totalL, totalD);
      return {
        user_id: m.user_id,
        display_name: profile.display_name || 'Unknown',
        wins: totalW,
        losses: totalL,
        draws: totalD,
        gp,
        score: sc,
      };
    }).filter(m => m.gp > 0).sort((a, b) => b.score - a.score).map((m, i) => ({ ...m, rank: i + 1 }));
  }

  async function startNewSeasonManual() {
    await performSeasonTransition();
  }

  async function updateRole(memberId, newRole) {
    await supabase.from('ttt_league_members').update({ role: newRole }).eq('id', memberId);
    fetchData();
  }

  async function removeMember(memberId) {
    if (!confirm('Remove this member from the league?')) return;
    await supabase.from('ttt_league_members').delete().eq('id', memberId);
    fetchData();
  }

  async function warnMember(memberId) {
    if (!confirm('Warn this member about not meeting requirements?')) return;
    await supabase.from('ttt_league_members').update({
      status: 'warned', warned_at: new Date().toISOString(),
    }).eq('id', memberId);
    fetchData();
  }

  async function probationMember(memberId) {
    if (!confirm('Put this member on probation? They can be removed next.')) return;
    await supabase.from('ttt_league_members').update({ status: 'probation' }).eq('id', memberId);
    fetchData();
  }

  async function resetMemberStatus(memberId) {
    await supabase.from('ttt_league_members').update({
      status: 'active', warned_at: null,
    }).eq('id', memberId);
    fetchData();
  }

  async function transferOwnership(memberId, userId) {
    if (!confirm('Transfer ownership? You will become a manager.')) return;
    try {
      const { error: e1 } = await supabase.from('ttt_league_members').update({ role: 'owner' }).eq('id', memberId);
      if (e1) throw e1;
      const myMember = members.find(m => m.user_id === user.id);
      if (myMember) {
        const { error: e2 } = await supabase.from('ttt_league_members').update({ role: 'manager' }).eq('id', myMember.id);
        if (e2) throw e2;
      }
      const { error: e3 } = await supabase.from('ttt_leagues').update({ owner_id: userId }).eq('id', league.id);
      if (e3) throw e3;
      fetchData();
      onRefresh();
    } catch (err) {
      console.error('Transfer ownership failed:', err);
      fetchData();
    }
  }

  async function saveStatEdit() {
    if (!editingMember) return;
    setRosterSaving(true);
    await supabase.from('ttt_league_stats').upsert({
      league_id: league.id,
      user_id: editingMember.user_id,
      game_mode: editGameMode,
      season: league.season,
      wins: Math.max(0, editStats.wins),
      losses: Math.max(0, editStats.losses),
      draws: Math.max(0, editStats.draws),
    }, { onConflict: 'league_id,user_id,game_mode,season' });
    setRosterSaving(false);
    setEditingMember(null);
    fetchData();
  }

  function openStatEditor(member) {
    const mode = editGameMode;
    const existing = leagueStats.find(s => s.user_id === member.user_id && s.game_mode === mode);
    setEditStats({
      wins: existing?.wins || 0,
      losses: existing?.losses || 0,
      draws: existing?.draws || 0,
    });
    setEditingMember(member);
  }

  async function saveSeasonSettings() {
    setSettingsSaving(true);
    const updates = {
      seasons_enabled: seasonsEnabled,
      season_mode: seasonMode,
      season_duration_days: seasonMode === 'custom_days' ? seasonDurationDays : null,
      season_end_date: seasonMode === 'custom_date' && seasonEndDate ? new Date(seasonEndDate).toISOString() : null,
      min_games_qualify: Math.max(1, minGamesQualify),
    };
    await supabase.from('ttt_leagues').update(updates).eq('id', league.id);
    setSettingsSaving(false);
    onRefresh();
  }

  const isOwner = myRole === 'owner';
  const isManager = myRole === 'manager' || isOwner;
  const isMember = !!myRole;

  // Build standings from members + league stats
  const standings = members.map(m => {
    const profile = m.ttt_profiles || {};
    const userStats = leagueStats.filter(s => s.user_id === m.user_id);
    const filteredStats = standingsMode === 'overall'
      ? userStats
      : userStats.filter(s => s.game_mode === standingsMode);

    let totalW = 0, totalL = 0, totalD = 0;
    filteredStats.forEach(s => { totalW += s.wins; totalL += s.losses; totalD += s.draws; });

    const gp = totalW + totalL + totalD;
    const sc = calcScore(totalW, totalL, totalD);
    const wpct = gp > 0 ? ((totalW + 0.5 * totalD) / gp * 100).toFixed(1) + '%' : '\u2014';

    return {
      ...m,
      display_name: profile.display_name || 'Unknown',
      avatar_url: profile.avatar_url,
      wins: totalW,
      losses: totalL,
      draws: totalD,
      gp,
      score: sc,
      wpct,
    };
  });

  const minGames = league.min_games_qualify || 3;

  const tabStyle = (id) => ({
    background: 'none', border: 'none', borderBottom: '2px solid ' + (tab === id ? 'var(--ac)' : 'transparent'),
    color: tab === id ? 'var(--ac)' : 'var(--mu)', fontFamily: "'DM Mono',monospace", fontSize: 10,
    letterSpacing: 2, textTransform: 'uppercase', padding: '8px 14px', cursor: 'pointer', marginBottom: -1, whiteSpace: 'nowrap'
  });

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <button className="smbtn" onClick={onBack} style={{ marginBottom: 16 }}>&larr; Back to Leagues</button>

      {/* League Header */}
      <div style={{ background: 'var(--sf)', border: '1px solid var(--bd)', borderTop: '3px solid var(--ac)', padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 2 }}>{league.name}</div>
            {league.description && <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 4 }}>{league.description}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 10, letterSpacing: 1, color: 'var(--mu)' }}>
              {league.seasons_enabled && <span>Season {league.season}</span>}
              <span>{members.length}{league.max_members ? `/${league.max_members}` : ''} members</span>
              {league.game_modes && <span style={{ textTransform: 'uppercase' }}>{league.game_modes.join(', ')}</span>}
              {!league.is_public && <span style={{ color: 'var(--hl)' }}>Private</span>}
            </div>
            {hasQualifiers(league) && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {qualifierBadges(league).map((b, i) => (
                  <span key={i} style={{ fontSize: 9, letterSpacing: 1, color: 'var(--hl)', padding: '2px 8px', border: '1px solid rgba(255,200,71,0.3)', borderRadius: 999, background: 'rgba(255,200,71,0.06)' }}>{b}</span>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            {league.invite_code && isManager && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 3 }}>Invite Code</div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 3, color: 'var(--hl)', cursor: 'pointer' }}
                  onClick={() => navigator.clipboard?.writeText(league.invite_code)} title="Click to copy">
                  {league.invite_code}
                </div>
              </div>
            )}
            {isMember && onPlayLeagueMatch && (
              <button className="savebtn" onClick={() => onPlayLeagueMatch(league.id, league.name)} style={{ whiteSpace: 'nowrap' }}>
                ⚔ Find League Match
              </button>
            )}
            {!isMember && league.is_public && onPlayLeagueMatch && (
              <button className="savebtn" onClick={() => onPlayLeagueMatch(league.id, league.name)} style={{ whiteSpace: 'nowrap' }}>
                ⚔ Play in League
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid var(--bd)', overflowX: 'auto' }}>
        <button onClick={() => setTab('standings')} style={tabStyle('standings')}>Standings</button>
        <button onClick={() => setTab('matches')} style={tabStyle('matches')}>Matches</button>
        <button onClick={() => setTab('roster')} style={tabStyle('roster')}>Roster</button>
        <button onClick={() => setTab('settings')} style={tabStyle('settings')}>Settings</button>
      </div>

      {/* Standings Tab */}
      {tab === 'standings' && (() => {
        const modeTabs = [
          { id: 'overall', label: 'Overall' },
          ...(league.game_modes || ['classic']).map(m => ({
            id: m,
            label: m === 'classic' ? 'Classic' : m === 'ultimate' ? 'Ultimate' : 'MEGA',
          })),
        ];
        const modeAc = standingsMode === 'ultimate' ? 'var(--O)' : standingsMode === 'mega' ? 'var(--mega)' : standingsMode === 'classic' ? 'var(--X)' : 'var(--ac)';

        // If viewing past season, use stored snapshot
        if (viewingSeason !== null) {
          const past = pastSeasons.find(p => p.season === viewingSeason);
          const pastData = past?.standings || [];
          return (
            <div>
              {/* Season selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <select value={viewingSeason} onChange={e => {
                  const val = e.target.value;
                  if (val === 'current') { setViewingSeason(null); } else { setViewingSeason(parseInt(val)); }
                }} style={{ ...inp, width: 'auto', fontSize: 11, padding: '6px 10px' }}>
                  <option value="current">Current Season ({league.season})</option>
                  {pastSeasons.map(p => <option key={p.season} value={p.season}>Season {p.season}</option>)}
                </select>
                <span style={{ fontSize: 9, color: 'var(--mu)', letterSpacing: 1 }}>
                  {past ? `${new Date(past.started_at || past.ended_at).toLocaleDateString()} — ${new Date(past.ended_at).toLocaleDateString()}` : ''}
                </span>
              </div>

              {pastData.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 11, letterSpacing: 2, padding: 30, border: '1px dashed var(--bd)' }}>No results for this season.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ borderBottom: '2px solid var(--ac)' }}>
                      <th style={{ ...labelSt, padding: '10px 12px', textAlign: 'left', width: 40 }}>#</th>
                      <th style={{ ...labelSt, padding: '10px 12px', textAlign: 'left' }}>Player</th>
                      <th style={{ ...labelSt, padding: '10px 12px', textAlign: 'right' }}>W</th>
                      <th style={{ ...labelSt, padding: '10px 12px', textAlign: 'right' }}>L</th>
                      <th style={{ ...labelSt, padding: '10px 12px', textAlign: 'right' }}>T</th>
                      <th style={{ ...labelSt, padding: '10px 12px', textAlign: 'right' }}>GP</th>
                      <th style={{ ...labelSt, padding: '10px 12px', textAlign: 'right' }}>Score</th>
                    </tr></thead>
                    <tbody>
                      {pastData.map((p, i) => {
                        const rc = i === 0 ? 'var(--go)' : i === 1 ? 'var(--si)' : i === 2 ? 'var(--br)' : 'var(--ac)';
                        return (
                          <tr key={p.user_id || i} style={{ borderBottom: '1px solid var(--bd)' }}>
                            <td><div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: i < 3 ? rc : 'var(--mu)', textAlign: 'center' }}>{i + 1}</div></td>
                            <td style={{ padding: '12px 12px', fontWeight: 500, color: i < 3 ? rc : undefined }}>{p.display_name}</td>
                            <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: 12, color: 'var(--mu)' }}>{p.wins}</td>
                            <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: 12, color: 'var(--mu)' }}>{p.losses}</td>
                            <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: 12, color: 'var(--mu)' }}>{p.draws}</td>
                            <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: 12, color: 'var(--mu)' }}>{p.gp}</td>
                            <td style={{ padding: '12px 12px', textAlign: 'right', fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, color: i < 3 ? rc : 'var(--ac)' }}>{p.score?.toFixed(1)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        }

        const quals = standings.filter(m => m.gp >= minGames).sort((a, b) => b.score - a.score);
        const dnqs = standings.filter(m => m.gp > 0 && m.gp < minGames).sort((a, b) => a.display_name.localeCompare(b.display_name));
        const noGames = standings.filter(m => m.gp === 0);
        const maxSc = quals.length > 0 ? quals[0].score : 1;

        return (
          <div>
            {/* Season selector (if seasons enabled and past seasons exist) */}
            {league.seasons_enabled && pastSeasons.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <select value="current" onChange={e => {
                  if (e.target.value !== 'current') setViewingSeason(parseInt(e.target.value));
                }} style={{ ...inp, width: 'auto', fontSize: 11, padding: '6px 10px' }}>
                  <option value="current">Current Season ({league.season})</option>
                  {pastSeasons.map(p => <option key={p.season} value={p.season}>Season {p.season}</option>)}
                </select>
              </div>
            )}

            {/* Mode Sub-tabs */}
            {modeTabs.length > 2 && (
              <div style={{ display: 'flex', gap: 2, marginBottom: 18, borderBottom: '1px solid var(--bd)', overflowX: 'auto' }}>
                {modeTabs.map(t => (
                  <button key={t.id} onClick={() => setStandingsMode(t.id)} style={{
                    background: 'none', border: 'none', borderBottom: '2px solid ' + (standingsMode === t.id ? modeAc : 'transparent'),
                    color: standingsMode === t.id ? modeAc : 'var(--mu)', fontFamily: "'DM Mono',monospace", fontSize: 10,
                    letterSpacing: 2, textTransform: 'uppercase', padding: '8px 14px', cursor: 'pointer', marginBottom: -1, whiteSpace: 'nowrap'
                  }}>{t.label}</button>
                ))}
              </div>
            )}

            {/* Standings Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '2px solid ' + modeAc }}>
                  <th style={{ ...labelSt, padding: '10px 12px', textAlign: 'left', width: 40 }}>#</th>
                  <th style={{ ...labelSt, padding: '10px 12px', textAlign: 'left' }}>Player</th>
                  <th style={{ ...labelSt, padding: '10px 12px', textAlign: 'right' }}>W</th>
                  <th style={{ ...labelSt, padding: '10px 12px', textAlign: 'right' }}>L</th>
                  <th style={{ ...labelSt, padding: '10px 12px', textAlign: 'right' }}>T</th>
                  <th style={{ ...labelSt, padding: '10px 12px', textAlign: 'right' }}>GP</th>
                  <th style={{ ...labelSt, padding: '10px 12px', textAlign: 'right' }}>Win%</th>
                  <th style={{ ...labelSt, padding: '10px 12px', minWidth: 140 }}>Score</th>
                </tr></thead>
                <tbody>
                  {quals.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--mu)', padding: 32, fontSize: 12, letterSpacing: 2 }}>No qualifying results yet{minGames > 1 ? ` (need ${minGames}+ games)` : ''}</td></tr>
                  )}
                  {quals.map((m, i) => {
                    const rc = i === 0 ? 'var(--go)' : i === 1 ? 'var(--si)' : i === 2 ? 'var(--br)' : modeAc;
                    const roleColor = m.role === 'owner' ? 'var(--go)' : m.role === 'manager' ? 'var(--hl)' : null;
                    return (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--bd)' }}>
                        <td><div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: i < 3 ? rc : 'var(--mu)', textAlign: 'center' }}>{i + 1}</div></td>
                        <td style={{ padding: '12px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {m.avatar_url && <img src={m.avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />}
                            <span style={{ fontWeight: 500, color: i < 3 ? rc : undefined }}>{m.display_name}</span>
                            {m.user_id === user?.id && <span style={{ fontSize: 9, color: 'var(--ac)', letterSpacing: 1 }}>(you)</span>}
                            {roleColor && <span style={{ fontSize: 8, letterSpacing: 1, color: roleColor, textTransform: 'uppercase', padding: '1px 5px', border: '1px solid ' + roleColor, borderRadius: 999 }}>{m.role}</span>}
                          </div>
                        </td>
                        <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: 12, color: 'var(--mu)' }}>{m.wins}</td>
                        <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: 12, color: 'var(--mu)' }}>{m.losses}</td>
                        <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: 12, color: 'var(--mu)' }}>{m.draws}</td>
                        <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: 12, color: 'var(--mu)' }}>{m.gp}</td>
                        <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: 12 }}>{m.wpct}</td>
                        <td style={{ padding: '12px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
                            <div style={{ flex: 1, height: 5, background: 'var(--bd)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', borderRadius: 3, background: i < 3 ? rc : modeAc, width: ((m.score / maxSc) * 100) + '%' }} />
                            </div>
                            <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: i < 3 ? rc : modeAc, minWidth: 40, textAlign: 'right' }}>{m.score.toFixed(1)}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Did Not Qualify */}
            {dnqs.length > 0 && (
              <div>
                <div style={{ fontSize: 10, letterSpacing: 3, color: 'var(--mu)', textTransform: 'uppercase', margin: '30px 0 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  Did Not Qualify ({minGames}+ games needed)
                  <span style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {dnqs.map(m => (
                    <div key={m.id} style={{ background: 'var(--sf)', border: '1px solid var(--bd)', padding: '7px 13px', fontSize: 12, color: 'var(--mu)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: 'var(--rd)' }}>x</span>
                      <span style={{ color: 'var(--tx)', fontWeight: 500 }}>{m.display_name}</span>
                      <span>{m.wins}-{m.losses}-{m.draws} ({m.gp} GP)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Games */}
            {noGames.length > 0 && (
              <div>
                <div style={{ fontSize: 10, letterSpacing: 3, color: 'var(--mu)', textTransform: 'uppercase', margin: '20px 0 10px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  No Games Played
                  <span style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {noGames.map(m => {
                    const roleColor = m.role === 'owner' ? 'var(--go)' : m.role === 'manager' ? 'var(--hl)' : null;
                    return (
                      <div key={m.id} style={{ background: 'var(--sf)', border: '1px solid var(--bd)', padding: '7px 13px', fontSize: 12, color: 'var(--mu)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {m.avatar_url && <img src={m.avatar_url} alt="" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />}
                        <span style={{ color: 'var(--tx)', fontWeight: 500 }}>{m.display_name}</span>
                        {roleColor && <span style={{ fontSize: 8, color: roleColor, textTransform: 'uppercase' }}>{m.role}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Matches Tab */}
      {tab === 'matches' && (
        <div>
          {matches.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 11, letterSpacing: 2, padding: 30, border: '1px dashed var(--bd)' }}>
              No league matches yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {matches.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--sf)', border: '1px solid var(--bd)', fontSize: 12 }}>
                  <span style={{ fontWeight: 500, color: 'var(--X)' }}>{m.player_x?.display_name || '?'}</span>
                  <span style={{ fontSize: 10, color: 'var(--mu)' }}>vs</span>
                  <span style={{ fontWeight: 500, color: 'var(--O)' }}>{m.player_o?.display_name || '?'}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{
                    fontSize: 10, padding: '2px 8px',
                    background: m.is_draw ? 'rgba(71,200,255,0.1)' : 'rgba(71,255,154,0.1)',
                    color: m.is_draw ? 'var(--a3)' : 'var(--gn)'
                  }}>{m.is_draw ? 'Draw' : m.result === 'x_wins' ? 'X wins' : 'O wins'}</span>
                  <span style={{ fontSize: 10, color: 'var(--mu)' }}>{new Date(m.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Roster Tab */}
      {tab === 'roster' && !isManager && (
        <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 11, letterSpacing: 2, padding: 30, border: '1px dashed var(--bd)' }}>
          Only league managers can access the roster.
        </div>
      )}
      {tab === 'roster' && isManager && (
        <div>
          <div style={{ fontSize: 10, letterSpacing: 3, color: 'var(--ac)', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            Roster Management
            <span style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
            <span style={{ color: 'var(--mu)', letterSpacing: 1, textTransform: 'none' }}>{members.length} member{members.length !== 1 ? 's' : ''}</span>
            {hasQualifiers(league) && (
              <button className="smbtn" style={{ fontSize: 8, padding: '4px 10px', borderColor: showReqFilter ? 'var(--hl)' : 'var(--bd)', color: showReqFilter ? 'var(--hl)' : 'var(--mu)' }}
                onClick={() => setShowReqFilter(!showReqFilter)}>
                {showReqFilter ? '✕ Show All' : '⚠ Check Requirements'}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {members.map(m => {
              const profile = m.ttt_profiles || {};
              const roleColor = m.role === 'owner' ? 'var(--go)' : m.role === 'manager' ? 'var(--hl)' : 'var(--mu)';
              const isEditing = editingMember?.id === m.id;

              // Get stats for this member
              const mStats = leagueStats.filter(s => s.user_id === m.user_id);
              let tw = 0, tl = 0, td = 0;
              mStats.forEach(s => { tw += s.wins; tl += s.losses; td += s.draws; });
              const tgp = tw + tl + td;

              // Global qualifier check
              const memberGlobal = globalStats[m.user_id] || [];
              const qualResult = hasQualifiers(league) ? checkQualifiers(league, memberGlobal) : null;
              const failing = qualResult && !qualResult.qualified;

              // Filter mode: only show failing members
              if (showReqFilter && !failing) return null;

              const statusColor = m.status === 'probation' ? 'var(--rd)' : m.status === 'warned' ? 'var(--hl)' : null;

              return (
                <div key={m.id} style={{ background: 'var(--sf)', border: '1px solid ' + (failing ? 'rgba(255,71,87,0.3)' : 'var(--bd)'), padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isEditing ? 12 : 0 }}>
                    {profile.avatar_url && <img src={profile.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{profile.display_name || 'Unknown'}</span>
                        <span style={{ fontSize: 8, letterSpacing: 1, color: roleColor, textTransform: 'uppercase', padding: '1px 5px', border: '1px solid ' + roleColor, borderRadius: 999 }}>{m.role}</span>
                        {failing && <span style={{ fontSize: 12 }} title="Below requirements">⚠️</span>}
                        {statusColor && (
                          <span style={{ fontSize: 8, letterSpacing: 1, color: statusColor, textTransform: 'uppercase', padding: '1px 5px', border: '1px solid ' + statusColor, borderRadius: 999, background: m.status === 'probation' ? 'rgba(255,71,87,0.1)' : 'rgba(255,200,71,0.1)' }}>
                            {m.status}
                          </span>
                        )}
                        {m.user_id === user?.id && <span style={{ fontSize: 9, color: 'var(--ac)' }}>(you)</span>}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 2 }}>
                        {tgp > 0 ? `${tw}W ${tl}L ${td}T (${tgp} GP)` : 'No games'}
                        {' · '}Joined {new Date(m.joined_at).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Actions */}
                    {m.user_id !== user.id && m.role !== 'owner' && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button className="smbtn" style={{ fontSize: 8, padding: '4px 8px' }} onClick={() => openStatEditor(m)}>Edit Stats</button>
                        {isOwner && m.role === 'member' && <button className="smbtn" style={{ fontSize: 8, padding: '4px 8px' }} onClick={() => updateRole(m.id, 'manager')}>Promote</button>}
                        {isOwner && m.role === 'manager' && <button className="smbtn" style={{ fontSize: 8, padding: '4px 8px' }} onClick={() => updateRole(m.id, 'member')}>Demote</button>}
                        {/* Qualifier warning actions */}
                        {failing && m.status === 'active' && (
                          <button style={{ background: 'none', border: '1px solid var(--hl)', color: 'var(--hl)', fontFamily: "'DM Mono',monospace", fontSize: 8, padding: '4px 8px', cursor: 'pointer' }}
                            onClick={() => warnMember(m.id)}>Warn</button>
                        )}
                        {failing && m.status === 'warned' && (
                          <button style={{ background: 'rgba(255,71,87,0.1)', border: '1px solid var(--rd)', color: 'var(--rd)', fontFamily: "'DM Mono',monospace", fontSize: 8, padding: '4px 8px', cursor: 'pointer' }}
                            onClick={() => probationMember(m.id)}>Probation</button>
                        )}
                        {(m.status === 'warned' || m.status === 'probation') && !failing && (
                          <button className="smbtn" style={{ fontSize: 8, padding: '4px 8px', borderColor: 'var(--gn)', color: 'var(--gn)' }}
                            onClick={() => resetMemberStatus(m.id)}>Clear Status</button>
                        )}
                        <button style={{ background: 'none', border: '1px solid var(--rd)', color: 'var(--rd)', fontFamily: "'DM Mono',monospace", fontSize: 8, padding: '4px 8px', cursor: 'pointer' }}
                          onClick={() => removeMember(m.id)}>Remove</button>
                        {isOwner && <button className="smbtn" style={{ fontSize: 8, padding: '4px 8px', borderColor: 'var(--go)', color: 'var(--go)' }} onClick={() => transferOwnership(m.id, m.user_id)}>Transfer Owner</button>}
                      </div>
                    )}
                  </div>

                  {/* Failing requirements detail */}
                  {failing && qualResult && (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(255,71,87,0.05)', border: '1px solid rgba(255,71,87,0.15)', fontSize: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {qualResult.results.map((r, i) => (
                        <span key={i} style={{ color: r.met ? 'var(--gn)' : 'var(--rd)' }}>
                          {r.met ? '✓' : '✗'} {r.label}: {r.actual} / {r.required}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Inline stat editor */}
                  {isEditing && (
                    <div style={{ background: 'var(--s2)', border: '1px solid var(--bd)', padding: 14, marginTop: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, letterSpacing: 2, color: 'var(--mu)', textTransform: 'uppercase' }}>Edit Stats for:</span>
                        <select value={editGameMode} onChange={e => {
                          setEditGameMode(e.target.value);
                          const existing = leagueStats.find(s => s.user_id === m.user_id && s.game_mode === e.target.value);
                          setEditStats({ wins: existing?.wins || 0, losses: existing?.losses || 0, draws: existing?.draws || 0 });
                        }} style={{ ...inp, width: 'auto', fontSize: 11, padding: '4px 8px' }}>
                          {(league.game_modes || ['classic']).map(gm => (
                            <option key={gm} value={gm}>{gm.charAt(0).toUpperCase() + gm.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <label style={{ fontSize: 10, color: 'var(--mu)' }}>W:
                          <input type="number" min={0} value={editStats.wins} onChange={e => setEditStats(s => ({ ...s, wins: parseInt(e.target.value) || 0 }))}
                            style={{ ...inp, width: 60, padding: '4px 8px', marginLeft: 4, fontSize: 12 }} />
                        </label>
                        <label style={{ fontSize: 10, color: 'var(--mu)' }}>L:
                          <input type="number" min={0} value={editStats.losses} onChange={e => setEditStats(s => ({ ...s, losses: parseInt(e.target.value) || 0 }))}
                            style={{ ...inp, width: 60, padding: '4px 8px', marginLeft: 4, fontSize: 12 }} />
                        </label>
                        <label style={{ fontSize: 10, color: 'var(--mu)' }}>T:
                          <input type="number" min={0} value={editStats.draws} onChange={e => setEditStats(s => ({ ...s, draws: parseInt(e.target.value) || 0 }))}
                            style={{ ...inp, width: 60, padding: '4px 8px', marginLeft: 4, fontSize: 12 }} />
                        </label>
                        <button className="savebtn" style={{ padding: '5px 12px', fontSize: 10 }} onClick={saveStatEdit} disabled={rosterSaving}>
                          {rosterSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button className="smbtn" style={{ fontSize: 9, padding: '5px 10px' }} onClick={() => setEditingMember(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {tab === 'settings' && !isManager && (
        <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 11, letterSpacing: 2, padding: 30, border: '1px dashed var(--bd)' }}>
          Only league managers can access settings.
        </div>
      )}
      {tab === 'settings' && isManager && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Visibility */}
          <div style={cardSt}>
            <div style={labelSt}>League Visibility</div>
            <div style={descSt}>Public leagues are visible to all players and allow auto-join when playing a match. Private leagues require an invite code to join.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={leaguePublic} onChange={e => setLeaguePublic(e.target.checked)}
                  style={{ accentColor: 'var(--ac)', width: 16, height: 16 }} />
                <span style={{ fontSize: 12, color: leaguePublic ? 'var(--ac)' : 'var(--mu)' }}>
                  {leaguePublic ? 'Public' : 'Private (Invite Only)'}
                </span>
              </label>
            </div>
            <button className="savebtn" style={{ padding: '8px 16px' }} disabled={visibilitySaving}
              onClick={async () => {
                setVisibilitySaving(true);
                await supabase.from('ttt_leagues').update({ is_public: leaguePublic }).eq('id', league.id);
                onRefresh();
                setVisibilitySaving(false);
              }}>
              {visibilitySaving ? 'Saving...' : 'Save Visibility'}
            </button>
          </div>

          {/* Entry Requirements */}
          <div style={cardSt}>
            <div style={{ ...labelSt, color: 'var(--hl)' }}>Entry Requirements</div>
            <div style={descSt}>Set minimum global stats players must meet to join this league. Leave blank for no requirement. Players who fall below after joining can be warned and removed from the Roster tab.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: 3 }}>Min Games Played</label>
                <input type="number" min={0} value={reqMinGames} onChange={e => setReqMinGames(e.target.value)} style={inp} placeholder="None" />
              </div>
              <div>
                <label style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: 3 }}>Min Wins</label>
                <input type="number" min={0} value={reqMinWins} onChange={e => setReqMinWins(e.target.value)} style={inp} placeholder="None" />
              </div>
              <div>
                <label style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: 3 }}>Min Win %</label>
                <input type="number" min={0} max={100} step={0.1} value={reqMinWinPct} onChange={e => setReqMinWinPct(e.target.value)} style={inp} placeholder="None" />
              </div>
              <div>
                <label style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: 3 }}>Min ELO</label>
                <input type="number" min={0} value={reqMinElo} onChange={e => setReqMinElo(e.target.value)} style={inp} placeholder="None" />
              </div>
            </div>
            <button className="savebtn" style={{ padding: '8px 16px' }} disabled={reqSaving}
              onClick={async () => {
                setReqSaving(true);
                await supabase.from('ttt_leagues').update({
                  req_min_games: reqMinGames !== '' ? parseInt(reqMinGames, 10) : null,
                  req_min_wins: reqMinWins !== '' ? parseInt(reqMinWins, 10) : null,
                  req_min_win_pct: reqMinWinPct !== '' ? parseFloat(reqMinWinPct) : null,
                  req_min_elo: reqMinElo !== '' ? parseInt(reqMinElo, 10) : null,
                }).eq('id', league.id);
                onRefresh();
                setReqSaving(false);
              }}>
              {reqSaving ? 'Saving...' : 'Save Requirements'}
            </button>
          </div>

          {/* Timer Settings */}
          <div style={cardSt}>
            <div style={labelSt}>Turn Timer</div>
            <div style={descSt}>Enable a per-turn timer for league matches. Players who run out of time forfeit.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={timerEnabled} onChange={e => setTimerEnabled(e.target.checked)}
                  style={{ accentColor: 'var(--hl)', width: 16, height: 16 }} />
                <span style={{ fontSize: 12, color: timerEnabled ? 'var(--hl)' : 'var(--mu)' }}>
                  {timerEnabled ? 'Timer Enabled' : 'Timer Disabled'}
                </span>
              </label>
            </div>
            {timerEnabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <label style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--mu)' }}>Seconds per turn:</label>
                <input type="number" min={10} max={120} value={timerSeconds}
                  onChange={e => setTimerSeconds(Math.max(10, Math.min(120, parseInt(e.target.value, 10) || 45)))}
                  style={{ width: 70, ...inp, textAlign: 'center' }} />
                <span style={{ fontSize: 10, color: 'var(--mu)' }}>({timerSeconds <= 15 ? 'fast' : timerSeconds <= 30 ? 'moderate' : timerSeconds <= 45 ? 'generous' : 'relaxed'})</span>
              </div>
            )}
            <button className="savebtn" style={{ padding: '8px 16px' }} disabled={timerSaving}
              onClick={async () => {
                setTimerSaving(true);
                await supabase.from('ttt_leagues').update({ timer_enabled: timerEnabled, timer_seconds: timerSeconds }).eq('id', league.id);
                onRefresh();
                setTimerSaving(false);
              }}>
              {timerSaving ? 'Saving...' : 'Save Timer Settings'}
            </button>
          </div>

          {/* Season Settings */}
          <div style={cardSt}>
            <div style={labelSt}>Season System</div>
            <div style={descSt}>Organize competition into seasons. Past season results are archived and viewable.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={seasonsEnabled} onChange={e => setSeasonsEnabled(e.target.checked)}
                  style={{ accentColor: 'var(--ac)', width: 16, height: 16 }} />
                <span style={{ fontSize: 12, color: seasonsEnabled ? 'var(--ac)' : 'var(--mu)' }}>
                  {seasonsEnabled ? 'Seasons Enabled' : 'Seasons Disabled'}
                </span>
              </label>
            </div>

            {seasonsEnabled && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: 4 }}>Season Mode</label>
                  <select value={seasonMode} onChange={e => setSeasonMode(e.target.value)} style={{ ...inp, width: '100%' }}>
                    <option value="quarterly">Quarterly (Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec)</option>
                    <option value="custom_days">Custom Interval (every X days)</option>
                    <option value="custom_date">Custom End Date</option>
                    <option value="manual">Manual Only</option>
                  </select>
                </div>

                {seasonMode === 'custom_days' && (
                  <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--mu)' }}>Days per season:</label>
                    <input type="number" min={1} max={365} value={seasonDurationDays}
                      onChange={e => setSeasonDurationDays(Math.max(1, parseInt(e.target.value) || 30))}
                      style={{ width: 80, ...inp, textAlign: 'center' }} />
                  </div>
                )}

                {seasonMode === 'custom_date' && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: 4 }}>Season End Date</label>
                    <input type="date" value={seasonEndDate} onChange={e => setSeasonEndDate(e.target.value)}
                      style={{ ...inp, width: 200 }} />
                  </div>
                )}

                <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 14, background: 'var(--s2)', padding: 10, border: '1px solid var(--bd)' }}>
                  Current: Season {league.season} · Started {new Date(league.season_started_at || league.created_at).toLocaleDateString()}
                  {league.season_end_date && ` · Ends ${new Date(league.season_end_date).toLocaleDateString()}`}
                </div>

                <button className="smbtn" style={{ marginBottom: 8 }} onClick={startNewSeasonManual}>
                  Start Season {league.season + 1} Now
                </button>
              </>
            )}

            <div style={{ marginTop: seasonsEnabled ? 16 : 0, paddingTop: seasonsEnabled ? 16 : 0, borderTop: seasonsEnabled ? '1px solid var(--bd)' : 'none' }}>
              <div style={{ ...labelSt, marginBottom: 6 }}>Minimum Games to Qualify</div>
              <div style={{ ...descSt, marginBottom: 8 }}>Players need at least this many games to appear in ranked standings.</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="number" min={1} max={100} value={minGamesQualify}
                  onChange={e => setMinGamesQualify(Math.max(1, parseInt(e.target.value) || 3))}
                  style={{ width: 70, ...inp, textAlign: 'center' }} />
                <span style={{ fontSize: 10, color: 'var(--mu)' }}>games</span>
              </div>
            </div>

            <button className="savebtn" style={{ padding: '8px 16px', marginTop: 14 }} disabled={settingsSaving}
              onClick={saveSeasonSettings}>
              {settingsSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          {/* Transfer Ownership */}
          {isOwner && (
            <div style={cardSt}>
              <div style={labelSt}>Transfer Ownership</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {members.filter(m => m.user_id !== user.id).map(m => (
                  <button key={m.id} className="smbtn" onClick={() => transferOwnership(m.id, m.user_id)}>
                    Transfer to {m.ttt_profiles?.display_name || 'Unknown'}
                  </button>
                ))}
              </div>
              {members.filter(m => m.user_id !== user.id).length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--mu)' }}>No other members to transfer to.</div>
              )}
            </div>
          )}

          {/* Leave League */}
          {isMember && !isOwner && (
            <div style={{ ...cardSt, borderColor: 'var(--rd)' }}>
              <div style={{ ...labelSt, color: 'var(--rd)' }}>Leave League</div>
              <button style={{ background: 'none', border: '1px solid var(--rd)', color: 'var(--rd)', fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: 2, padding: '10px 16px', cursor: 'pointer' }}
                onClick={async () => {
                  const me = members.find(m => m.user_id === user.id);
                  if (me) { await removeMember(me.id); onBack(); }
                }}>Leave League</button>
            </div>
          )}

          {/* Delete League */}
          {isOwner && (
            <div style={{ ...cardSt, borderColor: 'var(--rd)' }}>
              <div style={{ ...labelSt, color: 'var(--rd)' }}>Delete League</div>
              <div style={descSt}>Permanently delete this league and all its data. This cannot be undone.</div>
              <button style={{ background: 'rgba(255,71,87,0.1)', border: '1px solid var(--rd)', color: 'var(--rd)', fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: 2, padding: '10px 16px', cursor: 'pointer' }}
                onClick={async () => {
                  if (!confirm('Are you sure you want to delete this league? This cannot be undone.')) return;
                  if (!confirm('This will permanently delete all league data including members, stats, matches, and season history. Continue?')) return;
                  try {
                    const { error: delErr } = await supabase.from('ttt_leagues').delete().eq('id', league.id);
                    if (delErr) throw delErr;
                    if (onDeleted) onDeleted();
                  } catch (err) {
                    console.error('Delete league failed:', err);
                    alert('Failed to delete league: ' + (err.message || 'Unknown error'));
                  }
                }}>Delete League Permanently</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Leagues Component ───────────────────────────────
export default function Leagues({ onPlayLeagueMatch }) {
  const { user } = useAuth();
  const [view, setView] = useState('list');
  const [leagues, setLeagues] = useState([]);
  const [myLeagues, setMyLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [joinError, setJoinError] = useState('');

  useEffect(() => { if (user) fetchLeagues(); }, [user]);

  async function fetchLeagues() {
    const { data: all } = await supabase
      .from('ttt_leagues')
      .select('*, ttt_league_members(count)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (all) setLeagues(all);

    const { data: myMems } = await supabase
      .from('ttt_league_members')
      .select('league_id')
      .eq('user_id', user.id);
    if (myMems && all) {
      const myIds = new Set(myMems.map(m => m.league_id));
      setMyLeagues(all.filter(l => myIds.has(l.id)));
    }
  }

  async function joinByCode(code) {
    setJoinError('');
    const { data: league } = await supabase
      .from('ttt_leagues')
      .select('*')
      .eq('invite_code', code)
      .eq('is_active', true)
      .single();

    if (!league) { setJoinError('Invalid invite code'); return; }

    const { data: existing } = await supabase
      .from('ttt_league_members')
      .select('id')
      .eq('league_id', league.id)
      .eq('user_id', user.id)
      .single();
    if (existing) { setSelectedLeague(league); setView('detail'); return; }

    // Check qualifier requirements
    if (hasQualifiers(league)) {
      const { data: pStats } = await supabase
        .from('ttt_player_stats')
        .select('*')
        .eq('user_id', user.id);
      const { qualified, results } = checkQualifiers(league, pStats || []);
      if (!qualified) {
        const failed = results.filter(r => !r.met).map(r => `${r.label}: need ${r.required}, you have ${r.actual}`).join('; ');
        setJoinError(`You don't meet the entry requirements: ${failed}`);
        return;
      }
    }

    const { error } = await supabase.from('ttt_league_members').insert({
      league_id: league.id,
      user_id: user.id,
      role: 'member',
    });
    if (error) { setJoinError(error.message); return; }

    fetchLeagues();
    setSelectedLeague(league);
    setView('detail');
  }

  function viewLeague(league) {
    setSelectedLeague(league);
    setView('detail');
  }

  if (!user) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: 'var(--ac)', marginBottom: 10 }}>Leagues</div>
      <div style={{ fontSize: 11, color: 'var(--mu)', letterSpacing: 1.5 }}>Sign in to create or join leagues.</div>
    </div>
  );

  async function refreshSelectedLeague() {
    await fetchLeagues();
    if (selectedLeague) {
      const { data: fresh } = await supabase
        .from('ttt_leagues')
        .select('*, ttt_league_members(count)')
        .eq('id', selectedLeague.id)
        .single();
      if (fresh) setSelectedLeague(fresh);
    }
  }

  if (view === 'create') return <CreateLeague onBack={() => setView('list')} onCreated={(l) => { fetchLeagues(); setSelectedLeague(l); setView('detail'); }} />;
  if (view === 'detail' && selectedLeague) return (
    <LeagueDetail
      key={selectedLeague.id}
      league={selectedLeague}
      onBack={() => { setView('list'); fetchLeagues(); }}
      onRefresh={refreshSelectedLeague}
      onPlayLeagueMatch={onPlayLeagueMatch}
      onDeleted={() => { setSelectedLeague(null); setView('list'); fetchLeagues(); }}
    />
  );

  return (
    <div>
      {joinError && <div style={{ background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.25)', color: 'var(--rd)', fontSize: 11, padding: '10px 12px', marginBottom: 12 }}>{joinError}</div>}
      <LeagueList
        leagues={leagues}
        myLeagues={myLeagues}
        onSelect={viewLeague}
        onCreate={() => setView('create')}
        onJoinCode={joinByCode}
      />
    </div>
  );
}
