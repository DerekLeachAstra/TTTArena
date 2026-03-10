import { WIN_LINES, checkWin, getValidMoves } from '../lib/gameLogic';

// ─── CLASSIC AI ────────────────────────────────────────────

function classicMinimax(cells, isMax, alpha, beta, depth) {
  const w = checkWin(cells);
  if (w === 'X') return -10 + depth;
  if (w === 'O') return 10 - depth;
  if (w === 'T') return 0;

  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (cells[i]) continue;
      cells[i] = 'O';
      best = Math.max(best, classicMinimax(cells, false, alpha, beta, depth + 1));
      cells[i] = null;
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (cells[i]) continue;
      cells[i] = 'X';
      best = Math.min(best, classicMinimax(cells, true, alpha, beta, depth + 1));
      cells[i] = null;
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

function findWinningMove(cells, player) {
  for (const [a, b, c] of WIN_LINES) {
    const line = [cells[a], cells[b], cells[c]];
    const count = line.filter(x => x === player).length;
    const empty = line.filter(x => x === null).length;
    if (count === 2 && empty === 1) {
      if (!cells[a]) return a;
      if (!cells[b]) return b;
      if (!cells[c]) return c;
    }
  }
  return -1;
}

export function classicAI(cells, turn, difficulty) {
  const valid = getValidMoves(cells);
  if (valid.length === 0) return -1;

  if (difficulty === 'easy') {
    return valid[Math.floor(Math.random() * valid.length)];
  }

  if (difficulty === 'medium') {
    const win = findWinningMove(cells, turn);
    if (win >= 0) return win;
    const opp = turn === 'X' ? 'O' : 'X';
    const block = findWinningMove(cells, opp);
    if (block >= 0) return block;
    return valid[Math.floor(Math.random() * valid.length)];
  }

  // hard & unbeatable: minimax
  const isO = turn === 'O';
  let bestScore = isO ? -Infinity : Infinity;
  let bestMove = valid[0];

  for (const i of valid) {
    const copy = [...cells];
    copy[i] = turn;
    const s = classicMinimax(copy, !isO, -Infinity, Infinity, 0);
    if (isO ? s > bestScore : s < bestScore) {
      bestScore = s;
      bestMove = i;
    }
  }
  return bestMove;
}

// ─── ULTIMATE AI ───────────────────────────────────────────

const BOARD_WEIGHTS = [2, 1, 2, 1, 3, 1, 2, 1, 2]; // center=3, corner=2, edge=1
const CELL_WEIGHTS = [1.2, 1, 1.2, 1, 1.5, 1, 1.2, 1, 1.2];

function countLineThreats(cells, player) {
  let score = 0;
  for (const [a, b, c] of WIN_LINES) {
    const line = [cells[a], cells[b], cells[c]];
    const mine = line.filter(x => x === player).length;
    const empty = line.filter(x => x === null).length;
    if (mine === 2 && empty === 1) score += 5;
    else if (mine === 1 && empty === 2) score += 1;
  }
  return score;
}

function evalUltimateBoard(boards, bWins, turn) {
  const opp = turn === 'X' ? 'O' : 'X';
  let sc = 0;

  // Board wins
  for (let i = 0; i < 9; i++) {
    if (bWins[i] === turn) sc += 10 * BOARD_WEIGHTS[i];
    else if (bWins[i] === opp) sc -= 10 * BOARD_WEIGHTS[i];
    else if (bWins[i] === 'T') continue;
    else {
      sc += countLineThreats(boards[i], turn) * BOARD_WEIGHTS[i] * 0.3;
      sc -= countLineThreats(boards[i], opp) * BOARD_WEIGHTS[i] * 0.3;
    }
  }

  // Meta-board line threats
  sc += countLineThreats(bWins, turn) * 8;
  sc -= countLineThreats(bWins, opp) * 8;

  // Check for meta win
  const mw = checkWin(bWins);
  if (mw === turn) sc += 1000;
  else if (mw === opp) sc -= 1000;

  return sc;
}

function getUltimateMoves(boards, bWins, active) {
  const moves = [];
  const boardsToCheck = active !== null ? [active] : Array.from({ length: 9 }, (_, i) => i);
  for (const bi of boardsToCheck) {
    if (bWins[bi]) continue;
    for (let ci = 0; ci < 9; ci++) {
      if (!boards[bi][ci]) moves.push([bi, ci]);
    }
  }
  return moves;
}

export function ultimateAI(boards, bWins, active, turn, difficulty) {
  const moves = getUltimateMoves(boards, bWins, active);
  if (moves.length === 0) return null;

  if (difficulty === 'easy') {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  if (difficulty === 'medium') {
    // Try to win a board
    for (const [bi, ci] of moves) {
      const testBoard = [...boards[bi]];
      testBoard[ci] = turn;
      if (checkWin(testBoard) === turn) return [bi, ci];
    }
    // Block opponent winning a board
    const opp = turn === 'X' ? 'O' : 'X';
    for (const [bi, ci] of moves) {
      const testBoard = [...boards[bi]];
      testBoard[ci] = opp;
      if (checkWin(testBoard) === opp) return [bi, ci];
    }
    return moves[Math.floor(Math.random() * moves.length)];
  }

  // hard & unbeatable: heuristic evaluation with lookahead
  let bestScore = -Infinity;
  let bestMoves = [moves[0]];
  const depth = difficulty === 'unbeatable' ? 2 : 1;

  for (const [bi, ci] of moves) {
    const nb = boards.map((b, i) => i === bi ? b.map((c, j) => j === ci ? turn : c) : [...b]);
    const nw = bWins.map((w, i) => i === bi && !w ? checkWin(nb[i]) : w);

    let sc = evalUltimateBoard(nb, nw, turn);

    // Positional bonus
    sc += CELL_WEIGHTS[ci] * BOARD_WEIGHTS[bi] * 0.5;

    // Sending opponent to won/full board = good (they get free choice... which is bad for us)
    // Actually sending to won board gives opponent any board - that's bad for us
    if (nw[ci]) sc -= 3;

    // Lookahead
    if (depth >= 2 && !checkWin(nw)) {
      const opp = turn === 'X' ? 'O' : 'X';
      const nextActive = nw[ci] ? null : ci;
      const oppMoves = getUltimateMoves(nb, nw, nextActive);
      let worstOpp = Infinity;
      for (const [obi, oci] of oppMoves.slice(0, 15)) {
        const ob = nb.map((b, i) => i === obi ? b.map((c, j) => j === oci ? opp : c) : [...b]);
        const ow = nw.map((w, i) => i === obi && !w ? checkWin(ob[i]) : w);
        worstOpp = Math.min(worstOpp, evalUltimateBoard(ob, ow, turn));
      }
      if (oppMoves.length > 0) sc = sc * 0.4 + worstOpp * 0.6;
    }

    if (sc > bestScore) {
      bestScore = sc;
      bestMoves = [[bi, ci]];
    } else if (sc === bestScore) {
      bestMoves.push([bi, ci]);
    }
  }

  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

// ─── MEGA AI ───────────────────────────────────────────────

function evalMegaBoard(smallW, midW, turn) {
  const opp = turn === 'X' ? 'O' : 'X';
  let sc = 0;

  // Mid-board wins
  for (let mi = 0; mi < 9; mi++) {
    if (midW[mi] === turn) sc += 15 * BOARD_WEIGHTS[mi];
    else if (midW[mi] === opp) sc -= 15 * BOARD_WEIGHTS[mi];
    else if (midW[mi] !== 'T') {
      // Small board wins within this mid-board
      for (let si = 0; si < 9; si++) {
        if (smallW[mi][si] === turn) sc += 2 * BOARD_WEIGHTS[si];
        else if (smallW[mi][si] === opp) sc -= 2 * BOARD_WEIGHTS[si];
      }
      sc += countLineThreats(smallW[mi], turn) * BOARD_WEIGHTS[mi] * 0.4;
      sc -= countLineThreats(smallW[mi], opp) * BOARD_WEIGHTS[mi] * 0.4;
    }
  }

  // Meta-board threats
  sc += countLineThreats(midW, turn) * 12;
  sc -= countLineThreats(midW, opp) * 12;

  const mw = checkWin(midW);
  if (mw === turn) sc += 1000;
  else if (mw === opp) sc -= 1000;

  return sc;
}

function getMegaMoves(cells, smallW, midW, aMid, aSmall) {
  const moves = [];
  for (let mi = 0; mi < 9; mi++) {
    if (midW[mi]) continue;
    if (aMid !== null && aMid !== mi) continue;
    for (let si = 0; si < 9; si++) {
      if (smallW[mi][si]) continue;
      if (aMid === mi && aSmall !== null && aSmall !== si) continue;
      for (let ci = 0; ci < 9; ci++) {
        if (!cells[mi][si][ci]) moves.push([mi, si, ci]);
      }
    }
  }
  return moves;
}

export function megaAI(cells, smallW, midW, aMid, aSmall, turn, difficulty) {
  const moves = getMegaMoves(cells, smallW, midW, aMid, aSmall);
  if (moves.length === 0) return null;

  if (difficulty === 'easy') {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  if (difficulty === 'medium') {
    // Try winning a small board
    for (const [mi, si, ci] of moves) {
      const testCells = [...cells[mi][si]];
      testCells[ci] = turn;
      if (checkWin(testCells) === turn) {
        // Check if this also wins the mid-board
        const testSmall = [...smallW[mi]];
        testSmall[si] = turn;
        if (checkWin(testSmall) === turn) return [mi, si, ci]; // Wins mid-board!
        return [mi, si, ci];
      }
    }
    // Block opponent winning a small board
    const opp = turn === 'X' ? 'O' : 'X';
    for (const [mi, si, ci] of moves) {
      const testCells = [...cells[mi][si]];
      testCells[ci] = opp;
      if (checkWin(testCells) === opp) return [mi, si, ci];
    }
    return moves[Math.floor(Math.random() * moves.length)];
  }

  // hard & unbeatable: heuristic with limited evaluation
  let bestScore = -Infinity;
  let bestMoves = [moves[0]];
  const sampleSize = difficulty === 'unbeatable' ? moves.length : Math.min(moves.length, 40);
  const sampled = moves.length <= sampleSize ? moves : moves.sort(() => Math.random() - 0.5).slice(0, sampleSize);

  for (const [mi, si, ci] of sampled) {
    const nc = cells.map((m, m2) => m.map((s, s2) => (m2 === mi && s2 === si) ? s.map((c, c2) => c2 === ci ? turn : c) : [...s]));
    const nsw = smallW.map((m, m2) => m.map((w, s2) => (m2 === mi && s2 === si && !w) ? checkWin(nc[m2][s2]) : w));
    const nmw = midW.map((w, m2) => (m2 === mi && !w) ? checkWin(nsw[m2]) : w);

    let sc = evalMegaBoard(nsw, nmw, turn);

    // Positional bonus
    sc += CELL_WEIGHTS[ci] * BOARD_WEIGHTS[si] * BOARD_WEIGHTS[mi] * 0.1;

    // Immediate wins are highly valued
    if (checkWin(nc[mi][si]) === turn) sc += 8 * BOARD_WEIGHTS[si];
    if (checkWin(nsw[mi]) === turn) sc += 25 * BOARD_WEIGHTS[mi];
    if (checkWin(nmw) === turn) sc += 1000;

    if (sc > bestScore) {
      bestScore = sc;
      bestMoves = [[mi, si, ci]];
    } else if (sc === bestScore) {
      bestMoves.push([mi, si, ci]);
    }
  }

  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

// ─── Unified AI interface ──────────────────────────────────

export function getAIMove(mode, gameState, turn, difficulty) {
  return new Promise(resolve => {
    const delay = 400 + Math.random() * 400;
    setTimeout(() => {
      if (mode === 'classic') {
        resolve(classicAI(gameState.cells, turn, difficulty));
      } else if (mode === 'ultimate') {
        resolve(ultimateAI(gameState.boards, gameState.bWins, gameState.active, turn, difficulty));
      } else if (mode === 'mega') {
        resolve(megaAI(gameState.cells, gameState.smallW, gameState.midW, gameState.aMid, gameState.aSmall, turn, difficulty));
      }
    }, delay);
  });
}
