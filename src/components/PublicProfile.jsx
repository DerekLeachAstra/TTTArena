import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getRankBadge } from '../lib/gameLogic';
import { useAuth } from '../hooks/useAuth';

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

export default function PublicProfile() {
  const { username: rawUsername } = useParams();
  const username = decodeURIComponent(rawUsername || '').replace(/^@/, '');
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState(null);
  const [stats, setStats] = useState([]);
  const [ranks, setRanks] = useState({});
  const [matches, setMatches] = useState([]);
  const [matchTab, setMatchTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [rivalStatus, setRivalStatus] = useState(null); // null | 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'sending'
  const [rivalRecord, setRivalRecord] = useState(null); // { w, l, d, rivalryId }

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setNotFound(false);

    // Fetch profile by username
    const { data: prof, error } = await supabase
      .from('ttt_profiles')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !prof) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setProfileData(prof);

    // Fetch stats, ranks, and matches in parallel
    const [statsRes, ranksRes, matchesRes] = await Promise.all([
      supabase.from('ttt_player_stats').select('*').eq('user_id', prof.id),
      supabase.rpc('get_player_ranks', { p_user_id: prof.id }),
      supabase.from('ttt_matches')
        .select('*')
        .or(`player_x_id.eq.${prof.id},player_o_id.eq.${prof.id}`)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    if (statsRes.data) setStats(statsRes.data);
    if (ranksRes.data) {
      const r = {};
      ranksRes.data.forEach(d => {
        r[d.game_mode] = { rank: d.rank, total: d.total_players, elo: d.elo_rating };
      });
      setRanks(r);
    }
    if (matchesRes.data) setMatches(matchesRes.data);

    // Check rival status with this player
    if (user && prof.id !== user.id) {
      const { data: rivalData } = await supabase
        .from('ttt_rivals')
        .select('id, status, user_a_id, user_b_id')
        .or(`and(user_a_id.eq.${user.id},user_b_id.eq.${prof.id}),and(user_a_id.eq.${prof.id},user_b_id.eq.${user.id})`)
        .limit(1);

      if (rivalData && rivalData.length > 0) {
        const r = rivalData[0];
        if (r.status === 'accepted') {
          setRivalStatus('accepted');
          // Fetch H2H record
          const { data: h2h } = await supabase
            .from('ttt_matches')
            .select('winner_id, is_draw')
            .eq('rivalry_id', r.id);
          let w = 0, l = 0, d = 0;
          (h2h || []).forEach(m => {
            if (m.is_draw) d++;
            else if (m.winner_id === user.id) w++;
            else l++;
          });
          setRivalRecord({ w, l, d, rivalryId: r.id });
        } else {
          setRivalStatus(r.user_a_id === user.id ? 'pending_sent' : 'pending_received');
          setRivalRecord({ w: 0, l: 0, d: 0, rivalryId: r.id });
        }
      } else {
        setRivalStatus('none');
      }
    }

    setLoading(false);
  }, [username, user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  async function sendRivalRequest() {
    if (!user || !profileData) return;
    setRivalStatus('sending');
    try {
      await supabase.from('ttt_rivals').insert({ user_a_id: user.id, user_b_id: profileData.id });
      setRivalStatus('pending_sent');
    } catch { setRivalStatus('none'); }
  }

  async function acceptRivalRequest() {
    if (!rivalRecord?.rivalryId) return;
    await supabase.from('ttt_rivals').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', rivalRecord.rivalryId);
    setRivalStatus('accepted');
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div className="ai-thinking"><span>Loading</span><span className="dot" /><span className="dot" /><span className="dot" /></div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 42, letterSpacing: 2, color: 'var(--mu)', marginBottom: 12 }}>Player Not Found</div>
        <div style={{ fontSize: 12, color: 'var(--mu)', letterSpacing: 2, marginBottom: 24 }}>
          No player with username "<span style={{ color: 'var(--ac)' }}>{username}</span>" exists.
        </div>
        <Link to="/" style={{
          display: 'inline-block', padding: '10px 24px', background: 'var(--ac)', color: 'var(--bg)',
          fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: 2, textTransform: 'uppercase',
          textDecoration: 'none', fontWeight: 500,
        }}>Back to Arena</Link>
      </div>
    );
  }

  const getStat = (mode) => stats.find(s => s.game_mode === mode) || { elo_rating: 1200, wins: 0, losses: 0, draws: 0 };
  const filteredMatches = matchTab === 'all' ? matches : matches.filter(m => m.game_mode === matchTab);

  // Check if this is the current user's own profile
  const isOwnProfile = user && profileData && user.id === profileData.id;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      {/* Profile Header */}
      <div style={{
        background: 'var(--sf)', border: '1px solid var(--bd)', borderTop: '3px solid var(--ac)',
        padding: 28, marginBottom: 24, display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap'
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%', overflow: 'hidden',
          background: 'var(--s2)', border: '2px solid var(--bd)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {profileData.avatar_url ? (
            <img src={profileData.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, color: 'var(--mu)' }}>
              {(profileData.display_name || '?')[0].toUpperCase()}
            </span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 30, letterSpacing: 2 }}>{profileData.display_name}</div>
          {profileData.username && (
            <div style={{ fontSize: 11, color: 'var(--mu)', fontFamily: "'DM Mono',monospace" }}>@{profileData.username}</div>
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
            Member since {new Date(profileData.created_at).toLocaleDateString()}
          </div>
          {isOwnProfile && (
            <Link to="/profile" style={{
              display: 'inline-block', marginTop: 10, padding: '6px 14px',
              background: 'var(--s2)', border: '1px solid var(--bd)', color: 'var(--ac)',
              fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 2,
              textTransform: 'uppercase', textDecoration: 'none', cursor: 'pointer',
            }}>Edit Profile</Link>
          )}
          {/* Rival actions — not own profile, not guest */}
          {!isOwnProfile && user && !isGuest && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' }}>
              {rivalStatus === 'none' && (
                <button className="smbtn" onClick={sendRivalRequest} style={{ borderColor: 'var(--a3)', color: 'var(--a3)' }}>Add as Rival</button>
              )}
              {rivalStatus === 'sending' && (
                <span style={{ fontSize: 10, color: 'var(--a3)', letterSpacing: 2, textTransform: 'uppercase' }}>Sending...</span>
              )}
              {rivalStatus === 'pending_sent' && (
                <span style={{ fontSize: 10, color: 'var(--a3)', letterSpacing: 2, textTransform: 'uppercase', padding: '6px 14px', background: 'rgba(71,200,255,0.06)', border: '1px solid rgba(71,200,255,0.2)' }}>Rival Request Sent</span>
              )}
              {rivalStatus === 'pending_received' && (
                <button className="savebtn" onClick={acceptRivalRequest} style={{ padding: '6px 14px', fontSize: 10 }}>Accept Rival Request</button>
              )}
              {rivalStatus === 'accepted' && (
                <>
                  <span style={{
                    fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--a3)',
                    padding: '6px 14px', background: 'rgba(71,200,255,0.06)', border: '1px solid rgba(71,200,255,0.2)',
                    fontFamily: "'DM Mono',monospace"
                  }}>Rivals</span>
                  <button className="smbtn" style={{ borderColor: 'var(--a3)', color: 'var(--a3)', padding: '5px 12px', fontSize: 10 }}
                    onClick={() => navigate(`/live?rivalryId=${rivalRecord?.rivalryId}&rivalName=${encodeURIComponent(profileData.display_name || 'Rival')}`)}>
                    Challenge
                  </button>
                </>
              )}
            </div>
          )}
          {/* H2H record for accepted rivals */}
          {rivalStatus === 'accepted' && rivalRecord && (rivalRecord.w + rivalRecord.l + rivalRecord.d > 0) && (
            <div style={{
              display: 'flex', gap: 12, marginTop: 10, padding: '8px 14px',
              background: 'rgba(71,200,255,0.04)', border: '1px solid rgba(71,200,255,0.15)',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--mu)' }}>H2H</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--gn)' }}>{rivalRecord.w}W</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--rd)' }}>{rivalRecord.l}L</span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--a3)' }}>{rivalRecord.d}D</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ fontSize: 10, letterSpacing: 3, color: 'var(--ac)', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        Stats by Mode
        <span style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 30 }}>
        {MODES.map(m => <StatCard key={m.id} stat={getStat(m.id)} mode={m} rank={ranks[m.id]} />)}
      </div>

      {/* Match History */}
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
          No matches recorded yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filteredMatches.map(m => {
            const isX = m.player_x_id === profileData.id;
            const won = m.winner_id === profileData.id;
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
    </div>
  );
}
