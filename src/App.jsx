import { useState, useEffect, useCallback, useRef } from "react";
import { Routes, Route, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom';
import './styles.css';
import { AuthProvider, useAuth } from './hooks/useAuth';
import AuthModal from './components/AuthModal';
import ProtectedRoute from './components/ProtectedRoute';
import { calcElo, clampElo } from './lib/gameLogic';
import { logError } from './lib/logger';
import { supabase } from './lib/supabase';
import { h2hKey } from './lib/playerUtils';
import { checkMilestones, checkAchievements } from './lib/trophyChecker';
import Profile from './components/Profile';
import PublicProfile from './components/PublicProfile';
import ResetPassword from './components/ResetPassword';
import Leagues from './components/Leagues';
import LiveGameWrapper from './components/LiveGameWrapper';
import Arena from './components/Arena';
import Rivals from './components/Rivals';
import ClassicGame from './components/games/ClassicGame';
import UltimateGame from './components/games/UltimateGame';
import MegaGame from './components/games/MegaGame';
import GameSetup from './components/games/GameSetup';
import H2H from './components/h2h/H2H';
import Manage from './components/manage/Manage';
import EditModal from './components/manage/EditModal';
import Confirm from './components/ui/Confirm';
import Admin from './components/Admin';

// M4: Default to empty array; existing users keep localStorage data
const INITIAL_PLAYERS = [];

function AppContent() {
  const { user, profile, loading, isGuest, signOut, fetchProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const load = (key, def) => { try { const s=localStorage.getItem(key); return s?JSON.parse(s):def; } catch { return def; } };
  const [players, setPlayers]   = useState(() => load("ttta_p", INITIAL_PLAYERS));
  const [h2hData, setH2hData]   = useState(() => load("ttta_h", {}));
  const [gameState, setGameState] = useState(null);
  const [aiGame, setAiGame]     = useState(null); // { difficulty, mode }
  const [editP, setEditP]       = useState(null);
  const [confirm, setConfirm]   = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [globalStats, setGlobalStats] = useState([]);
  const [rankedSaving, setRankedSaving] = useState(false);
  const gameStartRef = useRef(null);
  const [rivalBadge, setRivalBadge] = useState(0);

  // Navigation helper — clears game state before navigating
  function navigateTo(path) {
    setGameState(null); setAiGame(null); setConfirm(null); setEditP(null);
    navigate(path);
  }

  // Nav links — auth-dependent (guests get limited nav)
  const NAV_LINKS = user && !isGuest
    ? [
        { to:"/",         label:"Arena" },
        { to:"/profile",  label:"Profile" },
        { to:"/classic",  label:"Classic" },
        { to:"/ultimate", label:"Ultimate" },
        { to:"/mega",     label:"MEGA" },
        { to:"/leagues",  label:"Leagues" },
        { to:"/rivals",   label:"Rivals", badge: rivalBadge },
        { to:"/h2h",      label:"Head-to-Head" },
        ...(user?.email === 'contact@derekleach.com' ? [{ to:"/admin", label:"Admin" }] : []),
      ]
    : [
        { to:"/",         label:"Arena" },
        { to:"/classic",  label:"Classic" },
        { to:"/ultimate", label:"Ultimate" },
        { to:"/mega",     label:"MEGA" },
        { to:"/live",     label:"Live" },
      ];

  useEffect(() => { try { localStorage.setItem("ttta_p", JSON.stringify(players)); } catch {} }, [players]);
  useEffect(() => { try { localStorage.setItem("ttta_h", JSON.stringify(h2hData)); } catch {} }, [h2hData]);

  // Clear game state when navigating away from game pages
  useEffect(() => {
    const gamePaths = ['/classic', '/ultimate', '/mega'];
    if (!gamePaths.includes(location.pathname)) {
      setGameState(null);
      setAiGame(null);
    }
  }, [location.pathname]);

  // Fetch global stats
  useEffect(() => {
    async function fetchGlobal() {
      try {
        const { data } = await supabase
          .from('ttt_player_stats')
          .select('*, ttt_profiles(display_name, avatar_url, username)')
          .order('elo_rating', { ascending: false })
          .limit(20);
        if (data) setGlobalStats(data.map(d => ({ ...d, display_name: d.ttt_profiles?.display_name, username: d.ttt_profiles?.username })));
      } catch (err) {
        logError('Failed to fetch global stats:', err);
      }
    }
    fetchGlobal();
  }, []);

  // Global rival notifications — count pending requests + challenges
  const fetchRivalBadge = useCallback(async () => {
    if (!user || isGuest) { setRivalBadge(0); return; }
    try {
      const [rivalsRes, challengesRes] = await Promise.all([
        supabase.from('ttt_rivals').select('id', { count: 'exact', head: true }).eq('user_b_id', user.id).eq('status', 'pending'),
        supabase.from('ttt_rival_challenges').select('id', { count: 'exact', head: true }).eq('challenged_id', user.id).eq('status', 'pending'),
      ]);
      setRivalBadge((rivalsRes.count || 0) + (challengesRes.count || 0));
    } catch (err) { logError('fetchRivalBadge:', err); }
  }, [user, isGuest]);

  useEffect(() => {
    fetchRivalBadge();
  }, [fetchRivalBadge]);

  // Listen for immediate badge refresh from child components (no real-time delay)
  useEffect(() => {
    const handler = () => fetchRivalBadge();
    window.addEventListener('rival-badge-refresh', handler);
    return () => window.removeEventListener('rival-badge-refresh', handler);
  }, [fetchRivalBadge]);

  useEffect(() => {
    if (!user || isGuest) return;
    const channel = supabase.channel('rival-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttt_rivals', filter: `user_b_id=eq.${user.id}` }, () => fetchRivalBadge())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttt_rival_challenges', filter: `challenged_id=eq.${user.id}` }, () => fetchRivalBadge())
      .subscribe();
    // Polling fallback: refresh badge count every 10 seconds
    const badgeInterval = setInterval(fetchRivalBadge, 10000);
    return () => { supabase.removeChannel(channel); clearInterval(badgeInterval); };
  }, [user, isGuest, fetchRivalBadge]);

  // Global listener: auto-navigate challenger when their challenge is accepted
  useEffect(() => {
    if (!user || isGuest) return;
    const channel = supabase.channel('challenge-accepted')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'ttt_rival_challenges',
        filter: `challenger_id=eq.${user.id}`
      }, (payload) => {
        const updated = payload.new;
        if (updated.status === 'accepted' && updated.game_id) {
          navigate(`/live?rivalryId=${updated.rivalry_id}`);
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user, isGuest, navigate]);

  // Heartbeat: update last_seen_at every 60 seconds for online status
  useEffect(() => {
    if (!user || isGuest) return;
    const updatePresence = () => {
      supabase.from('ttt_profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id).then(() => {}).catch(() => {});
    };
    updatePresence(); // immediate on mount
    const interval = setInterval(updatePresence, 60000);
    return () => clearInterval(interval);
  }, [user, isGuest]);

  // Save ranked game result to Supabase
  async function saveRankedResult(mode, result, difficulty) {
    if (!user) return;
    setRankedSaving(true);
    try {
      const isDraw = result === 'T';
      const playerWon = result === 'X'; // human is always X
      const duration = gameStartRef.current ? Math.round((Date.now() - gameStartRef.current) / 1000) : null;

      // Get current ELO
      const { data: statRow } = await supabase
        .from('ttt_player_stats')
        .select('elo_rating, wins, losses, draws')
        .eq('user_id', user.id)
        .eq('game_mode', mode)
        .single();

      const currentElo = statRow?.elo_rating || 1200;
      const aiElo = difficulty === 'easy' ? 800 : difficulty === 'medium' ? 1200 : difficulty === 'hard' ? 1500 : 1800;
      const { winnerDelta, loserDelta } = calcElo(
        isDraw ? currentElo : (playerWon ? currentElo : aiElo),
        isDraw ? aiElo : (playerWon ? aiElo : currentElo),
        isDraw
      );

      const eloDelta = isDraw ? winnerDelta : (playerWon ? winnerDelta : loserDelta);

      // Insert match record
      await supabase.from('ttt_matches').insert({
        game_mode: mode,
        player_x_id: user.id,
        player_o_id: null,
        winner_id: isDraw ? null : (playerWon ? user.id : null),
        result: isDraw ? 'draw' : (playerWon ? 'x_wins' : 'o_wins'),
        is_draw: isDraw,
        match_type: 'ranked',
        ai_difficulty: difficulty,
        elo_change_x: eloDelta,
        elo_change_o: 0,
        duration_seconds: duration,
        completed_at: new Date().toISOString(),
      });

      // C3: Upsert player stats (creates row if missing instead of silently failing)
      await supabase
        .from('ttt_player_stats')
        .upsert({
          user_id: user.id,
          game_mode: mode,
          elo_rating: clampElo(currentElo + eloDelta),
          wins: (statRow?.wins || 0) + (playerWon ? 1 : 0),
          losses: (statRow?.losses || 0) + (!isDraw && !playerWon ? 1 : 0),
          draws: (statRow?.draws || 0) + (isDraw ? 1 : 0),
        }, { onConflict: 'user_id,game_mode' });

      // Check trophies (fire-and-forget, don't block UI)
      checkMilestones(user.id).catch(() => {});
      checkAchievements(user.id, {
        winnerId: playerWon ? user.id : null,
        myElo: currentElo,
        opponentElo: aiElo,
        gameMode: mode,
        matchType: 'ranked',
        createdAt: new Date().toISOString(),
      }).catch(() => {});

      // Refresh global stats
      const { data } = await supabase
        .from('ttt_player_stats')
        .select('*, ttt_profiles(display_name, avatar_url, username)')
        .order('elo_rating', { ascending: false })
        .limit(20);
      if (data) setGlobalStats(data.map(d => ({ ...d, display_name: d.ttt_profiles?.display_name, username: d.ttt_profiles?.username })));
    } catch (err) {
      logError('Failed to save ranked result:', err);
      throw err; // Re-throw so callers know save failed
    } finally { setRankedSaving(false); }
  }

  function startGame(pX, pO, rivalData) { setGameState({ pX, pO, finished:false, rivalData: rivalData || null }); setAiGame(null); gameStartRef.current = Date.now(); }
  function startAIGame(mode, difficulty) {
    const aiPlayer = { id:'ai', firstName:'AI', lastName:'('+difficulty+')', nickname: difficulty.charAt(0).toUpperCase()+difficulty.slice(1)+' AI' };
    const humanPlayer = user
      ? { id:'human', firstName: profile?.display_name || 'You', lastName:'', nickname: profile?.username ? '@'+profile.username : '' }
      : { id:'human', firstName:'You', lastName:'', nickname:'' };
    setGameState({ pX: humanPlayer, pO: aiPlayer, finished:false });
    setAiGame({ difficulty, mode });
    gameStartRef.current = Date.now();
  }

  function tryAbandon() {
    if (gameState && !gameState.finished) {
      setConfirm({ title:"Abandon Game?", msg:"The game is still in progress. Leaving will discard this match.", onConfirm:doAbandon });
    } else doAbandon();
  }
  function doAbandon() { setGameState(null); setAiGame(null); setConfirm(null); }
  function handlePlayLeagueMatch(leagueId, leagueName) {
    navigateTo('/live?leagueId=' + leagueId + '&leagueName=' + encodeURIComponent(leagueName));
  }

  function handleViewLeagueFromArena(league) {
    // Navigate to leagues page — public leagues no longer auto-join,
    // membership is created when playing a match in the league
    navigateTo('/leagues');
  }

  async function saveLocalRivalGame(mode, result, rivalData, pX, pO) {
    try {
      const isDraw = result === 'T';
      const winnerId = isDraw ? null : (result === 'X' ? pX.id : pO.id);
      const dbResult = isDraw ? 'draw' : (result === 'X' ? 'x_wins' : 'o_wins');
      const duration = gameStartRef.current ? Math.round((Date.now() - gameStartRef.current) / 1000) : null;

      // Insert with status 'active' first
      const { data: inserted, error: insertErr } = await supabase
        .from('ttt_live_games')
        .insert({
          player_x_id: pX.id,
          player_o_id: pO.id,
          game_mode: mode,
          status: 'active',
          rivalry_id: rivalData.rivalryId,
        })
        .select('id')
        .single();

      if (insertErr || !inserted) {
        logError('Failed to insert local rival game:', insertErr);
        return;
      }

      // Update to 'finished' — triggers handle_ttt_game_finished
      const { error: updateErr } = await supabase
        .from('ttt_live_games')
        .update({
          status: 'finished',
          winner_id: winnerId,
          result: dbResult,
          duration_seconds: duration,
          finished_at: new Date().toISOString(),
        })
        .eq('id', inserted.id);

      if (updateErr) {
        logError('Failed to update local rival game:', updateErr);
      }
    } catch (err) {
      logError('Error saving local rival game:', err);
    }
  }

  function handleEnd(result, mode) {
    if (!gameState || aiGame) return; // Don't save AI game stats to local
    setGameState(gs => gs ? {...gs, finished:true} : gs);
    const { pX, pO, rivalData } = gameState;

    // If it's a rival local game, save to database (triggers ELO, stats, H2H)
    if (rivalData && rivalData.rivalUserId && rivalData.rivalryId) {
      saveLocalRivalGame(mode, result, rivalData, pX, pO);
      return; // Don't update localStorage stats for rival games
    }

    // For non-rival local games, update localStorage stats as before
    const isC=mode==="classic", isU=mode==="ultimate", isM=mode==="mega";
    setPlayers(ps => ps.map(p => {
      if (result === "T") {
        if (p.id===pX.id||p.id===pO.id) return {...p, ct:isC?(p.ct||0)+1:(p.ct||0), st:isU?(p.st||0)+1:(p.st||0), mt:isM?(p.mt||0)+1:(p.mt||0)};
      } else {
        const wid = result==="X"?pX.id:pO.id, lid = result==="X"?pO.id:pX.id;
        if (p.id===wid) return {...p, cw:isC?(p.cw||0)+1:(p.cw||0), sw:isU?(p.sw||0)+1:(p.sw||0), mw:isM?(p.mw||0)+1:(p.mw||0)};
        if (p.id===lid) return {...p, cl:isC?(p.cl||0)+1:(p.cl||0), sl:isU?(p.sl||0)+1:(p.sl||0), ml:isM?(p.ml||0)+1:(p.ml||0)};
      }
      return p;
    }));
    const k = h2hKey(pX.id, pO.id);
    const wid = result==="T"?null:result==="X"?pX.id:pO.id;
    setH2hData(d => ({...d, [k]:[...(d[k]||[]),{id:Date.now(),winner:wid,tie:result==="T",note:mode+" match",date:new Date().toLocaleDateString(),mode}]}));
  }

  function saveEdit(ep) { setPlayers(ps => ps.map(p => p.id===ep.id ? {...ep, cw:+ep.cw||0,cl:+ep.cl||0,ct:+ep.ct||0,sw:+ep.sw||0,sl:+ep.sl||0,st:+ep.st||0,mw:+ep.mw||0,ml:+ep.ml||0,mt:+ep.mt||0} : p)); setEditP(null); }
  function delPlayer(id) { setPlayers(ps => ps.filter(p => p.id !== id)); setEditP(null); }
  function addH2h(key, entry) { setH2hData(d => ({...d, [key]:[...(d[key]||[]),entry]})); }
  function delH2h(key, eid) { setH2hData(d => ({...d, [key]:(d[key]||[]).filter(e=>e.id!==eid)})); }
  function resetAll() { localStorage.removeItem("ttta_p"); localStorage.removeItem("ttta_h"); setPlayers(INITIAL_PLAYERS); setH2hData({}); setConfirm(null); }

  const renderGame = (mode) => {
    const GameComp = mode === "classic" ? ClassicGame : mode === "ultimate" ? UltimateGame : MegaGame;
    if (gameState) {
      return <GameComp pX={gameState.pX} pO={gameState.pO} onEnd={r=>handleEnd(r,mode)} onAbandon={tryAbandon} aiDifficulty={aiGame?.difficulty}
        canSaveRanked={!!user && !!aiGame} onSaveRanked={(result) => saveRankedResult(mode, result, aiGame?.difficulty)} rankedSaving={rankedSaving}
        onRematch={() => { gameStartRef.current = Date.now(); }} />;
    }
    return <GameSetup players={players} mode={mode} onStart={startGame} onStartAI={(diff) => startAIGame(mode, diff)} isAuthenticated={!!user} user={user} profile={profile} />;
  };

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div className="ai-thinking"><span>Loading</span><span className="dot"/><span className="dot"/><span className="dot"/></div>
    </div>
  );

  // Gate: suspended / blocked / deleted accounts
  const accountStatus = profile?.status;
  if (user && accountStatus && accountStatus !== 'active') {
    const messages = {
      suspended: { title: 'Account Suspended', desc: profile?.suspend_reason || 'Your account has been temporarily suspended.', action: 'If you believe this is a mistake, please contact support.' },
      blocked: { title: 'Account Blocked', desc: 'Your account has been permanently blocked for violating our terms of service.', action: 'Contact support if you believe this is an error.' },
      deleted: { title: 'Account Deleted', desc: 'This account has been deleted.', action: '' },
    };
    const msg = messages[accountStatus] || messages.blocked;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 30 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 36, letterSpacing: 4, color: 'var(--rd)', marginBottom: 12 }}>{msg.title}</div>
          <div style={{ fontSize: 13, color: 'var(--fg)', lineHeight: 1.6, marginBottom: 8 }}>{msg.desc}</div>
          {msg.action && <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 24 }}>{msg.action}</div>}
          <button className="smbtn" onClick={signOut} style={{ padding: '10px 28px' }}>Sign Out</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Skip to content link — visible on focus for keyboard users */}
      <a href="#main-content" style={{
        position:'absolute', left:'-9999px', top:'auto', width:1, height:1, overflow:'hidden',
        zIndex:9999, padding:'12px 20px', background:'var(--ac)', color:'var(--bg)',
        fontFamily:"'DM Mono',monospace", fontSize:12, letterSpacing:2, textDecoration:'none',
      }} onFocus={e => { e.target.style.position='fixed'; e.target.style.left='10px'; e.target.style.top='10px'; e.target.style.width='auto'; e.target.style.height='auto'; }}
         onBlur={e => { e.target.style.position='absolute'; e.target.style.left='-9999px'; e.target.style.width='1px'; e.target.style.height='1px'; }}>
        Skip to content
      </a>
      <div style={{ minHeight:"100vh", background:"var(--bg)" }}>
        <div style={{ position:"relative", zIndex:1, maxWidth:980, margin:"0 auto", padding:"30px 18px 80px" }}>
          {/* Header */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:30 }}>
            <div style={{ textAlign:"center", flex:1 }}>
              <div style={{ fontSize:10, letterSpacing:4, color:"var(--ac)", textTransform:"uppercase", marginBottom:8 }}>Competitive Tic-Tac-Toe Platform</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(44px,7vw,76px)", lineHeight:0.9, letterSpacing:3 }}>
                TTT<span style={{ color:"var(--ac)", display:"block" }}>ARENA</span>
              </div>
            </div>
            <div style={{ position:"absolute", right:18, top:30, display:"flex", gap:8, alignItems:"center" }}>
              {user && !isGuest ? (
                <>
                  {profile?.avatar_url && (
                    <div style={{ width:28, height:28, borderRadius:"50%", overflow:"hidden", border:"1px solid var(--bd)" }}>
                      <img src={profile.avatar_url} alt="Your avatar" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                    </div>
                  )}
                  <button style={{ fontSize:11, color:"var(--mu)", letterSpacing:1, cursor:"pointer", background:"none", border:"none", fontFamily:"inherit", padding:0 }} onClick={() => navigateTo("/profile")}>
                    {profile?.display_name || user.email}
                  </button>
                  <button className="smbtn" onClick={signOut}>Sign Out</button>
                </>
              ) : isGuest ? (
                <>
                  <span style={{ fontSize:9, color:"var(--go)", letterSpacing:2, fontWeight:600, border:"1px solid rgba(255,200,71,0.3)", padding:"2px 8px" }}>GUEST</span>
                  <span style={{ fontSize:11, color:"var(--mu)", letterSpacing:1 }}>
                    {profile?.display_name || 'Guest'}
                  </span>
                  <button className="smbtn" onClick={signOut}>Leave</button>
                  <button className="savebtn" style={{ padding:"6px 14px", fontSize:10 }} onClick={() => { signOut(); setAuthOpen(true); }}>Sign Up</button>
                </>
              ) : (
                <>
                  <button className="smbtn" onClick={() => setAuthOpen(true)}>Sign In</button>
                  <button className="savebtn" style={{ padding:"6px 14px", fontSize:10 }} onClick={() => setAuthOpen(true)}>Sign Up</button>
                </>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav aria-label="Main navigation" style={{ display:"flex", gap:2, marginBottom:30, borderBottom:"2px solid var(--bd)", overflowX:"auto" }}>
            {NAV_LINKS.map(link => (
              <NavLink key={link.to} to={link.to} end={link.to === "/"} style={({ isActive }) => ({
                background:"none", border:"none", borderBottom:"2px solid "+(isActive?"var(--ac)":"transparent"),
                color: isActive?"var(--ac)":"var(--mu)", fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:2,
                textTransform:"uppercase", padding:"10px 14px", cursor:"pointer", marginBottom:-2, whiteSpace:"nowrap",
                textDecoration:"none"
              })}>
                {link.label}
                {link.badge > 0 && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    minWidth: 16, height: 16, borderRadius: 999, background: 'var(--rd)',
                    color: '#fff', fontSize: 9, fontWeight: 700, marginLeft: 5, padding: '0 4px',
                    lineHeight: 1, verticalAlign: 'middle'
                  }}>{link.badge}</span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Routes */}
          <main id="main-content">
          <Routes>
            <Route path="/" element={<Arena globalStats={globalStats} onSelectDifficulty={(mode) => navigateTo("/" + mode)} onFindOpponent={(mode) => navigateTo("/live" + (mode ? "?mode=" + mode : ""))} isAuthenticated={!!user} onSignUp={() => setAuthOpen(true)} onViewLeague={handleViewLeagueFromArena} onBrowseLeagues={() => navigateTo("/leagues")} />} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/player/:username" element={<PublicProfile />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/classic" element={renderGame("classic")} />
            <Route path="/ultimate" element={renderGame("ultimate")} />
            <Route path="/mega" element={renderGame("mega")} />
            <Route path="/live" element={<LiveGameWrapper />} />
            <Route path="/leagues" element={<ProtectedRoute><Leagues onPlayLeagueMatch={handlePlayLeagueMatch} /></ProtectedRoute>} />
            <Route path="/rivals" element={<ProtectedRoute><Rivals /></ProtectedRoute>} />
            <Route path="/h2h" element={<H2H players={players} h2hData={h2hData} onAdd={addH2h} onDel={delH2h} user={user} />} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/manage" element={
              <Manage players={players} setPlayers={setPlayers} onEdit={setEditP}
                onDel={id => setConfirm({ title:"Delete Player?", msg:"This will permanently remove this player.", onConfirm:()=>delPlayer(id) })}
                onReset={() => setConfirm({ title:"Reset All Data?", msg:"This permanently deletes all records. Cannot be undone.", onConfirm:resetAll })} />
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </main>
        </div>
      </div>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
      {editP && <EditModal p={editP} onSave={saveEdit} onDel={id=>setConfirm({title:"Delete Player?",msg:"Permanently remove this player?",onConfirm:()=>delPlayer(id)})} onClose={()=>setEditP(null)}/>}
      {confirm && <Confirm title={confirm.title} msg={confirm.msg} onConfirm={confirm.onConfirm} onCancel={()=>setConfirm(null)}/>}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
