import { WIN_LINES, checkWin } from '../lib/gameLogic';

// ─── Classic: Improved minimax probability ────────────────────

// Returns { wins, losses, draws } counts over ALL possible game continuations
function classicCountOutcomes(cells, turn, memo = new Map()) {
  const key = cells.join(',') + turn;
  if (memo.has(key)) return memo.get(key);

  const w = checkWin(cells);
  if (w === 'X') { const r = { xWins: 1, oWins: 0, draws: 0 }; memo.set(key, r); return r; }
  if (w === 'O') { const r = { xWins: 0, oWins: 1, draws: 0 }; memo.set(key, r); return r; }
  if (w === 'T') { const r = { xWins: 0, oWins: 0, draws: 1 }; memo.set(key, r); return r; }

  const moves = [];
  for (let i = 0; i < 9; i++) if (!cells[i]) moves.push(i);

  let totalX = 0, totalO = 0, totalD = 0;
  for (const i of moves) {
    const next = [...cells];
    next[i] = turn;
    const result = classicCountOutcomes(next, turn === 'X' ? 'O' : 'X', memo);
    totalX += result.xWins;
    totalO += result.oWins;
    totalD += result.draws;
  }

  const r = { xWins: totalX, oWins: totalO, draws: totalD };
  memo.set(key, r);
  return r;
}

// Check if the current player can win on this move
function hasImmediateWin(cells, player) {
  for (let i = 0; i < 9; i++) {
    if (cells[i]) continue;
    const test = [...cells];
    test[i] = player;
    if (checkWin(test) === player) return true;
  }
  return false;
}

export function classicProbability(cells, turn) {
  const w = checkWin(cells);
  if (w === 'X') return { x: 100, o: 0 };
  if (w === 'O') return { x: 0, o: 100 };
  if (w === 'T') return { x: 50, o: 50 };

  // If current player can win immediately, show near-certain win
  if (hasImmediateWin(cells, turn)) {
    return turn === 'X' ? { x: 99, o: 1 } : { x: 1, o: 99 };
  }

  // Count all possible outcomes from this position
  const result = classicCountOutcomes([...cells], turn);
  const total = result.xWins + result.oWins + result.draws;
  if (total === 0) return { x: 50, o: 50 };

  // Weight: wins count full, draws count half
  const xPct = ((result.xWins + result.draws * 0.5) / total) * 100;
  return { x: Math.round(xPct), o: Math.round(100 - xPct) };
}

// ─── Ultimate: Heuristic probability ───────────────────────

const BOARD_WEIGHTS = [2, 1, 2, 1, 3, 1, 2, 1, 2];

function countSetups(cells, player) {
  let count = 0;
  for (const [a, b, c] of WIN_LINES) {
    const line = [cells[a], cells[b], cells[c]];
    const mine = line.filter(x => x === player).length;
    const empty = line.filter(x => x === null).length;
    if (mine === 2 && empty === 1) count += 3;
    else if (mine === 1 && empty === 2) count += 1;
  }
  return count;
}

// Check if player has a meta-board winning threat (2 in a row with 1 empty on meta)
function hasMetaWinThreat(bWins, player) {
  for (const [a, b, c] of WIN_LINES) {
    const line = [bWins[a], bWins[b], bWins[c]];
    const mine = line.filter(x => x === player).length;
    const open = line.filter(x => x === null).length;
    if (mine === 2 && open === 1) return true;
  }
  return false;
}

export function ultimateProbability(boards, bWins, active) {
  const mw = checkWin(bWins);
  if (mw === 'X') return { x: 100, o: 0 };
  if (mw === 'O') return { x: 0, o: 100 };
  if (mw === 'T') return { x: 50, o: 50 };

  let xScore = 0, oScore = 0;

  // Board wins (heavily weighted)
  for (let i = 0; i < 9; i++) {
    if (bWins[i] === 'X') xScore += 10 * BOARD_WEIGHTS[i];
    else if (bWins[i] === 'O') oScore += 10 * BOARD_WEIGHTS[i];
    else if (bWins[i] !== 'T' && boards) {
      // Check for immediate sub-board wins
      if (hasImmediateWin(boards[i], 'X')) xScore += 6 * BOARD_WEIGHTS[i];
      if (hasImmediateWin(boards[i], 'O')) oScore += 6 * BOARD_WEIGHTS[i];
      xScore += countSetups(boards[i], 'X') * BOARD_WEIGHTS[i] * 0.3;
      oScore += countSetups(boards[i], 'O') * BOARD_WEIGHTS[i] * 0.3;
    }
  }

  // Meta-board line threats (very important — close to winning the game)
  const xMetaThreat = hasMetaWinThreat(bWins, 'X');
  const oMetaThreat = hasMetaWinThreat(bWins, 'O');
  xScore += countSetups(bWins, 'X') * 12;
  oScore += countSetups(bWins, 'O') * 12;

  // Bonus for having a meta-winning threat with sub-board advantage
  if (xMetaThreat) xScore += 20;
  if (oMetaThreat) oScore += 20;

  // Active board disadvantage
  if (active !== null) {
    oScore += 1;
  }

  const total = xScore + oScore;
  if (total === 0) return { x: 50, o: 50 };
  const xPct = Math.min(95, Math.max(5, (xScore / total) * 100));
  return { x: Math.round(xPct), o: Math.round(100 - xPct) };
}

// ─── MEGA: Three-layer heuristic ───────────────────────────

export function megaProbability(smallW, midW) {
  const mw = checkWin(midW);
  if (mw === 'X') return { x: 100, o: 0 };
  if (mw === 'O') return { x: 0, o: 100 };
  if (mw === 'T') return { x: 50, o: 50 };

  let xScore = 0, oScore = 0;

  // Mid-board wins (top priority)
  for (let mi = 0; mi < 9; mi++) {
    if (midW[mi] === 'X') xScore += 15 * BOARD_WEIGHTS[mi];
    else if (midW[mi] === 'O') oScore += 15 * BOARD_WEIGHTS[mi];
    else if (midW[mi] !== 'T') {
      // Sub-board wins within mid-boards
      for (let si = 0; si < 9; si++) {
        if (smallW[mi][si] === 'X') xScore += 2 * BOARD_WEIGHTS[si] * BOARD_WEIGHTS[mi] * 0.1;
        else if (smallW[mi][si] === 'O') oScore += 2 * BOARD_WEIGHTS[si] * BOARD_WEIGHTS[mi] * 0.1;
      }
      // Check for immediate mid-board sub-wins
      if (hasImmediateWin(smallW[mi], 'X')) xScore += 8 * BOARD_WEIGHTS[mi];
      if (hasImmediateWin(smallW[mi], 'O')) oScore += 8 * BOARD_WEIGHTS[mi];
      xScore += countSetups(smallW[mi], 'X') * BOARD_WEIGHTS[mi] * 0.5;
      oScore += countSetups(smallW[mi], 'O') * BOARD_WEIGHTS[mi] * 0.5;
    }
  }

  // Meta threats
  const xMetaThreat = hasMetaWinThreat(midW, 'X');
  const oMetaThreat = hasMetaWinThreat(midW, 'O');
  xScore += countSetups(midW, 'X') * 12;
  oScore += countSetups(midW, 'O') * 12;

  if (xMetaThreat) xScore += 25;
  if (oMetaThreat) oScore += 25;

  const total = xScore + oScore;
  if (total === 0) return { x: 50, o: 50 };
  const xPct = Math.min(95, Math.max(5, (xScore / total) * 100));
  return { x: Math.round(xPct), o: Math.round(100 - xPct) };
}
