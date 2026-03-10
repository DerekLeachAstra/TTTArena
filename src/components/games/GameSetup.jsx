import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function GameSetup({ players, mode, onStart, onStartAI, isAuthenticated, user, profile }) {
  const [playMode, setPlayMode] = useState("ai");

  // Local play state — signed-in user
  const [mySide, setMySide] = useState("X");
  const [opponentMode, setOpponentMode] = useState("guest");
  const [guestName, setGuestName] = useState("");
  const [rivalUsername, setRivalUsername] = useState("");
  const [rivalVerified, setRivalVerified] = useState(null); // null | 'verified' | 'not_found' | 'not_rival'
  const [rivalProfile, setRivalProfile] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [rivalryId, setRivalryId] = useState(null);

  // Local play state — not signed in
  const [guestXName, setGuestXName] = useState("");
  const [guestOName, setGuestOName] = useState("");

  const isMega = mode === "mega", isUlt = mode === "ultimate";
  const accent = isMega ? "var(--mega)" : isUlt ? "var(--O)" : "var(--ac)";
  const title = isMega ? "MEGA Tic-Tac-Toe" : isUlt ? "Ultimate Tic-Tac-Toe" : "Classic Tic-Tac-Toe";
  const desc = isMega
    ? "Three layers deep. Win small boards to claim mid-board cells. Win mid-boards to win."
    : isUlt
    ? "Nine boards in a 3x3 grid. Win 3 boards in a row to win. Cell position determines opponent's next board."
    : "Classic 3x3 Tic-Tac-Toe. First to get three in a row wins.";
  const difficulties = ['easy','medium','hard','unbeatable'];

  async function verifyRival() {
    if (!rivalUsername.trim() || !user) return;
    setVerifying(true);
    setRivalVerified(null);
    setRivalProfile(null);
    setRivalryId(null);
    try {
      // Look up the profile by full username (e.g., JamesBezek#61742)
      const { data: profileData, error: profileErr } = await supabase
        .from('ttt_profiles')
        .select('id, display_name, username, avatar_url')
        .eq('username', rivalUsername.trim())
        .single();

      if (profileErr || !profileData) {
        setRivalVerified('not_found');
        setVerifying(false);
        return;
      }

      if (profileData.id === user.id) {
        setRivalVerified('not_found');
        setVerifying(false);
        return;
      }

      // Check if they are rivals (accepted status in either direction)
      const { data: rivalData } = await supabase
        .from('ttt_rivals')
        .select('id')
        .eq('status', 'accepted')
        .or(`and(user_a_id.eq.${user.id},user_b_id.eq.${profileData.id}),and(user_a_id.eq.${profileData.id},user_b_id.eq.${user.id})`);

      if (!rivalData || rivalData.length === 0) {
        setRivalVerified('not_rival');
        setRivalProfile(profileData);
        setVerifying(false);
        return;
      }

      setRivalVerified('verified');
      setRivalProfile(profileData);
      setRivalryId(rivalData[0].id);
    } catch {
      setRivalVerified('not_found');
    }
    setVerifying(false);
  }

  function startLocalGame() {
    if (user && isAuthenticated) {
      // Signed-in user
      const mePlayer = {
        id: user.id,
        firstName: profile?.display_name || 'You',
        lastName: '',
        nickname: profile?.display_name || 'You',
      };

      if (opponentMode === 'guest') {
        const oppPlayer = {
          id: 'guest',
          firstName: guestName.trim() || 'Guest',
          lastName: '',
          nickname: guestName.trim() || 'Guest',
        };
        const pX = mySide === 'X' ? mePlayer : oppPlayer;
        const pO = mySide === 'X' ? oppPlayer : mePlayer;
        onStart(pX, pO);
      } else if (opponentMode === 'rival' && rivalVerified === 'verified' && rivalProfile) {
        const oppPlayer = {
          id: rivalProfile.id,
          firstName: rivalProfile.display_name,
          lastName: '',
          nickname: rivalProfile.display_name,
        };
        const pX = mySide === 'X' ? mePlayer : oppPlayer;
        const pO = mySide === 'X' ? oppPlayer : mePlayer;
        onStart(pX, pO, { rivalUserId: rivalProfile.id, rivalryId });
      }
    } else {
      // Guest vs guest (not signed in)
      const pX = { id: 'guest-x', firstName: guestXName.trim() || 'Player X', lastName: '', nickname: guestXName.trim() || 'Player X' };
      const pO = { id: 'guest-o', firstName: guestOName.trim() || 'Player O', lastName: '', nickname: guestOName.trim() || 'Player O' };
      onStart(pX, pO);
    }
  }

  const canStart = user && isAuthenticated
    ? (opponentMode === 'guest' || (opponentMode === 'rival' && rivalVerified === 'verified'))
    : true;

  const inputStyle = {
    width: '100%', background: 'var(--s2)', border: '1px solid var(--bd)', color: 'var(--tx)',
    fontFamily: "'DM Mono',monospace", fontSize: 13, padding: '10px 12px', outline: 'none',
  };

  return (
    <div style={{ maxWidth:540, margin:"0 auto" }}>
      <div style={{ background:"var(--sf)", border:"1px solid var(--bd)", borderTop:"3px solid "+accent, padding:30, marginBottom:18 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:34, letterSpacing:2, color:accent, marginBottom:6 }}>{title}</div>
        <div style={{ fontSize:11, color:"var(--mu)", letterSpacing:"1.5px", marginBottom:22, lineHeight:1.9 }}>{desc}</div>

        <div style={{ display:"flex", gap:2, marginBottom:22, borderBottom:"1px solid var(--bd)" }}>
          {[{id:"ai",label:"Play vs AI"},{id:"local",label:"Local Play"}].map(t => (
            <button key={t.id} onClick={() => setPlayMode(t.id)} style={{
              background:"none", border:"none", borderBottom:"2px solid "+(playMode===t.id?accent:"transparent"),
              color: playMode===t.id?accent:"var(--mu)", fontFamily:"'DM Mono',monospace", fontSize:10,
              letterSpacing:2, textTransform:"uppercase", padding:"9px 16px", cursor:"pointer", marginBottom:-1
            }}>{t.label}</button>
          ))}
        </div>

        {playMode === "ai" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)" }}>Select Difficulty</div>
              {isAuthenticated && (
                <div style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 8px", background:"rgba(168,85,247,0.12)", border:"1px solid rgba(168,85,247,0.3)", borderRadius:999 }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:"var(--hl)" }}/>
                  <span style={{ fontSize:9, letterSpacing:2, color:"var(--hl)", textTransform:"uppercase" }}>Ranked</span>
                </div>
              )}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
              {difficulties.map(d => (
                <button key={d} onClick={() => onStartAI(d)} style={{
                  background:"var(--s2)", border:"1px solid var(--bd)", color:"var(--tx)",
                  fontFamily:"'DM Mono',monospace", fontSize:12, letterSpacing:2, textTransform:"uppercase",
                  padding:"14px 12px", cursor:"pointer", transition:"all 0.15s",
                  borderColor: d==='unbeatable'?'var(--rd)':d==='hard'?accent:'var(--bd)'
                }}
                onMouseOver={e => { e.target.style.borderColor = accent; e.target.style.color = accent; }}
                onMouseOut={e => { e.target.style.borderColor = d==='unbeatable'?'var(--rd)':d==='hard'?accent:'var(--bd)'; e.target.style.color = 'var(--tx)'; }}
                >{d}{d==='unbeatable' ? ' \u{1F480}' : ''}</button>
              ))}
            </div>
          </div>
        )}

        {playMode === "local" && (
          <div>
            {user && isAuthenticated ? (
              <>
                {/* Side picker */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8, color: 'var(--mu)' }}>You Play As</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['X', 'O'].map(side => (
                      <button key={side} onClick={() => setMySide(side)} style={{
                        flex: 1, padding: '12px 0', cursor: 'pointer', transition: 'all 0.15s',
                        background: mySide === side ? (side === 'X' ? 'rgba(232,255,71,0.12)' : 'rgba(71,200,255,0.12)') : 'var(--s2)',
                        border: `2px solid ${mySide === side ? (side === 'X' ? 'var(--X)' : 'var(--O)') : 'var(--bd)'}`,
                        color: mySide === side ? (side === 'X' ? 'var(--X)' : 'var(--O)') : 'var(--mu)',
                        fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 3,
                      }}>{side}</button>
                    ))}
                  </div>
                </div>

                {/* Opponent mode tabs */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8, color: 'var(--mu)' }}>Opponent</div>
                  <div style={{ display: 'flex', gap: 2, marginBottom: 14, borderBottom: '1px solid var(--bd)' }}>
                    {[{ id: 'guest', label: 'Guest' }, { id: 'rival', label: 'Rival' }].map(t => (
                      <button key={t.id} onClick={() => setOpponentMode(t.id)} style={{
                        background: 'none', border: 'none', borderBottom: `2px solid ${opponentMode === t.id ? accent : 'transparent'}`,
                        color: opponentMode === t.id ? accent : 'var(--mu)', fontFamily: "'DM Mono',monospace", fontSize: 10,
                        letterSpacing: 2, textTransform: 'uppercase', padding: '8px 14px', cursor: 'pointer', marginBottom: -1,
                      }}>{t.label}</button>
                    ))}
                  </div>

                  {opponentMode === 'guest' && (
                    <div>
                      <input
                        type="text"
                        value={guestName}
                        onChange={e => setGuestName(e.target.value)}
                        placeholder="Guest name (optional)"
                        style={inputStyle}
                        maxLength={30}
                      />
                    </div>
                  )}

                  {opponentMode === 'rival' && (
                    <div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="text"
                          value={rivalUsername}
                          onChange={e => { setRivalUsername(e.target.value); setRivalVerified(null); setRivalProfile(null); setRivalryId(null); }}
                          placeholder="Username (e.g., Player#12345)"
                          style={{ ...inputStyle, flex: 1 }}
                          maxLength={50}
                          onKeyDown={e => { if (e.key === 'Enter') verifyRival(); }}
                        />
                        <button
                          className="smbtn"
                          onClick={verifyRival}
                          disabled={!rivalUsername.trim() || verifying}
                          style={{ whiteSpace: 'nowrap', padding: '10px 14px' }}
                        >{verifying ? '...' : 'Verify'}</button>
                      </div>

                      {rivalVerified === 'verified' && rivalProfile && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '8px 12px', background: 'rgba(71,255,154,0.08)', border: '1px solid rgba(71,255,154,0.25)' }}>
                          <span style={{ color: 'var(--gn)', fontSize: 16 }}>{'\u2713'}</span>
                          {rivalProfile.avatar_url && (
                            <div style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--bd)', flexShrink: 0 }}>
                              <img src={rivalProfile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                            </div>
                          )}
                          <span style={{ fontSize: 12, color: 'var(--gn)', fontWeight: 500 }}>{rivalProfile.display_name}</span>
                          <span style={{ fontSize: 9, color: 'var(--mu)', letterSpacing: 1 }}>RIVAL</span>
                        </div>
                      )}

                      {rivalVerified === 'not_found' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '8px 12px', background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.25)' }}>
                          <span style={{ color: 'var(--rd)', fontSize: 16 }}>{'\u2717'}</span>
                          <span style={{ fontSize: 11, color: 'var(--rd)' }}>Player not found</span>
                        </div>
                      )}

                      {rivalVerified === 'not_rival' && rivalProfile && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '8px 12px', background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.25)' }}>
                          <span style={{ color: 'var(--rd)', fontSize: 16 }}>{'\u2717'}</span>
                          <span style={{ fontSize: 11, color: 'var(--rd)' }}>{rivalProfile.display_name} is not on your rivals list</span>
                        </div>
                      )}

                      <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 8, lineHeight: 1.6 }}>
                        Enter your rival's full username to play a tracked local game.
                      </div>
                    </div>
                  )}
                </div>

                {/* Start button */}
                <button disabled={!canStart} onClick={startLocalGame} style={{
                  width: '100%', background: canStart ? accent : 'var(--bd)', color: canStart ? 'var(--bg)' : 'var(--mu)',
                  fontFamily: "'DM Mono',monospace", fontSize: 12, letterSpacing: 4, textTransform: 'uppercase',
                  border: 'none', padding: 13, cursor: canStart ? 'pointer' : 'not-allowed', fontWeight: 500,
                }}>
                  {opponentMode === 'rival' && rivalVerified === 'verified' && rivalProfile
                    ? `Start \u2014 ${profile?.display_name || 'You'} vs ${rivalProfile.display_name}`
                    : opponentMode === 'guest'
                    ? `Start \u2014 ${profile?.display_name || 'You'} vs ${guestName.trim() || 'Guest'}`
                    : 'Verify Rival to Begin'}
                </button>
              </>
            ) : (
              /* Not signed in — simple guest vs guest */
              <>
                <div style={{ display: 'flex', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 130 }}>
                    <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 7, color: 'var(--mu)' }}>
                      Player <span style={{ fontFamily: "'Bebas Neue'", fontSize: 15, color: 'var(--X)' }}>X</span>
                    </div>
                    <input
                      type="text"
                      value={guestXName}
                      onChange={e => setGuestXName(e.target.value)}
                      placeholder="Player X"
                      style={inputStyle}
                      maxLength={30}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 10, fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, color: 'var(--a2)', letterSpacing: 2 }}>VS</div>
                  <div style={{ flex: 1, minWidth: 130 }}>
                    <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 7, color: 'var(--mu)' }}>
                      Player <span style={{ fontFamily: "'Bebas Neue'", fontSize: 15, color: 'var(--O)' }}>O</span>
                    </div>
                    <input
                      type="text"
                      value={guestOName}
                      onChange={e => setGuestOName(e.target.value)}
                      placeholder="Player O"
                      style={inputStyle}
                      maxLength={30}
                    />
                  </div>
                </div>
                <button onClick={startLocalGame} style={{
                  width: '100%', background: accent, color: 'var(--bg)',
                  fontFamily: "'DM Mono',monospace", fontSize: 12, letterSpacing: 4, textTransform: 'uppercase',
                  border: 'none', padding: 13, cursor: 'pointer', fontWeight: 500,
                }}>
                  {`Start \u2014 ${guestXName.trim() || 'Player X'} vs ${guestOName.trim() || 'Player O'}`}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
