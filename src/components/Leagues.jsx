import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { getRankBadge, score as calcScore } from '../lib/gameLogic';

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ── League List ──────────────────────────────────────────
function LeagueList({ leagues, myLeagues, onSelect, onCreate, onJoinCode }) {
  const [code, setCode] = useState('');
  const [tab, setTab] = useState('my');

  const shown = tab === 'my' ? myLeagues : leagues.filter(l => l.is_public);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 30, letterSpacing: 2, color: 'var(--ac)' }}>Leagues</div>
        <button className="savebtn" onClick={onCreate}>+ Create League</button>
      </div>

      {/* Join by code */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="INVITE CODE"
          style={{ flex: 1, maxWidth: 200, background: 'var(--s2)', border: '1px solid var(--bd)', color: 'var(--tx)', fontFamily: "'DM Mono',monospace", fontSize: 12, padding: '8px 12px', outline: 'none', letterSpacing: 2 }}
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
          }}>{t.label} ({t.id === 'my' ? myLeagues.length : leagues.filter(l => l.is_public).length})</button>
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
                  <span>{l.member_count || 0} members</span>
                  <span>Season {l.season}</span>
                  {l.game_modes && <span style={{ textTransform: 'uppercase' }}>{l.game_modes.join(', ')}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
      const inviteCode = isPublic ? null : generateCode();
      const { data: league, error: insertErr } = await supabase.from('ttt_leagues').insert({
        name: name.trim(),
        description: desc.trim() || null,
        game_mode: modes[0],
        game_modes: modes,
        owner_id: user.id,
        is_public: isPublic,
        invite_code: inviteCode,
        max_members: maxMembers,
      }).select().single();
      if (insertErr) throw insertErr;

      // Add owner as member
      await supabase.from('ttt_league_members').insert({
        league_id: league.id,
        user_id: user.id,
        role: 'owner',
      });

      onCreated(league);
    } catch (err) { setError(err.message || 'Failed to create league'); }
    finally { setSaving(false); }
  }

  const inp = { width: '100%', background: 'var(--s2)', border: '1px solid var(--bd)', color: 'var(--tx)', fontFamily: "'DM Mono',monospace", fontSize: 13, padding: '10px 12px', outline: 'none' };
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
            <input type="number" min={2} max={200} value={maxMembers} onChange={e => setMaxMembers(+e.target.value || 50)} style={inp} />
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

// ── League Detail ────────────────────────────────────────
function LeagueDetail({ league, onBack, onRefresh }) {
  const { user } = useAuth();
  const [tab, setTab] = useState('standings');
  const [members, setMembers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [chat, setChat] = useState([]);
  const [chatMsg, setChatMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [myRole, setMyRole] = useState(null);
  const [leagueStats, setLeagueStats] = useState([]);
  const [standingsMode, setStandingsMode] = useState('overall');
  const chatEndRef = useRef(null);

  useEffect(() => { fetchData(); }, [league.id]);

  useEffect(() => {
    // Subscribe to chat messages
    const channel = supabase.channel(`league-chat-${league.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ttt_league_chat', filter: `league_id=eq.${league.id}` },
        payload => { setChat(prev => [...prev, payload.new]); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [league.id]);

  useEffect(() => {
    if (tab === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat, tab]);

  async function fetchData() {
    // Fetch members with profiles
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

    // Fetch league stats for current season
    const { data: lstats } = await supabase
      .from('ttt_league_stats')
      .select('*')
      .eq('league_id', league.id)
      .eq('season', league.season);
    if (lstats) setLeagueStats(lstats);

    // Fetch league matches
    const { data: mtch } = await supabase
      .from('ttt_matches')
      .select('*, player_x:ttt_profiles!player_x_id(display_name), player_o:ttt_profiles!player_o_id(display_name)')
      .eq('league_id', league.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (mtch) setMatches(mtch);

    // Fetch chat
    const { data: msgs } = await supabase
      .from('ttt_league_chat')
      .select('*, ttt_profiles(display_name)')
      .eq('league_id', league.id)
      .order('created_at')
      .limit(100);
    if (msgs) setChat(msgs);
  }

  async function sendChat() {
    if (!chatMsg.trim() || sending) return;
    setSending(true);
    await supabase.from('ttt_league_chat').insert({
      league_id: league.id,
      user_id: user.id,
      message: chatMsg.trim(),
    });
    setChatMsg('');
    setSending(false);
  }

  async function updateRole(memberId, userId, newRole) {
    await supabase.from('ttt_league_members').update({ role: newRole }).eq('id', memberId);
    fetchData();
  }

  async function removeMember(memberId) {
    await supabase.from('ttt_league_members').delete().eq('id', memberId);
    fetchData();
  }

  async function transferOwnership(memberId, userId) {
    // Update new owner
    await supabase.from('ttt_league_members').update({ role: 'owner' }).eq('id', memberId);
    // Update old owner to manager
    const myMember = members.find(m => m.user_id === user.id);
    if (myMember) await supabase.from('ttt_league_members').update({ role: 'manager' }).eq('id', myMember.id);
    // Update league owner
    await supabase.from('ttt_leagues').update({ owner_id: userId }).eq('id', league.id);
    fetchData();
    onRefresh();
  }

  async function newSeason() {
    await supabase.from('ttt_leagues').update({ season: league.season + 1 }).eq('id', league.id);
    onRefresh();
  }

  const isOwner = myRole === 'owner';
  const isManager = myRole === 'manager' || isOwner;
  const isMember = !!myRole;

  // Build standings from members + league stats
  const standings = members.map(m => {
    const profile = m.ttt_profiles || {};
    const userStats = leagueStats.filter(s => s.user_id === m.user_id);

    // Filter by mode if not "overall"
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

  const tabs = [
    { id: 'standings', label: 'Standings' },
    { id: 'matches', label: 'Matches' },
    { id: 'chat', label: `Chat (${chat.length})` },
    ...(isManager ? [{ id: 'settings', label: 'Settings' }] : []),
  ];

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
              <span>Season {league.season}</span>
              <span>{members.length}/{league.max_members} members</span>
              {league.game_modes && <span style={{ textTransform: 'uppercase' }}>{league.game_modes.join(', ')}</span>}
              {!league.is_public && <span style={{ color: 'var(--hl)' }}>Private</span>}
            </div>
          </div>
          {league.invite_code && isManager && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 3 }}>Invite Code</div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: 4, color: 'var(--hl)', cursor: 'pointer' }}
                onClick={() => navigator.clipboard?.writeText(league.invite_code)} title="Click to copy">
                {league.invite_code}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid var(--bd)', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: 'none', border: 'none', borderBottom: '2px solid ' + (tab === t.id ? 'var(--ac)' : 'transparent'),
            color: tab === t.id ? 'var(--ac)' : 'var(--mu)', fontFamily: "'DM Mono',monospace", fontSize: 10,
            letterSpacing: 2, textTransform: 'uppercase', padding: '8px 14px', cursor: 'pointer', marginBottom: -1, whiteSpace: 'nowrap'
          }}>{t.label}</button>
        ))}
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

        const quals = standings.filter(m => m.gp >= 3).sort((a, b) => b.score - a.score);
        const dnqs = standings.filter(m => m.gp > 0 && m.gp < 3).sort((a, b) => a.display_name.localeCompare(b.display_name));
        const noGames = standings.filter(m => m.gp === 0);
        const maxSc = quals.length > 0 ? quals[0].score : 1;

        return (
          <div>
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
                  <th style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', padding: '10px 12px', textAlign: 'left', width: 40 }}>#</th>
                  <th style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', padding: '10px 12px', textAlign: 'left' }}>Player</th>
                  <th style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', padding: '10px 12px', textAlign: 'right' }}>W</th>
                  <th style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', padding: '10px 12px', textAlign: 'right' }}>L</th>
                  <th style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', padding: '10px 12px', textAlign: 'right' }}>T</th>
                  <th style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', padding: '10px 12px', textAlign: 'right' }}>GP</th>
                  <th style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', padding: '10px 12px', textAlign: 'right' }}>Win%</th>
                  <th style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', padding: '10px 12px', minWidth: 140 }}>Score</th>
                  {isManager && <th></th>}
                </tr></thead>
                <tbody>
                  {quals.length === 0 && (
                    <tr><td colSpan={isManager ? 9 : 8} style={{ textAlign: 'center', color: 'var(--mu)', padding: 32, fontSize: 12, letterSpacing: 2 }}>No qualifying results yet</td></tr>
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
                        {isManager && (
                          <td style={{ padding: '12px 4px' }}>
                            {m.user_id !== user.id && m.role !== 'owner' && (
                              <div style={{ display: 'flex', gap: 4 }}>
                                {isOwner && m.role === 'member' && <button className="smbtn" style={{ fontSize: 8, padding: '3px 6px' }} onClick={() => updateRole(m.id, m.user_id, 'manager')}>Promote</button>}
                                {isOwner && m.role === 'manager' && <button className="smbtn" style={{ fontSize: 8, padding: '3px 6px' }} onClick={() => updateRole(m.id, m.user_id, 'member')}>Demote</button>}
                                <button style={{ background: 'none', border: '1px solid var(--rd)', color: 'var(--rd)', fontFamily: "'DM Mono',monospace", fontSize: 8, padding: '3px 6px', cursor: 'pointer' }}
                                  onClick={() => removeMember(m.id)}>Remove</button>
                              </div>
                            )}
                          </td>
                        )}
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
                  Did Not Qualify
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

            {/* Members with no games */}
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
                        {isManager && m.user_id !== user.id && m.role !== 'owner' && (
                          <button style={{ background: 'none', border: '1px solid var(--rd)', color: 'var(--rd)', fontFamily: "'DM Mono',monospace", fontSize: 8, padding: '2px 5px', cursor: 'pointer' }}
                            onClick={() => removeMember(m.id)}>x</button>
                        )}
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

      {/* Chat Tab */}
      {tab === 'chat' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: 400 }}>
          <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--bd)', padding: 12, marginBottom: 8, background: 'var(--s2)' }}>
            {chat.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 11, letterSpacing: 2, padding: 40 }}>No messages yet. Say hello!</div>
            )}
            {chat.map(msg => {
              const isMe = msg.user_id === user?.id;
              const name = msg.ttt_profiles?.display_name || 'Unknown';
              return (
                <div key={msg.id} style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  <div style={{ fontSize: 9, letterSpacing: 1, color: 'var(--mu)', marginBottom: 2 }}>
                    {name} &middot; {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{
                    maxWidth: '80%', padding: '8px 12px', fontSize: 12, lineHeight: 1.5,
                    background: isMe ? 'rgba(232,255,71,0.08)' : 'var(--sf)',
                    border: '1px solid ' + (isMe ? 'rgba(232,255,71,0.2)' : 'var(--bd)'),
                    color: 'var(--tx)'
                  }}>{msg.message}</div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          {isMember && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} placeholder="Type a message..."
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                style={{ flex: 1, background: 'var(--sf)', border: '1px solid var(--bd)', color: 'var(--tx)', fontFamily: "'DM Mono',monospace", fontSize: 12, padding: '10px 12px', outline: 'none' }} />
              <button className="savebtn" onClick={sendChat} disabled={sending || !chatMsg.trim()} style={{ padding: '10px 16px' }}>Send</button>
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {tab === 'settings' && isManager && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isOwner && (
            <>
              <div style={{ background: 'var(--sf)', border: '1px solid var(--bd)', padding: 20 }}>
                <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', marginBottom: 10 }}>Season Management</div>
                <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 12 }}>Current: Season {league.season}. Starting a new season resets the standings.</div>
                <button className="smbtn" onClick={newSeason}>Start Season {league.season + 1}</button>
              </div>

              <div style={{ background: 'var(--sf)', border: '1px solid var(--bd)', padding: 20 }}>
                <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', marginBottom: 10 }}>Transfer Ownership</div>
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
            </>
          )}

          {isMember && !isOwner && (
            <div style={{ background: 'var(--sf)', border: '1px solid var(--rd)', padding: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--rd)', marginBottom: 10 }}>Leave League</div>
              <button style={{ background: 'none', border: '1px solid var(--rd)', color: 'var(--rd)', fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: 2, padding: '10px 16px', cursor: 'pointer' }}
                onClick={async () => {
                  const me = members.find(m => m.user_id === user.id);
                  if (me) { await removeMember(me.id); onBack(); }
                }}>Leave League</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Leagues Component ───────────────────────────────
export default function Leagues() {
  const { user } = useAuth();
  const [view, setView] = useState('list'); // list, create, detail
  const [leagues, setLeagues] = useState([]);
  const [myLeagues, setMyLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [joinError, setJoinError] = useState('');

  useEffect(() => { if (user) fetchLeagues(); }, [user]);

  async function fetchLeagues() {
    // Fetch all visible leagues
    const { data: all } = await supabase
      .from('ttt_leagues')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (all) setLeagues(all);

    // Fetch my memberships
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

    // Check if already a member
    const { data: existing } = await supabase
      .from('ttt_league_members')
      .select('id')
      .eq('league_id', league.id)
      .eq('user_id', user.id)
      .single();
    if (existing) { setSelectedLeague(league); setView('detail'); return; }

    // Join
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

  async function joinPublic(league) {
    // Check membership
    const { data: existing } = await supabase
      .from('ttt_league_members')
      .select('id')
      .eq('league_id', league.id)
      .eq('user_id', user.id)
      .single();
    if (existing) { setSelectedLeague(league); setView('detail'); return; }

    await supabase.from('ttt_league_members').insert({
      league_id: league.id,
      user_id: user.id,
      role: 'member',
    });
    fetchLeagues();
    setSelectedLeague(league);
    setView('detail');
  }

  if (!user) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: 'var(--ac)', marginBottom: 10 }}>Leagues</div>
      <div style={{ fontSize: 11, color: 'var(--mu)', letterSpacing: 1.5 }}>Sign in to create or join leagues.</div>
    </div>
  );

  if (view === 'create') return <CreateLeague onBack={() => setView('list')} onCreated={(l) => { fetchLeagues(); setSelectedLeague(l); setView('detail'); }} />;
  if (view === 'detail' && selectedLeague) return <LeagueDetail league={selectedLeague} onBack={() => { setView('list'); fetchLeagues(); }} onRefresh={() => { fetchLeagues(); }} />;

  return (
    <div>
      {joinError && <div style={{ background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.25)', color: 'var(--rd)', fontSize: 11, padding: '10px 12px', marginBottom: 12 }}>{joinError}</div>}
      <LeagueList
        leagues={leagues}
        myLeagues={myLeagues}
        onSelect={(l) => { joinPublic(l); }}
        onCreate={() => setView('create')}
        onJoinCode={joinByCode}
      />
    </div>
  );
}
