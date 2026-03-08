import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { getRankBadge } from '../lib/gameLogic';
import { checkNickname } from '../lib/profanityFilter';
import TrophyCase from './trophy/TrophyCase';

const MODES = [
  { id: 'classic', label: 'Classic', color: 'var(--X)' },
  { id: 'ultimate', label: 'Ultimate', color: 'var(--O)' },
  { id: 'mega', label: 'MEGA', color: 'var(--mega)' },
];

function StatCard({ stat, mode, rank }) {
  const gp = stat.wins + stat.losses + stat.draws;
  const badge = gp > 0 ? getRankBadge(stat.elo_rating) : null;
  const wpct = gp > 0 ? ((stat.wins + stat.draws * 0.5) / gp * 100).toFixed(1) : '0.0';

  return (
    <div style={{
      background: 'var(--sf)', border: '1px solid var(--bd)',
      borderTop: `3px solid ${mode.color}`, padding: 20
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', marginBottom: 4 }}>{mode.label}</div>
          {gp > 0 ? (
            <>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 36, color: mode.color, lineHeight: 1 }}>{stat.elo_rating}</div>
              <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--mu)', textTransform: 'uppercase', marginTop: 2 }}>Rating</div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: 'var(--mu)', lineHeight: 1, opacity: 0.5 }}>&mdash;</div>
              <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--mu)', textTransform: 'uppercase', marginTop: 2 }}>Unranked</div>
            </>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {badge && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 999
            }}>
              <span style={{ fontSize: 14, color: badge.color }}>{badge.icon}</span>
              <span style={{ fontSize: 10, letterSpacing: 2, color: badge.color, fontFamily: "'DM Mono',monospace", textTransform: 'uppercase' }}>{badge.name}</span>
            </div>
          )}
          {rank && gp > 0 && (
            <div style={{
              padding: '3px 10px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 999,
              fontSize: 10, letterSpacing: 1.5, color: mode.color, fontFamily: "'DM Mono',monospace",
            }}>
              #{rank.rank} <span style={{ color: 'var(--mu)', fontSize: 9 }}>of {rank.total}</span>
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 1, marginBottom: 12 }}>
        {[
          { v: stat.wins, l: 'W', c: 'var(--gn)' },
          { v: stat.losses, l: 'L', c: 'var(--rd)' },
          { v: stat.draws, l: 'D', c: 'var(--a3)' },
        ].map(s => (
          <div key={s.l} style={{ flex: 1, textAlign: 'center', padding: '10px 4px', background: 'var(--s2)' }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--mu)', textTransform: 'uppercase' }}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--mu)' }}>
        <span>{gp} games played</span>
        <span>{wpct}% win rate</span>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, profile, updateProfile, fetchProfile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState([]);
  const [ranks, setRanks] = useState({});
  const [matches, setMatches] = useState([]);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [matchTab, setMatchTab] = useState('all');
  const [profileTab, setProfileTab] = useState('stats');
  const fileRef = useRef(null);
  const [rivals, setRivals] = useState([]);
  const [pendingIncoming, setPendingIncoming] = useState([]);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('ttt_player_stats')
      .select('*')
      .eq('user_id', user.id);
    if (data) setStats(data);
  }, [user]);

  const fetchRanks = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.rpc('get_player_ranks', { p_user_id: user.id });
    if (data) {
      const r = {};
      data.forEach(d => {
        r[d.game_mode] = { rank: d.rank, total: d.total_players, elo: d.elo_rating };
      });
      setRanks(r);
    }
  }, [user]);

  const fetchMatches = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('ttt_matches')
      .select('*')
      .or(`player_x_id.eq.${user.id},player_o_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setMatches(data);
  }, [user]);

  const fetchRivals = useCallback(async () => {
    if (!user) return;
    // Fetch accepted rivals
    const { data: accepted } = await supabase
      .from('ttt_rivals')
      .select('*, user_a:ttt_profiles!user_a_id(id,display_name,username,avatar_url,last_seen_at), user_b:ttt_profiles!user_b_id(id,display_name,username,avatar_url,last_seen_at)')
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .eq('status', 'accepted')
      .order('accepted_at', { ascending: false });

    if (accepted) {
      // Compute W/L/D for each rival
      const rivalList = await Promise.all(accepted.map(async (r) => {
        const rival = r.user_a_id === user.id ? r.user_b : r.user_a;
        const { data: matchData } = await supabase
          .from('ttt_matches')
          .select('winner_id, is_draw')
          .eq('rivalry_id', r.id);
        let w = 0, l = 0, d = 0;
        (matchData || []).forEach(m => {
          if (m.is_draw) d++;
          else if (m.winner_id === user.id) w++;
          else l++;
        });
        return { ...r, rival, w, l, d };
      }));
      setRivals(rivalList);
    }

    // Fetch pending incoming requests
    const { data: pending } = await supabase
      .from('ttt_rivals')
      .select('*, user_a:ttt_profiles!user_a_id(id,display_name,username,avatar_url)')
      .eq('user_b_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (pending) setPendingIncoming(pending);
  }, [user]);

  async function acceptRival(rivalId) {
    await supabase.from('ttt_rivals').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', rivalId);
    fetchRivals();
    window.dispatchEvent(new Event('rival-badge-refresh'));
  }

  async function declineRival(rivalId) {
    await supabase.from('ttt_rivals').delete().eq('id', rivalId);
    fetchRivals();
    window.dispatchEvent(new Event('rival-badge-refresh'));
  }

  useEffect(() => {
    if (!user) return;
    fetchStats();
    fetchMatches();
    fetchRanks();
    fetchRivals();
  }, [user, fetchStats, fetchMatches, fetchRanks, fetchRivals]);

  // Real-time subscription for rivals updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('profile-rivals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttt_rivals', filter: `user_a_id=eq.${user.id}` }, () => fetchRivals())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttt_rivals', filter: `user_b_id=eq.${user.id}` }, () => fetchRivals())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user, fetchRivals]);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setNickname(profile.nickname || '');
    }
  }, [profile]);

  async function handleSave() {
    setError(''); setSaving(true);
    try {
      if (!firstName.trim()) { setError('First name is required'); setSaving(false); return; }
      const fn = firstName.trim();
      const ln = lastName.trim();
      const nick = nickname.trim();
      // Profanity check on nickname
      if (nick) {
        const check = checkNickname(nick);
        if (check.blocked) { setError(check.reason); setSaving(false); return; }
        if (!/^[a-zA-Z0-9_]+$/.test(nick)) { setError('Nickname can only contain letters, numbers, and underscores'); setSaving(false); return; }
      }
      const displayName = [fn, ln].filter(Boolean).join(' ');
      // Update username when nickname changes (keep same tag)
      const updates = { first_name: fn, last_name: ln || null, nickname: nick || null, display_name: displayName };
      if (nick && profile.username) {
        const tag = profile.username.split('#')[1];
        if (tag) updates.username = nick.toLowerCase() + '#' + tag;
      }
      await updateProfile(updates);
      setEditing(false);
    } catch (err) {
      setError(err.message || 'Failed to save');
    } finally { setSaving(false); }
  }

  async function handleAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('Max file size is 2MB'); return; }
    setUploading(true); setError('');
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('ttt-avatars')
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage
        .from('ttt-avatars')
        .getPublicUrl(path);
      await updateProfile({ avatar_url: publicUrl + '?t=' + Date.now() });
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally { setUploading(false); }
  }

  if (!user || !profile) return null;

  const getStat = (mode) => stats.find(s => s.game_mode === mode) || { elo_rating: 1200, wins: 0, losses: 0, draws: 0 };
  const filteredMatches = matchTab === 'all' ? matches : matches.filter(m => m.game_mode === matchTab);

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      {/* Profile Header */}
      <div style={{
        background: 'var(--sf)', border: '1px solid var(--bd)', borderTop: '3px solid var(--ac)',
        padding: 28, marginBottom: 24, display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap'
      }}>
        <div style={{ position: 'relative' }}>
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              width: 80, height: 80, borderRadius: '50%', overflow: 'hidden',
              background: 'var(--s2)', border: '2px solid var(--bd)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, color: 'var(--mu)' }}>
                {(profile.display_name || '?')[0].toUpperCase()}
              </span>
            )}
          </div>
          {uploading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 9, color: 'var(--ac)' }}>...</span>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} style={{ display: 'none' }} />
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: 3 }}>First Name *</label>
                  <input value={firstName} onChange={e => setFirstName(e.target.value)} style={{
                    width: '100%', background: 'var(--s2)', border: '1px solid var(--bd)', color: 'var(--tx)',
                    fontFamily: "'DM Mono',monospace", fontSize: 13, padding: '8px 10px', outline: 'none', boxSizing: 'border-box'
                  }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: 3 }}>Last Name</label>
                  <input value={lastName} onChange={e => setLastName(e.target.value)} style={{
                    width: '100%', background: 'var(--s2)', border: '1px solid var(--bd)', color: 'var(--tx)',
                    fontFamily: "'DM Mono',monospace", fontSize: 13, padding: '8px 10px', outline: 'none', boxSizing: 'border-box'
                  }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: 3 }}>Nickname</label>
                <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Your arena name" style={{
                  width: '100%', background: 'var(--s2)', border: '1px solid var(--bd)', color: 'var(--tx)',
                  fontFamily: "'DM Mono',monospace", fontSize: 13, padding: '8px 10px', outline: 'none', boxSizing: 'border-box'
                }} />
              </div>
              {profile.username && (
                <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'var(--mu)', fontFamily: "'DM Mono',monospace" }}>
                  Username: <span style={{ color: 'var(--hl)' }}>{profile.username}</span>
                </div>
              )}
              {error && <div style={{ fontSize: 11, color: 'var(--rd)' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="savebtn" style={{ padding: '7px 16px' }} onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="smbtn" onClick={() => { setEditing(false); setError(''); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 30, letterSpacing: 2 }}>{profile.display_name}</div>
              {profile.username && (
                <div style={{ fontSize: 11, color: 'var(--mu)', fontFamily: "'DM Mono',monospace" }}>@{profile.username}</div>
              )}
              {ranks.overall && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  marginTop: 8, padding: '6px 14px', background: 'var(--s2)',
                  border: '1px solid var(--bd)', borderRadius: 999,
                }}>
                  <span style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--mu)' }}>Overall Rank</span>
                  <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: 'var(--ac)', lineHeight: 1 }}>
                    #{ranks.overall.rank}
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--mu)', letterSpacing: 1 }}>of {ranks.overall.total}</span>
                </div>
              )}
              <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 6 }}>
                Member since {new Date(profile.created_at).toLocaleDateString()}
              </div>
              <button className="smbtn" style={{ marginTop: 10 }} onClick={() => setEditing(true)}>Edit Profile</button>
            </>
          )}
        </div>
      </div>

      {/* Profile Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid var(--bd)', overflowX: 'auto' }}>
        {[
          { id: 'stats', label: 'Stats' },
          { id: 'trophies', label: 'Trophy Case' },
          { id: 'rivals', label: 'Rivals' },
          { id: 'history', label: 'Match History' },
        ].map(t => (
          <button key={t.id} onClick={() => setProfileTab(t.id)} style={{
            background: 'none', border: 'none',
            borderBottom: '2px solid ' + (profileTab === t.id ? 'var(--ac)' : 'transparent'),
            color: profileTab === t.id ? 'var(--ac)' : 'var(--mu)',
            fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 2,
            textTransform: 'uppercase', padding: '8px 14px', cursor: 'pointer', marginBottom: -1, whiteSpace: 'nowrap'
          }}>{t.label}{t.id === 'rivals' && pendingIncoming.length > 0 && (
            <span style={{ marginLeft: 6, color: 'var(--hl)' }}>({pendingIncoming.length})</span>
          )}</button>
        ))}
      </div>

      {/* Stats Tab */}
      {profileTab === 'stats' && (
        <>
          <div style={{ fontSize: 10, letterSpacing: 3, color: 'var(--ac)', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            Stats by Mode
            <span style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {MODES.map(m => <StatCard key={m.id} stat={getStat(m.id)} mode={m} rank={ranks[m.id]} />)}
          </div>
        </>
      )}

      {/* Trophy Case Tab */}
      {profileTab === 'trophies' && (
        <TrophyCase userId={user.id} isOwn={true} />
      )}

      {/* Rivals Tab */}
      {profileTab === 'rivals' && (
        <>
          <div style={{ fontSize: 10, letterSpacing: 3, color: 'var(--a3)', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            My Rivals
            <span style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
            <Link to="/rivals" style={{ fontSize: 9, color: 'var(--a3)', letterSpacing: 2, textDecoration: 'none' }}>VIEW ALL</Link>
          </div>

          {/* Pending incoming rival requests */}
          {pendingIncoming.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--hl)', textTransform: 'uppercase', marginBottom: 8 }}>
                Pending Requests ({pendingIncoming.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pendingIncoming.map(req => (
                  <div key={req.id} style={{
                    background: 'var(--sf)', border: '1px solid var(--bd)', padding: '10px 16px',
                    display: 'flex', alignItems: 'center', gap: 12
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', overflow: 'hidden',
                      background: 'var(--s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      {req.user_a?.avatar_url ? (
                        <img src={req.user_a.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: 14, color: 'var(--mu)' }}>{(req.user_a?.display_name || '?')[0].toUpperCase()}</span>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: 12 }}>{req.user_a?.display_name}</div>
                      {req.user_a?.username && <div style={{ fontSize: 9, color: 'var(--mu)', fontFamily: "'DM Mono',monospace" }}>@{req.user_a.username}</div>}
                    </div>
                    <button className="savebtn" style={{ padding: '4px 12px', fontSize: 10 }} onClick={() => acceptRival(req.id)}>Accept</button>
                    <button className="smbtn" style={{ padding: '4px 10px', fontSize: 10 }} onClick={() => declineRival(req.id)}>Decline</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rivals.length === 0 && pendingIncoming.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 11, letterSpacing: 2, padding: 30, border: '1px dashed var(--bd)' }}>
              No rivals yet. <Link to="/rivals" style={{ color: 'var(--a3)', textDecoration: 'none' }}>Find rivals</Link> to challenge!
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {rivals.slice(0, 6).map(r => {
                const gp = r.w + r.l + r.d;
                return (
                  <div key={r.id} style={{
                    background: 'var(--sf)', border: '1px solid var(--bd)', padding: 16,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8
                  }}>
                    <div style={{ position: 'relative' }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%', overflow: 'hidden',
                        background: 'var(--s2)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {r.rival?.avatar_url ? (
                          <img src={r.rival.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 18, color: 'var(--mu)' }}>{(r.rival?.display_name || '?')[0].toUpperCase()}</span>
                        )}
                      </div>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: r.rival?.last_seen_at && (Date.now() - new Date(r.rival.last_seen_at).getTime() < 3 * 60 * 1000) ? '#22c55e' : 'var(--s3)',
                        border: '2px solid var(--sf)', position: 'absolute', bottom: 0, right: 0,
                        boxShadow: r.rival?.last_seen_at && (Date.now() - new Date(r.rival.last_seen_at).getTime() < 3 * 60 * 1000) ? '0 0 6px rgba(34,197,94,0.5)' : 'none',
                      }} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 500, fontSize: 12, lineHeight: 1.2 }}>{r.rival?.display_name}</div>
                      {r.rival?.username && <div style={{ fontSize: 9, color: 'var(--mu)', fontFamily: "'DM Mono',monospace" }}>@{r.rival.username}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, fontSize: 11, fontFamily: "'DM Mono',monospace" }}>
                      <span style={{ color: 'var(--gn)' }}>{r.w}W</span>
                      <span style={{ color: 'var(--rd)' }}>{r.l}L</span>
                      <span style={{ color: 'var(--a3)' }}>{r.d}D</span>
                    </div>
                    <button className="smbtn" style={{ padding: '4px 12px', fontSize: 9, borderColor: 'var(--a3)', color: 'var(--a3)' }}
                      onClick={() => navigate(`/live?rivalryId=${r.id}&rivalName=${encodeURIComponent(r.rival?.display_name || 'Rival')}`)}>
                      Challenge
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Match History Tab */}
      {profileTab === 'history' && (
        <>
          <div style={{ fontSize: 10, letterSpacing: 3, color: 'var(--ac)', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            Match History
            <span style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
          </div>
          <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '1px solid var(--bd)' }}>
            {[{ id: 'all', label: 'All' }, ...MODES].map(t => (
              <button key={t.id} onClick={() => setMatchTab(t.id)} style={{
                background: 'none', border: 'none',
                borderBottom: '2px solid ' + (matchTab === t.id ? 'var(--ac)' : 'transparent'),
                color: matchTab === t.id ? 'var(--ac)' : 'var(--mu)',
                fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 2,
                textTransform: 'uppercase', padding: '8px 12px', cursor: 'pointer', marginBottom: -1
              }}>{t.label}</button>
            ))}
          </div>

          {filteredMatches.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 11, letterSpacing: 2, padding: 30, border: '1px dashed var(--bd)' }}>
              No matches recorded yet. Play ranked games to build your history.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filteredMatches.map(m => {
                const isX = m.player_x_id === user.id;
                const won = m.winner_id === user.id;
                const draw = m.is_draw;
                const eloChange = isX ? m.elo_change_x : m.elo_change_o;
                const modeColor = m.game_mode === 'classic' ? 'var(--X)' : m.game_mode === 'ultimate' ? 'var(--O)' : 'var(--mega)';

                return (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                    background: 'var(--sf)', border: '1px solid var(--bd)', fontSize: 12
                  }}>
                    <span style={{
                      fontFamily: "'Bebas Neue',sans-serif", fontSize: 13, padding: '3px 10px', minWidth: 46, textAlign: 'center',
                      background: draw ? 'rgba(71,200,255,0.1)' : won ? 'rgba(71,255,154,0.1)' : 'rgba(255,71,87,0.1)',
                      color: draw ? 'var(--a3)' : won ? 'var(--gn)' : 'var(--rd)'
                    }}>
                      {draw ? 'DRAW' : won ? 'WIN' : 'LOSS'}
                    </span>
                    <span style={{ fontSize: 10, letterSpacing: 1, color: modeColor, textTransform: 'uppercase', minWidth: 60 }}>
                      {m.game_mode}
                    </span>
                    <span style={{ fontSize: 10, color: m.match_type === 'rival' ? 'var(--a3)' : 'var(--mu)', textTransform: 'uppercase', letterSpacing: 1 }}>
                      {m.match_type === 'rival' ? 'Rival' : m.match_type === 'ranked' ? 'Ranked' : 'Casual'}
                    </span>
                    {m.ai_difficulty && (
                      <span style={{ fontSize: 10, color: 'var(--hl)', textTransform: 'uppercase' }}>vs AI ({m.ai_difficulty})</span>
                    )}
                    <span style={{ flex: 1 }} />
                    {eloChange !== 0 && eloChange != null && (
                      <span style={{
                        fontFamily: "'Bebas Neue',sans-serif", fontSize: 16,
                        color: eloChange > 0 ? 'var(--gn)' : 'var(--rd)'
                      }}>
                        {eloChange > 0 ? '+' : ''}{eloChange}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: 'var(--mu)' }}>
                      {new Date(m.created_at).toLocaleDateString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
