import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { getRankBadge } from '../lib/gameLogic';

const MODES = [
  { id: 'classic', label: 'Classic', color: 'var(--X)' },
  { id: 'ultimate', label: 'Ultimate', color: 'var(--O)' },
  { id: 'mega', label: 'MEGA', color: 'var(--mega)' },
];

function StatCard({ stat, mode }) {
  const badge = getRankBadge(stat.elo_rating);
  const gp = stat.wins + stat.losses + stat.draws;
  const wpct = gp > 0 ? ((stat.wins + stat.draws * 0.5) / gp * 100).toFixed(1) : '0.0';

  return (
    <div style={{
      background: 'var(--sf)', border: '1px solid var(--bd)',
      borderTop: `3px solid ${mode.color}`, padding: 20
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', marginBottom: 4 }}>{mode.label}</div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 36, color: mode.color, lineHeight: 1 }}>{stat.elo_rating}</div>
          <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--mu)', textTransform: 'uppercase', marginTop: 2 }}>ELO Rating</div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '4px 10px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 999
        }}>
          <span style={{ fontSize: 14, color: badge.color }}>{badge.icon}</span>
          <span style={{ fontSize: 10, letterSpacing: 2, color: badge.color, fontFamily: "'DM Mono',monospace", textTransform: 'uppercase' }}>{badge.name}</span>
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
  const [stats, setStats] = useState([]);
  const [matches, setMatches] = useState([]);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [matchTab, setMatchTab] = useState('all');
  const fileRef = useRef(null);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('ttt_player_stats')
      .select('*')
      .eq('user_id', user.id);
    if (data) setStats(data);
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

  useEffect(() => {
    if (!user) return;
    fetchStats();
    fetchMatches();
  }, [user, fetchStats, fetchMatches]);

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
      const displayName = [fn, ln].filter(Boolean).join(' ');
      const updates = { first_name: fn, last_name: ln || null, nickname: nick || null, display_name: displayName };
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
              <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 4 }}>
                Member since {new Date(profile.created_at).toLocaleDateString()}
              </div>
              <button className="smbtn" style={{ marginTop: 10 }} onClick={() => setEditing(true)}>Edit Profile</button>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ fontSize: 10, letterSpacing: 3, color: 'var(--ac)', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        Stats by Mode
        <span style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 30 }}>
        {MODES.map(m => <StatCard key={m.id} stat={getStat(m.id)} mode={m} />)}
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
                <span style={{ fontSize: 10, color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  {m.match_type === 'ranked' ? 'Ranked' : 'Casual'}
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
