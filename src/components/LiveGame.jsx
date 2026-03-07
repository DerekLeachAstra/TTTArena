import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { checkWin, getWinLine, calcElo } from '../lib/gameLogic';
import WinProbabilityBar from './WinProbabilityBar';
import { classicProbability, ultimateProbability } from '../ai/probability';

const TURN_TIMER = 30;

// Handle PvP game completion: record match, update global ELO, update league stats
// Only player_x's client runs this to avoid double-counting from both clients
async function handlePvPGameFinished(game, userId) {
  if (!game.player_x_id || !game.player_o_id || userId !== game.player_x_id) return;

  const isDraw = game.result === 'draw';
  const winnerId = game.winner_id;
  const xWon = !isDraw && winnerId === game.player_x_id;
  const oWon = !isDraw && winnerId === game.player_o_id;
  const matchType = game.league_id ? 'league' : 'pvp';

  try {
    // 1. Insert match record
    await supabase.from('ttt_matches').insert({
      game_mode: game.game_mode,
      player_x_id: game.player_x_id,
      player_o_id: game.player_o_id,
      winner_id: isDraw ? null : winnerId,
      result: game.result,
      is_draw: isDraw,
      match_type: matchType,
      league_id: game.league_id || null,
      completed_at: new Date().toISOString(),
    });

    // 2. Update global ELO for both players
    const [{ data: xStats }, { data: oStats }] = await Promise.all([
      supabase.from('ttt_player_stats').select('*').eq('user_id', game.player_x_id).eq('game_mode', game.game_mode).single(),
      supabase.from('ttt_player_stats').select('*').eq('user_id', game.player_o_id).eq('game_mode', game.game_mode).single(),
    ]);

    const xElo = xStats?.elo_rating || 1200;
    const oElo = oStats?.elo_rating || 1200;

    let xDelta, oDelta;
    if (isDraw) {
      const r = calcElo(xElo, oElo, true);
      xDelta = r.winnerDelta;
      oDelta = r.loserDelta;
    } else if (xWon) {
      const r = calcElo(xElo, oElo, false);
      xDelta = r.winnerDelta;
      oDelta = r.loserDelta;
    } else {
      const r = calcElo(oElo, xElo, false);
      oDelta = r.winnerDelta;
      xDelta = r.loserDelta;
    }

    // Upsert player X stats
    if (xStats) {
      const u = { elo_rating: Math.max(0, xElo + xDelta), updated_at: new Date().toISOString() };
      if (isDraw) u.draws = (xStats.draws || 0) + 1;
      else if (xWon) u.wins = (xStats.wins || 0) + 1;
      else u.losses = (xStats.losses || 0) + 1;
      await supabase.from('ttt_player_stats').update(u).eq('id', xStats.id);
    } else {
      await supabase.from('ttt_player_stats').insert({
        user_id: game.player_x_id, game_mode: game.game_mode,
        elo_rating: Math.max(0, 1200 + xDelta),
        wins: xWon ? 1 : 0, losses: oWon ? 1 : 0, draws: isDraw ? 1 : 0,
      });
    }

    // Upsert player O stats
    if (oStats) {
      const u = { elo_rating: Math.max(0, oElo + oDelta), updated_at: new Date().toISOString() };
      if (isDraw) u.draws = (oStats.draws || 0) + 1;
      else if (oWon) u.wins = (oStats.wins || 0) + 1;
      else u.losses = (oStats.losses || 0) + 1;
      await supabase.from('ttt_player_stats').update(u).eq('id', oStats.id);
    } else {
      await supabase.from('ttt_player_stats').insert({
        user_id: game.player_o_id, game_mode: game.game_mode,
        elo_rating: Math.max(0, 1200 + oDelta),
        wins: oWon ? 1 : 0, losses: xWon ? 1 : 0, draws: isDraw ? 1 : 0,
      });
    }

    // 3. If league game, also update league stats
    if (game.league_id) {
      const { data: leagueData } = await supabase
        .from('ttt_leagues').select('season').eq('id', game.league_id).single();
      const season = leagueData?.season || 1;

      for (const playerId of [game.player_x_id, game.player_o_id]) {
        const isWinner = !isDraw && winnerId === playerId;
        const isLoser = !isDraw && winnerId !== playerId;

        const { data: existing } = await supabase
          .from('ttt_league_stats').select('*')
          .eq('league_id', game.league_id).eq('user_id', playerId)
          .eq('game_mode', game.game_mode).eq('season', season).single();

        if (existing) {
          const u = { updated_at: new Date().toISOString() };
          if (isDraw) u.draws = existing.draws + 1;
          else if (isWinner) u.wins = existing.wins + 1;
          else u.losses = existing.losses + 1;
          await supabase.from('ttt_league_stats').update(u).eq('id', existing.id);
        } else {
          await supabase.from('ttt_league_stats').insert({
            league_id: game.league_id, user_id: playerId, game_mode: game.game_mode, season,
            wins: isWinner ? 1 : 0, losses: isLoser ? 1 : 0, draws: isDraw ? 1 : 0,
          });
        }
      }
    }
  } catch (err) {
    console.error('Failed to record PvP result:', err);
  }
}

// ── Matchmaking / Lobby ──────────────────────────────────
function Lobby({ onJoinGame, leagueId, leagueName }) {
  const { user, profile } = useAuth();
  const [games, setGames] = useState([]);
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState('classic');

  useEffect(() => {
    fetchGames();
    const channel = supabase.channel('lobby')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttt_live_games', filter: 'status=eq.waiting' },
        () => fetchGames())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  async function fetchGames() {
    const { data } = await supabase
      .from('ttt_live_games')
      .select('*, player_x:ttt_profiles!player_x_id(display_name)')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false });
    if (data) setGames(data.filter(g => g.player_x_id !== user?.id));
  }

  async function createGame() {
    setCreating(true);
    const initialBoard = mode === 'classic'
      ? { cells: Array(9).fill(null) }
      : { boards: Array(9).fill(null).map(() => Array(9).fill(null)), bWins: Array(9).fill(null), active: null };

    const { data, error } = await supabase.from('ttt_live_games').insert({
      game_mode: mode,
      player_x_id: user.id,
      board_state: initialBoard,
      current_turn: 'X',
      status: 'waiting',
      last_move_at: new Date().toISOString(),
      ...(leagueId ? { league_id: leagueId } : {}),
    }).select().single();

    if (data) onJoinGame(data);
    setCreating(false);
  }

  async function joinGame(game) {
    const { data, error } = await supabase.from('ttt_live_games')
      .update({ player_o_id: user.id, status: 'active', last_move_at: new Date().toISOString() })
      .eq('id', game.id)
      .eq('status', 'waiting')
      .select()
      .single();
    if (data) onJoinGame(data);
  }

  const modeColors = { classic: 'var(--X)', ultimate: 'var(--O)', mega: 'var(--mega)' };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 30, letterSpacing: 2, color: 'var(--ac)', marginBottom: 20 }}>Live Multiplayer</div>

      {/* League context banner */}
      {leagueId && leagueName && (
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

      {/* Create Game */}
      <div style={{ background: 'var(--sf)', border: '1px solid var(--bd)', borderTop: '3px solid var(--ac)', padding: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--mu)', marginBottom: 12 }}>Create Game</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {['classic', 'ultimate'].map(m => (
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

      {/* Available Games */}
      <div style={{ fontSize: 10, letterSpacing: 3, color: 'var(--ac)', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        Open Games
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
              </div>
              <button className="savebtn" style={{ padding: '6px 16px' }} onClick={() => joinGame(g)}>Join</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Live Classic Game ────────────────────────────────────
function LiveClassicGame({ game, myRole, onUpdate, onLeave }) {
  const { user } = useAuth();
  const [timer, setTimer] = useState(TURN_TIMER);
  const timerRef = useRef(null);

  const cells = game.board_state?.cells || Array(9).fill(null);
  const winner = checkWin(cells);
  const winLine = winner && winner !== 'T' ? getWinLine(cells) : [];
  const isMyTurn = (game.current_turn === 'X' && myRole === 'X') || (game.current_turn === 'O' && myRole === 'O');
  const prob = !winner ? classicProbability(cells, game.current_turn) : { x: 50, o: 50 };

  // Turn timer
  useEffect(() => {
    if (winner || game.status !== 'active') return;
    const lastMove = new Date(game.last_move_at || game.created_at).getTime();
    const elapsed = Math.floor((Date.now() - lastMove) / 1000);
    setTimer(Math.max(0, TURN_TIMER - elapsed));

    timerRef.current = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, TURN_TIMER - Math.floor((now - lastMove) / 1000));
      setTimer(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        // If it's opponent's turn and they timed out, we can claim win
        if (!isMyTurn) handleTimeout();
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [game.last_move_at, game.current_turn, winner, game.status]);

  async function handleTimeout() {
    // The current turn player loses
    const winnerId = game.current_turn === 'X' ? game.player_o_id : game.player_x_id;
    await supabase.from('ttt_live_games').update({
      status: 'finished',
      winner_id: winnerId,
      result: 'timeout',
    }).eq('id', game.id);
  }

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

    await supabase.from('ttt_live_games').update(updates).eq('id', game.id);
  }

  async function requestRematch() {
    if (game.rematch_requested_by && game.rematch_requested_by !== user.id) {
      // Both want rematch - create new game
      const newBoard = { cells: Array(9).fill(null) };
      const { data } = await supabase.from('ttt_live_games').insert({
        game_mode: 'classic',
        player_x_id: game.player_o_id,
        player_o_id: game.player_x_id,
        board_state: newBoard,
        current_turn: 'X',
        status: 'active',
        last_move_at: new Date().toISOString(),
        ...(game.league_id ? { league_id: game.league_id } : {}),
      }).select().single();
      if (data) onUpdate(data);
    } else {
      await supabase.from('ttt_live_games').update({ rematch_requested_by: user.id }).eq('id', game.id);
    }
  }

  const xName = game.player_x_name || 'Player X';
  const oName = game.player_o_name || 'Player O';
  const isFinished = game.status === 'finished' || !!winner;
  const resultText = game.result === 'timeout' ? 'Timeout!'
    : game.result === 'draw' || winner === 'T' ? 'Draw!'
    : (game.winner_id === user.id ? 'You Win!' : 'You Lose!');
  const resultColor = game.result === 'draw' || winner === 'T' ? 'var(--mu)'
    : game.winner_id === user.id ? 'var(--gn)' : 'var(--rd)';
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
          {!isFinished && (
            <span style={{
              fontFamily: "'Bebas Neue',sans-serif", fontSize: 22,
              color: timer <= 5 ? 'var(--rd)' : timer <= 10 ? 'var(--go)' : 'var(--mu)'
            }}>{timer}s</span>
          )}
          <button className="smbtn" onClick={onLeave}>Leave</button>
        </div>
      </div>
      <WinProbabilityBar xPct={prob.x} oPct={prob.o} xName={xName} oName={oName} />
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 18 }}>
          {cells.map((c, i) => (
            <div key={i} onClick={() => play(i)} style={{
              aspectRatio: '1', background: winLine.includes(i) ? (c === 'X' ? 'rgba(232,255,71,0.08)' : 'rgba(71,200,255,0.08)') : 'var(--sf)',
              border: '1px solid ' + (winLine.includes(i) ? (c === 'X' ? 'var(--X)' : 'var(--O)') : 'var(--bd)'),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(38px,9vw,68px)',
              cursor: (!c && isMyTurn && !winner && game.status === 'active') ? 'pointer' : 'default',
              color: c === 'X' ? 'var(--X)' : c === 'O' ? 'var(--O)' : 'transparent', transition: 'all 0.12s'
            }}>{c}</div>
          ))}
        </div>
        {isFinished && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,8,14,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20 }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(28px,7vw,52px)', letterSpacing: 3, color: resultColor }}>
              {resultText}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              {!iRequestedRematch && (
                <button className="savebtn" onClick={requestRematch}>
                  {rematchRequested ? 'Accept Rematch' : 'Request Rematch'}
                </button>
              )}
              {iRequestedRematch && <div style={{ fontSize: 10, color: 'var(--hl)', letterSpacing: 2, textTransform: 'uppercase' }}>Waiting for opponent...</div>}
              <button className="smbtn" onClick={onLeave}>Back to Lobby</button>
            </div>
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
function LiveUltimateGame({ game, myRole, onUpdate, onLeave }) {
  const { user } = useAuth();
  const [timer, setTimer] = useState(TURN_TIMER);
  const timerRef = useRef(null);

  const bs = game.board_state || {};
  const boards = bs.boards || Array(9).fill(null).map(() => Array(9).fill(null));
  const bWins = bs.bWins || Array(9).fill(null);
  const active = bs.active ?? null;
  const winner = checkWin(bWins);
  const isMyTurn = (game.current_turn === 'X' && myRole === 'X') || (game.current_turn === 'O' && myRole === 'O');
  const prob = !winner ? ultimateProbability(boards, bWins, active) : { x: 50, o: 50 };

  useEffect(() => {
    if (winner || game.status !== 'active') return;
    const lastMove = new Date(game.last_move_at || game.created_at).getTime();
    setTimer(Math.max(0, TURN_TIMER - Math.floor((Date.now() - lastMove) / 1000)));
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, TURN_TIMER - Math.floor((Date.now() - lastMove) / 1000));
      setTimer(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        if (!isMyTurn) {
          const winnerId = game.current_turn === 'X' ? game.player_o_id : game.player_x_id;
          supabase.from('ttt_live_games').update({ status: 'finished', winner_id: winnerId, result: 'timeout' }).eq('id', game.id);
        }
      }
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [game.last_move_at, game.current_turn, winner, game.status]);

  async function play(bi, ci) {
    if (!isMyTurn || bWins[bi] || (active !== null && active !== bi) || boards[bi][ci] || winner || game.status !== 'active') return;

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
    }

    await supabase.from('ttt_live_games').update(updates).eq('id', game.id);
  }

  async function requestRematch() {
    if (game.rematch_requested_by && game.rematch_requested_by !== user.id) {
      const newBoard = { boards: Array(9).fill(null).map(() => Array(9).fill(null)), bWins: Array(9).fill(null), active: null };
      const { data } = await supabase.from('ttt_live_games').insert({
        game_mode: 'ultimate', player_x_id: game.player_o_id, player_o_id: game.player_x_id,
        board_state: newBoard, current_turn: 'X', status: 'active', last_move_at: new Date().toISOString(),
        ...(game.league_id ? { league_id: game.league_id } : {}),
      }).select().single();
      if (data) onUpdate(data);
    } else {
      await supabase.from('ttt_live_games').update({ rematch_requested_by: user.id }).eq('id', game.id);
    }
  }

  const xName = game.player_x_name || 'Player X';
  const oName = game.player_o_name || 'Player O';
  const isFinished = game.status === 'finished' || !!winner;
  const resultText = game.result === 'timeout' ? 'Timeout!'
    : game.result === 'draw' || winner === 'T' ? 'Draw!'
    : (game.winner_id === user.id ? 'You Win!' : 'You Lose!');
  const resultColor = game.result === 'draw' || winner === 'T' ? 'var(--mu)' : game.winner_id === user.id ? 'var(--gn)' : 'var(--rd)';
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
          {!isFinished && <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: timer <= 5 ? 'var(--rd)' : timer <= 10 ? 'var(--go)' : 'var(--mu)' }}>{timer}s</span>}
          <button className="smbtn" onClick={onLeave}>Leave</button>
        </div>
      </div>
      <WinProbabilityBar xPct={prob.x} oPct={prob.o} xName={xName} oName={oName} />
      <div style={{ textAlign: 'center', marginBottom: 14, fontSize: 11, letterSpacing: 2, color: 'var(--mu)', textTransform: 'uppercase' }}>
        {!winner && game.status === 'active' && (active === null
          ? <span>Play on <strong style={{ color: 'var(--hl)' }}>any open board</strong></span>
          : <span>Must play on <strong style={{ color: 'var(--hl)' }}>Board {active + 1}</strong></span>)}
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {Array(9).fill(null).map((_, bi) => {
            const bw = bWins[bi];
            const isAct = !winner && game.status === 'active' && (active === null ? !bw : active === bi);
            return (
              <div key={bi} style={{
                border: '2px solid ' + (isAct ? 'var(--hl)' : bw === 'X' ? 'var(--X)' : bw === 'O' ? 'var(--O)' : 'var(--bd)'),
                padding: 5, position: 'relative',
                background: bw === 'X' ? 'rgba(232,255,71,0.06)' : bw === 'O' ? 'rgba(71,200,255,0.06)' : bw === 'T' ? 'var(--s2)' : 'var(--sf)'
              }}>
                {bw && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(32px,7vw,64px)', color: bw === 'X' ? 'var(--X)' : bw === 'O' ? 'var(--O)' : 'var(--mu)', zIndex: 5, pointerEvents: 'none' }}>{bw === 'T' ? '\u2014' : bw}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 3, opacity: bw ? 0.2 : 1 }}>
                  {boards[bi].map((c, ci) => (
                    <div key={ci} onClick={() => play(bi, ci)} style={{
                      aspectRatio: '1', background: 'var(--s2)', border: '1px solid var(--s3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(13px,2.5vw,22px)',
                      cursor: (!c && !bw && isAct && isMyTurn && game.status === 'active') ? 'pointer' : 'default',
                      color: c === 'X' ? 'var(--X)' : c === 'O' ? 'var(--O)' : 'transparent'
                    }}>{c}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {isFinished && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,8,14,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20, zIndex: 20 }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(28px,7vw,52px)', letterSpacing: 3, color: resultColor }}>{resultText}</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              {!iRequestedRematch && <button className="savebtn" onClick={requestRematch}>{rematchRequested ? 'Accept Rematch' : 'Request Rematch'}</button>}
              {iRequestedRematch && <div style={{ fontSize: 10, color: 'var(--hl)', letterSpacing: 2, textTransform: 'uppercase' }}>Waiting for opponent...</div>}
              <button className="smbtn" onClick={onLeave}>Back to Lobby</button>
            </div>
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
function WaitingScreen({ game, onCancel }) {
  return (
    <div style={{ maxWidth: 400, margin: '0 auto', textAlign: 'center', padding: 40 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 2, color: 'var(--ac)', marginBottom: 12 }}>
        Waiting for Opponent
      </div>
      <div className="ai-thinking" style={{ justifyContent: 'center', marginBottom: 20 }}>
        <span>Searching</span><span className="dot" /><span className="dot" /><span className="dot" />
      </div>
      <div style={{ fontSize: 10, letterSpacing: 2, color: 'var(--mu)', textTransform: 'uppercase', marginBottom: 8 }}>
        Game Mode: <span style={{ color: game.game_mode === 'classic' ? 'var(--X)' : 'var(--O)' }}>{game.game_mode}</span>
      </div>
      <div style={{ fontSize: 10, letterSpacing: 1, color: 'var(--mu)', marginBottom: 24 }}>
        Share the lobby link or wait for someone to join.
      </div>
      <button className="smbtn" onClick={onCancel}>Cancel</button>
    </div>
  );
}

// ── Main LiveGame Component ──────────────────────────────
export default function LiveGame({ leagueId, leagueName }) {
  const { user } = useAuth();
  const [currentGame, setCurrentGame] = useState(null);

  // Subscribe to game updates
  useEffect(() => {
    if (!currentGame) return;

    const channel = supabase.channel(`game-${currentGame.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ttt_live_games', filter: `id=eq.${currentGame.id}` },
        payload => {
          const updated = payload.new;
          setCurrentGame(prev => ({ ...prev, ...updated }));
          // Record PvP result: global ELO + league stats (if applicable)
          if (updated.status === 'finished' && updated.result && updated.player_o_id) {
            handlePvPGameFinished(updated, user.id);
          }
        })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentGame?.id]);

  // Fetch player names when game starts
  useEffect(() => {
    if (!currentGame || currentGame.player_x_name) return;
    async function fetchNames() {
      const ids = [currentGame.player_x_id, currentGame.player_o_id].filter(Boolean);
      if (ids.length === 0) return;
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

  // Check for active games on mount
  useEffect(() => {
    if (!user) return;
    async function checkActive() {
      const { data } = await supabase
        .from('ttt_live_games')
        .select('*')
        .or(`player_x_id.eq.${user.id},player_o_id.eq.${user.id}`)
        .in('status', ['waiting', 'active'])
        .order('created_at', { ascending: false })
        .limit(1);
      if (data?.[0]) setCurrentGame(data[0]);
    }
    checkActive();
  }, [user]);

  async function handleLeave() {
    if (currentGame) {
      if (currentGame.status === 'waiting') {
        await supabase.from('ttt_live_games').delete().eq('id', currentGame.id);
      } else if (currentGame.status === 'active') {
        const winnerId = currentGame.player_x_id === user.id ? currentGame.player_o_id : currentGame.player_x_id;
        await supabase.from('ttt_live_games').update({
          status: 'finished', winner_id: winnerId, result: 'abandoned'
        }).eq('id', currentGame.id);
      }
    }
    setCurrentGame(null);
  }

  if (!user) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: 'var(--ac)', marginBottom: 10 }}>Live Multiplayer</div>
      <div style={{ fontSize: 11, color: 'var(--mu)', letterSpacing: 1.5 }}>Sign in to play live games.</div>
    </div>
  );

  if (!currentGame) return <Lobby onJoinGame={setCurrentGame} leagueId={leagueId} leagueName={leagueName} />;
  if (currentGame.status === 'waiting') return <WaitingScreen game={currentGame} onCancel={handleLeave} />;

  const myRole = currentGame.player_x_id === user.id ? 'X' : 'O';

  if (currentGame.game_mode === 'ultimate') {
    return <LiveUltimateGame game={currentGame} myRole={myRole} onUpdate={setCurrentGame} onLeave={handleLeave} />;
  }

  return <LiveClassicGame game={currentGame} myRole={myRole} onUpdate={setCurrentGame} onLeave={handleLeave} />;
}
