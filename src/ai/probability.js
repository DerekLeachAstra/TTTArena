import { WIN_LINES, checkWin } from '../lib/gameLogic';

// ─── Classic: Exact minimax probability ────────────────────

function classicMinimaxProb(cells, turn, memo = new Map()) {
  const key = cells.join(',') + turn;
  if (memo.has(key)) return memo.get(key);

  const w = checkWin(cells);
  if (w === 'X') { memo.set(key, { x: 1, o: 0, d: 0 }); return { x: 1, o: 0, d: 0 }; }
  if (w === 'O') { memo.set(key, { x: 0, o: 1, d: 0 }); return { x: 0, o: 1, d: 0 }; }
  if (w === 'T') { memo.set(key, { x: 0, o: 0, d: 1 }); return { x: 0, o: 0, d: 1 }; }

  const moves = [];
  for (let i = 0; i < 9; i++) if (!cells[i]) moves.push(i);

  let bestResult = null;
  for (const i of moves) {
    const next = [...cells];
    next[i] = turn;
    const result = classicMinimaxProb(next, turn === 'X' ? 'O' : 'X', memo);
    if (!bestResult) {
      bestResult = result;
    } else if (turn === 'X') {
      if (result.x > bestResult.x || (result.x === bestResult.x && result.d > bestResult.d)) {
        bestResult = result;
      }
    } else {
      if (result.o > bestResult.o || (result.o === bestResult.o && result.d > bestResult.d)) {
        bestResult = result;
      }
    }
  }

  memo.set(key, bestResult);
  return bestResult;
}

export function classicProbability(cells, turn) {
  const w = checkWin(cells);
  if (w === 'X') return { x: 100, o: 0 };
  if (w === 'O') return { x: 0, o: 100 };
  if (w === 'T') return { x: 50, o: 50 };

  const result = classicMinimaxProb([...cells], turn);
  const total = result.x + result.o + result.d;
  if (total === 0) return { x: 50, o: 50 };
  const xPct = ((result.x + result.d * 0.5) / total) * 100;
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
      xScore += countSetups(boards[i], 'X') * BOARD_WEIGHTS[i] * 0.3;
      oScore += countSetups(boards[i], 'O') * BOARD_WEIGHTS[i] * 0.3;
    }
  }

  // Meta-board line threats
  xScore += countSetups(bWins, 'X') * 8;
  oScore += countSetups(bWins, 'O') * 8;

  // Active board disadvantage
  if (active !== null) {
    // Being forced to a specific board is slight disadvantage
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
      // Small board wins within mid-boards
      for (let si = 0; si < 9; si++) {
        if (smallW[mi][si] === 'X') xScore += 2 * BOARD_WEIGHTS[si] * BOARD_WEIGHTS[mi] * 0.1;
        else if (smallW[mi][si] === 'O') oScore += 2 * BOARD_WEIGHTS[si] * BOARD_WEIGHTS[mi] * 0.1;
      }
      xScore += countSetups(smallW[mi], 'X') * BOARD_WEIGHTS[mi] * 0.5;
      oScore += countSetups(smallW[mi], 'O') * BOARD_WEIGHTS[mi] * 0.5;
    }
  }

  // Meta threats
  xScore += countSetups(midW, 'X') * 12;
  oScore += countSetups(midW, 'O') * 12;

  const total = xScore + oScore;
  if (total === 0) return { x: 50, o: 50 };
  const xPct = Math.min(95, Math.max(5, (xScore / total) * 100));
  return { x: Math.round(xPct), o: Math.round(100 - xPct) };
}
