import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const MODE_COLORS = { classic: 'var(--X)', ultimate: 'var(--O)', mega: 'var(--mega)' };

export default function Rivals() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rivals, setRivals] = useState([]);
  const [pendingIn, setPendingIn] = useState([]);
  const [pendingOut, setPendingOut] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [records, setRecords] = useState({});
  const [searchName, setSearchName] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState('rivals');

  // ── Fetch all rival data ──
  const fetchRivals = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('ttt_rivals')
      .select('*, profile_a:ttt_profiles!user_a_id(id, display_name, username, avatar_url, last_seen_at), profile_b:ttt_profiles!user_b_id(id, display_name, username, avatar_url, last_seen_at)')
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);

    if (!data) return;

    const accepted = [];
    const incoming = [];
    const outgoing = [];

    data.forEach(r => {
      if (r.status === 'accepted') {
        accepted.push(r);
      } else if (r.user_b_id === user.id) {
        incoming.push(r);
      } else {
        outgoing.push(r);
      }
    });

    setRivals(accepted);
    setPendingIn(incoming);
    setPendingOut(outgoing);

    // Fetch W/L/D records for accepted rivals
    if (accepted.length > 0) {
      const rivalIds = accepted.map(r => r.user_a_id === user.id ? r.user_b_id : r.user_a_id);
      const { data: matches } = await supabase
        .from('ttt_matches')
        .select('player_x_id, player_o_id, winner_id, is_draw, rivalry_id')
        .or(`player_x_id.eq.${user.id},player_o_id.eq.${user.id}`)
        .not('rivalry_id', 'is', null);

      if (matches) {
        const rec = {};
        matches.forEach(m => {
          const oppId = m.player_x_id === user.id ? m.player_o_id : m.player_x_id;
          if (!rivalIds.includes(oppId)) return;
          if (!rec[oppId]) rec[oppId] = { wins: 0, losses: 0, draws: 0 };
          if (m.is_draw) rec[oppId].draws++;
          else if (m.winner_id === user.id) rec[oppId].wins++;
          else rec[oppId].losses++;
        });
        setRecords(rec);
      }
    }
  }, [user]);

  const fetchChallenges = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('ttt_rival_challenges')
      .select('*, challenger:ttt_profiles!challenger_id(display_name, username), challenged:ttt_profiles!challenged_id(display_name, username)')
      .or(`challenger_id.eq.${user.id},challenged_id.eq.${user.id}`)
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false });
    if (data) setChallenges(data);
  }, [user]);

  useEffect(() => {
    fetchRivals();
    fetchChallenges();
  }, [fetchRivals, fetchChallenges]);

  // ── Real-time subscriptions ──
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('my-rivals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttt_rivals', filter: `user_a_id=eq.${user.id}` }, () => fetchRivals())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttt_rivals', filter: `user_b_id=eq.${user.id}` }, () => fetchRivals())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttt_rival_challenges', filter: `challenged_id=eq.${user.id}` }, () => fetchChallenges())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ttt_rival_challenges', filter: `challenger_id=eq.${user.id}` }, (payload) => {
        const updated = payload.new;
        // Auto-navigate challenger to the game when their challenge is accepted
        if (updated.status === 'accepted' && updated.game_id) {
          navigate(`/live?rivalryId=${updated.rivalry_id}`);
          return;
        }
        fetchChallenges();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ttt_rival_challenges', filter: `challenger_id=eq.${user.id}` }, () => fetchChallenges())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'ttt_rival_challenges', filter: `challenger_id=eq.${user.id}` }, () => fetchChallenges())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user, fetchRivals, fetchChallenges, navigate]);

  // ── Helper: get rival profile from a rivalry row ──
  function getRivalProfile(rivalry) {
    return rivalry.user_a_id === user.id ? rivalry.profile_b : rivalry.profile_a;
  }
  function getRivalId(rivalry) {
    return rivalry.user_a_id === user.id ? rivalry.user_b_id : rivalry.user_a_id;
  }

  // ── Search for a user by username or display name ──
  async function handleSearch() {
    setSearchError('');
    setSearchResult(null);
    const q = searchName.trim().replace(/^@/, '');
    if (!q) return;

    // Try exact username match first, then prefix match (username#tag), then display name
    let { data } = await supabase
      .from('ttt_profiles')
      .select('id, display_name, username, avatar_url')
      .ilike('username', q)
      .limit(1)
      .single();

    if (!data) {
      // Prefix match: "fizzle" matches "fizzle#87585"
      const { data: prefixData } = await supabase
        .from('ttt_profiles')
        .select('id, display_name, username, avatar_url')
        .ilike('username', `${q}%`)
        .limit(1)
        .single();
      data = prefixData;
    }

    if (!data) {
      // Fallback: search by display name
      const { data: nameData } = await supabase
        .from('ttt_profiles')
        .select('id, display_name, username, avatar_url')
        .ilike('display_name', `%${q}%`)
        .limit(1)
        .single();
      data = nameData;
    }

    if (!data) {
      setSearchError('No player found with that username');
      return;
    }
    if (data.id === user.id) {
      setSearchError("You can't add yourself as a rival");
      return;
    }
    setSearchResult(data);
  }

  // ── Send rival request ──
  async function sendRivalRequest(targetId) {
    setSending(true);
    try {
      const { error } = await supabase.from('ttt_rivals').insert({
        user_a_id: user.id,
        user_b_id: targetId,
        status: 'pending',
      });
      if (error) {
        if (error.code === '23505') setSearchError('A rival request already exists between you two');
        else throw error;
      } else {
        setSearchResult(null);
        setSearchName('');
        fetchRivals();
      }
    } catch (err) {
      setSearchError(err.message);
    }
    setSending(false);
  }

  // ── Accept / Decline rival request ──
  const refreshBadge = () => window.dispatchEvent(new Event('rival-badge-refresh'));

  async function acceptRival(rivalryId) {
    await supabase.from('ttt_rivals').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', rivalryId);
    fetchRivals();
    refreshBadge();
  }
  async function declineRival(rivalryId) {
    await supabase.from('ttt_rivals').delete().eq('id', rivalryId);
    fetchRivals();
    refreshBadge();
  }
  async function removeRival(rivalryId) {
    if (!confirm('Remove this rival? You can always add them again later.')) return;
    await supabase.from('ttt_rivals').delete().eq('id', rivalryId);
    fetchRivals();
  }

  // ── Challenge a rival ──
  const [challengeMode, setChallengeMode] = useState(null); // { rivalryId, rivalId, rivalName }
  async function sendChallenge(mode) {
    if (!challengeMode) return;
    await supabase.from('ttt_rival_challenges').insert({
      rivalry_id: challengeMode.rivalryId,
      challenger_id: user.id,
      challenged_id: challengeMode.rivalId,
      game_mode: mode,
      status: 'pending',
    });
    setChallengeMode(null);
    fetchChallenges();
  }

  // ── Accept a challenge → create game and navigate ──
  async function acceptChallenge(challenge) {
    const isMega = challenge.game_mode === 'mega';
    const isClassic = challenge.game_mode === 'classic';
    const initialBoard = isClassic
      ? { cells: Array(9).fill(null) }
      : isMega
        ? { cells: Array(9).fill(null).map(() => Array(9).fill(null).map(() => Array(9).fill(null))), smallW: Array(9).fill(null).map(() => Array(9).fill(null)), midW: Array(9).fill(null), aMid: null, aSmall: null }
        : { boards: Array(9).fill(null).map(() => Array(9).fill(null)), bWins: Array(9).fill(null), active: null };

    // Acceptor must be player_x_id to satisfy RLS INSERT (auth.uid() = player_x_id)
    const { data: game } = await supabase.from('ttt_live_games').insert({
      game_mode: challenge.game_mode,
      player_x_id: user.id,
      player_o_id: challenge.challenger_id,
      board_state: initialBoard,
      current_turn: 'X',
      status: 'active',
      last_move_at: new Date().toISOString(),
      rivalry_id: challenge.rivalry_id,
      timer_seconds: null,
    }).select().single();

    if (game) {
      await supabase.from('ttt_rival_challenges').update({
        status: 'accepted',
        game_id: game.id,
        responded_at: new Date().toISOString(),
      }).eq('id', challenge.id);

      const rivalName = challenge.challenger?.display_name || 'Rival';
      refreshBadge();
      navigate(`/live?rivalryId=${challenge.rivalry_id}&rivalName=${encodeURIComponent(rivalName)}`);
    }
  }

  async function declineChallenge(challengeId) {
    await supabase.from('ttt_rival_challenges').update({
      status: 'declined',
      responded_at: new Date().toISOString(),
    }).eq('id', challengeId);
    fetchChallenges();
    refreshBadge();
  }

  async function cancelChallenge(challengeId) {
    await supabase.from('ttt_rival_challenges').delete().eq('id', challengeId);
    fetchChallenges();
    refreshBadge();
  }

  // ── Online status helper: online if last_seen_at within 3 minutes ──
  function isOnline(lastSeenAt) {
    if (!lastSeenAt) return false;
    return Date.now() - new Date(lastSeenAt).getTime() < 3 * 60 * 1000;
  }

  const onlineDotSt = (online) => ({
    width: 10, height: 10, borderRadius: '50%',
    background: online ? '#22c55e' : 'var(--s3)',
    border: '2px solid var(--bg)',
    position: 'absolute', bottom: 0, right: 0,
    boxShadow: online ? '0 0 6px rgba(34,197,94,0.5)' : 'none',
  });

  // ── Styles ──
  const sectionLabelSt = { fontSize: 10, letterSpacing: 3, color: 'var(--ac)', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 };
  const cardSt = { background: 'var(--sf)', border: '1px solid var(--bd)', padding: '16px 20px' };
  const tabStyle = (t) => ({
    background: 'none', border: 'none',
    borderBottom: '2px solid ' + (tab === t ? 'var(--ac)' : 'transparent'),
    color: tab === t ? 'var(--ac)' : 'var(--mu)',
    fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 2,
    textTransform: 'uppercase', padding: '8px 14px', cursor: 'pointer', marginBottom: -1
  });

  const totalPending = pendingIn.length + challenges.filter(c => c.challenged_id === user.id && c.status === 'pending').length;

  // ── Build leaderboard data ──
  const leaderboard = rivals.map(r => {
    const rId = getRivalId(r);
    const rProfile = getRivalProfile(r);
    const rec = records[rId] || { wins: 0, losses: 0, draws: 0 };
    const total = rec.wins + rec.losses + rec.draws;
    const wpct = total > 0 ? ((rec.wins + rec.draws * 0.5) / total * 100) : 0;
    return { ...rec, total, wpct, profile: rProfile, rivalId: rId, rivalry: r };
  }).sort((a, b) => b.wpct - a.wpct || b.total - a.total);

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, letterSpacing: 2, color: 'var(--ac)', marginBottom: 6 }}>
        Rivals
      </div>
      <div style={{ fontSize: 11, color: 'var(--mu)', letterSpacing: 1.5, marginBottom: 24 }}>
        Challenge your rivals to untimed matches and track your record.
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '2px solid var(--bd)' }}>
        <button onClick={() => setTab('rivals')} style={tabStyle('rivals')}>
          Rivals {rivals.length > 0 && `(${rivals.length})`}
        </button>
        <button onClick={() => setTab('pending')} style={tabStyle('pending')}>
          Pending {totalPending > 0 && <span style={{ color: 'var(--rd)', marginLeft: 4 }}>({totalPending})</span>}
        </button>
        <button onClick={() => setTab('leaderboard')} style={tabStyle('leaderboard')}>Leaderboard</button>
      </div>

      {/* ── RIVALS TAB ── */}
      {tab === 'rivals' && (
        <>
          {/* Invite by Username */}
          <div style={{ ...cardSt, borderTop: '3px solid var(--ac)', marginBottom: 24 }}>
            <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', marginBottom: 12 }}>Invite a Rival</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: searchResult || searchError ? 12 : 0 }}>
              <input
                value={searchName}
                onChange={e => { setSearchName(e.target.value); setSearchError(''); setSearchResult(null); }}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Enter username (e.g. player#12345)"
                style={{
                  flex: 1, background: 'var(--s2)', border: '1px solid var(--bd)', color: 'var(--tx)',
                  fontFamily: "'DM Mono',monospace", fontSize: 12, padding: '9px 12px', outline: 'none'
                }}
              />
              <button className="savebtn" style={{ padding: '8px 18px' }} onClick={handleSearch}>Search</button>
            </div>
            {searchError && <div style={{ fontSize: 11, color: 'var(--rd)', letterSpacing: 1 }}>{searchError}</div>}
            {searchResult && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--s2)', border: '1px solid var(--bd)' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: 'var(--s2)', border: '1px solid var(--bd)',
                  overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {searchResult.avatar_url
                    ? <img src={searchResult.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, color: 'var(--mu)' }}>{(searchResult.display_name || '?')[0]}</span>
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{searchResult.display_name}</div>
                  <div style={{ fontSize: 10, color: 'var(--mu)', fontFamily: "'DM Mono',monospace" }}>@{searchResult.username}</div>
                </div>
                <button className="savebtn" style={{ padding: '6px 16px' }} onClick={() => sendRivalRequest(searchResult.id)} disabled={sending}>
                  {sending ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            )}
          </div>

          {/* Active Challenges */}
          {challenges.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={sectionLabelSt}>
                Active Challenges
                <span style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {challenges.map(c => {
                  const isIncoming = c.challenged_id === user.id;
                  const otherName = isIncoming ? c.challenger?.display_name : c.challenged?.display_name;
                  const isAccepted = c.status === 'accepted' && c.game_id;
                  return (
                    <div key={c.id} style={{
                      ...cardSt, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                      ...(isAccepted ? { borderColor: 'var(--gn)', borderLeft: '3px solid var(--gn)' } : {})
                    }}>
                      <span style={{
                        fontSize: 9, letterSpacing: 2, padding: '3px 8px', fontWeight: 600,
                        color: isAccepted ? 'var(--gn)' : isIncoming ? 'var(--go)' : 'var(--hl)',
                        border: '1px solid ' + (isAccepted ? 'rgba(34,197,94,0.3)' : isIncoming ? 'rgba(255,200,71,0.3)' : 'rgba(168,85,247,0.3)'),
                      }}>
                        {isAccepted ? 'GAME READY' : isIncoming ? 'INCOMING' : 'SENT'}
                      </span>
                      <span style={{ fontWeight: 500 }}>{otherName}</span>
                      <span style={{ fontSize: 10, color: MODE_COLORS[c.game_mode], letterSpacing: 1, textTransform: 'uppercase' }}>{c.game_mode}</span>
                      <span style={{ flex: 1 }} />
                      {isAccepted ? (
                        <button className="savebtn" style={{ padding: '5px 16px', background: 'var(--gn)', borderColor: 'var(--gn)', color: '#000' }}
                          onClick={() => navigate(`/live?rivalryId=${c.rivalry_id}`)}>
                          Join Game
                        </button>
                      ) : isIncoming ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="savebtn" style={{ padding: '5px 14px' }} onClick={() => acceptChallenge(c)}>Accept</button>
                          <button className="smbtn" onClick={() => declineChallenge(c.id)}>Decline</button>
                        </div>
                      ) : (
                        <button className="smbtn" onClick={() => cancelChallenge(c.id)}>Cancel</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rivals List */}
          <div style={sectionLabelSt}>
            Your Rivals
            <span style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
          </div>
          {rivals.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 11, letterSpacing: 2, padding: 30, border: '1px dashed var(--bd)' }}>
              No rivals yet. Search for a player above or add a rival after a public match.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rivals.map(r => {
                const rProfile = getRivalProfile(r);
                const rId = getRivalId(r);
                const rec = records[rId] || { wins: 0, losses: 0, draws: 0 };
                const total = rec.wins + rec.losses + rec.draws;

                const online = isOnline(rProfile?.last_seen_at);
                return (
                  <div key={r.id} style={{ ...cardSt, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%', background: 'var(--s2)', border: '1px solid var(--bd)',
                        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {rProfile?.avatar_url
                          ? <img src={rProfile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, color: 'var(--mu)' }}>{(rProfile?.display_name || '?')[0]}</span>
                        }
                      </div>
                      <div style={onlineDotSt(online)} title={online ? 'Online' : 'Offline'} />
                    </div>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{rProfile?.display_name}</div>
                      <div style={{ fontSize: 10, color: 'var(--mu)', fontFamily: "'DM Mono',monospace" }}>@{rProfile?.username}</div>
                    </div>
                    {/* W/L/D inline */}
                    <div style={{ display: 'flex', gap: 8, fontSize: 12, fontFamily: "'Bebas Neue',sans-serif" }}>
                      <span style={{ color: 'var(--gn)' }}>{rec.wins}W</span>
                      <span style={{ color: 'var(--rd)' }}>{rec.losses}L</span>
                      <span style={{ color: 'var(--a3)' }}>{rec.draws}D</span>
                      {total > 0 && <span style={{ color: 'var(--mu)', fontSize: 10, alignSelf: 'center' }}>({total})</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="savebtn" style={{ padding: '5px 14px', fontSize: 10 }}
                        onClick={() => setChallengeMode({ rivalryId: r.id, rivalId: rId, rivalName: rProfile?.display_name })}>
                        Challenge
                      </button>
                      <button className="smbtn" style={{ fontSize: 10 }}
                        onClick={() => navigate(`/player/${encodeURIComponent(rProfile?.username)}`)}>
                        Profile
                      </button>
                      <button className="smbtn" style={{ fontSize: 10, color: 'var(--rd)' }}
                        onClick={() => removeRival(r.id)}>
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── PENDING TAB ── */}
      {tab === 'pending' && (
        <>
          {/* Incoming requests */}
          <div style={sectionLabelSt}>
            Incoming Requests
            <span style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
          </div>
          {pendingIn.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 11, letterSpacing: 2, padding: 20, border: '1px dashed var(--bd)', marginBottom: 24 }}>
              No incoming requests.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {pendingIn.map(r => {
                const from = r.profile_a;
                return (
                  <div key={r.id} style={{ ...cardSt, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', background: 'var(--s2)', border: '1px solid var(--bd)',
                      overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {from?.avatar_url
                        ? <img src={from.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, color: 'var(--mu)' }}>{(from?.display_name || '?')[0]}</span>
                      }
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{from?.display_name}</div>
                      <div style={{ fontSize: 10, color: 'var(--mu)', fontFamily: "'DM Mono',monospace" }}>@{from?.username}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="savebtn" style={{ padding: '5px 14px' }} onClick={() => acceptRival(r.id)}>Accept</button>
                      <button className="smbtn" onClick={() => declineRival(r.id)}>Decline</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Outgoing requests */}
          <div style={sectionLabelSt}>
            Sent Requests
            <span style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
          </div>
          {pendingOut.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 11, letterSpacing: 2, padding: 20, border: '1px dashed var(--bd)' }}>
              No outgoing requests.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingOut.map(r => {
                const to = r.profile_b;
                return (
                  <div key={r.id} style={{ ...cardSt, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 500 }}>{to?.display_name}</span>
                      <span style={{ fontSize: 10, color: 'var(--mu)', fontFamily: "'DM Mono',monospace", marginLeft: 8 }}>@{to?.username}</span>
                    </div>
                    <span style={{ fontSize: 9, letterSpacing: 2, color: 'var(--go)', textTransform: 'uppercase' }}>Pending</span>
                    <button className="smbtn" style={{ fontSize: 10 }} onClick={() => declineRival(r.id)}>Cancel</button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── LEADERBOARD TAB ── */}
      {tab === 'leaderboard' && (
        <>
          <div style={sectionLabelSt}>
            Rival Leaderboard
            <span style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
          </div>
          {leaderboard.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 11, letterSpacing: 2, padding: 30, border: '1px dashed var(--bd)' }}>
              Add rivals and play matches to build your leaderboard.
            </div>
          ) : (
            <div>
              {/* Header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '30px 1fr 50px 50px 50px 60px 50px',
                gap: 8, padding: '8px 14px', fontSize: 9, letterSpacing: 2, color: 'var(--mu)',
                textTransform: 'uppercase', borderBottom: '1px solid var(--bd)'
              }}>
                <span>#</span><span>Rival</span><span style={{ textAlign: 'center' }}>W</span>
                <span style={{ textAlign: 'center' }}>L</span><span style={{ textAlign: 'center' }}>D</span>
                <span style={{ textAlign: 'center' }}>Win%</span><span style={{ textAlign: 'center' }}>GP</span>
              </div>
              {leaderboard.map((row, i) => (
                <div key={row.rivalId} style={{
                  display: 'grid', gridTemplateColumns: '30px 1fr 50px 50px 50px 60px 50px',
                  gap: 8, padding: '10px 14px', alignItems: 'center',
                  background: i % 2 === 0 ? 'var(--sf)' : 'transparent',
                  borderBottom: '1px solid var(--s2)'
                }}>
                  <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, color: i === 0 ? 'var(--ac)' : 'var(--mu)' }}>{i + 1}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: isOnline(row.profile?.last_seen_at) ? '#22c55e' : 'var(--s3)', flexShrink: 0 }} />
                    <span style={{ fontWeight: 500, fontSize: 13, cursor: 'pointer' }}
                      onClick={() => navigate(`/player/${encodeURIComponent(row.profile?.username)}`)}>
                      {row.profile?.display_name}
                    </span>
                  </div>
                  <span style={{ textAlign: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, color: 'var(--gn)' }}>{row.wins}</span>
                  <span style={{ textAlign: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, color: 'var(--rd)' }}>{row.losses}</span>
                  <span style={{ textAlign: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, color: 'var(--a3)' }}>{row.draws}</span>
                  <span style={{ textAlign: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, color: 'var(--ac)' }}>
                    {row.total > 0 ? row.wpct.toFixed(0) + '%' : '—'}
                  </span>
                  <span style={{ textAlign: 'center', fontSize: 11, color: 'var(--mu)' }}>{row.total}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Challenge Mode Selector Modal ── */}
      {challengeMode && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(8,8,14,0.85)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setChallengeMode(null)}>
          <div style={{
            background: 'var(--bg)', border: '1px solid var(--bd)', borderTop: '3px solid var(--ac)',
            padding: 30, maxWidth: 360, width: '90%'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, letterSpacing: 2, marginBottom: 4 }}>
              Challenge {challengeMode.rivalName}
            </div>
            <div style={{ fontSize: 10, color: 'var(--mu)', letterSpacing: 1.5, marginBottom: 20 }}>
              Select game mode — rival matches have no timer
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['classic', 'ultimate', 'mega'].map(m => (
                <button key={m} className="savebtn" onClick={() => sendChallenge(m)} style={{
                  padding: '12px 20px', borderColor: MODE_COLORS[m], color: MODE_COLORS[m],
                  background: 'var(--s2)', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase'
                }}>
                  {m}
                </button>
              ))}
              <button className="smbtn" onClick={() => setChallengeMode(null)} style={{ marginTop: 4 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
