import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { checkWin, getWinLine } from '../lib/gameLogic';
import { logError } from '../lib/logger';
import { cellLabel, srOnly } from '../lib/a11y';
import { checkMilestones, checkAchievements } from '../lib/trophyChecker';
import { isSeriesDecided } from '../lib/bracketUtils';
import WinProbabilityBar from './WinProbabilityBar';
import { classicProbability, ultimateProbability, megaProbability } from '../ai/probability';

// Default generous timer: 45 seconds per turn
const DEFAULT_TURN_TIMER = 45;

// Server-side move validation via Edge Function
async function serverMove(gameId, move) {
  const { data, error } = await supabase.functions.invoke('make-move', {
    body: { game_id: gameId, move },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

// ── Matchmaking / Lobby ──────────────────────────────────
function Lobby({ onJoinGame, leagueId, leagueName, rivalryId, rivalName, initialMode, tournamentMatchId, tournamentName }) {
  const { user, profile, isGuest } = useAuth();
  const [games, setGames] = useState([]);
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState(initialMode || 'classic');
  const [lobbyError, setLobbyError] = useState(null);

  const fetchGames = useCallback(async () => {
    let query = supabase
      .from('ttt_live_games')
      .select('*, player_x:ttt_profiles!player_x_id(display_name)')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false });

    // W1: Filter by league_id when in league context
    if (leagueId) {
      query = query.eq('league_id', leagueId);
    } else if (rivalryId) {
      query = query.eq('rivalry_id', rivalryId);
    } else {
      query = query.is('league_id', null).is('rivalry_id', null);
    }

    const { data } = await query;
    if (data) setGames(data.filter(g => g.player_x_id !== user?.id));
  }, [leagueId, rivalryId, user?.id]);

  useEffect(() => {
    fetchGames();
    const channel = supabase.channel('lobby')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttt_live_games', filter: 'status=eq.waiting' },
        () => fetchGames())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchGames]);

  async function createGame() {
    setCreating(true);
    const initialBoard = mode === 'classic'
      ? { cells: Array(9).fill(null) }
      : mode === 'mega'
        ? { cells: Array(9).fill(null).map(() => Array(9).fill(null).map(() => Array(9).fill(null))), smallW: Array(9).fill(null).map(() => Array(9).fill(null)), midW: Array(9).fill(null), aMid: null, aSmall: null }
        : { boards: Array(9).fill(null).map(() => Array(9).fill(null)), bWins: Array(9).fill(null), active: null };

    // If league, fetch league timer settings
    let timerSeconds = null;
    if (leagueId) {
      const { data: leagueData } = await supabase
        .from('ttt_leagues')
        .select('timer_enabled, timer_seconds')
        .eq('id', leagueId)
        .single();
      if (leagueData?.timer_enabled) {
        timerSeconds = leagueData.timer_seconds || DEFAULT_TURN_TIMER;
      }
    }

    const { data, error } = await supabase.from('ttt_live_games').insert({
      game_mode: mode,
      player_x_id: user.id,
      board_state: initialBoard,
      current_turn: 'X',
      status: 'waiting',
      last_move_at: new Date().toISOString(),
      ...(leagueId ? { league_id: leagueId } : {}),
      ...(rivalryId ? { rivalry_id: rivalryId } : {}),
      ...(tournamentMatchId ? { tournament_match_id: tournamentMatchId } : {}),
      timer_seconds: rivalryId ? null : timerSeconds,
    }).select().single();

    if (error) { logError('Create game failed:', error); setLobbyError('Failed to create game. Please try again.'); }
    else if (data) onJoinGame(data);
    setCreating(false);
  }

  async function joinGame(game) {
    const { data, error } = await supabase.from('ttt_live_games')
      .update({ player_o_id: user.id, status: 'active', last_move_at: new Date().toISOString() })
      .eq('id', game.id)
      .eq('status', 'waiting')
      .select()
      .single();
    if (error) { logError('Join game failed:', error); setLobbyError('Failed to join game. It may have been filled.'); fetchGames(); }
    else if (data) onJoinGame(data);
  }

  const modeColors = { classic: 'var(--X)', ultimate: 'var(--O)', mega: 'var(--mega)' };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 30, letterSpacing: 2, color: 'var(--ac)', marginBottom: 20 }}>Live Multiplayer</div>

      {lobbyError && (
        <div style={{ padding: '8px 12px', marginBottom: 12, background: 'rgba(255,71,87,0.1)', border: '1px solid var(--rd)', color: 'var(--rd)', fontSize: 10, letterSpacing: 1.5 }}>{lobbyError}</div>
      )}

      {/* Guest banner */}
      {isGuest && (
        <div style={{
          background: 'rgba(255,200,71,0.08)', border: '1px solid rgba(255,200,71,0.25)',
          padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 11, letterSpacing: 1.5
        }}>
          <span style={{ color: 'var(--go)', fontWeight: 600 }}>GUEST</span>
          <span style={{ color: 'var(--tx)' }}>{profile?.display_name || 'Guest'}</span>
          <span style={{ fontSize: 9, color: 'var(--mu)' }}>— Games won't affect ranked stats</span>
        </div>
      )}

      {/* League context banner */}
      {leagueId && leagueName && !isGuest && (
        <div style={{
          background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.25)',
          padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 11, letterSpacing: 1.5
        }}>
          <span style={{ color: 'var(--hl)', fontWeight: 600 }}>LEAGUE MATCH</span>
          <span style={{ color: 'var(--tx)' }}>{leagueName}</span>
          <span style={{ fontSize: 9, color: 'var(--mu)' }}>— This game will count toward league standings</span>
        </div>
      )}

      {/* Tournament match banner */}
      {tournamentMatchId && !isGuest && (
        <div style={{
          background: 'rgba(255,200,71,0.08)', border: '1px solid rgba(255,200,71,0.25)',
          padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 11, letterSpacing: 1.5
        }}>
          <span style={{ color: 'var(--go)', fontWeight: 600 }}>TOURNAMENT</span>
          <span style={{ color: 'var(--tx)' }}>{tournamentName || 'Tournament Match'}</span>
          <span style={{ fontSize: 9, color: 'var(--mu)' }}>— This game counts toward the tournament bracket</span>
        </div>
      )}

      {/* Rival match banner */}
      {rivalryId && !isGuest && (
        <div style={{
          background: 'rgba(71,200,255,0.08)', border: '1px solid rgba(71,200,255,0.25)',
          padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 11, letterSpacing: 1.5
        }}>
          <span style={{ color: 'var(--a3)', fontWeight: 600 }}>RIVAL MATCH</span>
          <span style={{ color: 'var(--tx)' }}>vs {rivalName || 'Rival'}</span>
          <span style={{ fontSize: 9, color: 'var(--mu)' }}>— Untimed rival game</span>
        </div>
      )}

      {/* Guests can't play league matches */}
      {isGuest && leagueId && (
        <div style={{
          textAlign: 'center', padding: 30, border: '1px dashed var(--bd)',
          color: 'var(--mu)', fontSize: 11, letterSpacing: 2, marginBottom: 20
        }}>
          League matches require a registered account.
        </div>
      )}

      {/* Create Game — hide for guests in league context */}
      {!(isGuest && leagueId) && (
        <div style={{ background: 'var(--sf)', border: '1px solid var(--bd)', borderTop: '3px solid var(--ac)', padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', marginBottom: 12 }}>Create Game</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {['classic', 'ultimate', 'mega'].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding: '8px 18px', border: '1px solid ' + (mode === m ? modeColors[m] : 'var(--bd)'),
                background: mode === m ? 'rgba(232,255,71,0.06)' : 'var(--s2)',
                color: mode === m ? modeColors[m] : 'var(--mu)',
                fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer'
              }}>{m}</button>
            ))}
          </div>
          <button className="savebtn" onClick={createGame} disabled={creating} style={{ width: '100%' }}>
            {creating ? 'Creating...' : 'Create & Wait for Opponent'}
          </button>
        </div>
      )}

      {/* Available Games */}
      <div style={{ fontSize: 10, letterSpacing: 3, color: 'var(--ac)', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        {leagueId ? 'League Games' : rivalryId ? 'Rival Games' : 'Open Games'}
        <span style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
      </div>

      {games.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 11, letterSpacing: 2, padding: 30, border: '1px dashed var(--bd)' }}>
          No open games. Create one and wait for an opponent.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {games.map(g => (
            <div key={g.id} style={{
              background: 'var(--sf)', border: '1px solid var(--bd)', padding: '14px 20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <span style={{ fontWeight: 500 }}>{g.player_x?.display_name || 'Unknown'}</span>
                <span style={{ fontSize: 10, color: modeColors[g.game_mode], letterSpacing: 1, textTransform: 'uppercase', marginLeft: 10 }}>{g.game_mode}</span>
                {g.timer_seconds && (
                  <span style={{ fontSize: 9, color: 'var(--mu)', marginLeft: 8 }}>⏱ {g.timer_seconds}s</span>
                )}
              </div>
              <button className="savebtn" style={{ padding: '6px 16px' }} onClick={() => joinGame(g)}>Join</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Turn Timer Hook ──────────────────────────────────────
function useTurnTimer(game, isMyTurn, winner, onTimeout) {
  const turnTimer = game.timer_seconds || DEFAULT_TURN_TIMER;
  const hasTimer = game.timer_seconds != null;
  const [timer, setTimer] = useState(turnTimer);
  const timerRef = useRef(null);
  const isMyTurnRef = useRef(isMyTurn);

  // Keep ref in sync (W5: fix stale closure)
  useEffect(() => { isMyTurnRef.current = isMyTurn; }, [isMyTurn]);

  useEffect(() => {
    if (!hasTimer || winner || game.status !== 'active') {
      setTimer(turnTimer);
      return;
    }

    const lastMove = new Date(game.last_move_at || game.created_at).getTime();
    const elapsed = Math.floor((Date.now() - lastMove) / 1000);
    setTimer(Math.max(0, turnTimer - elapsed));

    timerRef.current = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, turnTimer - Math.floor((now - lastMove) / 1000));
      setTimer(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        // Only the non-timed-out player's client claims the win
        if (!isMyTurnRef.current) onTimeout();
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [game.last_move_at, game.current_turn, winner, game.status, hasTimer, turnTimer, onTimeout]);

  return { timer, hasTimer };
}

// ── Live Classic Game ────────────────────────────────────
function LiveClassicGame({ game, myRole, onUpdate, onLeave, onForfeit, rivalryId }) {
  const { user, isGuest } = useAuth();
  const [rivalStatus, setRivalStatus] = useState(null); // null | 'checking' | 'none' | 'pending' | 'rivals' | 'sending' | 'sent'
  const [moveError, setMoveError] = useState(null);
  const moveErrorTimer = useRef(null);
  const gridRef = useRef(null);
  const [announce, setAnnounce] = useState('');
  useEffect(() => () => clearTimeout(moveErrorTimer.current), []);

  // Check rivalry status with opponent for "Add as Rival" button
  useEffect(() => {
    if (!game || game.status !== 'finished' || isGuest || rivalryId || game.rivalry_id) return;
    const opponentId = game.player_x_id === user.id ? game.player_o_id : game.player_x_id;
    if (!opponentId) return;
    setRivalStatus('checking');
    (async () => {
      const { data } = await supabase.from('ttt_rivals')
        .select('id, status')
        .or(`and(user_a_id.eq.${user.id},user_b_id.eq.${opponentId}),and(user_a_id.eq.${opponentId},user_b_id.eq.${user.id})`)
        .limit(1);
      if (data && data.length > 0) {
        setRivalStatus(data[0].status === 'accepted' ? 'rivals' : 'pending');
      } else {
        setRivalStatus('none');
      }
    })();
  }, [game?.status, game?.rivalry_id, user?.id, isGuest, rivalryId]);

  async function sendRivalRequest() {
    const opponentId = game.player_x_id === user.id ? game.player_o_id : game.player_x_id;
    if (!opponentId) return;
    setRivalStatus('sending');
    try {
      await supabase.from('ttt_rivals').insert({ user_a_id: user.id, user_b_id: opponentId });
      setRivalStatus('sent');
    } catch { setRivalStatus('none'); }
  }

  const cells = game.board_state?.cells || Array(9).fill(null);
  const winner = checkWin(cells);
  const winLine = winner && winner !== 'T' ? getWinLine(cells) : [];
  const isMyTurn = (game.current_turn === 'X' && myRole === 'X') || (game.current_turn === 'O' && myRole === 'O');
  const prob = !winner ? classicProbability(cells, game.current_turn) : { x: 50, o: 50 };
  const isFinished = winner || game.status === 'finished';

  useEffect(() => {
    if (isFinished) setAnnounce(winner === 'T' ? 'Game over, draw' : winner ? `${winner} wins` : 'Game over');
    else if (isMyTurn) setAnnounce(`Your turn as ${myRole}`);
    else setAnnounce("Opponent's turn");
  }, [game.current_turn, isFinished, isMyTurn, myRole, winner]);

  const handleGridKeyDown = useCallback((e) => {
    if (!gridRef.current) return;
    const btns = Array.from(gridRef.current.querySelectorAll('button[data-cell]'));
    const idx = btns.indexOf(document.activeElement);
    if (idx === -1) return;
    const row = Math.floor(idx / 3), col = idx % 3;
    let next = -1;
    if (e.key === 'ArrowRight') next = row * 3 + ((col + 1) % 3);
    else if (e.key === 'ArrowLeft') next = row * 3 + ((col + 2) % 3);
    else if (e.key === 'ArrowDown') next = ((row + 1) % 3) * 3 + col;
    else if (e.key === 'ArrowUp') next = ((row + 2) % 3) * 3 + col;
    if (next >= 0 && btns[next]) { e.preventDefault(); btns[next].focus(); }
  }, []);

  const handleTimeout = useCallback(async () => {
    const winnerId = game.current_turn === 'X' ? game.player_o_id : game.player_x_id;
    await supabase.from('ttt_live_games').update({
      status: 'finished', winner_id: winnerId, result: 'timeout',
    }).eq('id', game.id).eq('status', 'active');
  }, [game.id, game.current_turn, game.player_o_id, game.player_x_id]);

  const { timer, hasTimer } = useTurnTimer(game, isMyTurn, winner, handleTimeout);

  async function play(i) {
    if (!isMyTurn || cells[i] || winner || game.status !== 'active') return;
    const next = [...cells];
    next[i] = game.current_turn;
    const w = checkWin(next);

    const updates = {
      board_state: { cells: next },
      current_turn: game.current_turn === 'X' ? 'O' : 'X',
      last_move_at: new Date().toISOString(),
    };

    if (w) {
      updates.status = 'finished';
      updates.result = w === 'T' ? 'draw' : (w === 'X' ? 'x_wins' : 'o_wins');
      updates.winner_id = w === 'T' ? null : (w === 'X' ? game.player_x_id : game.player_o_id);
    }

    // Optimistic update: show move instantly before server confirms
    onUpdate({ ...game, ...updates });
    try {
      await serverMove(game.id, { i });
    } catch (err) {
      logError('Move failed:', err);
      onUpdate(game);
      setMoveError('Move failed, please try again');
      clearTimeout(moveErrorTimer.current);
      moveErrorTimer.current = setTimeout(() => setMoveError(null), 3000);
    }
  }

  async function createRematchGame() {
    const newBoard = { cells: Array(9).fill(null) };
    const { data } = await supabase.from('ttt_live_games').insert({
      game_mode: 'classic',
      player_x_id: game.player_o_id, player_o_id: game.player_x_id,
      board_state: newBoard, current_turn: 'X', status: 'active',
      last_move_at: new Date().toISOString(),
      ...(game.league_id ? { league_id: game.league_id } : {}),
      ...(game.rivalry_id ? { rivalry_id: game.rivalry_id } : {}),
      timer_seconds: game.rivalry_id ? null : (game.timer_seconds || null),
    }).select().single();
    if (data) {
      await supabase.from('ttt_live_games').update({ rematch_game_id: data.id }).eq('id', game.id);
      onUpdate(data);
    }
  }

  async function requestRematch() {
    if (game.rematch_requested_by && game.rematch_requested_by !== user.id) {
      await createRematchGame();
    } else if (!game.rematch_requested_by) {
      const { data: updated } = await supabase.from('ttt_live_games')
        .update({ rematch_requested_by: user.id }).eq('id', game.id)
        .is('rematch_requested_by', null).select();
      if (!updated || updated.length === 0) {
        // Race: other player set it first — accept their rematch
        await createRematchGame();
      }
    }
  }

  const [rematchSent, setRematchSent] = useState(false);
  useEffect(() => { setRematchSent(false); }, [game.id]);

  async function sendRematchChallenge() {
    if (!game.rivalry_id || rematchSent) return;
    const opponentId = game.player_x_id === user.id ? game.player_o_id : game.player_x_id;
    await supabase.from('ttt_rival_challenges').insert({
      rivalry_id: game.rivalry_id,
      challenger_id: user.id,
      challenged_id: opponentId,
      game_mode: 'classic',
      status: 'pending',
    });
    setRematchSent(true);
  }

  const xName = game.player_x_name || 'Player X';
  const oName = game.player_o_name || 'Player O';
  const isRivalGame = !!game.rivalry_id || !!rivalryId;
  const iWon = game.winner_id === user.id;
  const isDraw = game.result === 'draw' || winner === 'T';
  const isAbandoned = game.result === 'abandoned';
  const isTimeout = game.result === 'timeout';
  const resultText = isTimeout ? (iWon ? 'Opponent Timed Out!' : 'You Timed Out!')
    : isAbandoned ? (iWon ? 'Opponent Forfeited!' : 'You Forfeited!')
    : isDraw ? 'Draw!'
    : (iWon ? 'You Win!' : 'You Lose!');
  const resultColor = isDraw ? 'var(--mu)' : iWon ? 'var(--gn)' : 'var(--rd)';
  const rematchRequested = !!game.rematch_requested_by;
  const iRequestedRematch = game.rematch_requested_by === user.id;

  return (
    <div style={{ maxWidth: 460, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--mu)' }}>
          {isFinished ? 'Game Over' : isMyTurn ? (
            <span>Your Turn <span style={{ color: 'var(--ac)' }}>({myRole})</span></span>
          ) : (
            <span className="ai-thinking"><span>Opponent's turn</span><span className="dot" /><span className="dot" /><span className="dot" /></span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {hasTimer && !isFinished && (
            <span style={{
              fontFamily: "'Bebas Neue',sans-serif", fontSize: 22,
              color: timer <= 5 ? 'var(--rd)' : timer <= 10 ? 'var(--go)' : 'var(--mu)'
            }}>{timer}s</span>
          )}
          <button className="smbtn" onClick={onLeave}>Leave</button>
          {isRivalGame && !isFinished && <button className="smbtn" onClick={onForfeit} style={{ color: 'var(--rd)', borderColor: 'var(--rd)', fontSize: 9, padding: '4px 8px' }}>Forfeit</button>}
        </div>
      </div>
      <WinProbabilityBar xPct={prob.x} oPct={prob.o} xName={xName} oName={oName} />
      <div role="status" aria-live="polite" style={srOnly}>{announce}</div>
      {moveError && (
        <div style={{ textAlign: 'center', padding: '8px 12px', marginBottom: 8, background: 'rgba(255,71,87,0.1)', border: '1px solid var(--rd)', color: 'var(--rd)', fontSize: 11, letterSpacing: 1.5 }}>{moveError}</div>
      )}
      <div style={{ position: 'relative' }}>
        <div ref={gridRef} role="grid" aria-label="Classic Tic-Tac-Toe board" onKeyDown={handleGridKeyDown} style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 18 }}>
          {cells.map((c, i) => {
            const row = Math.floor(i / 3), col = i % 3;
            const disabled = !!c || !isMyTurn || !!winner || game.status !== 'active';
            return (
              <button key={i} data-cell={i} onClick={() => play(i)} disabled={disabled}
                aria-label={cellLabel(row, col, c)}
                tabIndex={i === 0 ? 0 : -1}
                style={{
                  aspectRatio: '1', background: winLine.includes(i) ? (c === 'X' ? 'rgba(232,255,71,0.08)' : 'rgba(71,200,255,0.08)') : 'var(--sf)',
                  border: '1px solid ' + (winLine.includes(i) ? (c === 'X' ? 'var(--X)' : 'var(--O)') : 'var(--bd)'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(38px,9vw,68px)',
                  cursor: disabled ? 'default' : 'pointer',
                  color: c === 'X' ? 'var(--X)' : c === 'O' ? 'var(--O)' : 'transparent', transition: 'all 0.12s', outline: 'none',
                }}
              >{c}</button>
            );
          })}
        </div>
        {isFinished && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,8,14,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20 }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(28px,7vw,52px)', letterSpacing: 3, color: resultColor }}>
              {resultText}
            </div>
            {(isAbandoned || isTimeout) && (
              <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--mu)', textTransform: 'uppercase' }}>
                {isAbandoned ? 'Game ended by forfeit' : 'Game ended by timeout'}
              </div>
            )}
            {game.left_by && game.left_by !== user.id ? (
              <div style={{ fontSize: 11, letterSpacing: 2, color: 'var(--mu)', textTransform: 'uppercase', animation: 'pulse 1.5s ease-in-out infinite' }}>Opponent has left</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {isRivalGame ? (
                    <>
                      {!rematchSent && (
                        <button className="savebtn" onClick={sendRematchChallenge}>
                          Rematch Challenge
                        </button>
                      )}
                      {rematchSent && <div style={{ fontSize: 10, color: 'var(--gn)', letterSpacing: 2, textTransform: 'uppercase' }}>Challenge Sent!</div>}
                    </>
                  ) : (
                    <>
                      {!iRequestedRematch && (
                        <button className="savebtn" onClick={requestRematch}>
                          {rematchRequested ? 'Accept Rematch' : 'Request Rematch'}
                        </button>
                      )}
                      {iRequestedRematch && <div style={{ fontSize: 10, color: 'var(--hl)', letterSpacing: 2, textTransform: 'uppercase' }}>Waiting for opponent...</div>}
                    </>
                  )}
                  <button className="smbtn" onClick={onLeave}>Back to Lobby</button>
                </div>
                {!isGuest && !isRivalGame && rivalStatus === 'none' && (
                  <button className="smbtn" onClick={sendRivalRequest} style={{ borderColor: 'var(--a3)', color: 'var(--a3)', marginTop: 4 }}>Add as Rival</button>
                )}
                {!isGuest && !isRivalGame && rivalStatus === 'sending' && (
                  <div style={{ fontSize: 10, color: 'var(--a3)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>Sending...</div>
                )}
                {!isGuest && !isRivalGame && (rivalStatus === 'sent' || rivalStatus === 'pending') && (
                  <div style={{ fontSize: 10, color: 'var(--a3)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>Rival Request Sent</div>
                )}
                {!isGuest && !isRivalGame && rivalStatus === 'rivals' && (
                  <div style={{ fontSize: 10, color: 'var(--a3)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>Already Rivals</div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 22, marginTop: 12, fontSize: 10, letterSpacing: 2, color: 'var(--mu)' }}>
        <span style={{ color: 'var(--X)' }}>X = {xName} {myRole === 'X' ? '(you)' : ''}</span>
        <span style={{ color: 'var(--O)' }}>O = {oName} {myRole === 'O' ? '(you)' : ''}</span>
      </div>
    </div>
  );
}

// ── Live Ultimate Game ───────────────────────────────────
function LiveUltimateGame({ game, myRole, onUpdate, onLeave, onForfeit, rivalryId }) {
  const { user, isGuest } = useAuth();
  const [rivalStatus, setRivalStatus] = useState(null);
  const [moveError, setMoveError] = useState(null);
  const moveErrorTimer = useRef(null);
  const [announce, setAnnounce] = useState('');
  useEffect(() => () => clearTimeout(moveErrorTimer.current), []);

  // Check rivalry status with opponent for "Add as Rival" button
  useEffect(() => {
    if (!game || game.status !== 'finished' || isGuest || rivalryId || game.rivalry_id) return;
    const opponentId = game.player_x_id === user.id ? game.player_o_id : game.player_x_id;
    if (!opponentId) return;
    setRivalStatus('checking');
    (async () => {
      const { data } = await supabase.from('ttt_rivals')
        .select('id, status')
        .or(`and(user_a_id.eq.${user.id},user_b_id.eq.${opponentId}),and(user_a_id.eq.${opponentId},user_b_id.eq.${user.id})`)
        .limit(1);
      if (data && data.length > 0) {
        setRivalStatus(data[0].status === 'accepted' ? 'rivals' : 'pending');
      } else {
        setRivalStatus('none');
      }
    })();
  }, [game?.status, game?.rivalry_id, user?.id, isGuest, rivalryId]);

  async function sendRivalRequest() {
    const opponentId = game.player_x_id === user.id ? game.player_o_id : game.player_x_id;
    if (!opponentId) return;
    setRivalStatus('sending');
    try {
      await supabase.from('ttt_rivals').insert({ user_a_id: user.id, user_b_id: opponentId });
      setRivalStatus('sent');
    } catch { setRivalStatus('none'); }
  }

  const bs = game.board_state || {};
  const boards = bs.boards || Array(9).fill(null).map(() => Array(9).fill(null));
  const bWins = bs.bWins || Array(9).fill(null);
  const active = bs.active ?? null;
  const winner = checkWin(bWins);
  const isMyTurn = (game.current_turn === 'X' && myRole === 'X') || (game.current_turn === 'O' && myRole === 'O');
  const prob = !winner ? ultimateProbability(boards, bWins, active) : { x: 50, o: 50 };
  const isFinished = game.status === 'finished' || !!winner;

  useEffect(() => {
    if (isFinished) setAnnounce(winner === 'T' ? 'Game over, draw' : winner ? `${winner} wins` : 'Game over');
    else if (isMyTurn) setAnnounce(`Your turn as ${myRole}` + (active !== null ? `, must play on Board ${active + 1}` : ''));
    else setAnnounce("Opponent's turn");
  }, [game.current_turn, isFinished, isMyTurn, myRole, winner, active]);

  const handleBoardKeyDown = useCallback((e) => {
    const board = e.currentTarget;
    const btns = Array.from(board.querySelectorAll('button[data-cell]'));
    const idx = btns.indexOf(document.activeElement);
    if (idx === -1) return;
    const row = Math.floor(idx / 3), col = idx % 3;
    let next = -1;
    if (e.key === 'ArrowRight') next = row * 3 + ((col + 1) % 3);
    else if (e.key === 'ArrowLeft') next = row * 3 + ((col + 2) % 3);
    else if (e.key === 'ArrowDown') next = ((row + 1) % 3) * 3 + col;
    else if (e.key === 'ArrowUp') next = ((row + 2) % 3) * 3 + col;
    if (next >= 0 && btns[next]) { e.preventDefault(); btns[next].focus(); }
  }, []);

  const handleTimeout = useCallback(async () => {
    const winnerId = game.current_turn === 'X' ? game.player_o_id : game.player_x_id;
    await supabase.from('ttt_live_games').update({
      status: 'finished', winner_id: winnerId, result: 'timeout',
    }).eq('id', game.id).eq('status', 'active');
  }, [game.id, game.current_turn, game.player_o_id, game.player_x_id]);

  const { timer, hasTimer } = useTurnTimer(game, isMyTurn, winner, handleTimeout);

  async function play(bi, ci) {
    if (!isMyTurn || bWins[bi] || (active !== null && active !== bi) || boards[bi][ci] || winner || game.status !== 'active') return;

    // W9: Copy all boards to avoid shared array references
    const nb = boards.map((b, i) => i === bi ? b.map((c, j) => j === ci ? game.current_turn : c) : [...b]);
    const nw = bWins.map((w, i) => i === bi && !w ? checkWin(nb[i]) : w);
    const mw = checkWin(nw);
    const nextActive = nw[ci] ? null : ci;

    const updates = {
      board_state: { boards: nb, bWins: nw, active: nextActive },
      current_turn: game.current_turn === 'X' ? 'O' : 'X',
      last_move_at: new Date().toISOString(),
    };

    if (mw) {
      updates.status = 'finished';
      updates.result = mw === 'T' ? 'draw' : (mw === 'X' ? 'x_wins' : 'o_wins');
      updates.winner_id = mw === 'T' ? null : (mw === 'X' ? game.player_x_id : game.player_o_id);
    } else {
      // Check for draw: no valid moves remaining
      const boardsToCheck = nextActive !== null ? [nextActive] : Array.from({ length: 9 }, (_, i) => i);
      const hasMovesLeft = boardsToCheck.some(b => !nw[b] && nb[b].some(c => !c));
      if (!hasMovesLeft) {
        updates.status = 'finished';
        updates.result = 'draw';
        updates.winner_id = null;
      }
    }

    // Optimistic update: show move instantly before server confirms
    onUpdate({ ...game, ...updates });
    try {
      await serverMove(game.id, { bi, ci });
    } catch (err) {
      logError('Move failed:', err);
      onUpdate(game);
      setMoveError('Move failed, please try again');
      clearTimeout(moveErrorTimer.current);
      moveErrorTimer.current = setTimeout(() => setMoveError(null), 3000);
    }
  }

  async function createRematchGame() {
    const newBoard = { boards: Array(9).fill(null).map(() => Array(9).fill(null)), bWins: Array(9).fill(null), active: null };
    const { data } = await supabase.from('ttt_live_games').insert({
      game_mode: 'ultimate', player_x_id: game.player_o_id, player_o_id: game.player_x_id,
      board_state: newBoard, current_turn: 'X', status: 'active', last_move_at: new Date().toISOString(),
      ...(game.league_id ? { league_id: game.league_id } : {}),
      ...(game.rivalry_id ? { rivalry_id: game.rivalry_id } : {}),
      timer_seconds: game.rivalry_id ? null : (game.timer_seconds || null),
    }).select().single();
    if (data) {
      await supabase.from('ttt_live_games').update({ rematch_game_id: data.id }).eq('id', game.id);
      onUpdate(data);
    }
  }

  async function requestRematch() {
    if (game.rematch_requested_by && game.rematch_requested_by !== user.id) {
      await createRematchGame();
    } else if (!game.rematch_requested_by) {
      const { data: updated } = await supabase.from('ttt_live_games')
        .update({ rematch_requested_by: user.id }).eq('id', game.id)
        .is('rematch_requested_by', null).select();
      if (!updated || updated.length === 0) {
        await createRematchGame();
      }
    }
  }

  const [rematchSent, setRematchSent] = useState(false);
  useEffect(() => { setRematchSent(false); }, [game.id]);

  async function sendRematchChallenge() {
    if (!game.rivalry_id || rematchSent) return;
    const opponentId = game.player_x_id === user.id ? game.player_o_id : game.player_x_id;
    await supabase.from('ttt_rival_challenges').insert({
      rivalry_id: game.rivalry_id,
      challenger_id: user.id,
      challenged_id: opponentId,
      game_mode: 'ultimate',
      status: 'pending',
    });
    setRematchSent(true);
  }

  const xName = game.player_x_name || 'Player X';
  const oName = game.player_o_name || 'Player O';
  const isRivalGame = !!game.rivalry_id || !!rivalryId;
  const iWon = game.winner_id === user.id;
  const isDraw = game.result === 'draw' || winner === 'T';
  const isAbandoned = game.result === 'abandoned';
  const isTimeout = game.result === 'timeout';
  const resultText = isTimeout ? (iWon ? 'Opponent Timed Out!' : 'You Timed Out!')
    : isAbandoned ? (iWon ? 'Opponent Forfeited!' : 'You Forfeited!')
    : isDraw ? 'Draw!'
    : (iWon ? 'You Win!' : 'You Lose!');
  const resultColor = isDraw ? 'var(--mu)' : iWon ? 'var(--gn)' : 'var(--rd)';
  const rematchRequested = !!game.rematch_requested_by;
  const iRequestedRematch = game.rematch_requested_by === user.id;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--mu)' }}>
          {isFinished ? 'Game Over' : isMyTurn ? <span>Your Turn <span style={{ color: 'var(--ac)' }}>({myRole})</span></span>
            : <span className="ai-thinking"><span>Opponent's turn</span><span className="dot" /><span className="dot" /><span className="dot" /></span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {hasTimer && !isFinished && <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: timer <= 5 ? 'var(--rd)' : timer <= 10 ? 'var(--go)' : 'var(--mu)' }}>{timer}s</span>}
          <button className="smbtn" onClick={onLeave}>Leave</button>
          {isRivalGame && !isFinished && <button className="smbtn" onClick={onForfeit} style={{ color: 'var(--rd)', borderColor: 'var(--rd)', fontSize: 9, padding: '4px 8px' }}>Forfeit</button>}
        </div>
      </div>
      <WinProbabilityBar xPct={prob.x} oPct={prob.o} xName={xName} oName={oName} />
      <div role="status" aria-live="polite" style={srOnly}>{announce}</div>
      {moveError && (
        <div style={{ textAlign: 'center', padding: '8px 12px', marginBottom: 8, background: 'rgba(255,71,87,0.1)', border: '1px solid var(--rd)', color: 'var(--rd)', fontSize: 11, letterSpacing: 1.5 }}>{moveError}</div>
      )}
      <div style={{ textAlign: 'center', marginBottom: 14, fontSize: 11, letterSpacing: 2, color: 'var(--mu)', textTransform: 'uppercase' }}>
        {!winner && game.status === 'active' && (active === null
          ? <span>Play on <strong style={{ color: 'var(--hl)' }}>any open board</strong></span>
          : <span>Must play on <strong style={{ color: 'var(--hl)' }}>Board {active + 1}</strong></span>)}
      </div>
      <div style={{ position: 'relative' }}>
        <div role="grid" aria-label="Ultimate Tic-Tac-Toe board" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {Array(9).fill(null).map((_, bi) => {
            const bw = bWins[bi];
            const isAct = !winner && game.status === 'active' && (active === null ? !bw : active === bi);
            const boardStatus = bw === 'X' ? 'Won by X' : bw === 'O' ? 'Won by O' : bw === 'T' ? 'Draw' : isAct ? 'Active' : 'Inactive';
            return (
              <div key={bi} role="group" aria-label={`Board ${bi + 1}, ${boardStatus}`} onKeyDown={handleBoardKeyDown} style={{
                border: '2px solid ' + (isAct ? 'var(--hl)' : bw === 'X' ? 'var(--X)' : bw === 'O' ? 'var(--O)' : 'var(--bd)'),
                padding: 5, position: 'relative',
                background: bw === 'X' ? 'rgba(232,255,71,0.06)' : bw === 'O' ? 'rgba(71,200,255,0.06)' : bw === 'T' ? 'var(--s2)' : 'var(--sf)'
              }}>
                {bw && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(32px,7vw,64px)', color: bw === 'X' ? 'var(--X)' : bw === 'O' ? 'var(--O)' : 'var(--mu)', zIndex: 5, pointerEvents: 'none' }}>{bw === 'T' ? '\u2014' : bw}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 3, opacity: bw ? 0.2 : 1 }}>
                  {boards[bi].map((c, ci) => {
                    const row = Math.floor(ci / 3), col = ci % 3;
                    const disabled = !!c || !!bw || !isAct || !isMyTurn || game.status !== 'active';
                    return (
                      <button key={ci} data-cell={ci} onClick={() => play(bi, ci)} disabled={disabled}
                        aria-label={cellLabel(row, col, c, `Board ${bi + 1}`)}
                        tabIndex={(bi === (active !== null ? active : 0) && ci === 0) ? 0 : -1}
                        style={{
                          aspectRatio: '1', background: 'var(--s2)', border: '1px solid var(--s3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(13px,2.5vw,22px)',
                          cursor: disabled ? 'default' : 'pointer',
                          color: c === 'X' ? 'var(--X)' : c === 'O' ? 'var(--O)' : 'transparent', outline: 'none',
                        }}
                      >{c}</button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {isFinished && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,8,14,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20, zIndex: 20 }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(28px,7vw,52px)', letterSpacing: 3, color: resultColor }}>{resultText}</div>
            {(isAbandoned || isTimeout) && (
              <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--mu)', textTransform: 'uppercase' }}>
                {isAbandoned ? 'Game ended by forfeit' : 'Game ended by timeout'}
              </div>
            )}
            {game.left_by && game.left_by !== user.id ? (
              <div style={{ fontSize: 11, letterSpacing: 2, color: 'var(--mu)', textTransform: 'uppercase', animation: 'pulse 1.5s ease-in-out infinite' }}>Opponent has left</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {isRivalGame ? (
                    <>
                      {!rematchSent && <button className="savebtn" onClick={sendRematchChallenge}>Rematch Challenge</button>}
                      {rematchSent && <div style={{ fontSize: 10, color: 'var(--gn)', letterSpacing: 2, textTransform: 'uppercase' }}>Challenge Sent!</div>}
                    </>
                  ) : (
                    <>
                      {!iRequestedRematch && <button className="savebtn" onClick={requestRematch}>{rematchRequested ? 'Accept Rematch' : 'Request Rematch'}</button>}
                      {iRequestedRematch && <div style={{ fontSize: 10, color: 'var(--hl)', letterSpacing: 2, textTransform: 'uppercase' }}>Waiting for opponent...</div>}
                    </>
                  )}
                  <button className="smbtn" onClick={onLeave}>Back to Lobby</button>
                </div>
                {!isGuest && !isRivalGame && rivalStatus === 'none' && (
                  <button className="smbtn" onClick={sendRivalRequest} style={{ borderColor: 'var(--a3)', color: 'var(--a3)', marginTop: 4 }}>Add as Rival</button>
                )}
                {!isGuest && !isRivalGame && rivalStatus === 'sending' && (
                  <div style={{ fontSize: 10, color: 'var(--a3)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>Sending...</div>
                )}
                {!isGuest && !isRivalGame && (rivalStatus === 'sent' || rivalStatus === 'pending') && (
                  <div style={{ fontSize: 10, color: 'var(--a3)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>Rival Request Sent</div>
                )}
                {!isGuest && !isRivalGame && rivalStatus === 'rivals' && (
                  <div style={{ fontSize: 10, color: 'var(--a3)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>Already Rivals</div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 22, marginTop: 12, fontSize: 10, letterSpacing: 2, color: 'var(--mu)' }}>
        <span style={{ color: 'var(--X)' }}>X = {xName} {myRole === 'X' ? '(you)' : ''}</span>
        <span style={{ color: 'var(--O)' }}>O = {oName} {myRole === 'O' ? '(you)' : ''}</span>
      </div>
    </div>
  );
}

// ── Live MEGA Game ───────────────────────────────────────
function LiveMegaGame({ game, myRole, onUpdate, onLeave, onForfeit, rivalryId }) {
  const { user, isGuest } = useAuth();
  const [rivalStatus, setRivalStatus] = useState(null);
  const [moveError, setMoveError] = useState(null);
  const moveErrorTimer = useRef(null);
  const [announce, setAnnounce] = useState('');
  useEffect(() => () => clearTimeout(moveErrorTimer.current), []);

  useEffect(() => {
    if (!game || game.status !== 'finished' || isGuest || rivalryId || game.rivalry_id) return;
    const opponentId = game.player_x_id === user.id ? game.player_o_id : game.player_x_id;
    if (!opponentId) return;
    setRivalStatus('checking');
    (async () => {
      const { data } = await supabase.from('ttt_rivals')
        .select('id, status')
        .or(`and(user_a_id.eq.${user.id},user_b_id.eq.${opponentId}),and(user_a_id.eq.${opponentId},user_b_id.eq.${user.id})`)
        .limit(1);
      if (data && data.length > 0) {
        setRivalStatus(data[0].status === 'accepted' ? 'rivals' : 'pending');
      } else {
        setRivalStatus('none');
      }
    })();
  }, [game?.status, game?.rivalry_id, user?.id, isGuest, rivalryId]);

  async function sendRivalRequest() {
    const opponentId = game.player_x_id === user.id ? game.player_o_id : game.player_x_id;
    if (!opponentId) return;
    setRivalStatus('sending');
    try {
      await supabase.from('ttt_rivals').insert({ user_a_id: user.id, user_b_id: opponentId });
      setRivalStatus('sent');
    } catch { setRivalStatus('none'); }
  }

  const bs = game.board_state || {};
  const cells = bs.cells || Array(9).fill(null).map(() => Array(9).fill(null).map(() => Array(9).fill(null)));
  const smallW = bs.smallW || Array(9).fill(null).map(() => Array(9).fill(null));
  const midW = bs.midW || Array(9).fill(null);
  const aMid = bs.aMid ?? null;
  const aSmall = bs.aSmall ?? null;
  const metaW = checkWin(midW);
  const isMyTurn = (game.current_turn === 'X' && myRole === 'X') || (game.current_turn === 'O' && myRole === 'O');
  const prob = !metaW ? megaProbability(smallW, midW) : { x: 50, o: 50 };
  const isFinished = game.status === 'finished' || !!metaW;

  useEffect(() => {
    if (isFinished) setAnnounce(metaW === 'T' ? 'Game over, draw' : metaW ? `${metaW} wins` : 'Game over');
    else if (isMyTurn) setAnnounce(`Your turn as ${myRole}`);
    else setAnnounce("Opponent's turn");
  }, [game.current_turn, isFinished, isMyTurn, myRole, metaW]);

  const handleSmallBoardKeyDown = useCallback((e) => {
    const board = e.currentTarget;
    const btns = Array.from(board.querySelectorAll('button[data-cell]'));
    const idx = btns.indexOf(document.activeElement);
    if (idx === -1) return;
    const row = Math.floor(idx / 3), col = idx % 3;
    let next = -1;
    if (e.key === 'ArrowRight') next = row * 3 + ((col + 1) % 3);
    else if (e.key === 'ArrowLeft') next = row * 3 + ((col + 2) % 3);
    else if (e.key === 'ArrowDown') next = ((row + 1) % 3) * 3 + col;
    else if (e.key === 'ArrowUp') next = ((row + 2) % 3) * 3 + col;
    if (next >= 0 && btns[next]) { e.preventDefault(); btns[next].focus(); }
  }, []);

  const handleTimeout = useCallback(async () => {
    const winnerId = game.current_turn === 'X' ? game.player_o_id : game.player_x_id;
    await supabase.from('ttt_live_games').update({
      status: 'finished', winner_id: winnerId, result: 'timeout',
    }).eq('id', game.id).eq('status', 'active');
  }, [game.id, game.current_turn, game.player_o_id, game.player_x_id]);

  const { timer, hasTimer } = useTurnTimer(game, isMyTurn, metaW, handleTimeout);

  function canPlay(mi, si) {
    if (metaW || midW[mi] || smallW[mi][si]) return false;
    if (aMid !== null && aMid !== mi) return false;
    if (aMid === mi && aSmall !== null && aSmall !== si) return false;
    return true;
  }

  async function play(mi, si, ci) {
    if (!isMyTurn || !canPlay(mi, si) || cells[mi][si][ci] || metaW || game.status !== 'active') return;

    const nc = cells.map((m, m2) => m.map((s, s2) => (m2 === mi && s2 === si) ? s.map((c, c2) => c2 === ci ? game.current_turn : c) : [...s]));
    const nsw = smallW.map((m, m2) => m.map((w, s2) => (m2 === mi && s2 === si && !w) ? checkWin(nc[m2][s2]) : w));
    const nmw = midW.map((w, m2) => (m2 === mi && !w) ? checkWin(nsw[m2]) : w);
    const nm = checkWin(nmw);
    const nextMid = nmw[si] ? null : si;
    const nextSmall = nextMid === null ? null : (nsw[nextMid][ci] ? null : ci);

    const updates = {
      board_state: { cells: nc, smallW: nsw, midW: nmw, aMid: nextMid, aSmall: nextSmall },
      current_turn: game.current_turn === 'X' ? 'O' : 'X',
      last_move_at: new Date().toISOString(),
    };

    if (nm) {
      updates.status = 'finished';
      updates.result = nm === 'T' ? 'draw' : (nm === 'X' ? 'x_wins' : 'o_wins');
      updates.winner_id = nm === 'T' ? null : (nm === 'X' ? game.player_x_id : game.player_o_id);
    } else {
      // Check for draw: no valid moves remaining across all 3 levels
      let hasMovesLeft = false;
      for (let m = 0; m < 9 && !hasMovesLeft; m++) {
        if (nmw[m]) continue;
        if (nextMid !== null && nextMid !== m) continue;
        for (let s = 0; s < 9 && !hasMovesLeft; s++) {
          if (nsw[m][s]) continue;
          if (nextMid === m && nextSmall !== null && nextSmall !== s) continue;
          if (nc[m][s].some(c => !c)) hasMovesLeft = true;
        }
      }
      if (!hasMovesLeft) {
        updates.status = 'finished';
        updates.result = 'draw';
        updates.winner_id = null;
      }
    }

    // Optimistic update: show move instantly before server confirms
    onUpdate({ ...game, ...updates });
    try {
      await serverMove(game.id, { mi, si, ci });
    } catch (err) {
      logError('Move failed:', err);
      onUpdate(game);
      setMoveError('Move failed, please try again');
      clearTimeout(moveErrorTimer.current);
      moveErrorTimer.current = setTimeout(() => setMoveError(null), 3000);
    }
  }

  async function createRematchGame() {
    const newBoard = {
      cells: Array(9).fill(null).map(() => Array(9).fill(null).map(() => Array(9).fill(null))),
      smallW: Array(9).fill(null).map(() => Array(9).fill(null)),
      midW: Array(9).fill(null), aMid: null, aSmall: null,
    };
    const { data } = await supabase.from('ttt_live_games').insert({
      game_mode: 'mega', player_x_id: game.player_o_id, player_o_id: game.player_x_id,
      board_state: newBoard, current_turn: 'X', status: 'active', last_move_at: new Date().toISOString(),
      ...(game.league_id ? { league_id: game.league_id } : {}),
      ...(game.rivalry_id ? { rivalry_id: game.rivalry_id } : {}),
      timer_seconds: game.rivalry_id ? null : (game.timer_seconds || null),
    }).select().single();
    if (data) {
      await supabase.from('ttt_live_games').update({ rematch_game_id: data.id }).eq('id', game.id);
      onUpdate(data);
    }
  }

  async function requestRematch() {
    if (game.rematch_requested_by && game.rematch_requested_by !== user.id) {
      await createRematchGame();
    } else if (!game.rematch_requested_by) {
      const { data: updated } = await supabase.from('ttt_live_games')
        .update({ rematch_requested_by: user.id }).eq('id', game.id)
        .is('rematch_requested_by', null).select();
      if (!updated || updated.length === 0) {
        await createRematchGame();
      }
    }
  }

  const [rematchSent, setRematchSent] = useState(false);
  useEffect(() => { setRematchSent(false); }, [game.id]);

  async function sendRematchChallenge() {
    if (!game.rivalry_id || rematchSent) return;
    const opponentId = game.player_x_id === user.id ? game.player_o_id : game.player_x_id;
    await supabase.from('ttt_rival_challenges').insert({
      rivalry_id: game.rivalry_id,
      challenger_id: user.id,
      challenged_id: opponentId,
      game_mode: 'mega',
      status: 'pending',
    });
    setRematchSent(true);
  }

  const xName = game.player_x_name || 'Player X';
  const oName = game.player_o_name || 'Player O';
  const isRivalGame = !!game.rivalry_id || !!rivalryId;
  const iWon = game.winner_id === user.id;
  const isDraw = game.result === 'draw' || metaW === 'T';
  const isAbandoned = game.result === 'abandoned';
  const isTimeout = game.result === 'timeout';
  const resultText = isTimeout ? (iWon ? 'Opponent Timed Out!' : 'You Timed Out!')
    : isAbandoned ? (iWon ? 'Opponent Forfeited!' : 'You Forfeited!')
    : isDraw ? 'Draw!'
    : (iWon ? 'You Win!' : 'You Lose!');
  const resultColor = isDraw ? 'var(--mu)' : iWon ? 'var(--gn)' : 'var(--rd)';
  const rematchRequested = !!game.rematch_requested_by;
  const iRequestedRematch = game.rematch_requested_by === user.id;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--mu)' }}>
          {isFinished ? 'Game Over' : isMyTurn ? <span>Your Turn <span style={{ color: 'var(--ac)' }}>({myRole})</span></span>
            : <span className="ai-thinking"><span>Opponent's turn</span><span className="dot" /><span className="dot" /><span className="dot" /></span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {hasTimer && !isFinished && <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: timer <= 5 ? 'var(--rd)' : timer <= 10 ? 'var(--go)' : 'var(--mu)' }}>{timer}s</span>}
          <button className="smbtn" onClick={onLeave}>Leave</button>
          {isRivalGame && !isFinished && <button className="smbtn" onClick={onForfeit} style={{ color: 'var(--rd)', borderColor: 'var(--rd)', fontSize: 9, padding: '4px 8px' }}>Forfeit</button>}
        </div>
      </div>
      <WinProbabilityBar xPct={prob.x} oPct={prob.o} xName={xName} oName={oName} />
      {moveError && (
        <div style={{ textAlign: 'center', padding: '8px 12px', marginBottom: 8, background: 'rgba(255,71,87,0.1)', border: '1px solid var(--rd)', color: 'var(--rd)', fontSize: 11, letterSpacing: 1.5 }}>{moveError}</div>
      )}
      <div style={{ textAlign: 'center', marginBottom: 12, fontSize: 10, letterSpacing: 2, color: 'var(--mu)', textTransform: 'uppercase', lineHeight: 1.8 }}>
        {!metaW && game.status === 'active' && (aMid === null
          ? <span>Play in <strong style={{ color: 'var(--mega)' }}>any mid-board</strong></span>
          : aSmall === null
            ? <span>Mid <strong style={{ color: 'var(--mega)' }}>{aMid + 1}</strong> — <strong style={{ color: 'var(--hl)' }}>any small board</strong></span>
            : <span>Mid <strong style={{ color: 'var(--mega)' }}>{aMid + 1}</strong> / Small <strong style={{ color: 'var(--hl)' }}>{aSmall + 1}</strong></span>
        )}
      </div>
      <div role="status" aria-live="polite" style={srOnly}>{announce}</div>
      <div style={{ position: 'relative', overflowX: 'auto' }}>
        <div role="grid" aria-label="MEGA Tic-Tac-Toe board" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, minWidth: 300 }}>
          {Array(9).fill(null).map((_, mi) => {
            const mw = midW[mi];
            const midAct = !metaW && game.status === 'active' && (aMid === null ? !mw : aMid === mi);
            return (
              <div key={mi} role="group" aria-label={`Mid-board ${mi + 1}${mw ? (mw === 'T' ? ', drawn' : `, won by ${mw}`) : midAct ? ', active' : ''}`} style={{
                border: '2px solid ' + (midAct ? 'var(--mega)' : mw === 'X' ? 'var(--X)' : mw === 'O' ? 'var(--O)' : 'var(--bd)'),
                padding: 4, position: 'relative',
                background: mw === 'X' ? 'rgba(232,255,71,0.05)' : mw === 'O' ? 'rgba(71,200,255,0.05)' : 'transparent',
                opacity: mw === 'T' ? 0.4 : 1
              }}>
                {mw && mw !== 'T' && (
                  <div aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(20px,4vw,40px)', color: mw === 'X' ? 'var(--X)' : 'var(--O)', zIndex: 5, pointerEvents: 'none' }}>{mw}</div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 3, opacity: mw ? 0.15 : 1 }}>
                  {Array(9).fill(null).map((_, si) => {
                    const sw = smallW[mi][si];
                    const smAct = canPlay(mi, si);
                    return (
                      <div key={si} role="group" aria-label={`Small-board ${si + 1}${sw ? (sw === 'T' ? ', drawn' : `, won by ${sw}`) : smAct ? ', active' : ''}`} onKeyDown={handleSmallBoardKeyDown} style={{
                        border: '1px solid ' + (smAct && !sw ? 'var(--hl)' : 'var(--s3)'),
                        padding: 2, position: 'relative',
                        background: sw === 'X' ? 'rgba(232,255,71,0.08)' : sw === 'O' ? 'rgba(71,200,255,0.08)' : 'transparent',
                        opacity: sw === 'T' ? 0.35 : 1
                      }}>
                        {sw && sw !== 'T' && (
                          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(10px,2vw,18px)', color: sw === 'X' ? 'var(--X)' : 'var(--O)', zIndex: 4, pointerEvents: 'none' }}>{sw}</div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, opacity: sw ? 0.15 : 1 }}>
                          {cells[mi][si].map((c, ci) => {
                            const disabled = !!c || !!mw || !!sw || !smAct || !isMyTurn || game.status !== 'active';
                            const row = Math.floor(ci / 3), col = ci % 3;
                            return (
                              <button key={ci} data-cell={ci} onClick={() => play(mi, si, ci)} disabled={disabled}
                                aria-label={cellLabel(row, col, c, `mid ${mi + 1} small ${si + 1}`)}
                                tabIndex={(mi === (aMid ?? 0) && si === (aSmall ?? 0) && ci === 0) ? 0 : -1}
                                style={{
                                  aspectRatio: '1', background: 'var(--s3)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(7px,1.4vw,13px)',
                                  cursor: disabled ? 'default' : 'pointer',
                                  color: c === 'X' ? 'var(--X)' : c === 'O' ? 'var(--O)' : 'transparent',
                                  border: 'none', padding: 0, outline: 'none', boxShadow: 'none'
                                }}>{c}</button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {isFinished && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,8,14,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20, zIndex: 20 }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(28px,7vw,52px)', letterSpacing: 3, color: resultColor }}>{resultText}</div>
            {(isAbandoned || isTimeout) && (
              <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--mu)', textTransform: 'uppercase' }}>
                {isAbandoned ? 'Game ended by forfeit' : 'Game ended by timeout'}
              </div>
            )}
            {game.left_by && game.left_by !== user.id ? (
              <div style={{ fontSize: 11, letterSpacing: 2, color: 'var(--mu)', textTransform: 'uppercase', animation: 'pulse 1.5s ease-in-out infinite' }}>Opponent has left</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {isRivalGame ? (
                    <>
                      {!rematchSent && <button className="savebtn" onClick={sendRematchChallenge}>Rematch Challenge</button>}
                      {rematchSent && <div style={{ fontSize: 10, color: 'var(--gn)', letterSpacing: 2, textTransform: 'uppercase' }}>Challenge Sent!</div>}
                    </>
                  ) : (
                    <>
                      {!iRequestedRematch && <button className="savebtn" onClick={requestRematch}>{rematchRequested ? 'Accept Rematch' : 'Request Rematch'}</button>}
                      {iRequestedRematch && <div style={{ fontSize: 10, color: 'var(--hl)', letterSpacing: 2, textTransform: 'uppercase' }}>Waiting for opponent...</div>}
                    </>
                  )}
                  <button className="smbtn" onClick={onLeave}>Back to Lobby</button>
                </div>
                {!isGuest && !isRivalGame && rivalStatus === 'none' && (
                  <button className="smbtn" onClick={sendRivalRequest} style={{ borderColor: 'var(--a3)', color: 'var(--a3)', marginTop: 4 }}>Add as Rival</button>
                )}
                {!isGuest && !isRivalGame && rivalStatus === 'sending' && (
                  <div style={{ fontSize: 10, color: 'var(--a3)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>Sending...</div>
                )}
                {!isGuest && !isRivalGame && (rivalStatus === 'sent' || rivalStatus === 'pending') && (
                  <div style={{ fontSize: 10, color: 'var(--a3)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>Rival Request Sent</div>
                )}
                {!isGuest && !isRivalGame && rivalStatus === 'rivals' && (
                  <div style={{ fontSize: 10, color: 'var(--a3)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>Already Rivals</div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 22, marginTop: 12, fontSize: 10, letterSpacing: 2, color: 'var(--mu)' }}>
        <span style={{ color: 'var(--X)' }}>X = {xName} {myRole === 'X' ? '(you)' : ''}</span>
        <span style={{ color: 'var(--O)' }}>O = {oName} {myRole === 'O' ? '(you)' : ''}</span>
      </div>
    </div>
  );
}

// ── Waiting Screen ───────────────────────────────────────
function WaitingScreen({ game, onCancel, onJoinGame, userId, leagueId, rivalryId }) {
  // Auto-match: look for other waiting games of the same mode/context and join them
  useEffect(() => {
    if (!userId || game.status !== 'waiting') return;

    const tryAutoMatch = async () => {
      let query = supabase
        .from('ttt_live_games')
        .select('*')
        .eq('status', 'waiting')
        .eq('game_mode', game.game_mode)
        .neq('player_x_id', userId)
        .neq('id', game.id)
        .order('created_at', { ascending: true })
        .limit(1);

      // Match the same context (league / rival / public)
      if (leagueId) {
        query = query.eq('league_id', leagueId);
      } else if (rivalryId) {
        query = query.eq('rivalry_id', rivalryId);
      } else {
        query = query.is('league_id', null).is('rivalry_id', null);
      }

      const { data: games } = await query;
      if (!games || games.length === 0) return;

      const target = games[0];
      // Try to join the other game (status guard prevents race conditions)
      const { data: joined } = await supabase
        .from('ttt_live_games')
        .update({ player_o_id: userId, status: 'active', last_move_at: new Date().toISOString() })
        .eq('id', target.id)
        .eq('status', 'waiting')
        .select()
        .single();

      if (joined) {
        // Successfully joined the other game — delete our own waiting game
        await supabase.from('ttt_live_games').delete().eq('id', game.id);
        onJoinGame(joined);
      }
    };

    // Run immediately, then every 2 seconds
    tryAutoMatch();
    const interval = setInterval(tryAutoMatch, 2000);
    return () => clearInterval(interval);
  }, [userId, game.id, game.status, game.game_mode, leagueId, rivalryId, onJoinGame]);

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', textAlign: 'center', padding: 40 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 2, color: 'var(--ac)', marginBottom: 12 }}>
        Waiting for Opponent
      </div>
      <div className="ai-thinking" style={{ justifyContent: 'center', marginBottom: 20 }}>
        <span>Searching</span><span className="dot" /><span className="dot" /><span className="dot" />
      </div>
      <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 8 }}>
        Game Mode: <span style={{ color: game.game_mode === 'classic' ? 'var(--X)' : game.game_mode === 'mega' ? 'var(--mega)' : 'var(--O)' }}>{game.game_mode}</span>
      </div>
      {game.timer_seconds && (
        <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 8 }}>
          Timer: <span style={{ color: 'var(--hl)' }}>{game.timer_seconds}s per turn</span>
        </div>
      )}
      <div style={{ fontSize: 10, letterSpacing: 1, color: 'var(--mu)', marginBottom: 24 }}>
        Share the lobby link or wait for someone to join.
      </div>
      <button className="smbtn" onClick={onCancel}>Cancel</button>
    </div>
  );
}

// ── Main LiveGame Component ──────────────────────────────
export default function LiveGame({ leagueId, leagueName, rivalryId, rivalName, initialMode, tournamentMatchId, tournamentName, gameId }) {
  const { user, isGuest, signInAsGuest, signOut } = useAuth();
  const [currentGame, setCurrentGame] = useState(null);
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState(null);

  // Subscribe to game updates
  // C2: Result recording is now handled server-side by the handle_ttt_game_finished trigger
  useEffect(() => {
    if (!currentGame) return;

    const channel = supabase.channel(`game-${currentGame.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ttt_live_games', filter: `id=eq.${currentGame.id}` },
        async (payload) => {
          const updated = payload.new;

          // Rematch: opponent created a new game and linked it via rematch_game_id
          if (updated.rematch_game_id && updated.status === 'finished') {
            const { data: newGame } = await supabase.from('ttt_live_games')
              .select('*').eq('id', updated.rematch_game_id).single();
            if (newGame) {
              setCurrentGame(newGame);
              return;
            }
          }

          // Opponent left the post-game lobby — auto-close after 2s
          if (updated.left_by && updated.left_by !== user?.id && updated.status === 'finished') {
            setCurrentGame(prev => ({ ...prev, ...updated }));
            setTimeout(() => setCurrentGame(null), 2000);
            return;
          }

          setCurrentGame(prev => ({ ...prev, ...updated }));

          // Check trophies when game finishes (fire-and-forget)
          if (updated.status === 'finished' && user && !isGuest) {
            checkMilestones(user.id).catch(() => {});
            checkAchievements(user.id, {
              winnerId: updated.winner_id || null,
              gameMode: updated.game_mode,
              matchType: updated.league_id ? 'league' : updated.rivalry_id ? 'rival' : 'pvp',
              createdAt: new Date().toISOString(),
            }).catch(() => {});
          }

          // Tournament series progression
          if (updated.status === 'finished' && updated.tournament_match_id) {
            handleTournamentGameFinished(updated).catch(err => logError('Tournament series error:', err));
          }

          // Auto-join: when a public league game finishes, ensure both players are members
          if (updated.status === 'finished' && updated.league_id) {
            autoJoinLeague(updated.league_id, [updated.player_x_id, updated.player_o_id].filter(Boolean));
          }
        })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentGame?.id]);

  // Fetch player names when game starts or opponent joins
  useEffect(() => {
    if (!currentGame) return;
    const ids = [currentGame.player_x_id, currentGame.player_o_id].filter(Boolean);
    if (ids.length === 0) return;
    // Skip if both real names are already loaded
    if (currentGame.player_x_name && currentGame.player_x_name !== 'Player X' &&
        currentGame.player_o_name && currentGame.player_o_name !== 'Player O') return;
    async function fetchNames() {
      const { data } = await supabase.from('ttt_profiles').select('id, display_name').in('id', ids);
      if (data) {
        const names = {};
        data.forEach(p => { names[p.id] = p.display_name; });
        setCurrentGame(prev => ({
          ...prev,
          player_x_name: names[prev.player_x_id] || 'Player X',
          player_o_name: names[prev.player_o_id] || 'Player O',
        }));
      }
    }
    fetchNames();
  }, [currentGame?.player_x_id, currentGame?.player_o_id]);

  // Check for active games on mount (clean up stale waiting games)
  useEffect(() => {
    if (!user) return;
    async function checkActive() {
      // If we have a direct game ID (e.g. from rival challenge auto-nav), fetch it directly
      if (gameId) {
        const { data } = await supabase
          .from('ttt_live_games')
          .select('*')
          .eq('id', gameId)
          .single();
        if (data) {
          setCurrentGame(data);
          return;
        }
      }

      let query = supabase
        .from('ttt_live_games')
        .select('*')
        .or(`player_x_id.eq.${user.id},player_o_id.eq.${user.id}`)
        .in('status', ['waiting', 'active'])
        .order('created_at', { ascending: false })
        .limit(1);

      // Filter by context so we don't pull user into wrong game type
      if (leagueId) {
        query = query.eq('league_id', leagueId);
      } else if (rivalryId) {
        query = query.eq('rivalry_id', rivalryId);
      } else {
        query = query.is('league_id', null).is('rivalry_id', null);
      }

      const { data } = await query;
      if (data?.[0]) {
        // Clean up stale waiting games older than 5 minutes
        if (data[0].status === 'waiting') {
          const age = Date.now() - new Date(data[0].created_at).getTime();
          if (age > 5 * 60 * 1000) {
            await supabase.from('ttt_live_games').delete().eq('id', data[0].id);
            return; // Show lobby instead of stale WaitingScreen
          }
        }
        setCurrentGame(data[0]);
      }
    }
    checkActive();
  }, [user, leagueId, rivalryId, gameId]);

  // Handle tournament game completion: update series score, advance bracket
  async function handleTournamentGameFinished(game) {
    if (!game.tournament_match_id) return;

    // Fetch the tournament match
    const { data: tMatch } = await supabase
      .from('ttt_tournament_matches')
      .select('*, tournament:ttt_tournaments!tournament_id(id, best_of, league_id, name, trophy_name)')
      .eq('id', game.tournament_match_id)
      .single();
    if (!tMatch) return;

    const bestOf = tMatch.tournament?.best_of || 1;
    const winnerId = game.winner_id;

    // Determine game result (draw doesn't count in series)
    if (!winnerId) {
      // Record the game but don't update series
      const gameCount = tMatch.player_a_wins + tMatch.player_b_wins + 1;
      await supabase.from('ttt_tournament_games').insert({
        tournament_match_id: tMatch.id,
        live_game_id: game.id,
        game_number: gameCount,
        winner_id: null,
        result: 'draw',
      });
      return;
    }

    // Update series score
    const isPlayerA = winnerId === tMatch.player_a_id;
    const newAWins = tMatch.player_a_wins + (isPlayerA ? 1 : 0);
    const newBWins = tMatch.player_b_wins + (isPlayerA ? 0 : 1);

    // Record the individual game
    const gameCount = tMatch.player_a_wins + tMatch.player_b_wins + 1;
    await supabase.from('ttt_tournament_games').insert({
      tournament_match_id: tMatch.id,
      live_game_id: game.id,
      game_number: gameCount,
      winner_id: winnerId,
      result: game.winner_id === game.player_x_id ? 'x_wins' : 'o_wins',
    });

    // Update match series score
    await supabase.from('ttt_tournament_matches').update({
      player_a_wins: newAWins,
      player_b_wins: newBWins,
    }).eq('id', tMatch.id);

    // Check if series is decided
    const { decided, winner: seriesWinner } = isSeriesDecided(newAWins, newBWins, bestOf);
    if (!decided) return;

    const seriesWinnerId = seriesWinner === 'a' ? tMatch.player_a_id : tMatch.player_b_id;

    // Complete the match
    await supabase.from('ttt_tournament_matches').update({
      winner_id: seriesWinnerId,
      status: 'completed',
    }).eq('id', tMatch.id);

    // Advance winner to next match
    if (tMatch.next_match_id) {
      const slot = tMatch.next_match_slot === 'a' ? 'player_a_id' : 'player_b_id';
      await supabase.from('ttt_tournament_matches').update({
        [slot]: seriesWinnerId,
      }).eq('id', tMatch.next_match_id);

      // Check if next match now has both players → set active
      const { data: nextMatch } = await supabase.from('ttt_tournament_matches')
        .select('player_a_id, player_b_id').eq('id', tMatch.next_match_id).single();
      if (nextMatch?.player_a_id && nextMatch?.player_b_id) {
        await supabase.from('ttt_tournament_matches').update({ status: 'active' }).eq('id', tMatch.next_match_id);
      }
    } else {
      // This was the final match — tournament complete!
      const tournamentId = tMatch.tournament_id;
      await supabase.from('ttt_tournaments').update({
        status: 'completed',
        winner_id: seriesWinnerId,
      }).eq('id', tournamentId);

      // Auto-grant award + tournament_champ achievement
      if (tMatch.tournament) {
        await supabase.from('ttt_awards').insert({
          user_id: seriesWinnerId,
          league_id: tMatch.tournament.league_id,
          tournament_id: tournamentId,
          award_type: 'tournament_winner',
          title: tMatch.tournament.trophy_name || `${tMatch.tournament.name} Champion`,
          description: `Winner of ${tMatch.tournament.name}`,
        });
        await supabase.from('ttt_achievements').insert({
          user_id: seriesWinnerId,
          achievement_key: 'tournament_champ',
          metadata: { tournament_id: tournamentId },
        }).then(() => {}).catch(() => {}); // ON CONFLICT DO NOTHING via DB
      }
    }

    // Check for comeback_kid achievement (trailing 0-2 in Bo5+)
    if (bestOf >= 5) {
      const loserWins = seriesWinner === 'a' ? newBWins : newAWins;
      if (loserWins >= 2) {
        // Winner came back from at least 0-2
        await supabase.from('ttt_achievements').insert({
          user_id: seriesWinnerId,
          achievement_key: 'comeback_kid',
          metadata: { tournament_match_id: tMatch.id },
        }).then(() => {}).catch(() => {});
      }
    }
  }

  // Auto-add players as league members when a public league game finishes
  async function autoJoinLeague(leagueId, playerIds) {
    try {
      // Check if league is public and fetch qualifier requirements
      const { data: league } = await supabase
        .from('ttt_leagues')
        .select('is_public, req_min_games, req_min_wins, req_min_win_pct, req_min_elo')
        .eq('id', leagueId)
        .single();
      if (!league?.is_public) return;

      const leagueHasReqs = league.req_min_games != null || league.req_min_wins != null ||
        league.req_min_win_pct != null || league.req_min_elo != null;

      // For each player, check membership and add if missing
      for (const pid of playerIds) {
        const { data: existing } = await supabase
          .from('ttt_league_members')
          .select('id')
          .eq('league_id', leagueId)
          .eq('user_id', pid)
          .single();
        if (!existing) {
          // Check qualifiers if league has requirements
          if (leagueHasReqs) {
            const { data: pStats } = await supabase
              .from('ttt_player_stats')
              .select('*')
              .eq('user_id', pid);
            let totalW = 0, totalL = 0, totalD = 0, maxElo = 0;
            (pStats || []).forEach(s => {
              totalW += s.wins || 0; totalL += s.losses || 0; totalD += s.draws || 0;
              if ((s.elo_rating || 0) > maxElo) maxElo = s.elo_rating;
            });
            const totalGP = totalW + totalL + totalD;
            const winPct = totalGP > 0 ? ((totalW + 0.5 * totalD) / totalGP) * 100 : 0;
            if (maxElo === 0) maxElo = 1200;
            if (league.req_min_games != null && totalGP < league.req_min_games) continue;
            if (league.req_min_wins != null && totalW < league.req_min_wins) continue;
            if (league.req_min_win_pct != null && winPct < league.req_min_win_pct) continue;
            if (league.req_min_elo != null && maxElo < league.req_min_elo) continue;
          }
          await supabase.from('ttt_league_members').insert({
            league_id: leagueId,
            user_id: pid,
            role: 'member',
          });
        }
      }
    } catch (err) {
      // Silent fail — membership is a convenience, not critical
      logError('Auto-join league failed:', err);
    }
  }

  async function handleLeave() {
    if (currentGame) {
      if (currentGame.status === 'waiting') {
        await supabase.from('ttt_live_games').delete().eq('id', currentGame.id);
      } else if (currentGame.status === 'active') {
        // Rival games: leave temporarily — opponent can wait, game stays active
        // Player can rejoin via checkActive on remount
        if (currentGame.rivalry_id) {
          setCurrentGame(null);
          return;
        }
        // Non-rival: confirm before forfeiting
        if (!confirm('Leaving an active game counts as a forfeit. Your opponent will be awarded the win.')) return;
        const winnerId = currentGame.player_x_id === user.id ? currentGame.player_o_id : currentGame.player_x_id;
        await supabase.from('ttt_live_games').update({
          status: 'finished', winner_id: winnerId, result: 'abandoned'
        }).eq('id', currentGame.id);
      } else if (currentGame.status === 'finished') {
        // Signal to opponent that we left the post-game lobby
        await supabase.from('ttt_live_games').update({ left_by: user.id }).eq('id', currentGame.id).catch(() => {});
      }
    }
    setCurrentGame(null);
  }

  async function handleForfeit() {
    if (!currentGame || currentGame.status !== 'active') return;
    if (!confirm('Forfeit this game? This counts as a loss.')) return;
    const winnerId = currentGame.player_x_id === user.id ? currentGame.player_o_id : currentGame.player_x_id;
    await supabase.from('ttt_live_games').update({
      status: 'finished', winner_id: winnerId, result: 'abandoned'
    }).eq('id', currentGame.id);
    setCurrentGame(null);
  }

  async function handlePlayAsGuest() {
    setGuestLoading(true);
    try {
      await signInAsGuest();
      // Auth state change will update user, which triggers the rest
    } catch (err) {
      logError('Guest sign-in failed:', err);
      setGuestError('Guest play is not available right now. Please sign in or try again later.');
    }
    setGuestLoading(false);
  }

  if (!user) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: 'var(--ac)', marginBottom: 10 }}>Live Multiplayer</div>
      <div style={{ fontSize: 11, color: 'var(--mu)', letterSpacing: 1.5, marginBottom: 20 }}>Sign in to play live games, or play as a guest.</div>
      <button
        className="savebtn"
        onClick={handlePlayAsGuest}
        disabled={guestLoading}
        style={{ padding: '10px 28px', fontSize: 12, letterSpacing: 2 }}
      >
        {guestLoading ? 'Loading...' : 'Play as Guest'}
      </button>
      <div style={{ fontSize: 9, color: 'var(--mu)', letterSpacing: 1.5, marginTop: 10 }}>
        Guest games won't affect ranked stats
      </div>
      {guestError && (
        <div style={{ color: 'var(--rd)', fontSize: 10, letterSpacing: 1.5, marginTop: 12 }}>{guestError}</div>
      )}
    </div>
  );

  if (!currentGame) return <Lobby onJoinGame={setCurrentGame} leagueId={leagueId} leagueName={leagueName} rivalryId={rivalryId} rivalName={rivalName} initialMode={initialMode} tournamentMatchId={tournamentMatchId} tournamentName={tournamentName} />;
  if (currentGame.status === 'waiting') return <WaitingScreen game={currentGame} onCancel={handleLeave} onJoinGame={setCurrentGame} userId={user.id} leagueId={leagueId} rivalryId={rivalryId} />;

  const myRole = currentGame.player_x_id === user.id ? 'X' : 'O';

  if (currentGame.game_mode === 'mega') {
    return <LiveMegaGame game={currentGame} myRole={myRole} onUpdate={setCurrentGame} onLeave={handleLeave} onForfeit={handleForfeit} rivalryId={rivalryId} />;
  }

  if (currentGame.game_mode === 'ultimate') {
    return <LiveUltimateGame game={currentGame} myRole={myRole} onUpdate={setCurrentGame} onLeave={handleLeave} onForfeit={handleForfeit} rivalryId={rivalryId} />;
  }

  return <LiveClassicGame game={currentGame} myRole={myRole} onUpdate={setCurrentGame} onLeave={handleLeave} onForfeit={handleForfeit} rivalryId={rivalryId} />;
}
